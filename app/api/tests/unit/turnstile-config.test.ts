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
const REAL_SECRET = "production-secret-for-config-tests-not-a-cloudflare-dummy";

describe("loadTurnstileCaptchaConfig", () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    secret: process.env.TURNSTILE_SECRET_KEY,
    expectedHostname: process.env.TURNSTILE_EXPECTED_HOSTNAME,
    expectedAction: process.env.TURNSTILE_EXPECTED_ACTION,
  };

  afterEach(() => {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.secret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = previous.secret;
    if (previous.expectedHostname === undefined) delete process.env.TURNSTILE_EXPECTED_HOSTNAME;
    else process.env.TURNSTILE_EXPECTED_HOSTNAME = previous.expectedHostname;
    if (previous.expectedAction === undefined) delete process.env.TURNSTILE_EXPECTED_ACTION;
    else process.env.TURNSTILE_EXPECTED_ACTION = previous.expectedAction;
  });

  it.each(DUMMY_SECRET_KEYS)("rejects a Cloudflare test secret in production", (secret) => {
    process.env.NODE_ENV = "production";
    process.env.TURNSTILE_SECRET_KEY = secret;

    expect(() => loadTurnstileCaptchaConfig()).toThrow("INVALID_TURNSTILE_SECRET_KEY");
  });

  it.each(["development", "test"])("allows the Cloudflare test secret without Siteverify expectations in %s", (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;
    process.env.TURNSTILE_SECRET_KEY = DUMMY_SECRET_KEYS[0];
    delete process.env.TURNSTILE_EXPECTED_HOSTNAME;
    delete process.env.TURNSTILE_EXPECTED_ACTION;

    expect(loadTurnstileCaptchaConfig().secretKey).toBe(DUMMY_SECRET_KEYS[0]);
  });

  it.each([
    ["TURNSTILE_EXPECTED_HOSTNAME", "MISSING_TURNSTILE_EXPECTED_HOSTNAME"],
    ["TURNSTILE_EXPECTED_ACTION", "MISSING_TURNSTILE_EXPECTED_ACTION"],
  ] as const)("requires %s in production", (missingKey, errorCode) => {
    process.env.NODE_ENV = "production";
    process.env.TURNSTILE_SECRET_KEY = REAL_SECRET;
    process.env.TURNSTILE_EXPECTED_HOSTNAME = "vulnera.example.com";
    process.env.TURNSTILE_EXPECTED_ACTION = "access-request";
    delete process.env[missingKey];

    expect(() => loadTurnstileCaptchaConfig()).toThrow(errorCode);
  });

  it("returns normalized Siteverify expectations for production", () => {
    process.env.NODE_ENV = "production";
    process.env.TURNSTILE_SECRET_KEY = REAL_SECRET;
    process.env.TURNSTILE_EXPECTED_HOSTNAME = "Vulnera.Example.com";
    process.env.TURNSTILE_EXPECTED_ACTION = "access-request";

    expect(loadTurnstileCaptchaConfig()).toMatchObject({
      secretKey: REAL_SECRET,
      expectedHostname: "vulnera.example.com",
      expectedAction: "access-request",
      verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    });
  });

  it.each([
    ["TURNSTILE_EXPECTED_HOSTNAME", "https://vulnera.example.com", "INVALID_TURNSTILE_EXPECTED_HOSTNAME"],
    ["TURNSTILE_EXPECTED_ACTION", "access request", "INVALID_TURNSTILE_EXPECTED_ACTION"],
  ] as const)("rejects malformed %s in production", (key, value, errorCode) => {
    process.env.NODE_ENV = "production";
    process.env.TURNSTILE_SECRET_KEY = REAL_SECRET;
    process.env.TURNSTILE_EXPECTED_HOSTNAME = "vulnera.example.com";
    process.env.TURNSTILE_EXPECTED_ACTION = "access-request";
    process.env[key] = value;

    expect(() => loadTurnstileCaptchaConfig()).toThrow(errorCode);
  });
});
