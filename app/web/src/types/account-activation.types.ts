/**
 * Tipos da fronteira pública de ativação de conta.
 * Evitam compartilhar dados de sessão, identidade ou autenticação automática.
 * Consumidos somente pela API e pela página de ativação.
 */

export interface ValidateAccountActivationInput {
  token: string;
}

export interface ValidateAccountActivationResponse {
  valid: boolean;
}

export interface ActivateAccountInput {
  token: string;
  password: string;
}
