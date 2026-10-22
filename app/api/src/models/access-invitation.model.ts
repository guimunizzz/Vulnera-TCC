/**
 * Contrato interno do convite, separado de User e do token de verificação.
 * Consumido pelo repository e pela futura ativação; não concede JWT.
 */
import type { AccessInvitation as PrismaAccessInvitation } from "@prisma/client";
import type { CreateAccessTokenDTO } from "./access-token.model";

export type AccessInvitation = PrismaAccessInvitation;
export type CreateAccessInvitationDTO = CreateAccessTokenDTO;
