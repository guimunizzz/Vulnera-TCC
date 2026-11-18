/**
 * O que faz: valida a navegação do login para a solicitação e o redirect legado.
 * Por que existe: nenhuma entrada web deve iniciar o cadastro direto antigo.
 * Quem consome: suíte Vitest de navegação pública do app.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "../App";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import { authApi } from "../lib/api/auth.api";

vi.mock("../lib/api/auth.api", () => ({
  authApi: { login: vi.fn(), register: vi.fn(), logout: vi.fn() },
}));
vi.mock("../components/auth/turnstile-challenge", async () => {
  const react = await import("react");
  const Challenge = react.forwardRef(function Challenge() {
    return react.createElement("div", { "data-testid": "turnstile-mock" });
  });
  return { TurnstileChallenge: Challenge };
});

function LocalizacaoAtual() {
  const location = useLocation();
  return <output data-testid="rota-atual">{location.pathname}</output>;
}

function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <LocalizacaoAtual />
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeAll(async () => {
  await Promise.all([
    import("../pages/auth/auth-layout"),
    import("../pages/auth/login-page"),
    import("../pages/auth/register-page"),
    import("../pages/auth/request-access-page"),
  ]);
}, 60_000);

afterEach(() => {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  vi.clearAllMocks();
});

describe("Navegação para acesso controlado", () => {
  it("leva o CTA do login à solicitação de acesso", async () => {
    renderApp("/login");

    fireEvent.click(await screen.findByRole("link", { name: /Solicitar acesso/ }));

    expect(await screen.findByRole("heading", { name: "Solicitar acesso" })).toBeInTheDocument();
    expect(screen.getByTestId("rota-atual")).toHaveTextContent("/request-access");
    expect(authApi.register).not.toHaveBeenCalled();
  });

  it("redireciona /register com replace lógico e não chama authApi.register", async () => {
    renderApp("/register");

    expect(await screen.findByRole("heading", { name: "Solicitar acesso" })).toBeInTheDocument();
    expect(screen.getByTestId("rota-atual")).toHaveTextContent("/request-access");
    expect(screen.queryByRole("heading", { name: "Criar conta" })).not.toBeInTheDocument();
    expect(authApi.register).not.toHaveBeenCalled();
  });
});
