// Contratos do fluxo interno de verificação de e-mail.
// Mantém o resultado do envio e os eventos de domínio sem expor credenciais.
// Consumido pelo service e pelos repositories de pedidos de acesso.

export type VerificationDeliveryResult =
  | "SENT"
  | "DELIVERY_FAILED"
  | "NOT_ELIGIBLE"
  | "CONFLICT";

export type EmailVerificationEventType =
  | "VERIFICATION_ISSUED"
  | "VERIFICATION_REISSUED"
  | "VERIFICATION_DELIVERY_FAILED";
