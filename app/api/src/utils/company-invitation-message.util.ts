// Monta a mensagem de convite de equipe com token no fragmento do link.
// O fragmento não é enviado ao servidor web; o service entrega a mensagem via SMTP.
import type { EmailMessage } from "../models/email.model";
import { isSingleEmailAddress } from "../models/email.model";
import { isValidCompanyInvitationToken } from "./company-invitation-token.util";

type CompanyInvitationMessageInput = {
  to: string;
  name: string;
  companyName: string;
  token: string;
  expiresAt: Date;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function replaceAsciiControls(value: string): string {
  let sanitized = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);
    const code = value.charCodeAt(index);
    sanitized += code < 32 || code === 127 ? " " : character;
  }
  return sanitized.replace(/\s+/gu, " ").trim();
}

function invitationUrl(publicWebUrl: string, token: string): string {
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
  const loopback = hostname === "localhost" || hostname === "::1" || /^127(?:\.\d{1,3}){3}$/u.test(hostname);
  const originOnly = !base.username && !base.password && base.pathname === "/" && !base.search && !base.hash;
  const protocolAllowed = base.protocol === "https:" || (base.protocol === "http:" && loopback);
  if (!originOnly || !protocolAllowed) throw new Error("INVALID_PUBLIC_WEB_URL");

  return `${new URL("/join-company", base.origin).toString()}#token=${encodeURIComponent(token)}`;
}

export function buildCompanyInvitationMessage(
  input: CompanyInvitationMessageInput,
  publicWebUrl: string,
): EmailMessage {
  if (!isSingleEmailAddress(input.to)) throw new Error("INVALID_EMAIL_ADDRESS");
  if (!input.name.trim() || !input.companyName.trim()) throw new Error("INVALID_INVITATION_NAME");
  if (!isValidCompanyInvitationToken(input.token)) throw new Error("INVALID_COMPANY_INVITATION_TOKEN");
  if (!(input.expiresAt instanceof Date) || !Number.isFinite(input.expiresAt.getTime())) {
    throw new Error("INVALID_COMPANY_INVITATION_EXPIRY");
  }

  const link = invitationUrl(publicWebUrl, input.token);
  const expiry = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(input.expiresAt);
  const plainName = replaceAsciiControls(input.name);
  const plainCompanyName = replaceAsciiControls(input.companyName);
  const name = escapeHtml(plainName);
  const companyName = escapeHtml(plainCompanyName);
  const safeLink = escapeHtml(link);
  const subject = "Convite para uma equipe na Vulnera";

  return {
    to: input.to,
    subject,
    text: `Olá, ${plainName}.\n\nVocê foi convidado para participar da equipe de ${plainCompanyName} na Vulnera. Para criar sua conta, acesse:\n${link}\n\nO convite é válido até ${expiry} (horário de Brasília) e pode ser usado uma única vez. Se você não esperava este convite, ignore esta mensagem.`,
    html: `<p>Olá, ${name}.</p><p>Você foi convidado para participar da equipe de ${companyName} na Vulnera.</p><p><a href="${safeLink}">Aceitar convite</a></p><p>O convite é válido até ${escapeHtml(expiry)} (horário de Brasília) e pode ser usado uma única vez. Se você não esperava este convite, ignore esta mensagem.</p>`,
  };
}
