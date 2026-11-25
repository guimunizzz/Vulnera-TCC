/**
 * Token opaco e com propósito explícito para convites de equipe.
 * O prefixo separa este fluxo da ativação de conta; só o SHA-256 persistido.
 * Consumido pelo service e pelo template de e-mail de CompanyInvitation.
 */
import { randomBytes } from "node:crypto";
import { hashAccessToken } from "./access-token.util";

const PREFIX = "team_";
const SECRET_LENGTH = 43;

export function generateCompanyInvitationToken(): { token: string; tokenHash: string } {
  const token = `${PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashAccessToken(token) };
}

export function isValidCompanyInvitationToken(token: unknown): token is string {
  if (typeof token !== "string" || !token.startsWith(PREFIX)) return false;
  const secret = token.slice(PREFIX.length);
  if (secret.length !== SECRET_LENGTH || !/^[A-Za-z0-9_-]{43}$/u.test(secret)) return false;
  const decoded = Buffer.from(secret, "base64url");
  return decoded.length === 32 && decoded.toString("base64url") === secret;
}
