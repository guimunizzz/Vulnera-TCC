/**
 * code-import-detail-page.test.tsx — detalhe de uma importação SAST/SCA
 * (ADR-052) com a API mockada: números do topo, selo "novo" vindo da
 * comparação, filtros, link seguro e triagem pela rota de código (não a do DAST).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../design/theme-provider";
import { CodeImportDetailPage } from "./code-import-detail-page";
import type { CodeFinding, CodeScanImport } from "../types/code-import.types";

const api = vi.hoisted(() => ({
  getById: vi.fn(),
  listFindings: vi.fn(),
  compare: vi.fn(),
  triage: vi.fn(),
  getReportData: vi.fn(),
  getPromotionDraft: vi.fn(),
  promote: vi.fn(),
  list: vi.fn(),
  importReport: vi.fn(),
}));
const dast = vi.hoisted(() => ({ triage: vi.fn() }));
vi.mock("../lib/api/code-imports.api", () => ({ codeImportsApi: api }));
vi.mock("../lib/api/dast.api", () => ({ dastApi: dast }));
vi.mock("../lib/api/projects.api", () => ({ projectsApi: { list: async () => [] } }));

const IMPORT: CodeScanImport = {
  id: "imp-2", projectId: "p1", projectName: "Portal", applicationName: "App Portal", companyName: "TechNova", format: "SARIF",
  toolName: "Semgrep OSS", toolVersion: "1.95.0", fileName: "semgrep.sarif", uploadedByName: "Pentester A",
  previousImportId: "imp-1", totalFindings: 2, newFindings: 1, persistedFindings: 1, resolvedFindings: 3,
  componentsCount: null, warningMessage: null, createdAt: "2026-11-13T10:00:00Z",
  severityCounts: { CRITICAL: 1, HIGH: 0, MEDIUM: 1, LOW: 0, INFO: 0 },
};

function achado(over: Partial<CodeFinding>): CodeFinding {
  return {
    id: "f", importId: "imp-2", projectId: "p1", fingerprint: "fp", category: "SAST", ruleId: "regra", title: "Título",
    severity: "MEDIUM", cweId: null, filePath: "src/a.js", startLine: 1, endLine: 1, snippet: null, packageName: null,
    packageVersion: null, purl: null, fixedVersion: null, advisoryId: null, cvssScore: null, cvssVector: null,
    description: null, recommendation: null, helpUri: null, triageStatus: "NEW", triageNote: null, triagedByName: null,
    triagedAt: null, triageInherited: false, promotedVulnerability: null, ...over,
  };
}

const FINDINGS = [
  achado({ id: "f1", fingerprint: "novo", severity: "CRITICAL", title: "SQL injection na busca", filePath: "src/db.js", startLine: 42, cweId: "89", helpUri: "javascript:alert(1)" }),
  achado({ id: "f2", fingerprint: "velho", severity: "MEDIUM", title: "Cookie sem HttpOnly", triageStatus: "FALSE_POSITIVE", triageInherited: true }),
];

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/sast-sca/imports/imp-2"]}>
          <Routes>
            <Route path="/sast-sca/imports/:id" element={<CodeImportDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.getById.mockResolvedValue(IMPORT);
  api.listFindings.mockResolvedValue(FINDINGS);
  api.compare.mockResolvedValue({
    headImport: IMPORT,
    baseImport: { ...IMPORT, id: "imp-1", previousImportId: null },
    introduced: [{ fingerprint: "novo", title: "SQL injection na busca", severity: "CRITICAL", category: "SAST", location: "src/db.js:42", promotedVulnerability: null }],
    persisted: [],
    resolved: [],
  });
  api.triage.mockResolvedValue(FINDINGS[0]);
});

describe("Detalhe da importação SAST/SCA", () => {
  it("mostra cabeçalho, contadores e o selo novo só no achado que apareceu desde a anterior", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: /Semgrep OSS/ })).toBeInTheDocument();
    const linhaNova = (await screen.findByText("SQL injection na busca")).closest("tr")!;
    expect(within(linhaNova).getByText("novo")).toBeInTheDocument();
    const linhaVelha = screen.getByText("Cookie sem HttpOnly").closest("tr")!;
    expect(within(linhaVelha).queryByText("novo")).not.toBeInTheDocument();
    expect(within(linhaVelha).getByText("herdada")).toBeInTheDocument();
  });

  it("filtra por severidade e mostra a contagem visível", async () => {
    renderPage();
    await screen.findByText("SQL injection na busca");
    fireEvent.click(screen.getByRole("button", { name: /Crítica/, pressed: false }));
    expect(screen.queryByText("Cookie sem HttpOnly")).not.toBeInTheDocument();
    expect(screen.getByText("1 de 2 achados")).toBeInTheDocument();
  });

  it("helpUri javascript: vira texto, nunca link; e a triagem usa a rota de código", async () => {
    renderPage();
    const linha = (await screen.findByText("SQL injection na busca")).closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: "Detalhes" }));

    expect(screen.getByText("javascript:alert(1)").tagName).toBe("P");
    expect(screen.queryByRole("link", { name: /javascript:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /CWE-89/ })).toHaveAttribute("href", "https://cwe.mitre.org/data/definitions/89.html");

    fireEvent.click(screen.getByRole("button", { name: "Confirmado" }));
    await waitFor(() => expect(api.triage).toHaveBeenCalledWith("f1", "CONFIRMED", null));
    expect(dast.triage).not.toHaveBeenCalled();
  });

  it("aba Security Graph: falso-positivo oculto até ligar o interruptor, e 'Ver na lista' volta para o achado", async () => {
    renderPage();
    await screen.findByText("SQL injection na busca");
    fireEvent.click(screen.getByRole("tab", { name: /Security Graph/ }));

    const noSql = await screen.findByRole("button", { name: /^Finding: SQL injection na busca/ });
    expect(screen.getByRole("button", { name: /^Aplicação: App Portal/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Arquivo: db\.js/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Finding: Cookie sem HttpOnly/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: /Falsos-positivos \(1\)/ }));
    expect(await screen.findByRole("button", { name: /^Finding: Cookie sem HttpOnly/ })).toBeInTheDocument();

    fireEvent.click(noSql);
    fireEvent.click(screen.getByRole("button", { name: "Ver na lista para triar" }));
    expect(await screen.findByRole("tab", { name: /Achados/, selected: true })).toBeInTheDocument();
    // A linha do achado volta aberta, com a triagem à mão.
    expect(await screen.findByRole("button", { name: "Confirmado" })).toBeInTheDocument();
  });

  it("salvar a nota logo depois de mudar o status não desfaz a triagem (lista ainda desatualizada)", async () => {
    // A API confirma a triagem, mas a lista recarregada continua devolvendo NEW
    // (o estado da corrida vista no fluxo real: ACCEPTED_RISK → NEW em 73 ms).
    renderPage();
    const linha = (await screen.findByText("SQL injection na busca")).closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: "Detalhes" }));
    fireEvent.click(screen.getByRole("button", { name: "Risco aceito" }));
    await waitFor(() => expect(api.triage).toHaveBeenCalledWith("f1", "ACCEPTED_RISK", null));
    await waitFor(() => expect(screen.getByRole("button", { name: "Risco aceito" })).toHaveAttribute("aria-pressed", "true"));

    fireEvent.change(screen.getByLabelText(/Nota da triagem/), { target: { value: "Código morto." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));
    await waitFor(() => expect(api.triage).toHaveBeenLastCalledWith("f1", "ACCEPTED_RISK", "Código morto."));
  });
});
