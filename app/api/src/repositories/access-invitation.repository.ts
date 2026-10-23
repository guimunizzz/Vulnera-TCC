/**
 * Persistência de convites; uso único via UPDATE condicional no MySQL.
 * Aceita transação externa para a futura criação de User; não a implementa.
 */
import type { AccessInvitation, CreateAccessInvitationDTO } from "../models/access-invitation.model";
import { canIssueAccessToken, canUseAccessToken, type RotateAccessTokenDTO, type RevokeAccessTokenDTO } from "../models/access-token.model";
import { inAccessTransaction, lockAccessRequest, type AccessDatabaseClient } from "./access-transaction.repository";

export class AccessInvitationRepository {
  constructor(private readonly prisma: AccessDatabaseClient) {}

  createIfEligible(data: CreateAccessInvitationDTO, now: Date = new Date()): Promise<AccessInvitation | null> {
    return inAccessTransaction(this.prisma, async tx => {
      const parent = await lockAccessRequest(tx, data.accessRequestId);
      if (!canIssueAccessToken(parent, "INVITATION", data.expiresAt, now)) return null;
      return tx.accessInvitation.create({ data: { ...data, createdAt: now, issuedAt: now } });
    });
  }

  findByHash(tokenHash: string): Promise<AccessInvitation | null> {
    return this.prisma.accessInvitation.findUnique({ where: { tokenHash } });
  }

  findByAccessRequestId(accessRequestId: string): Promise<AccessInvitation | null> {
    return this.prisma.accessInvitation.findUnique({ where: { accessRequestId } });
  }

  /** Lê o slot atual com lock, sempre depois de bloquear o pedido. */
  async findByAccessRequestIdForUpdate(accessRequestId: string): Promise<AccessInvitation | null> {
    if ("$transaction" in this.prisma) {
      throw new Error("ACCESS_INVITATION_LOCK_REQUIRES_TRANSACTION");
    }
    const rows = await this.prisma.$queryRaw<AccessInvitation[]>`
      SELECT * FROM AccessInvitation
      WHERE accessRequestId = ${accessRequestId}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  rotateIfAvailable(data: RotateAccessTokenDTO, now: Date): Promise<boolean> {
    return inAccessTransaction(this.prisma, async tx => {
      const parent = await lockAccessRequest(tx, data.accessRequestId);
      if (data.tokenHash === data.expectedTokenHash || !canIssueAccessToken(parent, "INVITATION", data.expiresAt, now)) return false;
      const result = await tx.accessInvitation.updateMany({
        where: { accessRequestId: data.accessRequestId, tokenHash: data.expectedTokenHash, revokedAt: data.expectedRevokedAt, usedAt: null, issuedAt: { lte: now } },
        data: { tokenHash: data.tokenHash, expiresAt: data.expiresAt, issuedAt: now, revokedAt: null },
      });
      return result.count === 1;
    });
  }

  revokeIfAvailable(data: RevokeAccessTokenDTO, now: Date): Promise<boolean> {
    return inAccessTransaction(this.prisma, async tx => {
      if (!await lockAccessRequest(tx, data.accessRequestId)) return false;
      const result = await tx.accessInvitation.updateMany({
        where: { accessRequestId: data.accessRequestId, tokenHash: data.expectedTokenHash, usedAt: null, revokedAt: null, issuedAt: { lte: now } },
        data: { revokedAt: now },
      });
      return result.count === 1;
    });
  }

  consumeIfAvailable(tokenHash: string, now: Date): Promise<boolean> {
    return inAccessTransaction(this.prisma, async tx => {
      const token = await tx.accessInvitation.findUnique({ where: { tokenHash }, select: { id: true, accessRequestId: true } });
      if (!token) return false;
      const parent = await lockAccessRequest(tx, token.accessRequestId);
      if (!canUseAccessToken(parent, "INVITATION", now)) return false;
      const result = await tx.accessInvitation.updateMany({
        where: { id: token.id, tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now }, issuedAt: { lte: now } },
        data: { usedAt: now },
      });
      return result.count === 1;
    });
  }
}
