/**
 * code-import-detail-page.test.tsx — detalhe de uma importação SAST/SCA
 * (ADR-052) com a API mockada: números do topo, selo "novo" vindo da
 * comparação, filtros, link seguro e triagem pela rota de código (não a do DAST).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
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
  acceptSuggestions: vi.fn(),
}));
const dast = vi.hoisted(() => ({ triage: vi.fn() }));
const vulns = vi.hoisted(() => ({ transition: vi.fn() }));
vi.mock("../lib/api/code-imports.api", () => ({ codeImportsApi: api }));
vi.mock("../lib/api/vulnerabilities.api", () => ({ vulnerabilitiesApi: vulns }));
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
    triagedAt: null, triageInherited: false, promotedVulnerability: null, preTriagem: { contexto: "PRODUCAO", sinais: [], sugestao: null }, ...over,
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
    reopenCandidates: [],
  });
  api.triage.mockResolvedValue(FINDINGS[0]);
});

describe("Detalhe da importação SAST/SCA", () => {
  it.each([403, 404])("encerra a leitura com mensagem neutra após HTTP %s", async (status) => {
    const response = { status, data: { message: "Dados internos" } } as AxiosResponse;
    api.getById.mockRejectedValueOnce(new AxiosError("Falha HTTP", undefined, undefined, undefined, response));
    renderPage();
    expect(await screen.findByRole("heading", { name: "Recurso indisponível" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para SAST/SCA" })).toHaveAttribute("href", "/sast-sca");
    expect(screen.queryByText("Dados internos")).not.toBeInTheDocument();
    expect(api.listFindings).not.toHaveBeenCalled();
    expect(api.compare).not.toHaveBeenCalled();
  });

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

  it("CODE-FUT-03: sem candidata a reabrir, o aviso não aparece", async () => {
    renderPage();
    await screen.findByText("SQL injection na busca");
    expect(screen.queryByText("Correção não confirmada")).not.toBeInTheDocument();
  });

  it("CODE-FUT-03: Reabrir confirma e chama a transição de retorno do ADR-033", async () => {
    const promovida = { id: "v1", projectId: "p1", severityFinal: "CRITICAL", status: "FIXED" };
    api.compare.mockResolvedValue({
      headImport: IMPORT,
      baseImport: { ...IMPORT, id: "imp-1", previousImportId: null },
      introduced: [{ fingerprint: "novo", title: "SQL injection na busca", severity: "CRITICAL", category: "SAST", location: "src/db.js:42", promotedVulnerability: promovida }],
      persisted: [],
      resolved: [],
      reopenCandidates: [{ fingerprint: "novo", title: "SQL injection na busca", severity: "CRITICAL", category: "SAST", location: "src/db.js:42", promotedVulnerability: promovida }],
    });
    vulns.transition.mockResolvedValue({ id: "v1", status: "IN_PROGRESS" });
    renderPage();

    expect(await screen.findByText("Correção não confirmada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "abrir vulnerabilidade" })).toHaveAttribute("href", "/findings/v1");
    fireEvent.click(screen.getByRole("button", { name: /Reabrir/ }));
    const dialogo = await screen.findByRole("dialog", { name: "Reabrir vulnerabilidade?" });
    expect(vulns.transition).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(vulns.transition).toHaveBeenCalledWith("v1", "IN_PROGRESS"));
  });

  it("pré-triagem: resume prováveis e fora de produção, filtra, mostra sinais e aceita as sugestões em lote", async () => {
    const provavel = achado({
      id: "p1", fingerprint: "p", severity: "HIGH", title: "Path traversal no upload", filePath: "src/upload.js", cweId: "22",
      preTriagem: { contexto: "PRODUCAO", sinais: [{ tipo: "DAST_CONFIRMADO", forte: true, detalhe: "O DAST já confirmou CWE-22 nesta aplicação.", vulnerabilityId: "v9" }], sugestao: { tipo: "PROVAVEL_VULNERABILIDADE", motivo: "confirmado pelo DAST" } },
    });
    const deTeste = achado({
      id: "t1", fingerprint: "t", title: "Hash bcrypt", filePath: "tests/fixtures/x.sarif",
      preTriagem: { contexto: "FIXTURE", sinais: [], sugestao: { tipo: "FALSO_POSITIVO", motivo: "Fora do código de produção: fixture/dado de teste." } },
    });
    const deDocs = achado({
      id: "d1", fingerprint: "d", title: "Link http", filePath: "docs/rel.html",
      preTriagem: { contexto: "DOCUMENTACAO", sinais: [], sugestao: { tipo: "FALSO_POSITIVO", motivo: "Fora do código de produção: documentação." } },
    });
    api.listFindings.mockResolvedValue([provavel, deTeste, deDocs, FINDINGS[1]]);
    api.acceptSuggestions.mockResolvedValue({ accepted: 2, byContext: { FIXTURE: 1, DOCUMENTACAO: 1 } });
    renderPage();

    const painel = await screen.findByRole("region", { name: "Pré-triagem" });
    expect(within(painel).getByText("1 provável vulnerabilidade")).toBeInTheDocument();
    expect(within(painel).getByText(/2 achados fora do código de produção/)).toBeInTheDocument();
    expect(within(painel).getByText(/1 fixture · 1 documentação/)).toBeInTheDocument();

    const linha = screen.getByText("Path traversal no upload").closest("tr")!;
    expect(within(linha).getByText("provável vulnerabilidade")).toBeInTheDocument();
    expect(within(screen.getByText("Hash bcrypt").closest("tr")!).getByText("fixture")).toBeInTheDocument();

    fireEvent.click(within(painel).getByRole("button", { name: "Ver só esses" }));
    expect(screen.queryByText("Hash bcrypt")).not.toBeInTheDocument();
    expect(screen.getByText("1 de 4 achados")).toBeInTheDocument();

    fireEvent.click(within(linha).getByRole("button", { name: "Detalhes" }));
    expect(screen.getByText("O DAST já confirmou CWE-22 nesta aplicação.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ver vulnerabilidade" })).toHaveAttribute("href", "/findings/v9");

    fireEvent.click(within(painel).getByRole("button", { name: "Aceitar sugestões (2)" }));
    await waitFor(() => expect(api.acceptSuggestions).toHaveBeenCalledWith("imp-2"));
    expect(await screen.findByText("2 achados marcados como falso-positivo.")).toBeInTheDocument();
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
