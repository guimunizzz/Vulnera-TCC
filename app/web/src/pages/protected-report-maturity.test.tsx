/**
 * O que faz: verifica negativas e falhas de leitura no relatório DAST e maturidade.
 * Por que existe: evita retries e metadados dependentes após acesso recusado.
 * Quem consome: Vitest focal das páginas protegidas, usando somente fixtures locais.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DastScanReportPage } from "./dast-scan-report-page";
import { MaturityAssessmentPage } from "./maturity-assessment-page";
import { dastApi } from "../lib/api/dast.api";
import { maturityApi } from "../lib/api/maturity.api";
import { useCompanyName } from "../hooks/use-company-name";
import { useAuthStore } from "../store/auth.store";
import { createQueryClient } from "../lib/query-client";

vi.mock("../lib/api/dast.api", () => ({ dastApi: { getReportHtml: vi.fn() } }));
vi.mock("../lib/api/maturity.api", () => ({ maturityApi: { getLatestByCompany: vi.fn(), getCatalog: vi.fn(), createAssessment: vi.fn(), submitScores: vi.fn() } }));
vi.mock("../hooks/use-company-name", () => ({ useCompanyName: vi.fn() }));
vi.mock("../components/maturity/maturity-radar", () => ({ MaturityRadar: () => <div>Radar autorizado</div> }));

const clients: QueryClient[] = [];
function httpError(status: number) {
  return { isAxiosError: true, response: { status, data: { error: "PRIVATE_DETAIL" }, headers: {} } };
}
function renderPage(page: "report" | "maturity", productionRetries = false) {
  const client = productionRetries ? createQueryClient() : new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const path = page === "report" ? "/dast/scans/scan-b/report" : "/companies/company-b/maturity";
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/dast/scans/:id/report" element={<DastScanReportPage />} />
    <Route path="/companies/:companyId/maturity" element={<MaturityAssessmentPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  useAuthStore.setState({ user: { id: "member-a", name: "Membro", email: "member@example.test", role: "CLIENT", companyId: "company-a", companyRole: "MEMBER", createdAt: "2026-01-01" } });
  vi.mocked(maturityApi.getCatalog).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.clearAllMocks();
  useAuthStore.setState({ user: null });
});

describe("Relatório DAST protegido", () => {
  it.each([403, 404])("trata %i sem retry nem detalhes privados", async (status) => {
    vi.mocked(dastApi.getReportHtml).mockRejectedValue(httpError(status));
    renderPage("report", true);
    expect(await screen.findByRole("heading", { name: "Recurso indisponível" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para DAST" })).toHaveAttribute("href", "/dast");
    expect(dastApi.getReportHtml).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(screen.queryByText("PRIVATE_DETAIL")).not.toBeInTheDocument();
  });
  it.each([
    [401, "Sessão indisponível"], [429, "Muitas solicitações"], [500, "Não foi possível carregar o recurso"],
  ])("mantém a classificação de HTTP %i", async (status, title) => {
    vi.mocked(dastApi.getReportHtml).mockRejectedValue(httpError(status));
    renderPage("report");
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Recurso indisponível")).not.toBeInTheDocument();
  });
  it("distingue falha de rede", async () => {
    vi.mocked(dastApi.getReportHtml).mockRejectedValue({ isAxiosError: true });
    renderPage("report");
    expect(await screen.findByRole("heading", { name: "Falha de comunicação" })).toBeInTheDocument();
  });
  it("preserva o isolamento do HTML autorizado pelo sandbox vazio", async () => {
    vi.mocked(dastApi.getReportHtml).mockResolvedValue("<h1>Relatório permitido</h1>");
    renderPage("report");
    const frame = await screen.findByTitle("Relatório original do OWASP ZAP");
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame).toHaveAttribute("srcdoc", "<h1>Relatório permitido</h1>");
  });
});

describe("Maturidade protegida", () => {
  it.each([403, 404])("trata negativa %i sem catálogo, nome da empresa ou estado vazio", async (status) => {
    vi.mocked(maturityApi.getLatestByCompany).mockRejectedValue(httpError(status));
    renderPage("maturity", true);
    expect(await screen.findByRole("heading", { name: "Recurso indisponível" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao painel" })).toHaveAttribute("href", "/dashboard");
    expect(maturityApi.getLatestByCompany).toHaveBeenCalledTimes(1);
    expect(maturityApi.getCatalog).not.toHaveBeenCalled();
    expect(useCompanyName).toHaveBeenLastCalledWith("company-b", false);
    expect(screen.queryByText("Nenhuma avaliação de maturidade ainda")).not.toBeInTheDocument();
  });
  it("mantém assessment null como ausência legítima após confirmar acesso", async () => {
    vi.mocked(maturityApi.getLatestByCompany).mockResolvedValue(null);
    renderPage("maturity");
    expect(await screen.findByText("Nenhuma avaliação de maturidade ainda")).toBeInTheDocument();
    expect(useCompanyName).toHaveBeenLastCalledWith("company-b", true);
    expect(maturityApi.getCatalog).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Criar avaliação" })).not.toBeInTheDocument();
  });
  it("não inicia consultas dependentes enquanto acesso está pendente", async () => {
    let complete!: (value: null) => void;
    vi.mocked(maturityApi.getLatestByCompany).mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    renderPage("maturity");
    expect(screen.getByRole("status")).toHaveTextContent("Carregando");
    expect(maturityApi.getCatalog).not.toHaveBeenCalled();
    expect(useCompanyName).toHaveBeenLastCalledWith("company-b", false);
    complete(null);
    await waitFor(() => expect(maturityApi.getCatalog).toHaveBeenCalledTimes(1));
  });
  it.each([403, 500])("separa falha %i do catálogo da negativa do assessment", async (status) => {
    vi.mocked(maturityApi.getLatestByCompany).mockResolvedValue(null);
    vi.mocked(maturityApi.getCatalog).mockRejectedValue(httpError(status));
    renderPage("maturity");
    expect(await screen.findByRole("heading", { name: "Não foi possível carregar o recurso" })).toBeInTheDocument();
    expect(screen.queryByText("Recurso indisponível")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma avaliação de maturidade ainda")).not.toBeInTheDocument();
  });
});
