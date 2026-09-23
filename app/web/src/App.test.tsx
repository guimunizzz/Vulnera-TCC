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

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { useAuthStore } from "./store/auth.store";
import { ThemeProvider } from "./design/theme-provider";

// A landing pública carrega `three`, `@react-three/*` e `gsap` (nada roda em
// jsdom) atrás de um `lazy()`. Estes testes cobrem a ÁRVORE DE ROTAS, não o
// conteúdo da landing — o stub abaixo mantém o foco nisso. O conteúdo real da
// landing é testado em `pages/landing-page.test.tsx`.
vi.mock("./pages/landing-page", () => ({
  LandingPage: () => <div data-testid="landing-stub">landing</div>,
}));

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

afterEach(limparAuth);

describe("Roteamento de App", () => {
  it("permite alternar entre login e cadastro mantendo o cenário de acesso", async () => {
    limparAuth();
    renderApp("/login");
    const logo = screen.getByRole("link", { name: "Vulnera — página inicial" });

    fireEvent.click(screen.getByRole("link", { name: "Criar uma conta" }));
    expect(await screen.findByRole("heading", { name: "Criar conta" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entrar" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nome" })).toBeRequired();
    expect(screen.getByRole("link", { name: "Vulnera — página inicial" })).toBe(logo);

    fireEvent.click(screen.getByRole("link", { name: "Entrar" }));
    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Criar conta" })).not.toBeInTheDocument();
  });

  it("ROTA-01 — '/' sem sessão renderiza a landing, sem redirecionar pro login", () => {
    limparAuth();
    renderApp("/");

    // É a landing (stub), não o formulário de login (login-page.tsx).
    expect(screen.getByTestId("landing-stub")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("ROTA-02 — rota privada sem sessão ainda redireciona pra /login", () => {
    limparAuth();
    renderApp("/dashboard");

    expect(screen.getByRole("heading", { name: "Entrar" })).toBeInTheDocument();
  });

  it("ROTA-03 — rota privada com sessão renderiza normalmente", () => {
    logar("CLIENT");
    renderApp("/dashboard");

    expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
  });

  it("ROTA-04 — '/' com sessão continua mostrando a landing, não expulsa quem já está logado", () => {
    logar("ADMIN");
    renderApp("/");

    // A landing é pública e renderiza igual com ou sem sessão — não redireciona
    // pro dashboard.
    expect(screen.getByTestId("landing-stub")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Olá, Rafael" })).not.toBeInTheDocument();
  });
});
