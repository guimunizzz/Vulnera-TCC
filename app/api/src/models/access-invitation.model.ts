/**
 * Contratos internos para o convite de acesso, separado de User e do token de
 * verificação. Consumido pelo repository, serviço administrativo e ativação.
 */
import type { AccessInvitation as PrismaAccessInvitation } from "@prisma/client";
import type { CreateAccessTokenDTO } from "./access-token.model";

export type AccessInvitation = PrismaAccessInvitation;
export type CreateAccessInvitationDTO = CreateAccessTokenDTO;

export type InvitationDeliveryStatus = "SENT" | "DELIVERY_FAILED";

/** Dados internos mantidos somente entre commit e chamada do remetente. */
export type PreparedAccessInvitation = {
  accessRequestId: string;
  to: string;
  name: string;
  token: string;
  tokenHash: string;
  expiresAt: Date;
  actorId: string;
};

export type AccessInvitationAuditAction =
  | "ACCESS_INVITATION_ISSUED"
  | "ACCESS_INVITATION_REISSUED"
  | "ACCESS_INVITATION_DELIVERY_FAILED";

/** Erro de regra de negócio para o controller calcular Retry-After. */
export class AccessInvitationCooldownError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("ACCESS_INVITATION_COOLDOWN");
    this.name = "AccessInvitationCooldownError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
