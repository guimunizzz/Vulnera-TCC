/**
 * applications-page.test.tsx
 *
 * O QUE FAZ
 * Garante que o refinamento visual do inventário continua apresentando os
 * dados reais e preserva as ações permitidas por cada papel.
 *
 * POR QUE EXISTE
 * A página recebeu hierarquia, filtro e animação de entrada, mas não pode
 * transformar capacidade, alvos ou permissões em dados decorativos.
 *
 * QUEM CONSOME
 * A suíte Vitest do frontend (`npm test`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import type { Application } from "../types/application.types";
import { ApplicationsPage } from "./applications-page";

const api = vi.hoisted(() => ({
  applications: vi.fn(),
  subscription: vi.fn(),
  plans: vi.fn(),
}));

vi.mock("../lib/api/applications.api", () => ({ applicationsApi: { list: api.applications, create: vi.fn(), delete: vi.fn() } }));
vi.mock("../lib/api/subscriptions.api", () => ({ subscriptionsApi: { current: api.subscription } }));
vi.mock("../lib/api/plans.api", () => ({ plansApi: { list: api.plans } }));
vi.mock("../hooks/use-company-name", () => ({ useCompanyName: () => "TechNova" }));

const APLICACOES: Application[] = [
  {
    id: "app-1", name: "Portal do Cliente", url: "https://portal.technova.demo", techStack: null, description: null,
    companyId: "company-1", isActive: true, criticality: "HIGH", environment: "PROD", internetFacing: true,
    dataSensitivity: "CONFIDENTIAL", businessOwner: null, technicalOwner: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "app-2", name: "Painel interno", url: "https://interna.technova.demo", techStack: null, description: null,
    companyId: "company-1", isActive: true, criticality: "MEDIUM", environment: "HOMOL", internetFacing: false,
    dataSensitivity: "INTERNAL", businessOwner: null, technicalOwner: null, createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

function entrarComo(role: "ADMIN" | "CLIENT" | "PENTESTER"): void {
  useAuthStore.setState({
    accessToken: "token-teste",
    refreshToken: "refresh-teste",
    user: { id: "user-1", name: "Rafael", email: "rafael@vulnera.test", role, companyId: "company-1", createdAt: "2026-01-01T00:00:00.000Z" },
  });
}

function renderizarPagina() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter><ApplicationsPage /></MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.applications.mockResolvedValue(APLICACOES);
  api.subscription.mockResolvedValue({ planId: "plan-1" });
  api.plans.mockResolvedValue([{ id: "plan-1", name: "PRO", maxApplications: 5 }]);
});

afterEach(() => {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

describe("ApplicationsPage", () => {
  it("APP-VIS-01 — inventário e capacidade continuam vindo dos contratos reais", async () => {
    entrarComo("ADMIN");
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aplicações" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "[data-numeric]" })).toBeInTheDocument();
    expect(screen.getByText("de 5 vagas no plano PRO")).toBeInTheDocument();
    expect(screen.getByText("Portal do Cliente")).toBeInTheDocument();
    expect(screen.getByText("Painel interno")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Filtrar aplicações" }), { target: { value: "interno" } });
    expect(screen.getByText("1 aplicação encontrada")).toBeInTheDocument();
    expect(screen.queryByText("Portal do Cliente")).not.toBeInTheDocument();
    expect(screen.getByText("Painel interno")).toBeInTheDocument();
  });

  it("APP-VIS-02 — PENTESTER mantém ações de leitura e análise, sem ações de gestão", async () => {
    entrarComo("PENTESTER");
    renderizarPagina();

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("link", { name: "Painel" })).toHaveLength(2);
    expect(within(table).getAllByRole("link", { name: "Nova análise" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Nova aplicação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contexto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
  });
});
