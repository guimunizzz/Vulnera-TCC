/**
 * create-project-flow.spec.ts (e2e)
 *
 * O QUE FAZ: valida o fluxo real de criação de Project pelas entradas Projetos e Aplicações.
 * POR QUE EXISTE: confirma que navegação, RBAC, API, persistência e retorno à lista funcionam juntos.
 * QUEM CONSOME: smoke Playwright da issue #20 contra a stack Vulnera real.
 *
 * ⚠️ Os registros de setup usam um marcador exclusivo e ficam preservados no banco.
 * Não há reset nem cleanup: AuditLog é append-only e a stack alvo pode conter dados do usuário.
 */

import { expect, test, type APIRequestContext, type APIResponse, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { API_URL, CREDENCIAIS } from "./helpers";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:8086";
const ARTIFACTS_DIR = process.env.E2E_OUTPUT_DIR ?? resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../output/issue-20",
);

test.use({ trace: "off" });

if (process.env.E2E_CHROMIUM_EXECUTABLE) {
  test.use({
    launchOptions: {
      executablePath: process.env.E2E_CHROMIUM_EXECUTABLE,
      args: ["--no-sandbox"],
    },
  });
}

type AuthResult = {
  accessToken: string;
  user: { id: string; email: string; role: string; companyId: string | null };
};

type Plan = {
  id: string;
  name: string;
  maxApplications: number;
  maxProjects: number;
  includesRemediation: boolean;
  isActive: boolean;
};

type Application = { id: string; name: string; companyId: string; isActive: boolean; url?: string | null };
type Project = { id: string; name: string; applicationId: string; companyId: string; status: string };

type Setup = {
  marker: string;
  clientEmail: string;
  clientPassword: string;
  companyId: string;
  applicationA: Application;
  applicationB: Application;
  adminToken: string;
};

type RateLimitObservation = { path: string; retryAfterMs: number };
const rateLimitObservations = new WeakMap<Page, RateLimitObservation[]>();

function esperaDoRetryAfter(rawRetryAfter: string | undefined): number | null {
  if (!rawRetryAfter) return null;
  const seconds = Number(rawRetryAfter);
  const retryAt = Number.isFinite(seconds)
    ? Date.now() + seconds * 1_000
    : Date.parse(rawRetryAfter);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
}

async function getComRetryAfter(
  request: APIRequestContext,
  url: string,
  headers?: Record<string, string>,
): Promise<APIResponse> {
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const response = await request.get(url, { headers });
    if (response.status() !== 429 || tentativa === 3) return response;
    const retryAfterMs = esperaDoRetryAfter(response.headers()["retry-after"]);
    expect(retryAfterMs, `429 de GET ${url} deve informar Retry-After`).not.toBeNull();
    // Repetimos somente leitura e respeitamos o prazo que a API comunicou.
    await new Promise((resolvePromise) => setTimeout(resolvePromise, retryAfterMs! + 100));
  }
  throw new Error("Fluxo de retry de GET terminou inesperadamente.");
}

function observarRateLimit(page: Page): void {
  const observations: RateLimitObservation[] = [];
  rateLimitObservations.set(page, observations);
  page.on("response", (response) => {
    if (response.status() !== 429) return;
    const rawRetryAfter = response.headers()["retry-after"];
    const retryAfterMs = esperaDoRetryAfter(rawRetryAfter);
    if (retryAfterMs === null) return;
    observations.push({
      path: new URL(response.url()).pathname,
      retryAfterMs,
    });
  });
}

async function esperarComRecuperacaoDe429(
  page: Page,
  esperado: Locator,
  endpoints: string | string[],
  textoDoErro: string | RegExp,
): Promise<void> {
  const observations = rateLimitObservations.get(page);
  if (!observations) throw new Error("O observador de rate limit precisa ser registrado antes da navegação.");
  const alert = page.getByRole("alert").filter({ hasText: textoDoErro });
  const endpointPaths = Array.isArray(endpoints) ? endpoints : [endpoints];
  const endpointLabel = endpointPaths.join(" ou ");

  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (await esperado.isVisible().catch(() => false)) return;

    await expect.poll(async () =>
      (await esperado.isVisible().catch(() => false)) || (await alert.isVisible().catch(() => false)),
    { message: `Aguardando ${endpointLabel} ou erro visível de carregamento` }).toBe(true);
    if (await esperado.isVisible().catch(() => false)) return;

    const responses = observations.filter((item) => endpointPaths.includes(item.path));
    expect(responses.length, `o erro de consulta em ${endpointLabel} deve estar associado a 429 observado`).toBeGreaterThan(0);
    const retryAfterMs = Math.max(...responses.map((item) => item.retryAfterMs));
    for (let index = observations.length - 1; index >= 0; index--) {
      if (endpointPaths.includes(observations[index].path)) observations.splice(index, 1);
    }

    // O limiter informa Retry-After em segundos. A pequena margem só cobre o
    // escalonamento do browser no instante em que a janela do token se abre.
    await page.waitForTimeout(retryAfterMs + 100);
    if (await esperado.isVisible().catch(() => false)) return;
    if (await alert.isVisible().catch(() => false)) {
      await alert.getByRole("button", { name: "Tentar novamente" }).click();
      // O Alert pode permanecer montado durante o refetch. Não reutilizamos
      // esse estado antigo: aguardamos o dado aparecer ou um novo 429 observado.
      await expect.poll(async () =>
        (await esperado.isVisible().catch(() => false)) ||
        observations.some((item) => endpointPaths.includes(item.path)),
      { message: `Aguardando resultado do retry de ${endpointLabel}`, timeout: 15_000 }).toBe(true);
      if (await esperado.isVisible().catch(() => false)) return;
    }
  }

  await expect(esperado).toBeVisible({ timeout: 15_000 });
}

function marcador(): string {
  const sufixo = Math.random().toString(36).slice(2, 8);
  return `E2E20-${Date.now()}-${sufixo}`;
}

async function jsonResponse<T>(response: APIResponse): Promise<T> {
  const body = await response.text();
  expect(response.ok(), `${response.url()} respondeu ${response.status()}: ${body}`).toBeTruthy();
  return JSON.parse(body) as T;
}

async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<AuthResult> {
  const response = await request.post(`${API_URL}/auth/login`, { data: { email, password } });
  return jsonResponse<AuthResult>(response);
}

async function criarDadosIsolados(request: APIRequestContext): Promise<Setup> {
  const marker = marcador();
  const applicationBUrl = `https://vulnera.test/${"a".repeat(130)}`;
  const clientEmail = `${marker.toLowerCase()}@vulnera.test`;
  const clientPassword = `Vulnera-${Math.random().toString(36).slice(2, 10)}-20!`;

  const registered = await request.post(`${API_URL}/auth/register`, {
    data: { name: `${marker} Owner`, email: clientEmail, password: clientPassword },
  });
  const client = await jsonResponse<AuthResult>(registered);
  expect(client.user.role).toBe("CLIENT");
  expect(client.user.companyId).toBeNull();

  const plansResponse = await request.get(`${API_URL}/plans`);
  const plans = await jsonResponse<Plan[]>(plansResponse);
  const plan = plans
    .filter((candidate) => candidate.isActive && candidate.maxApplications >= 2 && candidate.maxProjects >= 2)
    .sort((a, b) => b.maxProjects - a.maxProjects)[0];
  expect(plan, "a stack precisa ter plano ativo para pelo menos 2 aplicações e 2 projetos").toBeTruthy();

  const companyResponse = await request.post(`${API_URL}/companies`, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    data: { name: `${marker} Company`, planId: plan.id },
  });
  const company = await jsonResponse<{ id: string }>(companyResponse);

  const subscriptionResponse = await request.post(`${API_URL}/subscriptions`, {
    headers: { Authorization: `Bearer ${client.accessToken}` },
    data: { planId: plan.id },
  });
  const subscription = await jsonResponse<{ id: string; status: string }>(subscriptionResponse);
  expect(subscription.status).toBe("PENDING_APPROVAL");

  const admin = await apiLogin(request, CREDENCIAIS.admin.email, CREDENCIAIS.admin.senha);
  expect(admin.user.role).toBe("ADMIN");
  expect(admin.user.companyId ?? null, "ADMIN seed deve operar sem empresa pessoal").toBeNull();

  const approval = await request.post(`${API_URL}/subscriptions/${subscription.id}/approve`, {
    headers: { Authorization: `Bearer ${admin.accessToken}` },
  });
  expect((await jsonResponse<{ status: string }>(approval)).status).toBe("ACTIVE");

  async function createApplication(suffix: string, url?: string): Promise<Application> {
    const response = await request.post(`${API_URL}/applications`, {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      data: { name: `${marker} ${suffix}`, companyId: company.id, ...(url ? { url } : {}) },
    });
    return jsonResponse<Application>(response);
  }

  const applicationA = await createApplication("Application A");
  const applicationB = await createApplication("Application B", applicationBUrl);
  expect(applicationA.companyId).toBe(company.id);
  expect(applicationB.companyId).toBe(company.id);

  return { marker, clientEmail, clientPassword, companyId: company.id, applicationA, applicationB, adminToken: admin.accessToken };
}

async function loginPelaInterface(page: Page, email: string, password: string): Promise<void> {
  await page.goto(new URL("/login", BASE_URL).toString());
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30_000 });
}

async function abrirNovaAnaliseDeAplicacoes(page: Page, applicationName: string): Promise<void> {
  if (new URL(page.url()).pathname !== "/applications") {
    await page.getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: /Aplicações/ }).click();
    await expect(page).toHaveURL(/\/applications$/);
  }
  await expect(page.getByRole("heading", { name: "Aplicações", exact: true, level: 1 })).toBeVisible();
  const applicationRow = page.getByRole("row").filter({ hasText: applicationName });
  const createLink = applicationRow.getByRole("link", { name: "Nova análise" });
  await esperarComRecuperacaoDe429(page, createLink, "/api/applications", "Não foi possível carregar as aplicações");
  await createLink.click();
  await expect(page).toHaveURL(/\/new-analysis\?applicationId=/);
  const selectedApplication = page.getByRole("radio", { name: new RegExp(applicationName) });
  await esperarComRecuperacaoDe429(
    page,
    selectedApplication,
    ["/api/projects", "/api/applications"],
    /Não foi possível carregar as aplicações|confirmar quais aplicações já possuem projeto/,
  );
  await expect(selectedApplication).toBeChecked();
}

async function avançarAtePasso(page: Page, passo: number): Promise<void> {
  for (let atual = 1; atual < passo; atual++) {
    await page.getByRole("button", { name: "Continuar" }).click();
    const proximo = atual + 1;
    await expect(page.getByRole("status").filter({ hasText: `Passo ${proximo} de 4` })).toBeVisible();
    const proximoCampo = proximo === 2
      ? page.getByRole("radio", { name: /^DAST/ })
      : proximo === 3
        ? page.getByRole("textbox", { name: "Nome do projeto" })
        : page.getByRole("checkbox", { name: "Incluir serviço de remediação" });
    await expect(proximoCampo).toBeVisible();
    const proximoCabecalho = proximo === 2
      ? page.getByRole("heading", { name: "Tipo", exact: true })
      : proximo === 3
        ? page.getByRole("heading", { name: "Nome, nível e escopo", exact: true })
        : page.getByRole("heading", { name: "Remediação", exact: true });
    await expect(proximoCabecalho.locator("span")).toBeFocused();
  }
}

async function capturar(page: Page, nome: string): Promise<void> {
  await mkdir(ARTIFACTS_DIR, { recursive: true });
  await page.screenshot({ path: join(ARTIFACTS_DIR, nome), fullPage: true });
}

async function conferirSemOverflow(page: Page, contexto: string): Promise<void> {
  const dimensoes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensoes.scrollWidth, `${contexto} em ${dimensoes.clientWidth}px não pode transbordar horizontalmente`).toBeLessThanOrEqual(dimensoes.clientWidth);
}

test("E2E-ISSUE20 — ADMIN e CLIENT criam pela mesma stack; origem, cancelamento e isolamento permanecem corretos", async ({
  browser,
  request,
}) => {
  const setup = await criarDadosIsolados(request);
  const projectNameAdmin = `${setup.marker} Project via Projetos`;
  const projectNameClient = `${setup.marker} Project via Aplicações`;
  const adminPage = await browser.newPage({ baseURL: BASE_URL, viewport: { width: 1440, height: 1000 } });
  const clientPage = await browser.newPage({ baseURL: BASE_URL, viewport: { width: 1440, height: 1000 } });
  let adminProjectPosts = 0;
  let clientProjectPosts = 0;
  observarRateLimit(adminPage);
  observarRateLimit(clientPage);
  adminPage.on("request", (apiRequest) => {
    if (apiRequest.method() === "POST" && new URL(apiRequest.url()).pathname === "/api/projects") {
      adminProjectPosts++;
    }
  });
  clientPage.on("request", (apiRequest) => {
    if (apiRequest.method() === "POST" && new URL(apiRequest.url()).pathname === "/api/projects") {
      clientProjectPosts++;
    }
  });

  try {
    await loginPelaInterface(adminPage, CREDENCIAIS.admin.email, CREDENCIAIS.admin.senha);
    await adminPage.getByRole("navigation", { name: "Navegação principal" })
      .getByRole("link", { name: /Projetos/ }).click();
    await expect(adminPage).toHaveURL(/\/projects$/);
    await expect(adminPage.getByRole("link", { name: "Novo projeto" }).first()).toBeVisible();
    await capturar(adminPage, "issue20-projects-1440.png");

    // A ação cabe no mobile e a seleção continua operável por teclado.
    await adminPage.setViewportSize({ width: 375, height: 812 });
    await conferirSemOverflow(adminPage, "Projetos mobile");
    await adminPage.getByRole("link", { name: "Novo projeto" }).first().click();
    const mobileApplication = adminPage.getByRole("radio", { name: new RegExp(setup.applicationB.name) });
    await esperarComRecuperacaoDe429(
      adminPage,
      mobileApplication,
      ["/api/projects", "/api/applications"],
      /Não foi possível carregar as aplicações|confirmar quais aplicações já possuem projeto/,
    );
    await capturar(adminPage, "issue20-wizard-aplicacao-375.png");
    const mobileApplicationCard = mobileApplication.locator("xpath=..");
    const longApplicationUrl = mobileApplicationCard.getByText(setup.applicationB.url!);
    await expect(longApplicationUrl).toBeVisible();
    const urlOverflowsItsBox = await longApplicationUrl.evaluate((element) => element.scrollWidth > element.clientWidth);
    expect(urlOverflowsItsBox, "URL longa da Application deve quebrar dentro do card mobile").toBe(false);
    await mobileApplication.focus();
    await mobileApplication.press("Space");
    await expect(mobileApplication).toBeChecked();
    await conferirSemOverflow(adminPage, "wizard mobile");
    const cancelButton = adminPage.getByRole("button", { name: "Cancelar" });
    await cancelButton.focus();
    await expect(cancelButton).toBeFocused();
    await cancelButton.press("Enter");
    await expect(adminPage).toHaveURL(/\/projects$/);
    expect(adminProjectPosts, "Cancelar no primeiro passo não pode enviar Project").toBe(0);

    // ADMIN sem companyId pessoal cria para a Application da empresa CLIENT.
    await adminPage.setViewportSize({ width: 1440, height: 1000 });
    await adminPage.getByRole("link", { name: "Novo projeto" }).first().click();
    const adminApplication = adminPage.getByRole("radio", { name: new RegExp(setup.applicationA.name) });
    await esperarComRecuperacaoDe429(
      adminPage,
      adminApplication,
      ["/api/projects", "/api/applications"],
      /Não foi possível carregar as aplicações|confirmar quais aplicações já possuem projeto/,
    );
    await adminApplication.check();
    await avançarAtePasso(adminPage, 3);
    await capturar(adminPage, "issue20-wizard-passo-3-1440.png");
    const adminNameField = adminPage.getByRole("textbox", { name: "Nome do projeto" });
    await adminNameField.fill("   ");
    await adminPage.getByRole("button", { name: "Continuar" }).click();
    await expect(adminPage.getByRole("alert")).toContainText("Informe um nome para o projeto.");
    await expect(adminNameField).toBeFocused();
    await capturar(adminPage, "issue20-wizard-nome-invalido-1440.png");
    await adminNameField.fill(projectNameAdmin);
    await adminPage.getByRole("button", { name: "Continuar" }).click();
    await expect(adminPage.getByRole("checkbox", { name: "Incluir serviço de remediação" })).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "Remediação", exact: true }).locator("span")).toBeFocused();
    await expect(adminPage.getByText(projectNameAdmin)).toBeVisible();

    const adminResponsePromise = adminPage.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === "/api/projects",
    );
    await adminPage.getByRole("button", { name: "Criar projeto" }).click();
    const adminResponse = await adminResponsePromise;
    expect(adminResponse.status()).toBe(201);
    expect(adminProjectPosts).toBe(1);
    const createdByAdmin = await adminResponse.json() as Project;
    expect(createdByAdmin).toMatchObject({
      name: projectNameAdmin,
      applicationId: setup.applicationA.id,
      companyId: setup.companyId,
      status: "PENDING",
    });
    await expect(adminPage).toHaveURL(new RegExp(`/projects/${createdByAdmin.id}$`));

    const persistedByAdminResponse = await getComRetryAfter(
      request,
      `${API_URL}/projects/${createdByAdmin.id}`,
      { Authorization: `Bearer ${setup.adminToken}` },
    );
    expect(await jsonResponse<Project>(persistedByAdminResponse)).toMatchObject({
      id: createdByAdmin.id,
      applicationId: setup.applicationA.id,
      companyId: setup.companyId,
    });

    // Voltar pela navegação interna mantém o novo projeto visível sem reload manual.
    await adminPage.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: /Projetos/ }).click();
    await expect(adminPage.getByRole("link", { name: projectNameAdmin })).toBeVisible();

    // CLIENT isolado: cancelar em todas as quatro etapas não envia POST.
    await loginPelaInterface(clientPage, setup.clientEmail, setup.clientPassword);
    await expect(clientPage).toHaveURL(/\/dashboard|\/onboarding/);
    for (let passo = 1; passo <= 4; passo++) {
      await abrirNovaAnaliseDeAplicacoes(clientPage, setup.applicationB.name);
      await avançarAtePasso(clientPage, passo);
      await clientPage.getByRole("button", { name: "Cancelar" }).click();
      await expect(clientPage).toHaveURL(/\/applications$/);
      expect(clientProjectPosts, `Cancelar no passo ${passo} não pode enviar Project`).toBe(0);
    }

    const projectsBeforeClientSubmitResponse = await getComRetryAfter(
      request,
      `${API_URL}/projects`,
      { Authorization: `Bearer ${setup.adminToken}` },
    );
    const projectsBeforeClientSubmit = await jsonResponse<Project[]>(projectsBeforeClientSubmitResponse);
    expect(projectsBeforeClientSubmit.some((project) => project.name === projectNameClient)).toBe(false);

    // A pré-seleção e a origem são mantidas no link de Aplicações; submit usa a mesma rota/API.
    await abrirNovaAnaliseDeAplicacoes(clientPage, setup.applicationB.name);
    await avançarAtePasso(clientPage, 3);
    await clientPage.getByRole("textbox", { name: "Nome do projeto" }).fill(projectNameClient);
    await clientPage.getByRole("button", { name: "Continuar" }).click();
    await expect(clientPage.getByRole("checkbox", { name: "Incluir serviço de remediação" })).toBeVisible();
    await expect(clientPage.getByRole("heading", { name: "Remediação", exact: true }).locator("span")).toBeFocused();
    const clientResponsePromise = clientPage.waitForResponse((response) =>
      response.request().method() === "POST" && new URL(response.url()).pathname === "/api/projects",
    );
    await clientPage.getByRole("button", { name: "Criar projeto" }).click();
    const clientResponse = await clientResponsePromise;
    expect(clientResponse.status()).toBe(201);
    const createdByClient = await clientResponse.json() as Project;
    expect(clientProjectPosts).toBe(1);
    expect(createdByClient).toMatchObject({
      name: projectNameClient,
      applicationId: setup.applicationB.id,
      companyId: setup.companyId,
      status: "PENDING",
    });

    const persistedByClientResponse = await getComRetryAfter(
      request,
      `${API_URL}/projects/${createdByClient.id}`,
      { Authorization: `Bearer ${setup.adminToken}` },
    );
    expect(await jsonResponse<Project>(persistedByClientResponse)).toMatchObject({
      id: createdByClient.id,
      applicationId: setup.applicationB.id,
      companyId: setup.companyId,
    });
    await expect(clientPage).toHaveURL(new RegExp(`/projects/${createdByClient.id}$`));

    await clientPage.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: /Projetos/ }).click();
    await expect(clientPage.getByRole("link", { name: projectNameClient })).toBeVisible();

    // PENTESTER continua podendo ler Projetos, mas não recebe entrada de criação.
    const pentesterPage = await browser.newPage({ baseURL: BASE_URL, viewport: { width: 1440, height: 1000 } });
    await loginPelaInterface(pentesterPage, CREDENCIAIS.pentester.email, CREDENCIAIS.pentester.senha);
    await pentesterPage.goto("/projects");
    await expect(pentesterPage.getByRole("heading", { name: "Projetos", exact: true, level: 1 })).toBeVisible();
    await expect(pentesterPage.getByRole("link", { name: "Novo projeto" })).toHaveCount(0);
    await pentesterPage.close();

    await mkdir(ARTIFACTS_DIR, { recursive: true });
    await writeFile(join(ARTIFACTS_DIR, "issue20-smoke-evidence.json"), JSON.stringify({
      issue: 20,
      marker: setup.marker,
      companyId: setup.companyId,
      applications: [setup.applicationA, setup.applicationB].map(({ id, name, companyId }) => ({ id, name, companyId })),
      projects: [createdByAdmin, createdByClient].map(({ id, name, applicationId, companyId, status }) => ({
        id, name, applicationId, companyId, status,
      })),
      checks: {
        adminHasNoPersonalCompany: true,
        projectCreationReturns201: true,
        companyIdConfirmedByApiRead: true,
        clientApplicationPreselection: true,
        cancellationStepsWithoutPost: [1, 2, 3, 4],
        projectsListUpdatedWithoutManualReload: true,
        mobile375NoHorizontalOverflow: true,
        keyboardSelectionAndFocus: true,
        pentesterHasNoCreateAction: true,
        invalidProjectNameReturnsFocus: true,
      },
      screenshots: [
        "issue20-projects-1440.png",
        "issue20-wizard-aplicacao-375.png",
        "issue20-wizard-passo-3-1440.png",
        "issue20-wizard-nome-invalido-1440.png",
      ],
    }, null, 2), "utf8");
  } finally {
    await adminPage.close();
    await clientPage.close();
  }
});
