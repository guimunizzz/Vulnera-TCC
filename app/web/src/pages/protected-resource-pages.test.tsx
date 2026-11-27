/**
 * Confirma a mensagem neutra em rotas protegidas de módulos operacionais.
 * Consumido pelo Vitest com respostas HTTP simuladas e sem dados reais.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DastScanDetailPage } from "./dast-scan-detail-page";
import { FindingEditorPage } from "./finding-editor-page";
import { PlaybookDetailPage } from "./playbook-detail-page";

const api = vi.hoisted(() => ({
  scan: vi.fn(), scanStatus: vi.fn(), scanFindings: vi.fn(),
  playbook: vi.fn(), finding: vi.fn(), project: vi.fn(),
}));
vi.mock("../lib/api/dast.api", () => ({
  dastApi: { getById: api.scan, getStatus: api.scanStatus, listFindings: api.scanFindings },
}));
vi.mock("../lib/api/playbooks.api", () => ({ playbooksApi: { getById: api.playbook } }));
vi.mock("../lib/api/vulnerabilities.api", () => ({ vulnerabilitiesApi: { getById: api.finding } }));
vi.mock("../lib/api/projects.api", () => ({ projectsApi: { getById: api.project } }));

describe("URLs de recursos protegidos", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { url: "/dast/scans/denied", path: "/dast/scans/:id", Page: DastScanDetailPage, request: api.scan, back: "/dast" },
    { url: "/playbooks/denied", path: "/playbooks/:id", Page: PlaybookDetailPage, request: api.playbook, back: "/playbooks" },
    { url: "/findings/denied/edit", path: "/findings/:id/edit", Page: FindingEditorPage, request: api.finding, back: "/projects" },
    { url: "/projects/denied/findings/new", path: "/projects/:projectId/findings/new", Page: FindingEditorPage, request: api.project, back: "/projects" },
  ])("bloqueia a exibição após negativa em $path", async ({ url, path, Page, request, back }) => {
    const response = { status: 403, data: { error: "Informação interna" } } as AxiosResponse;
    request.mockRejectedValueOnce(new AxiosError("Falha HTTP", undefined, undefined, undefined, response));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes><Route path={path} element={<Page />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Recurso indisponível" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar para/ })).toHaveAttribute("href", back);
    expect(screen.queryByText("Informação interna")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(api.scanStatus).not.toHaveBeenCalled();
    expect(api.scanFindings).not.toHaveBeenCalled();
    if (request !== api.project) expect(api.project).not.toHaveBeenCalled();
  });
});
