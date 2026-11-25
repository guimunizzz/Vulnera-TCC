/**
 * Contratos públicos mínimos da ativação de conta e validação canônica do token.
 * Existe para alinhar a fronteira HTTP ao service sem expor identidade ou prazo.
 * Consumido pela rota de ativação e pelo AccountActivationService.
 */
export type ValidationResponseDTO = { valid: boolean };

/** Só aceita o formato canônico de 32 bytes em base64url sem padding. */
export function isValidAccountActivationToken(token: unknown): token is string {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const decoded = Buffer.from(token, "base64url");
  return decoded.length === 32 && decoded.toString("base64url") === token;
}
