/**
 * O que faz: isola os E2E determinísticos do fluxo público e administrativo de acesso.
 * Por que existe: a suíte padrão usa a stack real; este recorte usa Vite e APIs simuladas.
 * Quem consome: somente a execução focal da Etapa 6 da Issue 51.
 */
import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_DIR = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(WEB_DIR, "../../output/issue51-stage6");

export default defineConfig({
  testDir: resolve(WEB_DIR, "e2e"),
  testMatch: ["controlled-access.spec.ts"],
  outputDir: resolve(EVIDENCE_DIR, "playwright-results"),
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4179",
    ...devices["Desktop Chrome"],
    channel: "chrome",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4179 --strictPort",
    cwd: WEB_DIR,
    url: "http://127.0.0.1:4179",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_API_URL: "/api",
      VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      VITE_TURNSTILE_ACTION: "access-request",
    },
  },
});
