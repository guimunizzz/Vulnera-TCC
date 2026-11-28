/**
 * Protege o carregamento do grafo e seus metadados após a autorização do recurso.
 * Evita consultas dependentes e retries para negativas definitivas, preservando
 * a recuperação de falhas de comunicação. Consumido pelo Vitest do frontend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { createQueryClient } from "../lib/query-client";
import type { ExposureGraph } from "../types/exposure-graph.types";
import { ExposureGraphPage } from "./exposure-graph-page";

const api = vi.hoisted(() => ({ graph: vi.fn(), company: vi.fn() }));
vi.mock("../lib/api/exposure-graph.api", () => ({ exposureGraphApi: { obter: api.graph } }));
vi.mock("../lib/api/companies.api", () => ({ companiesApi: { me: api.company } }));
vi.mock("../features/security-graph/exposure-graph", () => ({ ExposureGraph2D: () => null }));
vi.mock("../features/security-graph/painel-exposicao", () => ({ PainelExposicao: () => null }));

const clients: QueryClient[] = [];
const graph: ExposureGraph = { companyId: "company-1", geradoEm: "2026-11-27T10:00:00Z", aplicacoes: [] };
function httpError(status: number, error = "FORBIDDEN") {
  return new AxiosError("Falha de leitura", AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
    status, statusText: "Error", data: { error, name: "Empresa de outro tenant" },
    headers: {}, config: { headers: new AxiosHeaders() },
  });
}
function renderPage(client = createQueryClient()) {
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><ExposureGraphPage /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  api.graph.mockResolvedValue(graph);
  api.company.mockResolvedValue({ id: graph.companyId, name: "Empresa autorizada" });
});
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

describe("Exposure Graph — autorização do recurso", () => {
  it("GRAPH-ACCESS-01 — aguarda o grafo autorizado antes de buscar o nome da empresa", async () => {
    let authorize!: (data: ExposureGraph) => void;
    api.graph.mockReturnValue(new Promise((resolve) => { authorize = resolve; }));
    renderPage();
    expect(api.graph).toHaveBeenCalledTimes(1);
    expect(api.company).not.toHaveBeenCalled();
    await act(async () => authorize(graph));
    await screen.findByText("Nenhuma aplicação ativa");
    await waitFor(() => expect(api.company).toHaveBeenCalledTimes(1));
  });

  it.each([403, 404])("GRAPH-ACCESS-02 — HTTP %s usa mensagem neutra sem carregar metadados", async (status) => {
    api.graph.mockRejectedValue(httpError(status));
    const { container } = renderPage();
    await screen.findByRole("heading", { name: "Recurso indisponível" });
    expect(screen.getByRole("link", { name: "Voltar para aplicações" })).toHaveAttribute("href", "/applications");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(screen.queryByText("Empresa de outro tenant")).not.toBeInTheDocument();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    expect(api.company).not.toHaveBeenCalled();
    expect(api.graph).toHaveBeenCalledTimes(1);
  });

  it("GRAPH-ACCESS-03 — conta sem empresa preserva o estado vazio legítimo", async () => {
    api.graph.mockRejectedValue(httpError(404, "COMPANY_NOT_FOUND"));
    renderPage();
    await screen.findByText("Sua conta não está vinculada a uma empresa");
    expect(api.company).not.toHaveBeenCalled();
    expect(api.graph).toHaveBeenCalledTimes(1);
  });

  it("GRAPH-ACCESS-04 — sessão inválida oferece login sem repetir o recurso", async () => {
    api.graph.mockRejectedValue(httpError(401));
    renderPage();
    await screen.findByRole("heading", { name: "Sessão indisponível" });
    expect(screen.getByRole("link", { name: "Ir para o login" })).toHaveAttribute("href", "/login");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(api.graph).toHaveBeenCalledTimes(1);
    expect(api.company).not.toHaveBeenCalled();
  });

  it("GRAPH-ACCESS-05 — falha operacional preserva retry mesmo com código de empresa ausente", async () => {
    api.graph.mockRejectedValue(httpError(500, "COMPANY_NOT_FOUND"));
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false } });
    renderPage(client);
    await screen.findByRole("heading", { name: "Não foi possível carregar o recurso" });
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(screen.queryByText("Sua conta não está vinculada a uma empresa")).not.toBeInTheDocument();
    expect(api.company).not.toHaveBeenCalled();
  });
});
