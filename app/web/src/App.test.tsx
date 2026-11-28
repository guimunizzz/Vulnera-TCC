/**
 * App.test.tsx
 *
 * Cobre o Checkpoint 3 do fix/landing-publica — a árvore de rotas.
 *
 *   ROTA-01  "/" sem sessão renderiza a landing pública, sem redirecionar
 *   ROTA-02  rota privada ("/dashboard") sem sessão ainda redireciona pra /login
 *   ROTA-03  rota privada ("/dashboard") com sessão renderiza normalmente
 *   ROTA-04  "/" com sessão continua mostrando a landing — não expulsa quem já
 *            está logado (decisão do Checkpoint 1, item 4)
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { useAuthStore } from "./store/auth.store";
import { ThemeProvider } from "./design/theme-provider";

// A landing pública carrega `gsap` e, por lazy, a cena `three` (nada roda em
// jsdom) atrás de um `lazy()`. Estes testes cobrem a ÁRVORE DE ROTAS, não o
// conteúdo da landing — o stub abaixo mantém o foco nisso. O conteúdo real da
// landing é testado em `pages/landing-page.test.tsx`.
vi.mock("./pages/landing-page", () => ({
  LandingPage: () => <div data-testid="landing-stub">landing</div>,
}));
vi.mock("./pages/onboarding-page", () => ({ OnboardingPage: () => <div>Onboarding de teste</div> }));
vi.mock("./pages/dast-scan-report-page", () => ({ DastScanReportPage: () => <div>Relatório de teste</div> }));
vi.mock("./pages/sast-sca-page", () => ({ SastScaPage: () => <h1>SAST/SCA de teste</h1> }));
vi.mock("./pages/code-import-detail-page", () => ({ CodeImportDetailPage: () => <h1>Importação de teste</h1> }));
vi.mock("./pages/threat-intel-page", () => ({ ThreatIntelPage: () => <h1>Threat Intel de teste</h1> }));
vi.mock("./pages/exposure-graph-page", () => ({ ExposureGraphPage: () => <h1>Exposure Graph de teste</h1> }));
vi.mock("./pages/triage-page", () => ({ TriagePage: () => <h1>Triagem de teste</h1> }));
vi.mock("./pages/agendamentos-page", () => ({ AgendamentosPage: () => <h1>Agendamentos de teste</h1> }));
vi.mock("./pages/conformidade-page", () => ({ ConformidadePage: () => <h1>Conformidade de teste</h1> }));
vi.mock("./pages/admin/access-requests-page", () => ({ AccessRequestsPage: () => <h1>Solicitações de teste</h1> }));
vi.mock("./pages/admin/filas-page", () => ({ FilasPage: () => <h1>Filas de teste</h1> }));
vi.mock("./components/auth/turnstile-challenge", async () => {
  const react = await import("react");
  const Challenge = react.forwardRef(function Challenge() {
    return react.createElement("div", { "data-testid": "turnstile-mock" });
  });
  return { TurnstileChallenge: Challenge };
});

function limparAuth(): void {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
}

function logar(role: "ADMIN" | "CLIENT" | "PENTESTER" = "CLIENT"): void {
  useAuthStore.setState({
    accessToken: "token-fake",
    refreshToken: "refresh-fake",
    user: {
      id: "u1",
      name: "Rafael",
      email: "rafael@technova.com",
      role,
      companyId: "c1",
      createdAt: new Date().toISOString(),
    },
  });
}

/** As páginas privadas disparam `useQuery` e o `AppLayout` usa `ThemeToggle`
 * (precisa de `ThemeProvider`) — sem os dois providers elas nem montam. */
function renderApp(rotaInicial: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[rotaInicial]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

// As páginas são lazy. Com o cache do vitest frio, o primeiro `import()` de
// uma página transforma a árvore inteira dela e já levou mais que o timeout do
// teste. Pré-carregar os módulos tira o tempo de transformação da asserção: o
// `lazy()` continua chamando `import()` e suspendendo, só que resolve do cache.
beforeAll(async () => {
  await Promise.all([
    import("./pages/auth/auth-layout"),
    import("./pages/auth/login-page"),
    import("./pages/auth/register-page"),
    import("./pages/auth/request-access-page"),
    import("./pages/dashboard-page"),
  ]);
}, 60_000);

afterEach(limparAuth);

describe("Roteamento de App", () => {
  it.each([
    ["/sast-sca", "SAST/SCA de teste", ["ADMIN", "PENTESTER"]],
    ["/sast-sca/imports/ficticio", "Importação de teste", ["ADMIN", "PENTESTER"]],
    ["/threat-intel", "Threat Intel de teste", ["ADMIN", "CLIENT", "PENTESTER"]],
    ["/exposure-graph", "Exposure Graph de teste", ["ADMIN", "CLIENT"]],
    ["/triagem", "Triagem de teste", ["ADMIN", "CLIENT", "PENTESTER"]],
    ["/agendamentos", "Agendamentos de teste", ["ADMIN", "CLIENT", "PENTESTER"]],
    ["/conformidade", "Conformidade de teste", ["ADMIN", "CLIENT"]],
    ["/admin/access-requests", "Solicitações de teste", ["ADMIN"]],
    ["/admin/filas", "Filas de teste", ["ADMIN"]],
  ] as const)("preserva os guards da dev e uma instancia do assistente em %s", async (route, heading, roles) => {
    for (const role of ["ADMIN", "CLIENT", "PENTESTER"] as const) {
      logar(role);
      const view = renderApp(route);
      const allowed = (roles as readonly string[]).includes(role);
      expect(await screen.findByRole("heading", { name: allowed ? heading : "Olá, Rafael" })).toBeInTheDocument();
      expect(await screen.findAllByTestId("assistant-root")).toHaveLength(1);
      if (!allowed) expect(screen.queryByRole("heading", { name: heading })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("leva do login à solicitação de acesso mantendo o cenário", async () => {
    limparAuth();
    renderApp("/login");
    // Cenário e páginas de acesso são lazy (um lote só): espera o primeiro paint.
    const logo = await screen.findByRole("link", { name: "Vulnera Security — página inicial" });
    expect(logo).toHaveTextContent("VULNERA SECURITY");

    fireEvent.click(screen.getByRole("link", { name: /Solicitar acesso/ }));
    expect(await screen.findByRole("heading", { name: "Solicitar acesso" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entrar" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("assistant-root")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nome do responsável" })).toBeRequired();
    expect(screen.getByRole("link", { name: "Vulnera Security — página inicial" })).toBe(logo);
  });

  it("ROTA-01 — '/' sem sessão renderiza a landing, sem redirecionar pro login", () => {
    limparAuth();
    renderApp("/");

    // É a landing (stub), não o formulário de login (login-page.tsx).
    expect(screen.getByTestId("landing-stub")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("ROTA-02 — rota privada sem sessão ainda redireciona pra /login", async () => {
    limparAuth();
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("ROTA-03 — rota privada com sessão renderiza normalmente", async () => {
    logar("CLIENT");
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
    expect(await screen.findAllByTestId("assistant-root")).toHaveLength(1);
  });

  it("ROTA-04 — '/' com sessão continua mostrando a landing, não expulsa quem já está logado", () => {
    logar("ADMIN");
    renderApp("/");

    // A landing é pública e renderiza igual com ou sem sessão — não redireciona
    // pro dashboard.
    expect(screen.getByTestId("landing-stub")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Olá, Rafael" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("assistant-root")).not.toBeInTheDocument();
  });

  it.each(["/onboarding", "/dast/scans/ficticio/report"])("monta uma instância do assistente também fora de AppLayout em %s", async (route) => {
    logar("ADMIN");
    renderApp(route);
    expect(await screen.findByText(route === "/onboarding" ? "Onboarding de teste" : "Relatório de teste")).toBeInTheDocument();
    // O portal monta pelo efeito seguinte, independentemente da pagina lazy.
    expect(await screen.findAllByTestId("assistant-root")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ajuda — abrir Assistente Vulnera" })).toBeInTheDocument();
  });
});
