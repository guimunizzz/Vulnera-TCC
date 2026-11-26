/**
 * conformidade.test.ts — catálogo e avaliação (ADR-063).
 *   CNF-01  catálogo íntegro: ids únicos por referência, toda categoria OWASP
 *           cai em pelo menos um requisito de cada referência
 *   CNF-02  requisito em risco soma as abertas das suas categorias, pior
 *           severidade e aplicações afetadas
 *   CNF-03  sem aberta relacionada → não está em risco (e nunca "conforme")
 */

import { describe, expect, it } from "vitest";
import type { AplicacaoExposta } from "../../types/exposure-graph.types";
import { avaliarReferencia, avaliarTudo } from "./avaliar";
import { CATEGORIAS_OWASP, REFERENCIAS } from "./catalogo";

function app(id: string, categorias: AplicacaoExposta["categorias"]): AplicacaoExposta {
  return {
    id,
    name: id,
    url: null,
    environment: "PROD",
    criticality: "HIGH",
    internetFacing: true,
    dataSensitivity: "INTERNAL",
    abertas: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    abertasPorOrigem: {},
    totalAbertas: categorias.reduce((s, c) => s + c.abertas, 0),
    totalResolvidas: 0,
    piorSeveridade: null,
    categorias,
    principais: [],
  };
}

describe("catálogo de conformidade", () => {
  it("CNF-01 — íntegro e com cobertura total das categorias", () => {
    for (const ref of REFERENCIAS) {
      const ids = ref.requisitos.map((r) => r.id);
      expect(new Set(ids).size, ref.id).toBe(ids.length);
      for (const r of ref.requisitos) expect(r.categorias.length, `${ref.id} ${r.id}`).toBeGreaterThan(0);
      const cobertas = new Set(ref.requisitos.flatMap((r) => r.categorias));
      for (const categoria of CATEGORIAS_OWASP) expect(cobertas.has(categoria), `${ref.id} cobre ${categoria}`).toBe(true);
    }
  });
});

describe("avaliação", () => {
  const aplicacoes = [
    app("portal", [
      { owaspCategory: "A03", abertas: 2, piorSeveridade: "CRITICAL" },
      { owaspCategory: "A05", abertas: 1, piorSeveridade: "LOW" },
    ]),
    app("api", [{ owaspCategory: "A03", abertas: 1, piorSeveridade: "HIGH" }]),
  ];

  it("CNF-02 — requisito em risco agrega categorias e aplicações", () => {
    const iso = avaliarReferencia(REFERENCIAS.find((r) => r.id === "ISO27001")!, aplicacoes);
    const codificacao = iso.requisitos.find((r) => r.id === "8.28")!; // A03, A10
    expect(codificacao).toMatchObject({ emRisco: true, abertas: 3, pior: "CRITICAL" });
    expect(codificacao.aplicacoes).toEqual([{ id: "portal", name: "portal", abertas: 2 }, { id: "api", name: "api", abertas: 1 }]);
    const testes = iso.requisitos.find((r) => r.id === "8.29")!; // A03, A05
    expect(testes.porCategoria.map((c) => c.owasp)).toEqual(["A03", "A05"]);
    expect(testes.abertas).toBe(4);
  });

  it("CNF-03 — sem aberta relacionada não está em risco", () => {
    const tudo = avaliarTudo(aplicacoes);
    const cripto = tudo.ISO27001.requisitos.find((r) => r.id === "8.24")!; // A02
    expect(cripto).toMatchObject({ emRisco: false, abertas: 0, pior: null, aplicacoes: [] });
    expect(tudo.LGPD.emRisco).toBeGreaterThan(0);
    expect(avaliarTudo([]).NISTCSF.emRisco).toBe(0);
  });
});
