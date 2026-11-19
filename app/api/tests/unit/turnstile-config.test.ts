/**
 * Protege a configuração Turnstile contra credenciais dummy em produção.
 * Evita que uma chave pública de teste aceite tokens em ambiente produtivo.
 * Consumido pela suíte Jest de configuração da API.
 */

import { loadTurnstileCaptchaConfig } from "../../src/config/turnstile.config";

const DUMMY_SECRET_KEYS = [
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
];

describe("loadTurnstileCaptchaConfig", () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    secret: process.env.TURNSTILE_SECRET_KEY,
  };

  afterEach(() => {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.secret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = previous.secret;
  });

  it.each(DUMMY_SECRET_KEYS)("rejects a Cloudflare test secret in production", (secret) => {
    process.env.NODE_ENV = "production";
    process.env.TURNSTILE_SECRET_KEY = secret;

    expect(() => loadTurnstileCaptchaConfig()).toThrow("INVALID_TURNSTILE_SECRET_KEY");
  });

  it("allows the Cloudflare test secret outside production for isolated development", () => {
    process.env.NODE_ENV = "development";
    process.env.TURNSTILE_SECRET_KEY = DUMMY_SECRET_KEYS[0];

    expect(loadTurnstileCaptchaConfig().secretKey).toBe(DUMMY_SECRET_KEYS[0]);
  });
});
