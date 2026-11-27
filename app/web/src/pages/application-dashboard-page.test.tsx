/**
 * application-dashboard-page.test.tsx
 *
 * O QUE FAZ: verifica quais métricas a navegação entre abas realmente busca.
 * POR QUE EXISTE: abas fechadas não devem consumir o limite compartilhado da
 * API antes que a pessoa peça seus dados, inclusive ao abrir um link direto.
 * QUEM CONSOME: suíte Vitest do frontend e regressão do painel da aplicação.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
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
  abertosPorOrigem: {}, filaDeTriagem: null,
  aging: { ate7Dias: 0, de7A30Dias: 0, de30A90Dias: 0, mais90Dias: 0 },
  mttrPorSeveridade: Object.fromEntries(["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((severity) => [
    severity, { medianaDias: null, amostras: 0 },
  ])),
};

function renderPage(query = "", client = createQueryClient()) {
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

function httpError(status: number) {
  return new AxiosError("Falha de leitura", AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
    status, statusText: "Error", data: { error: "FORBIDDEN", name: "Metadado de outro tenant" },
    headers: {}, config: { headers: new AxiosHeaders() },
  });
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
  it("MET-ACCESS-01 — aguarda a autorização da aplicação antes de consultar métricas", async () => {
    let authorize!: (application: { id: string; name: string }) => void;
    api.application.mockReturnValue(new Promise((resolve) => { authorize = resolve; }));
    renderPage("?aba=insights");
    expect(api.application).toHaveBeenCalledTimes(1);
    for (const request of [api.summary, api.timeseries, api.insights, api.comparison]) {
      expect(request).not.toHaveBeenCalled();
    }
    await act(async () => authorize({ id: "app-1", name: "Aplicação autorizada" }));
    await screen.findByText("Insight consultado sob demanda");
    expect(api.summary).toHaveBeenCalledTimes(1);
    expect(api.insights).toHaveBeenCalledTimes(1);
  });

  it.each([403, 404])("MET-ACCESS-02 — HTTP %s encerra o carregamento sem consultas dependentes ou retry", async (status) => {
    api.application.mockRejectedValue(httpError(status));
    const { container } = renderPage("?aba=comparativo");
    expect(await screen.findByRole("heading", { name: "Recurso indisponível" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para aplicações" })).toHaveAttribute("href", "/applications");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    expect(screen.queryByText("Metadado de outro tenant")).not.toBeInTheDocument();
    expect(api.application).toHaveBeenCalledTimes(1);
    for (const request of [api.summary, api.timeseries, api.insights, api.comparison]) {
      expect(request).not.toHaveBeenCalled();
    }
  });

  it("MET-ACCESS-03 — negativa de métrica também esconde dados previamente autorizados", async () => {
    api.summary.mockRejectedValue(httpError(403));
    renderPage();
    await screen.findByRole("heading", { name: "Recurso indisponível" });
    expect(screen.queryByText("Portal TechNova")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(api.summary).toHaveBeenCalledTimes(1);
  });

  it("MET-ACCESS-06 — revalidação negada oculta o painel mesmo com métricas em cache", async () => {
    const client = createQueryClient();
    renderPage("", client);
    await screen.findByText("Findings em aberto");
    api.application.mockRejectedValue(httpError(403));
    await act(async () => { await client.invalidateQueries({ queryKey: ["application", "app-1"] }); });
    await screen.findByRole("heading", { name: "Recurso indisponível" });
    expect(screen.queryByText("Portal TechNova")).not.toBeInTheDocument();
    expect(screen.queryByText("Findings em aberto")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(api.summary).toHaveBeenCalledTimes(1);
  });

  it("MET-ACCESS-07 — negativa de uma métrica tem prioridade sobre falha operacional simultânea", async () => {
    api.summary.mockRejectedValue(httpError(500));
    api.timeseries.mockRejectedValue(httpError(403));
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false } });
    renderPage("", client);
    await screen.findByRole("heading", { name: "Recurso indisponível" });
    expect(screen.queryByText("Não foi possível carregar o recurso")).not.toBeInTheDocument();
  });

  it("MET-ACCESS-04 — HTTP 401 respeita a resolução da sessão e não oferece retry de recurso", async () => {
    api.application.mockRejectedValue(httpError(401));
    renderPage();
    await screen.findByRole("heading", { name: "Sessão indisponível" });
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(api.application).toHaveBeenCalledTimes(1);
    expect(api.summary).not.toHaveBeenCalled();
  });

  it.each([
    ["500", () => httpError(500), "Não foi possível carregar o recurso"],
    ["429", () => httpError(429), "Muitas solicitações"],
    ["rede", () => new AxiosError("Network Error", AxiosError.ERR_NETWORK), "Falha de comunicação"],
    ["timeout", () => new AxiosError("Timeout", AxiosError.ECONNABORTED), "Falha de comunicação"],
  ])("MET-ACCESS-05 — %s mantém erro recuperável distinto de permissão", async (_kind, makeError, title) => {
    api.application.mockRejectedValue(makeError());
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false } });
    renderPage("", client);
    await screen.findByRole("heading", { name: title });
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByText("Recurso indisponível")).not.toBeInTheDocument();
    expect(api.summary).not.toHaveBeenCalled();
  });

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
