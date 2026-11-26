/**
 * Contratos e janelas comuns aos dois tokens de acesso. Evita divergência de
 * rotação entre verificação e convite; consumido pelos respectivos repositories.
 */
import type { AccessRequest } from "./access-request.model";

export type AccessTokenPurpose = "VERIFICATION" | "INVITATION";
export type CreateAccessTokenDTO = { accessRequestId: string; tokenHash: string; expiresAt: Date };
export type RotateAccessTokenDTO = CreateAccessTokenDTO & { expectedTokenHash: string; expectedRevokedAt: Date | null };
export type RevokeAccessTokenDTO = { accessRequestId: string; expectedTokenHash: string };

export const ACCESS_TOKEN_TTL_MS = { VERIFICATION: 3_600_000, INVITATION: 48 * 3_600_000 } as const;

export function accessTokenDeadline(purpose: AccessTokenPurpose, requestExpiresAt: Date, now: Date): Date {
  return new Date(Math.min(now.getTime() + ACCESS_TOKEN_TTL_MS[purpose], requestExpiresAt.getTime()));
}

export function canUseAccessToken(
  parent: Pick<AccessRequest, "status" | "expiresAt"> | null, purpose: AccessTokenPurpose, now: Date,
): boolean {
  const status = purpose === "VERIFICATION" ? "PENDING_EMAIL_VERIFICATION" : "APPROVED";
  return parent !== null && Number.isFinite(now.getTime()) && parent.status === status && parent.expiresAt.getTime() > now.getTime();
}

/** O snapshot precisa vir de SELECT FOR UPDATE, nunca de uma leitura sem lock. */
export function canIssueAccessToken(
  parent: Pick<AccessRequest, "status" | "expiresAt"> | null,
  purpose: AccessTokenPurpose,
  expiresAt: Date,
  now: Date,
): boolean {
  return canUseAccessToken(parent, purpose, now) && Number.isFinite(expiresAt.getTime())
    && expiresAt.getTime() > now.getTime()
    && expiresAt.getTime() <= accessTokenDeadline(purpose, parent!.expiresAt, now).getTime();
}
