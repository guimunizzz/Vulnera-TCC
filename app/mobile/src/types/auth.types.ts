// Tipos espelham os DTOs do backend (app/api/src/models/user.model.ts) —
// mesma cópia manual do app/web/src/types/auth.types.ts (sem pacote de
// tipos compartilhado entre as três superfícies nesta fase do projeto).

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
