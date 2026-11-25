/**
 * Persistência e transações do convite de equipe.
 * Este é o único arquivo novo que toca Prisma; locks seguem Company → Users → Invitation.
 * O service usa as primitivas condicionais para impedir replay e rotação perdida.
 */
import type { CompanyInvitation } from "../models/company-invitation.model";
import type { AccessDatabaseClient } from "./access-transaction.repository";
import { UserRepository } from "./user.repository";
import { RefreshTokenRepository } from "./refresh-token.repository";
import { TenantLockRepository } from "./tenant-lock.repository";

export type CompanyInvitationTransaction = {
  invitations: CompanyInvitationRepository;
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
};

export type CompanyInvitationCreateData = {
  companyId: string;
  issuerId: string;
  name: string;
  email: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
};

export type CompanyMemberRow = {
  id: string;
  name: string;
  email: string;
  companyRole: string | null;
  createdAt: Date;
};

export class CompanyInvitationRepository {
  constructor(private readonly prisma: AccessDatabaseClient) {}

  async transactionWithRetry<T>(operation: (repositories: CompanyInvitationTransaction) => Promise<T>): Promise<T> {
    if (!("$transaction" in this.prisma)) throw new Error("COMPANY_INVITATION_TRANSACTION_REQUIRED");

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(async tx => operation({
          invitations: new CompanyInvitationRepository(tx),
          users: new UserRepository(tx),
          refreshTokens: new RefreshTokenRepository(tx),
        }));
      } catch (error) {
        if (attempt >= 2 || !isRetryableTransactionError(error)) throw error;
        await delay(15 * (attempt + 1));
      }
    }
  }

  findByHash(tokenHash: string): Promise<CompanyInvitation | null> {
    return this.prisma.companyInvitation.findUnique({ where: { tokenHash } });
  }

  findByIdInCompany(companyId: string, id: string): Promise<CompanyInvitation | null> {
    return this.prisma.companyInvitation.findFirst({ where: { id, companyId } });
  }

  listByCompany(companyId: string): Promise<CompanyInvitation[]> {
    return this.prisma.companyInvitation.findMany({
      where: { companyId },
      orderBy: { issuedAt: "desc" },
    });
  }

  listHistory(companyId: string): Promise<Array<{
    id: string;
    entityId: string;
    action: string;
    diffJson: string | null;
    createdAt: Date;
    actor: { name: string };
  }>> {
    return this.prisma.auditLog.findMany({
      where: { companyId, entityType: "CompanyInvitation" },
      select: {
        id: true,
        entityId: true,
        action: true,
        diffJson: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  listActiveMembers(companyId: string): Promise<CompanyMemberRow[]> {
    return this.prisma.user.findMany({
      where: { companyId, role: "CLIENT", companyRole: { in: ["OWNER", "MEMBER"] }, deactivatedAt: null },
      select: { id: true, name: true, email: true, companyRole: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async lockCompany(companyId: string): Promise<{ id: string; name: string } | null> {
    this.assertTransactionClient();
    const locked = await new TenantLockRepository(this.prisma).lockCompany(companyId);
    if (!locked) return null;
    return this.prisma.company.findUnique({ where: { id: companyId }, select: { id: true, name: true } });
  }

  async lockByIdInCompany(companyId: string, id: string): Promise<CompanyInvitation | null> {
    this.assertTransactionClient();
    const rows = await this.prisma.$queryRaw<CompanyInvitation[]>`
      SELECT * FROM CompanyInvitation WHERE companyId = ${companyId} AND id = ${id} FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  async lockActiveByEmail(companyId: string, email: string): Promise<CompanyInvitation | null> {
    this.assertTransactionClient();
    const rows = await this.prisma.$queryRaw<CompanyInvitation[]>`
      SELECT * FROM CompanyInvitation WHERE companyId = ${companyId} AND activeEmail = ${email} FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  /** Segura a assinatura ACTIVE durante a transação de emissão/ativação. */
  async lockActiveSubscription(companyId: string): Promise<boolean> {
    this.assertTransactionClient();
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Subscription
      WHERE companyId = ${companyId} AND status = 'ACTIVE'
      ORDER BY createdAt DESC
      LIMIT 1
      FOR UPDATE
    `;
    return rows.length > 0;
  }

  hasActiveSubscription(companyId: string): Promise<boolean> {
    return this.prisma.subscription.findFirst({
      where: { companyId, status: "ACTIVE" },
      select: { id: true },
    }).then(subscription => subscription !== null);
  }

  create(data: CompanyInvitationCreateData): Promise<CompanyInvitation> {
    return this.prisma.companyInvitation.create({
      data: {
        ...data,
        activeEmail: data.email,
      },
    });
  }

  async rotate(data: {
    id: string;
    companyId: string;
    expectedTokenHash: string;
    issuerId: string;
    name: string;
    tokenHash: string;
    now: Date;
    expiresAt: Date;
  }): Promise<boolean> {
    const updated = await this.prisma.companyInvitation.updateMany({
      where: {
        id: data.id,
        companyId: data.companyId,
        tokenHash: data.expectedTokenHash,
        usedAt: null,
        revokedAt: null,
        issuedAt: { lte: data.now },
      },
      data: {
        issuerId: data.issuerId,
        name: data.name,
        tokenHash: data.tokenHash,
        issuedAt: data.now,
        expiresAt: data.expiresAt,
      },
    });
    return updated.count === 1;
  }

  async revoke(data: { id: string; companyId: string; expectedTokenHash: string; now: Date }): Promise<boolean> {
    const updated = await this.prisma.companyInvitation.updateMany({
      where: {
        id: data.id,
        companyId: data.companyId,
        tokenHash: data.expectedTokenHash,
        usedAt: null,
        revokedAt: null,
        activeEmail: { not: null },
      },
      data: { revokedAt: data.now, activeEmail: null },
    });
    return updated.count === 1;
  }

  async consume(data: { id: string; companyId: string; tokenHash: string; now: Date }): Promise<boolean> {
    const updated = await this.prisma.companyInvitation.updateMany({
      where: {
        id: data.id,
        companyId: data.companyId,
        tokenHash: data.tokenHash,
        usedAt: null,
        revokedAt: null,
        activeEmail: { not: null },
        expiresAt: { gt: data.now },
        issuedAt: { lte: data.now },
      },
      data: { usedAt: data.now, activeEmail: null },
    });
    return updated.count === 1;
  }

  async recordAudit(data: {
    actorId: string;
    companyId: string;
    entityId: string;
    entityType?: string;
    action: string;
    diff?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        companyId: data.companyId,
        entityType: data.entityType ?? "CompanyInvitation",
        entityId: data.entityId,
        action: data.action,
        diffJson: data.diff ? JSON.stringify(data.diff) : null,
      },
    });
  }

  private assertTransactionClient(): void {
    if ("$transaction" in this.prisma) throw new Error("COMPANY_INVITATION_LOCK_REQUIRES_TRANSACTION");
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const prismaCode = "code" in error ? (error as { code?: unknown }).code : undefined;
  const meta = "meta" in error ? (error as { meta?: { code?: unknown; message?: unknown } }).meta : undefined;
  const mysqlCode = meta?.code;
  const message = typeof meta?.message === "string" ? meta.message : "";
  return prismaCode === "P2034"
    || mysqlCode === 1213
    || mysqlCode === "1213"
    || mysqlCode === 1205
    || mysqlCode === "1205"
    || /deadlock|lock wait timeout/iu.test(message);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
