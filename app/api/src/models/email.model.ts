// Contratos de mensagem e envio de e-mail usados pela aplicação.
// Mantém o serviço de e-mail desacoplado do provedor e facilita testes.
// Consumido por utilitários, configurações e implementações de EmailSender.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Aceita um endereço individual em formato simples, sem nome de exibição,
 * lista, espaços ou sintaxe de endereço entre aspas/colchetes angulares.
 */
export function isSingleEmailAddress(value: string): boolean {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    /[\s\r\n<>"'“”‘’,;]/u.test(value)
  ) {
    return false;
  }

  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) return false;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || domain.length > 253) return false;

  const atom = String.raw`[\p{L}\p{N}!#$%&*+\-/=?^_{|}~][\p{L}\p{N}\p{M}!#$%&*+\-/=?^_{|}~]*`;
  const localPattern = new RegExp(`^${atom}(?:\\.${atom})*$`, "u");
  if (!localPattern.test(local)) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;

  const labelPattern = /^[\p{L}\p{N}](?:[\p{L}\p{N}\p{M}-]{0,61}[\p{L}\p{N}\p{M}])?$/u;
  if (labels.some((label) => label.length > 63 || !labelPattern.test(label))) {
    return false;
  }

  return /\p{L}/u.test(labels[labels.length - 1]);
}
