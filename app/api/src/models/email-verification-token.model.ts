/**
 * Contrato interno do token de verificação de e-mail, sem token bruto.
 * Consumido pelo repository e pela futura orquestração de verificação.
 */
import type { EmailVerificationToken as PrismaEmailVerificationToken } from "@prisma/client";
import type { CreateAccessTokenDTO } from "./access-token.model";

export type EmailVerificationToken = PrismaEmailVerificationToken;
export type CreateEmailVerificationTokenDTO = CreateAccessTokenDTO;
