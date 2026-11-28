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
  /** Ausente somente em JWTs emitidos antes do controle de versão de sessão. */
  sessionVersion?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

/** Assina o access token (curto). */
export function signAccessToken(payload: JwtPayload): string {
  const secret = EnvVar.get(EnvKeys.JWT_ACCESS_SECRET);
  const ttl = EnvVar.getOptional(EnvKeys.JWT_ACCESS_TTL, "15m");
  const opts: SignOptions = { algorithm: "HS256", expiresIn: ttl as SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, sessionVersion: payload.sessionVersion ?? 0 }, secret, opts);
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
  const opts: SignOptions = { algorithm: "HS256", expiresIn: ttl as SignOptions["expiresIn"] };
  return jwt.sign({ ...payload, jti: randomUUID() }, secret, opts);
}

/** Verifica o access token. Lança erro se inválido/expirado. */
export function verifyAccessToken(token: string): JwtPayload {
  const secret = EnvVar.get(EnvKeys.JWT_ACCESS_SECRET);
  return verifyPayload(token, secret);
}

/** Verifica o refresh token. Lança erro se inválido/expirado. */
export function verifyRefreshToken(token: string): JwtPayload {
  const secret = EnvVar.get(EnvKeys.JWT_REFRESH_SECRET);
  return verifyPayload(token, secret);
}

function verifyPayload(token: string, secret: string): JwtPayload {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (typeof decoded !== "object" || decoded === null) throw new Error("INVALID_TOKEN");

  const claims = decoded as Record<string, unknown>;
  if (
    typeof claims.userId !== "string" || claims.userId.length === 0 ||
    !["ADMIN", "CLIENT", "PENTESTER"].includes(String(claims.role)) ||
    typeof claims.exp !== "number" || !Number.isSafeInteger(claims.exp) ||
    (claims.sessionVersion !== undefined &&
      (!Number.isSafeInteger(claims.sessionVersion) || Number(claims.sessionVersion) < 0))
  ) {
    throw new Error("INVALID_TOKEN");
  }

  return {
    userId: claims.userId,
    role: claims.role as JwtPayload["role"],
    sessionVersion: claims.sessionVersion === undefined ? 0 : Number(claims.sessionVersion),
    ...(typeof claims.jti === "string" ? { jti: claims.jti } : {}),
    ...(typeof claims.iat === "number" ? { iat: claims.iat } : {}),
    ...(typeof claims.exp === "number" ? { exp: claims.exp } : {}),
  };
}
