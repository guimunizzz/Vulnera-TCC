/**
 * Cliente HTTP anônimo para os fluxos públicos de acesso.
 * Mantém essas chamadas fora do cliente autenticado, que injeta JWT e tenta refresh.
 * Consumido por public-access.api.ts e sem acesso à store de autenticação.
 */

export interface PublicApiErrorOptions {
  retryAfterSeconds?: number;
}

export class PublicApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds?: number;

  constructor(status: number, code: string, options: PublicApiErrorOptions = {}) {
    super(code);
    this.name = "PublicApiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** Envia JSON sem credenciais, bearer, interceptors ou cache. */
export async function publicPost<T>(
  path: string,
  body: unknown,
  options?: { signal?: AbortSignal },
): Promise<T> {
  const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/u, "");
  const suffix = path.startsWith("/") ? path : "/" + path;

  let response: Response;
  try {
    response = await fetch(base + suffix, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
  } catch {
    throw new PublicApiError(0, "NETWORK_ERROR");
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const record = asRecord(payload);
    const responseCode = safeCode(record?.error) ?? safeCode(record?.code);
    const code = responseCode ?? (response.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR");
    const retryAfterSeconds = readRetryAfter(response.headers.get("Retry-After"), record?.retryAfterSeconds);
    throw new PublicApiError(response.status, code, { retryAfterSeconds });
  }

  if (payload === undefined) throw new PublicApiError(response.status, "INVALID_RESPONSE");
  return payload as T;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function safeCode(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]{0,63}$/u.test(value) ? value : undefined;
}

function readRetryAfter(header: string | null, bodyValue: unknown): number | undefined {
  const bodySeconds = positiveSeconds(bodyValue);
  if (bodySeconds !== undefined) return bodySeconds;
  if (!header) return undefined;

  const numeric = Number(header.trim());
  if (Number.isFinite(numeric) && numeric >= 0) return Math.ceil(numeric);
  const timestamp = Date.parse(header);
  return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - Date.now()) / 1000)) : undefined;
}

function positiveSeconds(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.ceil(value)
    : undefined;
}
