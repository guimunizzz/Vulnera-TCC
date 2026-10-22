// Monta a mensagem de verificação de e-mail em texto e HTML seguros.
// Centraliza o conteúdo para que todos os fluxos enviem o mesmo link e prazo.
// Consumido pelo serviço que envia a verificação de endereço.

import type { EmailMessage } from "../models/email.model";
import { isSingleEmailAddress } from "../models/email.model";

type EmailVerificationInput = {
  to: string;
  name: string;
  token: string;
  expiresAt: Date;
};

const SUBJECT = "Confirme seu e-mail — solicitação de acesso Vulnera";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function buildVerificationUrl(publicWebUrl: string, token: string): string {
  if (
    publicWebUrl !== publicWebUrl.trim() ||
    /[?#]/u.test(publicWebUrl)
  ) {
    throw new Error("INVALID_PUBLIC_WEB_URL");
  }

  let base: URL;
  try {
    base = new URL(publicWebUrl);
  } catch {
    throw new Error("INVALID_PUBLIC_WEB_URL");
  }

  const hostname = base.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  const isLoopback =
    hostname === "localhost" ||
    hostname === "::1" ||
    /^127(?:\.\d{1,3}){3}$/u.test(hostname);
  const isStrictOrigin =
    base.username === "" &&
    base.password === "" &&
    base.pathname === "/" &&
    base.search === "" &&
    base.hash === "";
  const isAllowedProtocol =
    base.protocol === "https:" || (base.protocol === "http:" && isLoopback);

  if (!isStrictOrigin || !isAllowedProtocol) {
    throw new Error("INVALID_PUBLIC_WEB_URL");
  }

  return new URL(`/verify-email#token=${token}`, base.origin).toString();
}

/** Gera uma mensagem com token canônico de 32 bytes no fragmento do link. */
export function buildEmailVerificationMessage(
  input: EmailVerificationInput,
  publicWebUrl: string,
): EmailMessage {
  if (!isSingleEmailAddress(input.to)) throw new Error("INVALID_EMAIL_ADDRESS");
  if (typeof input.name !== "string") throw new Error("INVALID_NAME");
  if (
    typeof input.token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(input.token) ||
    Buffer.from(input.token, "base64url").length !== 32 ||
    Buffer.from(input.token, "base64url").toString("base64url") !== input.token
  ) {
    throw new Error("INVALID_EMAIL_VERIFICATION_TOKEN");
  }
  if (!(input.expiresAt instanceof Date) || !Number.isFinite(input.expiresAt.getTime())) {
    throw new Error("INVALID_EMAIL_VERIFICATION_EXPIRY");
  }

  const link = buildVerificationUrl(publicWebUrl, input.token);
  const safeName = escapeHtml(input.name);
  const safeLink = escapeHtml(link);
  const expiry = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(input.expiresAt);

  return {
    to: input.to,
    subject: SUBJECT,
    text: `Olá, ${input.name}.\n\nConfirme o e-mail informado na sua solicitação de acesso à Vulnera:\n${link}\n\nDepois da confirmação, sua solicitação seguirá para análise. A confirmação não concede acesso; aguarde a aprovação. Este link é válido até ${expiry} (horário de Brasília). Se você não solicitou esta mensagem, pode ignorá-la.`,
    html: `<p>Olá, ${safeName}.</p><p>Confirme o e-mail informado na sua solicitação de acesso à Vulnera:</p><p><a href="${safeLink}">Confirmar meu e-mail</a></p><p>Depois da confirmação, sua solicitação seguirá para análise. A confirmação não concede acesso; aguarde a aprovação.</p><p>Este link é válido até ${escapeHtml(expiry)} (horário de Brasília). Se você não solicitou esta mensagem, pode ignorá-la.</p>`,
  };
}
