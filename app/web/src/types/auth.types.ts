// Tipos espelham os DTOs do backend (app/api/src/models/user.model.ts).
// Mantidos manualmente — o projeto não compartilha pacote de tipos entre
// api/web nesta fase.

export type UserRole = "ADMIN" | "CLIENT" | "PENTESTER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}
