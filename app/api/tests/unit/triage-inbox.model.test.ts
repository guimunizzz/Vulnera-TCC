/**
 * triage-inbox.model.test.ts — regras puras da caixa de triagem (ADR-062).
 *   TIB-U01  severidade de qualquer fonte vai para a escala da caixa
 *   TIB-U02  ordem: mais grave primeiro; na mesma severidade, o mais novo
 *   TIB-U03  só a última importação de cada (projeto, ferramenta)
 *   TIB-U04  contexto curto: caminho da URL e resumo de uma linha
 */

import { caminhoDaUrl, ordenarItens, resumir, severidadeDaCaixa, ultimasImportacoes, type ItemDaCaixaDTO } from "../../src/models/triage-inbox.model";

const item = (id: string, severidade: ItemDaCaixaDTO["severidade"], criadoEm: string): ItemDaCaixaDTO => ({
  fonte: "DAST",
  id,
  titulo: id,
  severidade,
  contexto: "",
  detalhe: null,
  criadoEm,
  link: "/",
  companyId: null,
});

describe("caixa de triagem — regras puras", () => {
  it("TIB-U01 — normaliza a severidade", () => {
    expect(severidadeDaCaixa("HIGH")).toBe("HIGH");
    expect(severidadeDaCaixa("critical")).toBe("CRITICAL");
    expect(severidadeDaCaixa("NONE")).toBe("INFO");
    expect(severidadeDaCaixa(null)).toBe("INFO");
  });

  it("TIB-U02 — mais grave primeiro, depois o mais novo", () => {
    const ordem = ordenarItens([
      item("baixo-novo", "LOW", "2026-11-20T00:00:00Z"),
      item("alto-velho", "HIGH", "2026-11-01T00:00:00Z"),
      item("critico", "CRITICAL", "2026-10-01T00:00:00Z"),
      item("alto-novo", "HIGH", "2026-11-10T00:00:00Z"),
    ]).map((i) => i.id);
    expect(ordem).toEqual(["critico", "alto-novo", "alto-velho", "baixo-novo"]);
  });

  it("TIB-U03 — última importação de cada projeto e ferramenta", () => {
    const ultimas = ultimasImportacoes([
      { id: "p1-semgrep-velha", projectId: "p1", toolName: "semgrep", createdAt: "2026-11-01T00:00:00Z" },
      { id: "p1-semgrep-nova", projectId: "p1", toolName: "semgrep", createdAt: "2026-11-10T00:00:00Z" },
      { id: "p1-trivy", projectId: "p1", toolName: "trivy", createdAt: "2026-11-02T00:00:00Z" },
      { id: "p2-semgrep", projectId: "p2", toolName: "semgrep", createdAt: "2026-10-01T00:00:00Z" },
    ]).map((i) => i.id);
    expect(ultimas.sort()).toEqual(["p1-semgrep-nova", "p1-trivy", "p2-semgrep"]);
  });

  it("TIB-U04 — caminho da URL e resumo", () => {
    expect(caminhoDaUrl("https://loja.exemplo.test/login?next=/")).toBe("/login?next=/");
    expect(caminhoDaUrl("não é url")).toBe("não é url");
    expect(resumir("  linha   com\n\nespaços  ")).toBe("linha com espaços");
    expect(resumir("x".repeat(300), 10)).toBe(`${"x".repeat(9)}…`);
    expect(resumir("   ")).toBeNull();
  });
});
