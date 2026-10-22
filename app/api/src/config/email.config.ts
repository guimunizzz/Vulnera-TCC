// Configura SMTP e a origem pública usada nos links de verificação.
// Centraliza validação de ambiente para a factory do serviço de e-mail.
// Consumido pela factory e pelo adapter SMTP; nunca acessa process.env diretamente.
import { isIP } from "node:net";
import { EnvVar } from "./EnvVar";
import { EnvKeys } from "./enum/EnvKeys";
import { isSingleEmailAddress } from "../models/email.model";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth?: { user: string; pass: string };
  from: string;
  connectionTimeoutMs: number;
  greetingTimeoutMs: number;
  socketTimeoutMs: number;
};

export type EmailConfig = {
  smtp: SmtpConfig;
  publicWebUrl: string;
};

const MAX_TIMEOUT_MS = 300_000;

function containsAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function requiredValue(key: EnvKeys): string {
  const value = EnvVar.get(key);
  if (value !== value.trim() || /[\r\n]/u.test(value)) {
    throw new Error(`Invalid environment variable: ${key}`);
  }
  return value;
}

function readBoolean(key: EnvKeys, defaultValue: boolean): boolean {
  const value = EnvVar.getOptional(key, String(defaultValue));
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Env ${key} must be exactly true or false`);
}

function readInteger(key: EnvKeys, defaultValue: number, min: number, max: number): number {
  const value = EnvVar.getOptional(key, String(defaultValue));
  if (!/^(?:0|[1-9]\d*)$/u.test(value)) throw new Error(`Env ${key} must be an integer`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`Env ${key} is outside the allowed range`);
  }
  return number;
}

function readHost(): string {
  const host = requiredValue(EnvKeys.SMTP_HOST);
  // SMTP_HOST é apenas um hostname/IP: não aceita URL, porta embutida ou userinfo.
  if (!host || containsAsciiControl(host)) {
    throw new Error("Env SMTP_HOST must be a hostname or IP address without credentials or port");
  }
  if (isIP(host) !== 0) return host;
  if (/[@/:?#\\\s]/u.test(host)) {
    throw new Error("Env SMTP_HOST must be a hostname or IP address without credentials or port");
  }
  const labels = host.split(".");
  if (host.length > 253 || labels.some(label =>
    label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/iu.test(label),
  )) {
    throw new Error("Env SMTP_HOST must be a valid hostname or IP address");
  }
  return host;
}

function readPublicWebUrl(): string {
  const raw = requiredValue(EnvKeys.PUBLIC_WEB_URL);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Env PUBLIC_WEB_URL must be an absolute HTTP(S) origin");
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    !url.hostname || url.username || url.password || url.search || url.hash || url.pathname !== "/"
  ) {
    throw new Error("Env PUBLIC_WEB_URL must contain only an HTTP(S) origin");
  }

  const production = EnvVar.getOptional(EnvKeys.NODE_ENV, "development") === "production";
  if (production && url.protocol !== "https:") {
    throw new Error("Env PUBLIC_WEB_URL must use HTTPS in production");
  }
  if (!production && url.protocol === "http:") {
    const hostname = url.hostname.toLowerCase();
    const ipv4Loopback = isIP(hostname) === 4 && Number(hostname.split(".")[0]) === 127;
    const loopback = hostname === "localhost" || hostname === "[::1]" || ipv4Loopback;
    if (!loopback) throw new Error("HTTP PUBLIC_WEB_URL is allowed only for loopback hosts outside production");
  }
  return url.origin;
}

export function readEmailConfig(): EmailConfig {
  const secure = readBoolean(EnvKeys.SMTP_SECURE, false);
  const requireTLS = readBoolean(EnvKeys.SMTP_REQUIRE_TLS, false);
  const production = EnvVar.getOptional(EnvKeys.NODE_ENV, "development") === "production";
  if (production && !secure && !requireTLS) {
    throw new Error("SMTP must require TLS in production");
  }

  const user = EnvVar.getOptional(EnvKeys.SMTP_USER, "");
  const pass = EnvVar.getOptional(EnvKeys.SMTP_PASS, "");
  if ((user.length === 0) !== (pass.length === 0)) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured together");
  }
  if (/\s/u.test(user) || containsAsciiControl(user) || /[\r\n]/u.test(pass)) {
    throw new Error("SMTP credentials contain invalid characters");
  }

  const from = requiredValue(EnvKeys.SMTP_FROM);
  if (!isSingleEmailAddress(from)) throw new Error("Env SMTP_FROM must be a single email address");

  return {
    smtp: {
      host: readHost(),
      port: readInteger(EnvKeys.SMTP_PORT, 1025, 1, 65_535),
      secure,
      requireTLS,
      ...(user.length > 0 ? { auth: { user, pass } } : {}),
      from,
      connectionTimeoutMs: readInteger(EnvKeys.SMTP_CONNECTION_TIMEOUT_MS, 10_000, 1, MAX_TIMEOUT_MS),
      greetingTimeoutMs: readInteger(EnvKeys.SMTP_GREETING_TIMEOUT_MS, 10_000, 1, MAX_TIMEOUT_MS),
      socketTimeoutMs: readInteger(EnvKeys.SMTP_SOCKET_TIMEOUT_MS, 20_000, 1, MAX_TIMEOUT_MS),
    },
    publicWebUrl: readPublicWebUrl(),
  };
}
