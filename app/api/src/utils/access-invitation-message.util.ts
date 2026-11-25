// Monta o convite de acesso em texto e HTML seguros, com o segredo no fragmento.
// Existe para padronizar o link e o prazo; é consumido pelo serviço de convites.

import type { EmailMessage } from "../models/email.model";
import { isSingleEmailAddress } from "../models/email.model";

type AccessInvitationMessageInput = {
  to: string;
  name: string;
  token: string;
  expiresAt: Date;
};

const SUBJECT = "Seu convite para acessar a Vulnera";

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

function buildInvitationUrl(publicWebUrl: string, token: string): string {
  if (publicWebUrl !== publicWebUrl.trim() || /[?#]/u.test(publicWebUrl)) {
    throw new Error("INVALID_PUBLIC_WEB_URL");
  }

  let base: URL;
  try {
    base = new URL(publicWebUrl);
  } catch {
    throw new Error("INVALID_PUBLIC_WEB_URL");
  }

  const hostname = base.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  const isLoopback = hostname === "localhost"
    || hostname === "::1"
    || /^127(?:\.\d{1,3}){3}$/u.test(hostname);
  const isStrictOrigin = base.username === ""
    && base.password === ""
    && base.pathname === "/"
    && base.search === ""
    && base.hash === "";
  const isAllowedProtocol = base.protocol === "https:"
    || (base.protocol === "http:" && isLoopback);

  if (!isStrictOrigin || !isAllowedProtocol) throw new Error("INVALID_PUBLIC_WEB_URL");
  return new URL(`/activate-account#token=${token}`, base.origin).toString();
}

/** Gera o convite com token canônico de 32 bytes e validade em Brasília. */
export function buildAccessInvitationMessage(
  input: AccessInvitationMessageInput,
  publicWebUrl: string,
): EmailMessage {
  if (!isSingleEmailAddress(input.to)) throw new Error("INVALID_EMAIL_ADDRESS");
  if (typeof input.name !== "string") throw new Error("INVALID_NAME");
  if (
    typeof input.token !== "string"
    || !/^[A-Za-z0-9_-]{43}$/u.test(input.token)
    || Buffer.from(input.token, "base64url").length !== 32
    || Buffer.from(input.token, "base64url").toString("base64url") !== input.token
  ) {
    throw new Error("INVALID_ACCESS_INVITATION_TOKEN");
  }
  if (!(input.expiresAt instanceof Date) || !Number.isFinite(input.expiresAt.getTime())) {
    throw new Error("INVALID_ACCESS_INVITATION_EXPIRY");
  }

  const link = buildInvitationUrl(publicWebUrl, input.token);
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
    text: `Olá, ${input.name}.\n\nSua solicitação de acesso à Vulnera foi aprovada. Para criar sua conta, acesse:\n${link}\n\nEste convite é válido até ${expiry} (horário de Brasília) e pode ser usado uma única vez. Se você não solicitou acesso, ignore esta mensagem.`,
    html: `<p>Olá, ${safeName}.</p><p>Sua solicitação de acesso à Vulnera foi aprovada. Para criar sua conta, acesse:</p><p><a href="${safeLink}">Ativar minha conta</a></p><p>Este convite é válido até ${escapeHtml(expiry)} (horário de Brasília) e pode ser usado uma única vez. Se você não solicitou acesso, ignore esta mensagem.</p>`,
  };
}
