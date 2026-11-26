/**
 * Simula a emissão e validação de desafios CAPTCHA em testes locais.
 * Existe para cobrir uso único, expiração e indisponibilidade sem Cloudflare;
 * é consumida apenas pelas suítes de testes.
 */

import type { CaptchaVerificationInput, CaptchaVerifier } from "../../src/models/captcha.model";

export type FakeCaptchaVerifierOptions = {
  ttlMs?: number;
  nowMs?: () => number;
};

export class FakeCaptchaVerifier implements CaptchaVerifier {
  private readonly tokens = new Map<string, number>();
  private readonly ttlMs: number;
  private readonly nowMs: () => number;
  private sequence = 0;
  private failing = false;

  constructor(options: FakeCaptchaVerifierOptions = {}) {
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    this.nowMs = options.nowMs ?? (() => Date.now());
  }

  issueToken(): string {
    this.sequence += 1;
    const token = `fake-captcha-${this.sequence}`;
    this.tokens.set(token, this.nowMs() + this.ttlMs);
    return token;
  }

  setFailure(failing: boolean): void {
    this.failing = failing;
  }

  async verify(input: CaptchaVerificationInput): Promise<boolean> {
    if (this.failing) return false;

    const expiresAt = this.tokens.get(input.token);
    if (expiresAt === undefined || expiresAt <= this.nowMs()) {
      this.tokens.delete(input.token);
      return false;
    }

    this.tokens.delete(input.token);
    return true;
  }
}
