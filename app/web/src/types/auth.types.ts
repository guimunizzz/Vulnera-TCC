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
  /** True only for pre-wave accounts allowed to resume the legacy onboarding. */
  legacyOnboardingAllowed?: boolean;
  createdAt: string;
}

/** Resposta mínima de GET /vulnerabilities/:id/assignees. */
export interface AssigneeCandidate {
  id: string;
  name: string;
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
