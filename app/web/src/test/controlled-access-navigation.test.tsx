/**
 * O que faz: valida a navegação do login para a solicitação e o redirect legado.
 * Por que existe: nenhuma entrada web deve iniciar o cadastro direto antigo.
 * Quem consome: suíte Vitest de navegação pública do app.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { App } from "../App";
import { ThemeProvider } from "../design/theme-provider";
import { RegisterPage } from "../pages/auth/register-page";
import { RequestAccessPage } from "../pages/auth/request-access-page";
import { useAuthStore } from "../store/auth.store";

vi.mock("../lib/api/auth.api", () => ({
  authApi: { login: vi.fn(), logout: vi.fn() },
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

function VoltarNoHistorico() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(-1)}>Voltar</button>;
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

function renderRedirectLegado() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/pagina-anterior", "/register"]} initialIndex={1}>
          <LocalizacaoAtual />
          <VoltarNoHistorico />
          <Routes>
            <Route path="/pagina-anterior" element={<h1>Página anterior</h1>} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/request-access" element={<RequestAccessPage />} />
          </Routes>
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
    import("../pages/auth/verify-email-page"),
    import("../pages/auth/activate-account-page"),
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
  });

  it("redireciona /register para solicitação de acesso", async () => {
    renderRedirectLegado();

    expect(await screen.findByRole("heading", { name: "Solicitar acesso" })).toBeInTheDocument();
    expect(screen.getByTestId("rota-atual")).toHaveTextContent("/request-access");
    expect(screen.queryByRole("heading", { name: "Criar conta" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(await screen.findByRole("heading", { name: "Página anterior" })).toBeInTheDocument();
    expect(screen.getByTestId("rota-atual")).toHaveTextContent("/pagina-anterior");
  });
});
