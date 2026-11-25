/**
 * Persistência do token de verificação. Aceita o client de uma transação para
 * combinar consumo e mudança do pedido; consumido pela stack interna de acesso.
 */
import type { EmailVerificationToken, CreateEmailVerificationTokenDTO } from "../models/email-verification-token.model";
import { canIssueAccessToken, canUseAccessToken, type RotateAccessTokenDTO, type RevokeAccessTokenDTO } from "../models/access-token.model";
import { inAccessTransaction, lockAccessRequest, type AccessDatabaseClient } from "./access-transaction.repository";

export class EmailVerificationTokenRepository {
  constructor(private readonly prisma: AccessDatabaseClient) {}

  createIfEligible(data: CreateEmailVerificationTokenDTO, now: Date = new Date()): Promise<EmailVerificationToken | null> {
    return inAccessTransaction(this.prisma, async tx => {
      const parent = await lockAccessRequest(tx, data.accessRequestId);
      if (!canIssueAccessToken(parent, "VERIFICATION", data.expiresAt, now)) return null;
      return tx.emailVerificationToken.create({ data: { ...data, createdAt: now, issuedAt: now } });
    });
  }

  findByHash(tokenHash: string): Promise<EmailVerificationToken | null> {
    return this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  }

  /** Lê o slot atual com leitura bloqueante, sempre após travar o pedido. */
  async findByAccessRequestIdForUpdate(accessRequestId: string): Promise<EmailVerificationToken | null> {
    if ("$transaction" in this.prisma) {
      throw new Error("EMAIL_VERIFICATION_TOKEN_LOCK_REQUIRES_TRANSACTION");
    }
    const rows = await this.prisma.$queryRaw<EmailVerificationToken[]>`
      SELECT * FROM EmailVerificationToken
      WHERE accessRequestId = ${accessRequestId}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  rotateIfAvailable(data: RotateAccessTokenDTO, now: Date): Promise<boolean> {
    return inAccessTransaction(this.prisma, async tx => {
      const parent = await lockAccessRequest(tx, data.accessRequestId);
      if (data.tokenHash === data.expectedTokenHash || !canIssueAccessToken(parent, "VERIFICATION", data.expiresAt, now)) return false;
      const result = await tx.emailVerificationToken.updateMany({
        where: { accessRequestId: data.accessRequestId, tokenHash: data.expectedTokenHash, revokedAt: data.expectedRevokedAt, usedAt: null, issuedAt: { lte: now } },
        data: { tokenHash: data.tokenHash, expiresAt: data.expiresAt, issuedAt: now, revokedAt: null },
      });
      return result.count === 1;
    });
  }

  revokeIfAvailable(data: RevokeAccessTokenDTO, now: Date): Promise<boolean> {
    return inAccessTransaction(this.prisma, async tx => {
      if (!await lockAccessRequest(tx, data.accessRequestId)) return false;
      const result = await tx.emailVerificationToken.updateMany({
        where: { accessRequestId: data.accessRequestId, tokenHash: data.expectedTokenHash, usedAt: null, revokedAt: null, issuedAt: { lte: now } },
        data: { revokedAt: now },
      });
      return result.count === 1;
    });
  }

  consumeIfAvailable(tokenHash: string, now: Date): Promise<boolean> {
    return inAccessTransaction(this.prisma, async tx => {
      const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash }, select: { id: true, accessRequestId: true } });
      if (!token) return false;
      const parent = await lockAccessRequest(tx, token.accessRequestId);
      if (!canUseAccessToken(parent, "VERIFICATION", now)) return false;
      const result = await tx.emailVerificationToken.updateMany({
        where: { id: token.id, tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now }, issuedAt: { lte: now } },
        data: { usedAt: now },
      });
      return result.count === 1;
    });
  }
}
