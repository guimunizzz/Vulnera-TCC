/**
 * playwright.config.ts
 *
 * O QUE FAZ
 * Configura os testes de ponta a ponta que dirigem um Chrome de verdade
 * contra a aplicação REAL — front, API, banco e (quando disponível) o OWASP
 * ZAP em Docker.
 *
 * POR QUE EXISTE, se já há Vitest e Supertest
 * As três suítes respondem perguntas diferentes e nenhuma cobre a outra:
 *   - Vitest (app/web)  — um componente isolado se comporta como esperado?
 *   - Supertest (app/api) — o endpoint responde o status e o corpo certos?
 *   - Playwright (aqui) — a PESSOA consegue fazer a tarefa do começo ao fim?
 * Um bug de fiação (o botão existe, o endpoint existe, mas nada os liga)
 * passa pelas duas primeiras e só cai aqui.
 *
 * ⚠️ NÃO SOBE NADA SOZINHO — de propósito.
 * Não há `webServer` nesta config: a stack precisa estar de pé antes
 * (`docker compose up -d`, entrada em http://localhost:8086). O motivo é que
 * o alvo destes testes é a stack REAL, com o mesmo banco e o mesmo Docker que
 * a demonstração vai usar; subir uma cópia efêmera aqui testaria outra coisa.
 * Se a stack não estiver de pé, o teste falha dizendo isso em vez de fingir.
 *
 * COMO RODAR
 *   docker compose up -d              (na raiz do repositório)
 *   npm run test:e2e --workspace=app/web
 *   npm run test:e2e:ui --workspace=app/web    (modo interativo, com inspetor)
 *
 * ⚠️ RODE A SUÍTE SOZINHA. Cada caso dispara scans REAIS, e cada scan é um
 * container com uma JVM de até 2GB (ver DAST_ZAP_MEMORY) somada à VM do
 * Docker, ao Chrome do Playwright e ao Node. Rodando junto com `npm test` do
 * backend numa máquina de 16GB, em 2026-09-09, o SO matou o worker do
 * Playwright com `worker process exited unexpectedly` — que **parece** falha
 * de teste e não é. Se aparecer essa mensagem, feche o que estiver aberto e
 * rode de novo antes de investigar o produto.
 */

import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8086";

export default defineConfig({
  testDir: "./e2e",
  // Um scan real leva de 40s a 3min: o default de 30s do Playwright reprovaria
  // o fluxo mais importante da suíte por impaciência, não por defeito.
  timeout: 5 * 60 * 1000,
  expect: { timeout: 15_000 },

  // Serial de propósito: os testes compartilham a MESMA stack e o mesmo banco,
  // e o watchdog só deixa 2 scans rodarem ao mesmo tempo. Paralelizar aqui
  // produziria falhas de fila que não são bugs do produto.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    // Rastro e screenshot só do que falhou — o suficiente pra entender o erro
    // sem encher o disco a cada execução verde.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
