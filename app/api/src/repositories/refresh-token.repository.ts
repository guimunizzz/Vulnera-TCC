/**
 * refresh-token.repository.ts
 *
 * Persiste refresh tokens com hash SHA-256 — o token cru NUNCA entra no DB.
 * Fluxo de uso:
 *   1. AuthService gera um refresh token (JWT)
 *   2. Hasheia com SHA-256 e salva o hash no DB via .create()
 *   3. Devolve o token cru pro cliente
 *   4. Quando o cliente chama /refresh, hashamos o token recebido e procuramos
 *      via .findByHash() — se achou e não foi revogado, ok.
 */

import { createHash } from "crypto";
import type { RefreshToken } from "@prisma/client";
import { UserRepository } from "./user.repository";
import { inAccessTransaction, type AccessDatabaseClient } from "./access-transaction.repository";
import { TenantLockRepository } from "./tenant-lock.repository";

export interface AuthTransactionRepositories {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  tenantLocks: TenantLockRepository;
}

export class RefreshTokenRepository {
  constructor(private readonly prisma: AccessDatabaseClient) {}

  transaction<T>(operation: (repositories: AuthTransactionRepositories) => Promise<T>): Promise<T> {
    return inAccessTransaction(this.prisma, (tx) => operation({
      users: new UserRepository(tx),
      refreshTokens: new RefreshTokenRepository(tx),
      tenantLocks: new TenantLockRepository(tx),
    }));
  }

  /** Helper estático — outros lugares também podem usar */
  static hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  create(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  revoke(id: string, now: Date = new Date()): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: now },
    });
  }

  async findByHashForUpdate(tokenHash: string): Promise<RefreshToken | null> {
    if ("$transaction" in this.prisma) {
      throw new Error("REFRESH_TOKEN_LOCK_REQUIRES_TRANSACTION");
    }
    const rows = await this.prisma.$queryRaw<RefreshToken[]>`
      SELECT * FROM RefreshToken WHERE tokenHash = ${tokenHash} FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  revokeAllForUser(userId: string, now: Date = new Date()): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
