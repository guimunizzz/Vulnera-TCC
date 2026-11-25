/**
 * Adapta a validação do Turnstile ao contrato interno de CAPTCHA.
 * Existe para manter segredos e detalhes HTTP no adapter; é consumido pelo
 * factory da API e retorna falso diante de qualquer resposta inconclusiva.
 */

import type { TurnstileCaptchaConfig } from "../config/turnstile.config";
import type { CaptchaVerificationInput, CaptchaVerifier } from "../models/captcha.model";

const TOKEN_MAX_LENGTH = 2_048;
const TOKEN_MAX_AGE_MS = 5 * 60_000;
const FUTURE_CLOCK_SKEW_MS = 30_000;

type SiteverifyResponse = {
  success: boolean;
  challenge_ts?: unknown;
  hostname?: unknown;
  action?: unknown;
};

export class TurnstileCaptchaAdapter implements CaptchaVerifier {
  constructor(
    private readonly config: TurnstileCaptchaConfig,
    private readonly fetcher: typeof fetch = fetch,
    private readonly nowMs: () => number = () => Date.now(),
  ) {
    if (!config.secretKey || !Number.isFinite(config.timeoutMs) || config.timeoutMs < 1) {
      throw new Error("INVALID_TURNSTILE_CONFIG");
    }
  }

  async verify(input: CaptchaVerificationInput): Promise<boolean> {
    if (typeof input.token !== "string" || input.token.length === 0 || input.token.length > TOKEN_MAX_LENGTH) {
      return false;
    }

    const form = new URLSearchParams({
      secret: this.config.secretKey,
      response: input.token,
    });
    if (input.remoteIp) form.set("remoteip", input.remoteIp);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    timeout.unref();

    try {
      const response = await this.fetcher(this.config.verifyUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: controller.signal,
      });
      if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
        return false;
      }

      const payload: unknown = await response.json();
      if (!isSiteverifyResponse(payload) || !payload.success) return false;
      return this.hasCoherentChallenge(payload);
    } catch {
      // Timeout, rede, JSON inválido e falha do provedor não podem liberar o fluxo.
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  private hasCoherentChallenge(payload: SiteverifyResponse): boolean {
    if (typeof payload.challenge_ts !== "string" || typeof payload.hostname !== "string") {
      return false;
    }

    if (this.config.expectedHostname && payload.hostname !== this.config.expectedHostname) return false;
    if (this.config.expectedAction && payload.action !== this.config.expectedAction) return false;
    if (payload.action !== undefined && typeof payload.action !== "string") return false;

    const challengeAt = Date.parse(payload.challenge_ts);
    const ageMs = this.nowMs() - challengeAt;
    return Number.isFinite(challengeAt) && ageMs >= -FUTURE_CLOCK_SKEW_MS && ageMs <= TOKEN_MAX_AGE_MS;
  }
}

function isSiteverifyResponse(value: unknown): value is SiteverifyResponse {
  return typeof value === "object" && value !== null && "success" in value && typeof value.success === "boolean";
}
