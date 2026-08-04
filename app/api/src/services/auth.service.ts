/**
 * auth.service.ts
 *
 * Orquestra register/login/refresh/logout.
 *
 * Erros: lança Error com .message = SCREAMING_SNAKE. O controller traduz pra HTTP.
 */

import type { UserRepository } from "../repositories/user.repository";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository";
import { hashPassword, comparePassword } from "../utils/hash.util";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.util";
import {
  UserEntity,
  type AuthResponseDTO,
  type LoginDTO,
  type RegisterDTO,
  type UserRole,
} from "../models/user.model";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7d

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  async register(dto: RegisterDTO): Promise<AuthResponseDTO> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) throw new Error("EMAIL_ALREADY_EXISTS");

    const passwordHash = await hashPassword(dto.password);
    const user = await this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: passwordHash,
      role: "CLIENT", // default no MVP
    });

    return this.issueTokensFor(user);
  }

  async login(dto: LoginDTO): Promise<AuthResponseDTO> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) throw new Error("INVALID_CREDENTIALS");

    const ok = await comparePassword(dto.password, user.password);
    if (!ok) throw new Error("INVALID_CREDENTIALS");

    return this.issueTokensFor(user);
  }

  async refresh(refreshTokenRaw: string): Promise<AuthResponseDTO> {
    // 1. Validar assinatura/expiração
    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenRaw);
    } catch {
      throw new Error("INVALID_TOKEN");
    }

    // 2. Validar que existe no DB e não foi revogado
    const tokenHash = RefreshTokenRepository.hash(refreshTokenRaw);
    const stored = await this.refreshRepo.findByHash(tokenHash);
    if (!stored || stored.revokedAt) throw new Error("INVALID_TOKEN");

    // 3. Revogar o atual (rotation)
    await this.refreshRepo.revoke(stored.id);

    // 4. Emitir par novo
    const user = await this.userRepo.findById(payload.userId);
    if (!user) throw new Error("INVALID_TOKEN");
    return this.issueTokensFor(user);
  }

  async logout(refreshTokenRaw: string): Promise<void> {
    const tokenHash = RefreshTokenRepository.hash(refreshTokenRaw);
    const stored = await this.refreshRepo.findByHash(tokenHash);
    if (stored && !stored.revokedAt) {
      await this.refreshRepo.revoke(stored.id);
    }
    // logout idempotente: se token já estava revogado/inválido, segue 204
  }

  // ---------- privado ----------

  private async issueTokensFor(user: { id: string; role: string }): Promise<AuthResponseDTO> {
    const payload = { userId: user.id, role: user.role as UserRole };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // persiste hash do refresh
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.refreshRepo.create({
      userId: user.id,
      tokenHash: RefreshTokenRepository.hash(refreshToken),
      expiresAt,
    });

    const fullUser = await this.userRepo.findById(user.id);
    return {
      accessToken,
      refreshToken,
      user: UserEntity.toResponse(fullUser!),
    };
  }
}
