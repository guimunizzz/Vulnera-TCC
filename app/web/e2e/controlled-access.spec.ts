/**
 * O que faz: valida no Chrome os fluxos navegáveis da Etapa 6 de acesso controlado.
 * Por que existe: confirma a ligação entre rotas, controles visuais e contratos HTTP.
 * Quem consome: QA focal, com servidor Vite e respostas locais simuladas.
 *
 * Nenhuma chamada sai do navegador de teste: /api/** é interceptado e o script
 * Turnstile é servido por fixture local. O estado autenticado é isolado no
 * localStorage desta instância Playwright e não usa o perfil real do Chrome.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test as base, type Page } from "@playwright/test";
import type { AdminAccessRequest, AdminAccessRequestEvent } from "../src/types/admin-access-requests.types";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const REGRAS_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const SPEC_DIR = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(SPEC_DIR, "../../../output/issue51-stage6/screenshots");
const BASE_ORIGIN = "http://127.0.0.1:4179";
const INVITE_TOKEN = "A".repeat(43);
const COMPANY_INVITE_TOKEN = "team_" + "C".repeat(43);
const EMAIL_TOKEN = "B".repeat(43);
const ACCESS_REQUEST_ID = "access-request-e2e";

type ApiCall = {
  path: string;
  method: string;
  body: unknown;
  authorization: string | null;
  cookie: string | null;
};

type ApiHarness = {
  calls: ApiCall[];
  requestStatus: () => string;
  activationValid: (valid: boolean) => void;
};

const requestFields: AdminAccessRequest = {
  id: ACCESS_REQUEST_ID,
  name: "Rafaela QA",
  email: "rafaela.qa@example.test",
  companyName: "Empresa QA",
  phone: "+55 11 99999-0000",
  status: "PENDING_REVIEW",
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  emailVerifiedAt: "2026-11-17T12:00:00.000Z",
  reviewedAt: null,
  reviewedById: null,
  rejectionReason: null,
  enrollment: {
    planId: "plan-e2e", planName: "Plano QA", planPrice: "250.00", companyCnpj: null,
    planMaxApplications: 5, planMaxProjects: 3, planIncludesRemediation: true,
  },
  createdAt: "2026-11-17T11:00:00.000Z",
  updatedAt: "2026-11-17T12:00:00.000Z",
};

const test = base.extend<{ api: ApiHarness }>({
  api: [async ({ page }, use) => {
    await use(await installLocalFakes(page));
  }, { auto: true }],
});

test.use({ bypassCSP: true });

test.beforeAll(() => {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
});

async function installLocalFakes(page: Page): Promise<ApiHarness> {
  const calls: ApiCall[] = [];
  let request: AdminAccessRequest = { ...requestFields };
  let activationTokenValid = true;
  const events: AdminAccessRequestEvent[] = [
    {
      id: "event-e2e-1",
      eventType: "EMAIL_VERIFIED",
      actorId: null,
      fromStatus: "PENDING_EMAIL_VERIFICATION",
      toStatus: "PENDING_REVIEW",
      reason: null,
      createdAt: "2026-11-17T12:00:00.000Z",
    },
  ];

  // O fallback mantém somente tráfego do próprio Vite; destinos externos falham fechados.
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin === BASE_ORIGIN) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });

  // Esta resposta local instala uma API Turnstile mínima e exercita render/reset/remove.
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/javascript; charset=utf-8",
      body: `(() => {
        let nextId = 0;
        const widgets = new Map();
        const calls = { render: 0, reset: [], remove: [] };
        const latest = () => [...widgets.values()].at(-1);
        window.turnstile = {
          render(host, options) {
            const id = "local-turnstile-" + (++nextId);
            widgets.set(id, options);
            host.dataset.turnstileWidget = id;
            calls.render++;
            return id;
          },
          reset(id) { calls.reset.push(id ?? null); },
          remove(id) { calls.remove.push(id); widgets.delete(id); },
        };
        window.__turnstileE2E = {
          issue(token = "local-captcha-token") { latest()?.callback(token); },
          expire() { latest()?.["expired-callback"](); },
          fail() { latest()?.["error-callback"](); },
          calls,
        };
      })();`,
    });
  });

  // Todas as rotas da aplicação recebem respostas locais; não há backend, banco ou SMTP.
  await page.route((url) => url.origin === BASE_ORIGIN && url.pathname.startsWith("/api/"), async (route) => {
    const requestInfo = route.request();
    const url = new URL(requestInfo.url());
    const path = url.pathname;
    const method = requestInfo.method();
    const headers = requestInfo.headers();
    let body: unknown = null;
    try {
      body = requestInfo.postDataJSON();
    } catch {
      body = requestInfo.postData();
    }
    calls.push({
      path,
      method,
      body,
      authorization: headers.authorization ?? null,
      cookie: headers.cookie ?? null,
    });

    const json = (payload: unknown, status = 200) => route.fulfill({
      status,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(payload),
    });

    if (path === "/api/access-requests" && method === "POST") {
      await json({ message: "Solicitação recebida." }, 202);
      return;
    }
    if (path === "/api/access-requests/resend-verification" && method === "POST") {
      await json({ message: "Se os dados informados permitirem, você receberá as instruções por e-mail." }, 202);
      return;
    }
    if (path === "/api/access-requests/verify-email" && method === "POST") {
      await json({ message: "E-mail confirmado." });
      return;
    }
    if (path === "/api/account-activation/validate" && method === "POST") {
      await json({ valid: activationTokenValid });
      return;
    }
    if (path === "/api/account-activation/activate" && method === "POST") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/api/company-invitations/validate" && method === "POST") {
      await json({ valid: (body as { token?: string })?.token === COMPANY_INVITE_TOKEN });
      return;
    }
    if (path === "/api/company-invitations/activate" && method === "POST") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (path === "/api/saved-queries" && method === "GET") {
      await json([]);
      return;
    }
    if (path === "/api/notifications/unread-count" && method === "GET") {
      await json({ naoLidas: 0 });
      return;
    }
    if (path === "/api/notifications" && method === "GET") {
      await json({ data: [], naoLidas: 0 });
      return;
    }

    if (path === "/api/admin/access-requests" && method === "GET") {
      const filtered = url.searchParams.get("status");
      const visible = !filtered || filtered === request.status;
      await json({ items: visible ? [request] : [], total: visible ? 1 : 0, page: 1, pageSize: 20 });
      return;
    }
    const detailMatch = path.match(/^\/api\/admin\/access-requests\/([^/]+)$/u);
    if (detailMatch && method === "GET") {
      await json({
        ...request,
        enrollmentEligibility: "ELIGIBLE",
        invitation: request.status === "APPROVED"
          ? { issuedAt: "2026-11-17T12:01:00.000Z", expiresAt: "2026-11-24T12:01:00.000Z", usedAt: null, revokedAt: null }
          : null,
      });
      return;
    }
    const eventsMatch = path.match(/^\/api\/admin\/access-requests\/([^/]+)\/events$/u);
    if (eventsMatch && method === "GET") {
      await json({ items: events, total: events.length, page: 1, pageSize: 20 });
      return;
    }
    const approveMatch = path.match(/^\/api\/admin\/access-requests\/([^/]+)\/approve$/u);
    if (approveMatch && method === "POST") {
      request = { ...request, status: "APPROVED", reviewedAt: "2026-11-17T12:02:00.000Z", updatedAt: "2026-11-17T12:02:00.000Z" };
      events.push({
        id: "event-e2e-2",
        eventType: "APPROVED",
        actorId: "admin-e2e",
        fromStatus: "PENDING_REVIEW",
        toStatus: "APPROVED",
        reason: null,
        createdAt: "2026-11-17T12:02:00.000Z",
      });
      await json({ request, invitationDelivery: "SENT" });
      return;
    }
    const rejectMatch = path.match(/^\/api\/admin\/access-requests\/([^/]+)\/reject$/u);
    if (rejectMatch && method === "POST") {
      request = { ...request, status: "REJECTED", rejectionReason: (body as { reason?: string | null })?.reason ?? null };
      await json({ request });
      return;
    }

    if (path === "/api/auth/login" && method === "POST") {
      await json({
        accessToken: "e2e-login-access-token",
        refreshToken: "e2e-login-refresh-token",
        user: {
          id: "client-without-company",
          name: "Cliente E2E",
          email: "cliente@example.test",
          role: "CLIENT",
          companyId: null,
          companyRole: null,
          legacyOnboardingAllowed: true,
          createdAt: "2026-11-17T10:00:00.000Z",
        },
      });
      return;
    }
    if (path === "/api/auth/refresh" && method === "POST") {
      await json({ accessToken: "e2e-refreshed-access-token", refreshToken: "e2e-refreshed-refresh-token" });
      return;
    }
    if (path === "/api/companies/me" && method === "GET") {
      await json({ error: "USER_HAS_NO_COMPANY" }, 404);
      return;
    }
    if (path === "/api/plans" && method === "GET") {
      await json([{
        id: "plan-e2e", name: "Plano QA", isActive: true, price: 250,
        maxApplications: 5, maxProjects: 3, includesRemediation: true,
        createdAt: "2026-11-17T10:00:00.000Z",
      }]);
      return;
    }

    await json({ error: "UNMOCKED_E2E_ENDPOINT", path, method }, 501);
  });

  return {
    calls,
    requestStatus: () => request.status,
    activationValid: (valid) => { activationTokenValid = valid; },
  };
}

async function seedSession(
  page: Page,
  role: "ADMIN" | "CLIENT" | "PENTESTER",
  companyId: string | null = null,
  companyRole: "OWNER" | "MEMBER" = "OWNER",
) {
  await page.addInitScript(({ seededRole, seededCompanyId, seededCompanyRole }) => {
    localStorage.setItem("vulnera-auth", JSON.stringify({
      state: {
        accessToken: "e2e-admin-access-token",
        refreshToken: "e2e-admin-refresh-token",
        user: {
          id: `user-${seededRole.toLowerCase()}`,
          name: `Usuário ${seededRole}`,
          email: `${seededRole.toLowerCase()}@example.test`,
          role: seededRole,
          companyId: seededCompanyId,
          companyRole: seededCompanyId ? seededCompanyRole : null,
          legacyOnboardingAllowed: false,
          createdAt: "2026-11-17T10:00:00.000Z",
        },
      },
      version: 0,
    }));
    localStorage.setItem("vulnera:theme", "dark");
  }, { seededRole: role, seededCompanyId: companyId, seededCompanyRole: companyRole });
}

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.addInitScript((value) => localStorage.setItem("vulnera:theme", value), theme);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: resolve(SCREENSHOTS_DIR, name), fullPage: true, animations: "disabled" });
}

async function scanAxe(page: Page, panelSelector: string): Promise<string[]> {
  await page.addScriptTag({ path: AXE_PATH });
  // A varredura fica nos painéis novos. A tentativa em documento inteiro detectou
  // incompatibilidade de nome no link de marca preexistente do AuthLayout, fora deste recorte.
  return page.locator(panelSelector).evaluate(async (root, tags) => {
    const axe = (window as unknown as { axe: { run: (target: Element, options: unknown) => Promise<{ violations: Array<{ id: string; impact?: string; nodes: Array<{ target: string[] }> }> }> } }).axe;
    const result = await axe.run(root, { runOnly: { type: "tag", values: tags } });
    return result.violations.map((violation) =>
      `${violation.id} (${violation.impact ?? "impact unknown"}): ${violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(" | ")}`,
    );
  }, REGRAS_WCAG);
}

async function assertNoHorizontalOverflow(page: Page, expectedWidth: number) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.viewport).toBe(expectedWidth);
  expect(dimensions.document, `largura da página: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(expectedWidth);
}

async function fillRequestForm(page: Page) {
  await page.getByLabel("Nome").fill("Rafaela QA");
  await page.getByLabel("E-mail").fill("rafaela.qa@example.test");
  await page.getByLabel("Telefone (opcional)").fill("+55 11 99999-0000");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Empresa").fill("Empresa QA");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("radio", { name: /Plano QA/u }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

async function issueCaptcha(page: Page, token = "local-captcha-token") {
  await expect(page.locator('[data-testid="turnstile-host"]')).toHaveAttribute(
    "data-turnstile-widget",
    /^local-turnstile-/u,
  );
  await page.evaluate((captchaToken) => {
    (window as unknown as { __turnstileE2E?: { issue: (value: string) => void } }).__turnstileE2E?.issue(captchaToken);
  }, token);
}

test.describe("Pedido público e legado de cadastro", () => {
  test("CA-01 — CTA da landing e /register levam ao pedido de acesso sem chamar registro legado", async ({ page, api }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setTheme(page, "dark");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const cta = page.getByRole("link", { name: "Solicitar acesso →", exact: true });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/request-access$/u);
    await expect(page.getByRole("heading", { name: "Solicitar acesso" })).toBeVisible();

    await page.goto("/register");
    await expect(page).toHaveURL(/\/request-access$/u);
    await expect(page.getByRole("heading", { name: "Solicitar acesso" })).toBeVisible();
    expect(api.calls.filter((call) => call.path === "/api/auth/register")).toEqual([]);
    await screenshot(page, "01-request-access-landing-cta.png");
  });

  test("CA-02 — formulário exige CAPTCHA válido e envia campos sem credenciais", async ({ page, api }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setTheme(page, "light");
    await page.goto("/request-access");
    await expect(page.getByRole("heading", { name: "Solicitar acesso" })).toBeVisible();
    await fillRequestForm(page);
    const submit = page.getByRole("button", { name: "Enviar solicitação" });
    await expect(submit).toBeDisabled();
    await page.locator("form[aria-labelledby='request-access-title']").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.getByRole("alert").filter({ hasText: "Conclua a verificação de segurança" })).toBeVisible();
    expect(api.calls.filter((call) => call.path === "/api/access-requests")).toHaveLength(0);

    await issueCaptcha(page);
    await expect(submit).toBeEnabled();
    await page.evaluate(() => {
      (window as unknown as { __turnstileE2E?: { expire: () => void } }).__turnstileE2E?.expire();
    });
    await expect(submit).toBeDisabled();
    await page.locator("form[aria-labelledby='request-access-title']").evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.getByRole("alert").filter({ hasText: "Conclua a verificação de segurança" })).toBeVisible();
    expect(api.calls.filter((call) => call.path === "/api/access-requests")).toHaveLength(0);

    await issueCaptcha(page, "captcha-valid-for-request");
    await submit.click();
    await expect(page.getByRole("status").filter({ hasText: "Se os dados informados permitirem" })).toBeVisible();
    const call = api.calls.find((entry) => entry.path === "/api/access-requests" && entry.method === "POST");
    expect(call?.body).toEqual({
      name: "Rafaela QA",
      email: "rafaela.qa@example.test",
      companyName: "Empresa QA",
      phone: "+55 11 99999-0000",
      planId: "plan-e2e",
      captchaToken: "captcha-valid-for-request",
    });
    expect(call?.authorization).toBeNull();
    expect(call?.cookie).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("vulnera-auth"))).toBeNull();
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    await expect(submit).toBeDisabled(); // O desafio consumido foi reiniciado.
    await screenshot(page, "02-request-access-neutral-confirmation.png");
  });

  test("CA-03 — campos, foco por teclado e layouts públicos em tema claro/escuro", async ({ page }) => {
    const widths = [320, 390, 1440];
    for (const theme of ["light", "dark"] as const) {
      await setTheme(page, theme);
      for (const width of widths) {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
        await page.goto("/request-access");
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await assertNoHorizontalOverflow(page, width);
        await page.getByLabel("Nome").waitFor({ state: "visible" });
        if (width === 320 && theme === "light") {
          const heading = page.getByRole("heading", { name: "Solicitar acesso" });
          await expect(heading).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(page.getByLabel("Nome")).toBeFocused();
          await page.keyboard.press("Tab");
          await expect(page.getByLabel("E-mail")).toBeFocused();
        }
        if (width === 320 || width === 1440) {
          await screenshot(page, `03-request-access-${width}-${theme}.png`);
        }
      }
    }
  });
});

test.describe("Verificação de e-mail e ativação", () => {
  test("CA-04 — fragmento é removido antes da ação e token só segue ao confirmar", async ({ page, api }) => {
    await setTheme(page, "dark");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/verify-email?origem=e2e#token=${EMAIL_TOKEN}`);
    await expect(page.getByRole("heading", { name: "Confirmar e-mail" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
    await expect.poll(() => page.evaluate(() => location.search)).toBe("?origem=e2e");
    expect(api.calls.filter((call) => call.path === "/api/access-requests/verify-email")).toHaveLength(0);
    const secretsBeforeAction = await page.evaluate(() => JSON.stringify({
      local: Object.values(localStorage),
      session: Object.values(sessionStorage),
    }));
    expect(secretsBeforeAction).not.toContain(EMAIL_TOKEN);

    await page.getByRole("button", { name: "Confirmar e-mail" }).click();
    await expect(page.getByRole("status").filter({ hasText: "E-mail confirmado" })).toBeVisible();
    const call = api.calls.find((entry) => entry.path === "/api/access-requests/verify-email");
    expect(call?.body).toEqual({ token: EMAIL_TOKEN });
    expect(call?.authorization).toBeNull();
    expect(call?.cookie).toBeNull();
    await screenshot(page, "04-email-verified-fragment-scrubbed.png");
  });

  test("CA-05 — convite inválido não habilita senha nem cria sessão", async ({ page, api }) => {
    api.activationValid(false);
    await page.goto(`/activate-account#token=${INVITE_TOKEN}`);
    await expect(page.getByRole("heading", { name: "Ativar conta" })).toBeAttached();
    await expect(page.getByRole("alert").filter({ hasText: "Convite indisponível" })).toBeVisible();
    await expect(page.locator('input[name="password"]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
    expect(api.calls.filter((call) => call.path === "/api/account-activation/activate")).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem("vulnera-auth"))).toBeNull();
    await screenshot(page, "05-activation-expired-invitation.png");
  });

  test("CA-06 — ativação envia só token e senha, sem abrir sessão", async ({ page, api }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/activate-account#token=${INVITE_TOKEN}`);
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
    await page.locator('input[name="password"]').fill("SenhaSegura123!");
    await page.locator('input[name="passwordConfirmation"]').fill("SenhaSegura123!");
    await page.getByRole("button", { name: "Ativar conta" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Conta ativada" })).toBeVisible();
    const call = api.calls.find((entry) => entry.path === "/api/account-activation/activate");
    expect(call?.body).toEqual({ token: INVITE_TOKEN, password: "SenhaSegura123!" });
    expect(call?.authorization).toBeNull();
    expect(call?.cookie).toBeNull();
    const storageAfterActivation = await page.evaluate(() => JSON.stringify({ local: Object.values(localStorage), session: Object.values(sessionStorage) }));
    expect(storageAfterActivation).not.toContain(INVITE_TOKEN);
    expect(storageAfterActivation).not.toContain("e2e-login-access-token");
    expect(await page.evaluate(() => localStorage.getItem("vulnera-auth"))).toBeNull();
    await screenshot(page, "06-account-activated-no-session.png");
    await page.getByRole("link", { name: "Ir para o login" }).click();
    await expect(page).toHaveURL(/\/login$/u);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeAttached();
  });
});

test.describe("Fila administrativa e isolamento por papel", () => {
  test("CA-07 — ADMIN aprova, vê o novo estado e a auditoria sem SMTP real", async ({ page, api }) => {
    await seedSession(page, "ADMIN");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/access-requests");
    await expect(page.getByRole("heading", { name: "Central de solicitações" })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "rafaela.qa@example.test" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Ver detalhes" }).click();
    await expect(page.getByRole("heading", { name: "Rafaela QA" })).toBeVisible();
    await page.getByRole("button", { name: "Aprovar" }).click();
    await expect(page.getByRole("dialog", { name: "Aprovar solicitação?" })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Confirmar" }).click();
    await expect.poll(api.requestStatus).toBe("APPROVED");
    await expect(page.getByText("Aprovada", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("APPROVED")).toBeVisible();
    expect(api.calls.some((call) => call.path === `/api/admin/access-requests/${ACCESS_REQUEST_ID}/approve` && call.method === "POST")).toBe(true);
    expect(api.calls.filter((call) => call.path.startsWith("/api/admin/access-requests/")).every((call) => call.authorization === "Bearer e2e-admin-access-token")).toBe(true);
    expect(api.calls.some((call) => call.path.includes("smtp") || call.path.includes("mail"))).toBe(false);
    await screenshot(page, "07-admin-approved-request-audit.png");
  });

  for (const role of ["CLIENT", "PENTESTER"] as const) {
    test(`CA-08 — ${role} não acessa a fila ADMIN`, async ({ page, api }) => {
      await seedSession(page, role, role === "CLIENT" ? "company-client-e2e" : null);
      await page.goto("/admin/access-requests");
      await expect(page).toHaveURL(/\/dashboard$/u);
      expect(api.calls.filter((call) => call.path.startsWith("/api/admin/access-requests"))).toEqual([]);
    });
  }

  test("CA-09 — fila, verificação e ativação passam axe-core e não criam overflow nos tamanhos móveis", async ({ page, api }) => {
    test.setTimeout(90_000);
    for (const [route, title, panelSelector] of [
      ["/request-access", "Solicitar acesso", ".vx-request-access-panel"],
      ["/verify-email", "Confirmar e-mail", ".vx-verify-email-panel"],
      ["/activate-account", "Ativar conta", ".vx-activate-panel"],
    ] as const) {
      for (const width of [320, 390, 1440]) {
        const theme = width === 390 ? "light" : "dark";
        await setTheme(page, theme);
        await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
        await page.goto(route);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await expect(page.getByRole("heading", { name: title })).toBeAttached();
        await assertNoHorizontalOverflow(page, width);
        if (width === 390) {
          if (route === "/request-access") {
            expect(await scanAxe(page, panelSelector), "responsável axe-core").toEqual([]);
            await fillRequestForm(page);
            await issueCaptcha(page, "captcha-a11y-test");
          }
          expect(await scanAxe(page, panelSelector), `${route} axe-core`).toEqual([]);
        }
      }
    }

    // Verificação de e-mail aguarda ação explícita mesmo com token presente.
    await setTheme(page, "dark");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/verify-email#token=${EMAIL_TOKEN}`);
    await expect(page.getByRole("button", { name: "Confirmar e-mail" })).toBeVisible();
    expect(await scanAxe(page, ".vx-verify-email-panel"), "confirmação de e-mail axe-core").toEqual([]);

    // A ativação valida o fragmento e renderiza o formulário antes do scan.
    api.activationValid(true);
    await page.goto(`/activate-account#token=${INVITE_TOKEN}`);
    await expect(page.locator('input[name="password"]')).toBeVisible();
    expect(await scanAxe(page, ".vx-activate-panel"), "formulário de ativação axe-core").toEqual([]);

    await seedSession(page, "ADMIN");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/access-requests");
    await expect(page.getByRole("heading", { name: "Central de solicitações" })).toBeVisible();
    await assertNoHorizontalOverflow(page, 390);
    expect(await scanAxe(page, ".access-requests-page"), "fila ADMIN axe-core").toEqual([]);
    await screenshot(page, "08-admin-access-requests-mobile-390.png");
  });
});

test("A rota Minha equipe bloqueia MEMBER antes de carregar dados administrativos", async ({ page, api }) => {
  await seedSession(page, "CLIENT", "company-e2e", "MEMBER");
  await page.goto("/team");
  await expect(page).toHaveURL(/\/dashboard$/u);
  expect(api.calls.some(({ path }) => path.startsWith("/api/companies/me/invitations"))).toBe(false);
});

test("Convite de equipe remove o fragmento, define senha e segue para login", async ({ page, api }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/join-company#token=${COMPANY_INVITE_TOKEN}`);
  await expect(page.getByRole("heading", { name: "Entrar para a equipe" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
  const passwords = page.locator('input[type="password"]');
  await passwords.nth(0).fill("senha-equipe-playwright-123");
  await passwords.nth(1).fill("senha-equipe-playwright-123");
  await page.getByRole("button", { name: "Ativar acesso", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Acesso ativado" })).toBeVisible();
  const calls = api.calls.filter(({ path }) => path.startsWith("/api/company-invitations/"));
  expect(calls.map(({ path, authorization, cookie }) => ({ path, authorization, cookie }))).toEqual([
    { path: "/api/company-invitations/validate", authorization: null, cookie: null },
    { path: "/api/company-invitations/activate", authorization: null, cookie: null },
  ]);
  expect(calls[1]?.body).toEqual({ token: COMPANY_INVITE_TOKEN, password: "senha-equipe-playwright-123" });
  expect(await page.evaluate(() => localStorage.getItem("vulnera-auth"))).toBeNull();
  await page.getByRole("link", { name: "Ir para o login" }).click();
  await expect(page).toHaveURL(/\/login$/u);
});

test("CA-10 — login de CLIENT legado sem empresa segue para onboarding", async ({ page, api }) => {
  await setTheme(page, "dark");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("cliente@example.test");
  await page.locator('input[name="password"]').fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar na plataforma" }).click();
  await expect(page).toHaveURL(/\/onboarding$/u);
  await expect(page.getByText("Configure sua empresa")).toBeVisible();
  expect(api.calls.some((call) => call.path === "/api/auth/login" && call.method === "POST")).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("vulnera-auth"))).toContain("e2e-login-access-token");
  await screenshot(page, "09-client-without-company-onboarding.png");
});
