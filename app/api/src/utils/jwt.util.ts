/**
 * jwt.util.ts
 *
 * Geração e verificação de tokens JWT (access + refresh).
 *
 * Convenção:
 * - access token: curto (15min), carrega userId+role, usado em cada request
 * - refresh token: longo (7d), serve só pra trocar por um novo access
 *
 * Segurança:
 * - Segredos diferentes pra access e refresh (assim revogar um não pega o outro)
 * - HS256 (HMAC com chave simétrica) — suficiente pra MVP
 * - Em prod, segredos devem ter ≥32 chars aleatórios
 */

import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { EnvVar } from "../config/EnvVar";
import { EnvKeys } from "../config/enum/EnvKeys";

export interface JwtPayload {
  userId: string;
  role: "ADMIN" | "CLIENT" | "PENTESTER";
}

/** Assina o access token (curto). */
export function signAccessToken(payload: JwtPayload): string {
  const secret = EnvVar.get(EnvKeys.JWT_ACCESS_SECRET);
  const ttl = EnvVar.getOptional(EnvKeys.JWT_ACCESS_TTL, "15m");
  const opts: SignOptions = { expiresIn: ttl as SignOptions["expiresIn"] };
  return jwt.sign(payload, secret, opts);
}

/**
 * Assina o refresh token (longo).
 *
 * Inclui um `jti` aleatório: sem ele, duas chamadas de login/refresh no mesmo
 * segundo pro mesmo usuário gerariam tokens idênticos (mesmo payload + mesmo
 * `iat`), e o hash duplicado violaria a constraint unique de RefreshToken.
 */
export function signRefreshToken(payload: JwtPayload): string {
  const secret = EnvVar.get(EnvKeys.JWT_REFRESH_SECRET);
  const ttl = EnvVar.getOptional(EnvKeys.JWT_REFRESH_TTL, "7d");
  const opts: SignOptions = { expiresIn: ttl as SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, jti: randomUUID() }, secret, opts);
}

/** Verifica o access token. Lança erro se inválido/expirado. */
export function verifyAccessToken(token: string): JwtPayload {
  const secret = EnvVar.get(EnvKeys.JWT_ACCESS_SECRET);
  return jwt.verify(token, secret) as JwtPayload;
}

/** Verifica o refresh token. Lança erro se inválido/expirado. */
export function verifyRefreshToken(token: string): JwtPayload {
  const secret = EnvVar.get(EnvKeys.JWT_REFRESH_SECRET);
  return jwt.verify(token, secret) as JwtPayload;
}
