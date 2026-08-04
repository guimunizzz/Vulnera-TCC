/**
 * user.model.ts
 *
 * Tipos, DTOs e Entity do domínio User.
 *
 * Padrão do CLAUDE.md §5.1:
 * - type User = PrismaUser (reaproveita o tipo gerado pelo Prisma)
 * - DTOs: contratos de entrada/saída da API
 * - Entity: classe com lógica de transformação (ex: toResponse() sem password)
 */

import type { User as PrismaUser } from "@prisma/client";

export type User = PrismaUser;

export type UserRole = "ADMIN" | "CLIENT" | "PENTESTER";

// ---------- DTOs ----------

/** Body do POST /api/auth/register */
export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
}

/** Body do POST /api/auth/login */
export interface LoginDTO {
  email: string;
  password: string;
}

/** Body do POST /api/auth/refresh e logout */
export interface RefreshDTO {
  refreshToken: string;
}

/** O que sai da API depois de register/login/refresh */
export interface AuthResponseDTO {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDTO;
}

/** User retornado pela API — NUNCA com password */
export interface UserResponseDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  createdAt: Date;
}

// ---------- Entity ----------

/**
 * Wrapper sobre User pra forçar serialização segura.
 * Sempre que for retornar User na API, use UserEntity.toResponse(user).
 */
export class UserEntity {
  static toResponse(u: User): UserResponseDTO {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      companyId: u.companyId,
      createdAt: u.createdAt,
    };
  }
}
