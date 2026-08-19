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

import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { useAuthStore } from "./store/auth.store";
import { ThemeProvider } from "./design/theme-provider";

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
  it("ROTA-01 — '/' sem sessão renderiza a landing, sem redirecionar pro login", () => {
    limparAuth();
    renderApp("/");

    // É a landing: tem o link "Entrar" da navbar, não o <h1> "Entrar" do
    // formulário de login (login-page.tsx).
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
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

  it("ROTA-04 — '/' com sessão continua mostrando a landing, com o atalho pro Dashboard", () => {
    logar("ADMIN");
    renderApp("/");

    // Aparece na navbar (sm) e no hero (lg) — os dois apontam pro dashboard.
    const dashboard = screen.getAllByRole("link", { name: "Ir para o Dashboard" });
    expect(dashboard.length).toBeGreaterThan(0);
    for (const link of dashboard) {
      expect(link).toHaveAttribute("href", "/dashboard");
    }
    expect(screen.getByText("Encontre. Priorize. Remedie.")).toBeInTheDocument();
  });
});
