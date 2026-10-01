/**
 * application-dashboard-page.test.tsx
 *
 * O QUE FAZ: verifica quais métricas a navegação entre abas realmente busca.
 * POR QUE EXISTE: abas fechadas não devem consumir o limite compartilhado da
 * API antes que a pessoa peça seus dados, inclusive ao abrir um link direto.
 * QUEM CONSOME: suíte Vitest do frontend e regressão do painel da aplicação.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "../design/theme-provider";
import { createQueryClient } from "../lib/query-client";
import type { MetricsSummary } from "../types/metrics.types";
import { ApplicationDashboardPage } from "./application-dashboard-page";

const api = vi.hoisted(() => ({
  application: vi.fn(), summary: vi.fn(), timeseries: vi.fn(), insights: vi.fn(), comparison: vi.fn(),
}));

vi.mock("../lib/api/applications.api", () => ({ applicationsApi: { getById: api.application } }));
vi.mock("../lib/api/metrics.api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api/metrics.api")>("../lib/api/metrics.api");
  return { ...actual, metricsApi: {
    summary: api.summary, timeseries: api.timeseries, insights: api.insights, comparison: api.comparison,
  } };
});

// Os gráficos não participam do contrato de busca; as Tabs e o Router são reais.
vi.mock("../components/metrics/charts", () => ({
  DonutDeSeveridade: () => null,
  GraficoCriadosVersusResolvidos: () => null,
  GraficoDeAging: () => null,
  GraficoDeBurndown: () => null,
  GraficoDeRiskScore: () => null,
}));
vi.mock("../components/metrics/kpi-card", () => ({
  KpiCard: ({ rotulo }: { rotulo: string }) => <div>{rotulo}</div>,
}));
vi.mock("../components/metrics/filter-bar", () => ({ FilterBar: () => null }));
vi.mock("../components/applications/risk-context-chips", () => ({ RiskContextChips: () => null }));

const clients: QueryClient[] = [];
const periodo = { de: "2026-09-01T00:00:00.000Z", ate: "2026-10-01T00:00:00.000Z" };
const summary: MetricsSummary = {
  applicationId: "app-1", periodo, totalFindings: 0, totalAbertos: 0, totalRemediados: 0,
  taxaRemediacao: 0, riskScore: 0, abertosPorSeveridade: {}, porCategoriaOwasp: {},
  aging: { ate7Dias: 0, de7A30Dias: 0, de30A90Dias: 0, mais90Dias: 0 },
  mttrPorSeveridade: Object.fromEntries(["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((severity) => [
    severity, { medianaDias: null, amostras: 0 },
  ])),
};

function renderPage(query = "") {
  const client = createQueryClient();
  clients.push(client);
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/applications/app-1/dashboard${query}`]}>
          <Routes>
            <Route path="/applications/:id/dashboard" element={<ApplicationDashboardPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem("vulnera:filtros:app-1");
  api.application.mockResolvedValue({ id: "app-1", name: "Portal TechNova" });
  api.summary.mockResolvedValue(summary);
  api.timeseries.mockResolvedValue({ applicationId: "app-1", periodo, granularidade: "day", pontos: [] });
  api.insights.mockResolvedValue({
    applicationId: "app-1", geradoEm: periodo.ate,
    insights: [{ id: "insight-1", severidade: "neutro", texto: "Insight consultado sob demanda" }],
  });
  api.comparison.mockResolvedValue({ companyId: "company-1", periodo, aplicacoes: [] });
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  localStorage.removeItem("vulnera:filtros:app-1");
});

describe("Carregamento de métricas por aba", () => {
  it("MET-LAZY-01 — postura inicial consulta resumo e série, sem buscar abas fechadas", async () => {
    renderPage();
    await screen.findByText("Findings em aberto");

    expect(screen.getByRole("tab", { name: "Postura atual" })).toHaveAttribute("aria-selected", "true");
    expect(api.summary).toHaveBeenCalledTimes(1);
    expect(api.timeseries).toHaveBeenCalledTimes(1);
    expect(api.insights).not.toHaveBeenCalled();
    expect(api.comparison).not.toHaveBeenCalled();
  });

  it("MET-LAZY-02 — Insights só busca quando sua aba é selecionada", async () => {
    renderPage();
    await screen.findByText("Findings em aberto");
    expect(api.insights).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Insights" }));
    expect(await screen.findByText("Insight consultado sob demanda")).toBeInTheDocument();
    expect(api.insights).toHaveBeenCalledTimes(1);
    expect(api.comparison).not.toHaveBeenCalled();
    expect(api.summary).toHaveBeenCalledTimes(1);
  });

  it("MET-LAZY-03 — Comparativo só busca quando sua aba é selecionada", async () => {
    renderPage();
    await screen.findByText("Findings em aberto");
    expect(api.comparison).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("tab", { name: "Comparativo" }));
    expect(await screen.findByText("Nenhuma outra aplicação para comparar")).toBeInTheDocument();
    expect(api.comparison).toHaveBeenCalledTimes(1);
    expect(api.insights).not.toHaveBeenCalled();
    expect(api.summary).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["insights", "Insights"], ["comparativo", "Comparativo"], ["evolucao", "Evolução"],
  ])("MET-LAZY-04 — link direto para %s respeita a aba da URL", async (tab, label) => {
    renderPage(`?aba=${tab}&periodo=tudo`);
    await waitFor(() => expect(api.summary).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("tab", { name: new RegExp(`^${label}`) })).toHaveAttribute("aria-selected", "true");

    expect(api.timeseries).toHaveBeenCalledTimes(tab === "evolucao" ? 1 : 0);
    expect(api.insights).toHaveBeenCalledTimes(tab === "insights" ? 1 : 0);
    expect(api.comparison).toHaveBeenCalledTimes(tab === "comparativo" ? 1 : 0);
  });
});
