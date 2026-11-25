/**
 * O que faz: cobre as rotas públicas do acesso controlado e o limite ADMIN.
 * Por que existe: links por e-mail e URLs diretas precisam cair na página e no papel corretos.
 * Quem consome: suíte Vitest de integração do roteador web.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { App } from "../App";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";

const api = vi.hoisted(() => ({
  adminList: vi.fn(),
  notificationsUnread: vi.fn(),
  savedQueries: vi.fn(),
}));

vi.mock("../lib/api/admin-access-requests.api", () => ({
  adminAccessRequestsApi: {
    list: api.adminList,
    get: vi.fn(),
    events: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    resendInvitation: vi.fn(),
  },
}));
vi.mock("../lib/api/threat-intel.api", () => ({
  notificationsApi: {
    unreadCount: api.notificationsUnread,
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));
vi.mock("../lib/api/saved-queries.api", () => ({
  savedQueriesApi: { list: api.savedQueries },
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

function limparAuth(): void {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
}

function autenticar(role: "ADMIN" | "CLIENT" | "PENTESTER"): void {
  useAuthStore.setState({
    accessToken: "access-test",
    refreshToken: "refresh-test",
    user: {
      id: `user-${role.toLowerCase()}`,
      name: "Rafael",
      email: "rafael@example.test",
      role,
      companyId: role === "CLIENT" ? "company-1" : null,
      createdAt: "2026-11-17T00:00:00.000Z",
    },
  });
}

function renderApp(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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

beforeEach(() => {
  limparAuth();
  api.adminList.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  api.notificationsUnread.mockResolvedValue({ naoLidas: 0 });
  api.savedQueries.mockResolvedValue([]);
});

afterEach(() => {
  limparAuth();
  vi.clearAllMocks();
});

describe("Rotas do acesso controlado", () => {
  it.each([
    ["/request-access", "Solicitar acesso"],
    ["/verify-email", "Confirmar e-mail"],
    ["/activate-account", "Ativar conta"],
  ])("renderiza %s no AuthLayout e mantém o menu de acessibilidade", async (path, title) => {
    renderApp(path);

    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acessibilidade" })).toBeInTheDocument();
  });

  it("redireciona uma pessoa anônima da fila para o login", async () => {
    renderApp("/admin/access-requests");

    expect(await screen.findByRole("heading", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.getByTestId("rota-atual")).toHaveTextContent("/login");
    expect(api.adminList).not.toHaveBeenCalled();
  });

  it.each(["CLIENT", "PENTESTER"] as const)("redireciona %s para fora da fila administrativa", async (role) => {
    autenticar(role);
    renderApp("/admin/access-requests");

    expect(await screen.findByTestId("rota-atual")).toHaveTextContent("/dashboard");
    expect(screen.queryByRole("heading", { name: "Solicitações de acesso" })).not.toBeInTheDocument();
    expect(api.adminList).not.toHaveBeenCalled();
  });

  it("abre a fila dentro do AppLayout para ADMIN", async () => {
    autenticar("ADMIN");
    renderApp("/admin/access-requests");

    expect(await screen.findByRole("heading", { name: "Solicitações de acesso" })).toBeInTheDocument();
    expect(screen.getByTestId("rota-atual")).toHaveTextContent("/admin/access-requests");
    expect(await screen.findByText("Nenhuma solicitação neste estado.")).toBeInTheDocument();
  });
});
