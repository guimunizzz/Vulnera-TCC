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
  /**
   * OWNER | MEMBER | null — só para a tela decidir o que oferecer; a
   * autorização é do backend (CP-2). Opcional porque uma sessão persistida
   * antes do CP-2 não tem o campo — ausente vale como "não é OWNER".
   */
  companyRole?: string | null;
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
