/**
 * Regras puras das telas SAST/SCA (ADR-052): validação do arquivo antes do
 * upload, links seguros vindos de arquivo do usuário, filtros e o recorte
 * "última importação por fonte" que alimenta os números da página.
 */
import { describe, expect, it } from "vitest";
import { descreverSeveridades, FILTROS_INICIAIS, filtrarAchados, ultimasPorFonte, urlSegura, validarArquivo } from "./code-import";
import type { CodeFinding, CodeScanImport } from "../types/code-import.types";

function achado(over: Partial<CodeFinding>): CodeFinding {
  return {
    id: "f", importId: "i", projectId: "p", fingerprint: "fp", category: "SAST", ruleId: "regra", title: "Título",
    severity: "MEDIUM", cweId: null, filePath: null, startLine: null, endLine: null, snippet: null, packageName: null,
    packageVersion: null, purl: null, fixedVersion: null, advisoryId: null, cvssScore: null, cvssVector: null,
    description: null, recommendation: null, helpUri: null, triageStatus: "NEW", triageNote: null, triagedByName: null,
    triagedAt: null, triageInherited: false, promotedVulnerability: null, ...over,
  };
}

describe("lib/code-import", () => {
  it("valida extensão, vazio e limite de 10 MB antes de enviar", () => {
    expect(validarArquivo({ name: "semgrep.sarif", size: 100 })).toBeNull();
    expect(validarArquivo({ name: "SBOM.CDX.JSON", size: 100 })).toBeNull();
    expect(validarArquivo({ name: "relatorio.xml", size: 100 })).toMatch(/\.sarif ou \.json/);
    expect(validarArquivo({ name: "a.json", size: 0 })).toMatch(/vazio/);
    expect(validarArquivo({ name: "a.json", size: 11 * 1024 * 1024 })).toMatch(/limite é 10 MB/);
  });

  it("só aceita http(s) como link — javascript:/data: de um SARIF forjado viram texto", () => {
    expect(urlSegura("https://semgrep.dev/r/x")).toBe("https://semgrep.dev/r/x");
    expect(urlSegura("javascript:alert(1)")).toBeNull();
    expect(urlSegura("data:text/html,<script>")).toBeNull();
    expect(urlSegura("não é url")).toBeNull();
    expect(urlSegura(null)).toBeNull();
  });

  it("filtra por severidade (OU), origem, triagem, novos e busca em regra/arquivo/pacote/CVE/CWE", () => {
    const lista = [
      achado({ id: "1", fingerprint: "a", severity: "CRITICAL", filePath: "src/db.js", cweId: "89" }),
      achado({ id: "2", fingerprint: "b", severity: "HIGH", category: "SCA", packageName: "lodash", advisoryId: "CVE-2021-23337" }),
      achado({ id: "3", fingerprint: "c", severity: "LOW", triageStatus: "FALSE_POSITIVE" }),
    ];
    const ids = (f: Partial<typeof FILTROS_INICIAIS>, novos = new Set<string>()) => filtrarAchados(lista, { ...FILTROS_INICIAIS, ...f }, novos).map((x) => x.id);

    expect(ids({})).toEqual(["1", "2", "3"]);
    expect(ids({ severidades: ["CRITICAL", "LOW"] })).toEqual(["1", "3"]);
    expect(ids({ categoria: "SCA" })).toEqual(["2"]);
    expect(ids({ triagem: "FALSE_POSITIVE" })).toEqual(["3"]);
    expect(ids({ soNovos: true }, new Set(["b"]))).toEqual(["2"]);
    expect(ids({ busca: "cve-2021" })).toEqual(["2"]);
    expect(ids({ busca: "CWE-89" })).toEqual(["1"]);
    expect(ids({ busca: "db.js" })).toEqual(["1"]);
  });

  it("última importação por projeto+formato+ferramenta, sem contar reimportações duas vezes", () => {
    const imp = (id: string, projectId: string, toolName: string, format: "SARIF" | "CYCLONEDX" = "SARIF") => ({ id, projectId, toolName, format }) as CodeScanImport;
    const lista = [imp("novo", "p1", "Semgrep"), imp("velho", "p1", "Semgrep"), imp("sbom", "p1", "trivy", "CYCLONEDX"), imp("outro", "p2", "Semgrep")];
    expect(ultimasPorFonte(lista).map((i) => i.id)).toEqual(["novo", "sbom", "outro"]);
  });

  it("descreve a distribuição por extenso (a cor nunca é o único código)", () => {
    expect(descreverSeveridades({ CRITICAL: 1, HIGH: 0, MEDIUM: 3, LOW: 0, INFO: 0 })).toBe("1 crítica, 3 média");
    expect(descreverSeveridades({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 })).toBe("nenhum achado");
  });
});
