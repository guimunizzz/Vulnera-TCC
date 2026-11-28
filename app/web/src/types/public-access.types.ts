/**
 * Contratos tipados dos endpoints públicos de solicitação e verificação.
 * Evita misturar esses DTOs anônimos com os tipos de sessão autenticada.
 * Consumido por public-access.api.ts e pelas páginas públicas de acesso.
 */

export interface RequestAccessInput {
  name: string;
  email: string;
  companyName: string;
  planId: string;
  companyCnpj?: string;
  phone?: string;
  captchaToken: string;
}

export interface ResendVerificationInput {
  email: string;
  captchaToken: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface PublicAccessMessage {
  message: string;
}
