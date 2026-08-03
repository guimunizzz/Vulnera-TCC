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
import type { PrismaClient, RefreshToken } from "@prisma/client";

export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

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

  revoke(id: string): Promise<RefreshToken> {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string): Promise<{ count: number }> {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
