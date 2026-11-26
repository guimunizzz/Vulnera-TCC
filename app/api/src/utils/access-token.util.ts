/**
 * Gera segredos opacos de 256 bits e hashes SHA-256 para o domínio de acesso.
 * Consumido pela futura emissão/verificação; somente tokenHash pode ir ao DB.
 */
import { createHash, randomBytes } from "crypto";

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateAccessToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashAccessToken(token) };
}
