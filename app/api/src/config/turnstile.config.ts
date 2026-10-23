// Lê e valida a configuração do Siteverify do Turnstile.
// Mantém segredo, destino e limites fora do adapter HTTP.
// Consumido pela factory pública de AccessRequest; a leitura é lazy.

import { EnvVar } from "./EnvVar";
import { EnvKeys } from "./enum/EnvKeys";

export type TurnstileCaptchaConfig = {
  secretKey: string;
  verifyUrl: string;
  expectedHostname?: string;
  expectedAction?: string;
  timeoutMs: number;
};

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify" as const;
const MAX_TIMEOUT_MS = 10_000;

export function loadTurnstileCaptchaConfig(): TurnstileCaptchaConfig {
  const secretKey = EnvVar.get(EnvKeys.TURNSTILE_SECRET_KEY);
  if (
    secretKey !== secretKey.trim() ||
    secretKey.length < 1 ||
    secretKey.length > 2_048 ||
    containsControl(secretKey)
  ) {
    throw new Error("INVALID_TURNSTILE_SECRET_KEY");
  }

  const expectedHostname = optionalText(EnvKeys.TURNSTILE_EXPECTED_HOSTNAME, 253);
  if (expectedHostname && !isHostname(expectedHostname)) {
    throw new Error("INVALID_TURNSTILE_EXPECTED_HOSTNAME");
  }

  const expectedAction = optionalText(EnvKeys.TURNSTILE_EXPECTED_ACTION, 32);
  if (expectedAction && !/^[A-Za-z0-9_-]+$/u.test(expectedAction)) {
    throw new Error("INVALID_TURNSTILE_EXPECTED_ACTION");
  }

  const timeoutMs = readInteger(EnvKeys.TURNSTILE_TIMEOUT_MS, 5_000, 1, MAX_TIMEOUT_MS);
  return {
    secretKey,
    verifyUrl: VERIFY_URL,
    ...(expectedHostname ? { expectedHostname: expectedHostname.toLowerCase() } : {}),
    ...(expectedAction ? { expectedAction } : {}),
    timeoutMs,
  };
}

function optionalText(key: EnvKeys, maxLength: number): string | undefined {
  const raw = EnvVar.getOptional(key, "");
  if (raw.length === 0) return undefined;
  if (
    raw !== raw.trim() ||
    raw.length > maxLength ||
    containsControl(raw)
  ) {
    throw new Error(`INVALID_${key}`);
  }
  return raw;
}

function readInteger(key: EnvKeys, fallback: number, minimum: number, maximum: number): number {
  const raw = EnvVar.getOptional(key, String(fallback));
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) throw new Error(`INVALID_${key}`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`INVALID_${key}`);
  }
  return value;
}

function isHostname(value: string): boolean {
  if (value.length > 253 || value.startsWith(".") || value.endsWith(".")) return false;
  const labels = value.split(".");
  return labels.every((label) =>
    label.length > 0 && label.length <= 63 &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/u.test(label),
  );
}

function containsControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}
