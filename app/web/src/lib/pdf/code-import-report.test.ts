/**
 * PDF da importação SAST/SCA (ADR-052): o recorte decidido em 2026-11-13
 * (falso-positivo fora da lista, só contado) e a geração ponta a ponta com
 * texto fora do WinAnsi (emoji/seta em mensagens de ferramenta).
 */
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateCodeImportReportPdf, resumirParaRelatorio } from "./code-import-report";
import type { CodeFinding, CodeImportReportData } from "../../types/code-import.types";

function achado(over: Partial<CodeFinding>): CodeFinding {
  return {
    id: "f", importId: "i", projectId: "p", fingerprint: "fp", category: "SAST", ruleId: "regra", title: "Título",
    severity: "MEDIUM", cweId: null, filePath: "src/a.js", startLine: 3, endLine: 3, snippet: "eval(req.query.x) → 💥",
    packageName: null, packageVersion: null, purl: null, fixedVersion: null, advisoryId: null, cvssScore: null, cvssVector: null,
    description: "Uso de eval com entrada do usuário ✓", recommendation: "Não use eval.", helpUri: "https://semgrep.dev/r/x",
    triageStatus: "NEW", triageNote: null, triagedByName: null, triagedAt: null, triageInherited: false, promotedVulnerability: null, ...over,
  };
}

const FINDINGS = [
  achado({ id: "1", severity: "CRITICAL" }),
  achado({ id: "2", severity: "HIGH", category: "SCA", packageName: "lodash", packageVersion: "4.17.15", fixedVersion: "4.17.21", filePath: null }),
  achado({ id: "3", severity: "LOW", triageStatus: "FALSE_POSITIVE" }),
  achado({ id: "4", severity: "MEDIUM", promotedVulnerability: { id: "v", projectId: "p", severityFinal: "HIGH", status: "OPEN" } }),
];

describe("PDF SAST/SCA", () => {
  it("falso-positivo fica fora da lista e do gráfico, mas é contado", () => {
    const r = resumirParaRelatorio(FINDINGS);
    expect(r.visiveis.map((f) => f.id)).toEqual(["1", "2", "4"]);
    expect(r.falsosPositivos).toBe(1);
    expect(r.porSeveridade).toMatchObject({ CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 0 });
    expect(r.porTriagem).toEqual({ NEW: 3, CONFIRMED: 0, FALSE_POSITIVE: 1, ACCEPTED_RISK: 0 });
    expect(r).toMatchObject({ sast: 2, sca: 1, promovidos: 1 });
  });

  it("gera um PDF válido mesmo com emoji e seta no texto da ferramenta", async () => {
    const data: CodeImportReportData = {
      import: {
        id: "imp", projectId: "p", projectName: "Portal", applicationName: "App", format: "SARIF", toolName: "Semgrep OSS",
        toolVersion: "1.95.0", fileName: "semgrep.sarif", uploadedByName: "Pentester", previousImportId: "imp-0", totalFindings: 4,
        newFindings: 1, persistedFindings: 3, resolvedFindings: 1, componentsCount: null, warningMessage: null,
        createdAt: "2026-11-13T10:00:00Z", severityCounts: { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 1, INFO: 0 },
      },
      findings: FINDINGS,
      resolved: [{ fingerprint: "x", title: "XSS antigo", severity: "HIGH", category: "SAST", location: "src/v.js:1", promotedVulnerability: null }],
      generatedAt: "2026-11-13T11:00:00Z",
    };
    const blob = await generateCodeImportReportPdf(data);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    // capa + conteúdo + apêndice
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(3);
  });
});
