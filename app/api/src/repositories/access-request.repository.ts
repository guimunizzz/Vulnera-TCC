/**
 * Persistência de pedidos e trilha anônima. Criação e transição gravam histórico
 * atomicamente. Consumido pelos services internos de acesso, ainda sem endpoints.
 * O índice UNIQUE + CHECKs da migration, e não uma consulta prévia, arbitra criação.
 */
import {
  ACCESS_REQUEST_RESERVED_STATUSES, accessRequestDeadline,
  normalizeAccessRequestEmail,
  type AccessRequest, type AccessRequestEvent, type AccessRequestTransitionDTO,
  type CreateAccessRequestDTO,
} from "../models/access-request.model";
import type { EmailVerificationEventType } from "../models/email-verification.model";
import type { AccessInvitationAuditAction } from "../models/access-invitation.model";
import { AccessInvitationRepository } from "./access-invitation.repository";
import { EmailVerificationTokenRepository } from "./email-verification-token.repository";
import { inAccessTransaction, lockAccessRequest, type AccessDatabaseClient } from "./access-transaction.repository";

export type AccessRepositories = {
  requests: AccessRequestRepository;
  verificationTokens: EmailVerificationTokenRepository;
  invitations: AccessInvitationRepository;
};

export class AccessRequestRepository {
  constructor(private readonly prisma: AccessDatabaseClient) {}

  /** Reutiliza a transação existente; Prisma fica encapsulado nos repositories. */
  transaction<T>(operation: (repositories: AccessRepositories) => Promise<T>): Promise<T> {
    return inAccessTransaction(this.prisma, client => operation({
      requests: new AccessRequestRepository(client),
      verificationTokens: new EmailVerificationTokenRepository(client),
      invitations: new AccessInvitationRepository(client),
    }));
  }

  /** Reabre a operação inteira após deadlock ou colisão do índice ativo. */
  transactionWithRetry<T>(
    operation: (repositories: AccessRepositories) => Promise<T>,
    retryUniqueConflict = true,
  ): Promise<T> {
    return retryPublicTransaction(() => this.transaction(operation), retryUniqueConflict);
  }

  /** Consulta com a collation real de User.email, sem aproximá-la em JavaScript. */
  async existsUserByEmail(email: string): Promise<boolean> {
    const normalized = normalizeAccessRequestEmail(email);
    return (await this.prisma.user.findUnique({ where: { email: normalized }, select: { id: true } })) !== null;
  }

  createIfEmailAvailable(dto: CreateAccessRequestDTO, now: Date = new Date()): Promise<AccessRequest | null> {
    const email = normalizeAccessRequestEmail(dto.email);
    return this.transaction(async ({ requests }) => {
      // A comparação usa a collation de User.email, sem replicar UCA em JavaScript.
      const existingUser = await requests.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser) return null;
      return requests.prisma.accessRequest.create({
        data: {
          name: dto.name, email, activeEmail: email,
          companyName: dto.companyName, phone: dto.phone ?? null,
          createdAt: now, updatedAt: now,
          expiresAt: accessRequestDeadline("PENDING_EMAIL_VERIFICATION", now),
          events: { create: { toStatus: "PENDING_EMAIL_VERIFICATION", createdAt: now } },
        },
      });
    });
  }

  findExpiredReservations(now: Date, limit = 100): Promise<AccessRequest[]> {
    return this.prisma.accessRequest.findMany({
      where: { status: { in: [...ACCESS_REQUEST_RESERVED_STATUSES] }, expiresAt: { lte: now } },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: limit,
    });
  }

  findById(id: string): Promise<AccessRequest | null> {
    return this.prisma.accessRequest.findUnique({ where: { id } });
  }

  /** A leitura bloqueante só pode ser chamada pelo escopo de transaction. */
  async findByIdForUpdate(id: string): Promise<AccessRequest | null> {
    if ("$transaction" in this.prisma) {
      throw new Error("ACCESS_REQUEST_LOCK_REQUIRES_TRANSACTION");
    }
    return lockAccessRequest(this.prisma, id);
  }

  findActiveByEmail(email: string): Promise<AccessRequest | null> {
    return this.prisma.accessRequest.findUnique({ where: { activeEmail: normalizeAccessRequestEmail(email) } });
  }

  /** A leitura por e-mail com lock só pode ocorrer dentro da transação. */
  async findActiveByEmailForUpdate(email: string): Promise<AccessRequest | null> {
    if ("$transaction" in this.prisma) {
      throw new Error("ACCESS_REQUEST_LOCK_REQUIRES_TRANSACTION");
    }
    const normalized = normalizeAccessRequestEmail(email);
    const rows = await this.prisma.$queryRaw<AccessRequest[]>`
      SELECT * FROM AccessRequest WHERE activeEmail = ${normalized} FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  findHistoryByEmail(email: string): Promise<AccessRequest[]> {
    return this.prisma.accessRequest.findMany({
      where: { email: normalizeAccessRequestEmail(email) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  findEvents(accessRequestId: string): Promise<AccessRequestEvent[]> {
    return this.prisma.accessRequestEvent.findMany({
      where: { accessRequestId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  /** Registra evento genérico de verificação junto à escrita do mesmo tx. */
  async createVerificationEvent(
    accessRequestId: string,
    eventType: EmailVerificationEventType,
    createdAt: Date,
  ): Promise<AccessRequestEvent> {
    if ("$transaction" in this.prisma) {
      throw new Error("ACCESS_REQUEST_EVENT_REQUIRES_TRANSACTION");
    }
    return this.prisma.accessRequestEvent.create({
      data: {
        accessRequestId,
        eventType,
        fromStatus: "PENDING_EMAIL_VERIFICATION",
        toStatus: "PENDING_EMAIL_VERIFICATION",
        actorId: null,
        reason: null,
        createdAt,
      },
    });
  }

  /** Mantém a auditoria de convite no AuditLog sem alargar o CHECK de eventos anônimos. */
  async createInvitationAuditEvent(
    accessRequestId: string,
    action: AccessInvitationAuditAction,
    actorId: string,
    now: Date,
  ): Promise<void> {
    if ("$transaction" in this.prisma) {
      throw new Error("ACCESS_INVITATION_AUDIT_REQUIRES_TRANSACTION");
    }
    await this.prisma.auditLog.create({
      data: {
        actorId,
        companyId: null,
        entityType: "AccessRequest",
        entityId: accessRequestId,
        action,
        diffJson: null,
        createdAt: now,
      },
    });
  }

  /** DTO vem de AccessRequestEntity; não é uma API de update arbitrário. */
  transitionIfCurrent(id: string, transition: AccessRequestTransitionDTO): Promise<boolean> {
    return this.transaction(async ({ requests }) => {
      const { fromStatus, toStatus, actorId, reason, occurredAt, expectedExpiresAt, expiresAt } = transition;
      // Mesmo lock e mesma ordem usados por todos os caminhos de token.
      if (!await lockAccessRequest(requests.prisma, id)) return false;
      const review = toStatus === "APPROVED" || toStatus === "REJECTED";
      const terminal = toStatus === "REJECTED" || toStatus === "EXPIRED" || toStatus === "ACTIVATED";
      const result = await requests.prisma.accessRequest.updateMany({
        where: {
          id, status: fromStatus,
          expiresAt: { equals: expectedExpiresAt, ...(toStatus === "EXPIRED" ? { lte: occurredAt } : { gt: occurredAt }) },
        },
        data: {
          status: toStatus, expiresAt, updatedAt: occurredAt,
          ...(terminal ? { activeEmail: null } : {}),
          ...(toStatus === "PENDING_REVIEW" ? { emailVerifiedAt: occurredAt } : {}),
          ...(review ? {
            reviewedById: actorId, reviewedAt: occurredAt,
            rejectionReason: toStatus === "REJECTED" ? reason : null,
          } : {}),
        },
      });
      if (result.count !== 1) return false;
      if (terminal) {
        // Consumo já confirmado é mantido; os demais segredos do pedido encerrado são revogados.
        const where = { accessRequestId: id, usedAt: null, revokedAt: null };
        await requests.prisma.emailVerificationToken.updateMany({ where, data: { revokedAt: occurredAt } });
        await requests.prisma.accessInvitation.updateMany({ where, data: { revokedAt: occurredAt } });
      }
      await requests.prisma.accessRequestEvent.create({
        data: { accessRequestId: id, fromStatus, toStatus, actorId, reason, createdAt: occurredAt },
      });
      return true;
    });
  }
}

async function retryPublicTransaction<T>(
  operation: () => Promise<T>,
  retryUniqueConflict = true,
): Promise<T> {
  const maxAttempts = 3;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryablePublicWrite(error, retryUniqueConflict)) throw error;
    }
  }
}

function isRetryablePublicWrite(error: unknown, retryUniqueConflict: boolean): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown; errno?: unknown } };
  if (candidate.code === "P2034" || (retryUniqueConflict && candidate.code === "P2002")) return true;
  const databaseCode = String(candidate.meta?.code ?? candidate.meta?.errno ?? "");
  return candidate.code === "P2010" && ["1213", "1205", "40001"].includes(databaseCode);
}
