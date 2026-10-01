/**
 * admin-dashboard.test.tsx
 *
 * O QUE FAZ
 * Confirma que o redesign administrativo continua mostrando métricas e ranking
 * derivados exclusivamente dos contratos reais já existentes.
 *
 * POR QUE EXISTE
 * Barras e contadores visuais não podem introduzir números inventados durante
 * uma evolução puramente estética.
 *
 * QUEM CONSOME
 * A suíte Vitest do frontend (`npm test`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminDashboard } from "./admin-dashboard";

const api = vi.hoisted(() => ({
  companies: vi.fn(),
  active: vi.fn(),
  pending: vi.fn(),
}));

vi.mock("../../lib/api/companies.api", () => ({ companiesApi: { list: api.companies } }));
vi.mock("../../lib/api/subscriptions.api", () => ({
  subscriptionsApi: { listActive: api.active, listPending: api.pending },
}));
vi.mock("../../hooks/use-findings", () => ({
  useFindingsResumo: () => ({
    total: 18,
    porSeveridade: { CRITICAL: 4 },
    porStatus: { OPEN: 8 },
    porEmpresa: { "company-1": 12, "company-2": 6 },
    criticosAbertos: 4,
    recentes: [],
    carregando: false,
  }),
}));

function renderAdminDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.companies.mockResolvedValue([
    { id: "company-1", name: "TechNova Solutions" },
    { id: "company-2", name: "Jeremias" },
  ]);
  api.active.mockResolvedValue([{ id: "active-1" }, { id: "active-2" }]);
  api.pending.mockResolvedValue([{ id: "pending-1" }]);
});

describe("AdminDashboard", () => {
  it("DASH-VIS-06 — KPIs continuam exibindo os valores reais", async () => {
    renderAdminDashboard();

    const empresas = await screen.findByRole("article", { name: "Empresas ativas" });
    const pendentes = screen.getByRole("article", { name: "Assinaturas pendentes" });
    const criticos = screen.getByRole("article", { name: "Críticos em aberto (global)" });

    expect(within(empresas).getByText("2", { selector: ".sr-only" })).toBeInTheDocument();
    expect(within(pendentes).getByText("1", { selector: ".sr-only" })).toBeInTheDocument();
    expect(within(criticos).getByText("4", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("DASH-VIS-07 — ranking usa contagens reais e largura relativa", async () => {
    renderAdminDashboard();

    await screen.findByText("TechNova Solutions");
    const primeiraLinha = screen.getByText("TechNova Solutions").closest("li");
    const segundaLinha = screen.getByText("Jeremias").closest("li");
    expect(primeiraLinha).not.toBeNull();
    expect(segundaLinha).not.toBeNull();

    expect(within(primeiraLinha!).getByText("12 findings")).toBeInTheDocument();
    expect(within(segundaLinha!).getByText("6 findings")).toBeInTheDocument();
    expect(primeiraLinha!.querySelector("[data-volume-relativo='100']")).toBeInTheDocument();
    expect(segundaLinha!.querySelector("[data-volume-relativo='50']")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: "Maturidade" });
    expect(links[0]).toHaveAttribute("href", "/companies/company-1/maturity");
    expect(links[1]).toHaveAttribute("href", "/companies/company-2/maturity");
    await waitFor(() => expect(api.companies).toHaveBeenCalledTimes(1));
  });
});
