/**
 * Orquestra login, validação de sessão, rotação e logout.
 * Claims de role servem apenas para compatibilidade; a autorização usa o User atual.
 */

import type { User } from "@prisma/client";
import type { UserRepository } from "../repositories/user.repository";
import { RefreshTokenRepository, type AuthTransactionRepositories } from "../repositories/refresh-token.repository";
import { comparePassword } from "../utils/hash.util";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, type JwtPayload } from "../utils/jwt.util";
import { UserEntity, type AuthResponseDTO, type LoginDTO, type UserRole } from "../models/user.model";

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  async login(dto: LoginDTO): Promise<AuthResponseDTO> {
    const candidate = await this.userRepo.findByEmail(dto.email);
    if (!candidate || candidate.deactivatedAt) throw new Error("INVALID_CREDENTIALS");

    const passwordMatches = await comparePassword(dto.password, candidate.password);
    if (!passwordMatches) throw new Error("INVALID_CREDENTIALS");

    return this.refreshRepo.transaction(async ({ users, refreshTokens }) => {
      const user = await users.lockById(candidate.id);
      if (!user || user.deactivatedAt || user.password !== candidate.password) {
        throw new Error("INVALID_CREDENTIALS");
      }
      return this.issueTokensFor(user, refreshTokens, new Date());
    });
  }

  async refresh(refreshTokenRaw: string): Promise<AuthResponseDTO> {
    let payload: JwtPayload;
    try {
      payload = verifyRefreshToken(refreshTokenRaw);
    } catch {
      throw new Error("INVALID_TOKEN");
    }

    const tokenHash = RefreshTokenRepository.hash(refreshTokenRaw);
    const observed = await this.refreshRepo.findByHash(tokenHash);
    if (!observed || observed.userId !== payload.userId) throw new Error("INVALID_TOKEN");

    return this.refreshRepo.transaction(async ({ users, refreshTokens }) => {
      // A identidade é o primeiro lock; toda rotação e revogação usa essa ordem.
      const user = await users.lockById(payload.userId);
      const stored = await refreshTokens.findByHashForUpdate(tokenHash);
      // O relógio é lido após a espera dos dois locks: um token pode vencer enquanto aguarda.
      const now = new Date();
      if (
        !user || user.deactivatedAt || !stored || stored.userId !== user.id ||
        stored.revokedAt !== null || stored.expiresAt.getTime() <= now.getTime() ||
        typeof payload.exp !== "number" || payload.exp * 1000 <= now.getTime() ||
        (payload.sessionVersion ?? 0) !== user.sessionVersion
      ) {
        throw new Error("INVALID_TOKEN");
      }

      await refreshTokens.revoke(stored.id, now);
      return this.issueTokensFor(user, refreshTokens, now);
    });
  }

  async logout(refreshTokenRaw: string): Promise<void> {
    const tokenHash = RefreshTokenRepository.hash(refreshTokenRaw);
    const observed = await this.refreshRepo.findByHash(tokenHash);
    if (!observed) return;

    const now = new Date();
    await this.refreshRepo.transaction(async ({ users, refreshTokens }) => {
      const user = await users.lockById(observed.userId);
      if (!user) return;
      const stored = await refreshTokens.findByHashForUpdate(tokenHash);
      if (stored && stored.userId === user.id && !stored.revokedAt) {
        await refreshTokens.revoke(stored.id, now);
      }
    });
    // Logout é idempotente: valor desconhecido ou já revogado permanece 204.
  }

  /** Revalida assinatura, existência, estado e versão antes de aceitar qualquer request. */
  async authenticateAccessToken(token: string): Promise<JwtPayload> {
    let payload: JwtPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new Error("INVALID_TOKEN");
    }

    const user = await this.userRepo.findById(payload.userId);
    if (
      !user || user.deactivatedAt ||
      (payload.sessionVersion ?? 0) !== user.sessionVersion ||
      !isUserRole(user.role)
    ) {
      throw new Error("INVALID_TOKEN");
    }

    // O role assinado pode estar antigo; a identidade vigente vem do banco.
    return { userId: user.id, role: user.role, sessionVersion: user.sessionVersion };
  }

  private async issueTokensFor(
    user: User,
    repositories: AuthTransactionRepositories["refreshTokens"],
    now: Date,
  ): Promise<AuthResponseDTO> {
    if (user.deactivatedAt || !isUserRole(user.role)) throw new Error("INVALID_TOKEN");

    const payload: JwtPayload = {
      userId: user.id,
      role: user.role,
      sessionVersion: user.sessionVersion,
    };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const refreshClaims = verifyRefreshToken(refreshToken);
    if (typeof refreshClaims.exp !== "number" || refreshClaims.exp * 1000 <= now.getTime()) {
      throw new Error("INVALID_REFRESH_TOKEN_EXPIRY");
    }

    await repositories.create({
      userId: user.id,
      tokenHash: RefreshTokenRepository.hash(refreshToken),
      // A coluna guarda a mesma fronteira temporal assinada no JWT, incluindo TTL configurável.
      expiresAt: new Date(refreshClaims.exp * 1000),
    });

    return { accessToken, refreshToken, user: UserEntity.toResponse(user) };
  }
}

function isUserRole(role: string): role is UserRole {
  return role === "ADMIN" || role === "CLIENT" || role === "PENTESTER";
}
