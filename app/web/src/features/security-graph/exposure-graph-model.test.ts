import { describe, expect, it } from "vitest";
import type { AplicacaoExposta, ExposureGraph } from "../../types/exposure-graph.types";
import { contextoDoNo } from "./graph-model";
import { aplicarLayout, LAYOUTS } from "./graph-layouts";
import { categoriasDaEmpresa, ID_EMPRESA, idDaAplicacao, idDaCategoria, montarVisaoEmpresa } from "./exposure-graph-model";

const app = (id: string, extra: Partial<AplicacaoExposta> = {}): AplicacaoExposta => ({
  id,
  name: `App ${id}`,
  url: null,
  environment: "PROD",
  criticality: "MEDIUM",
  internetFacing: false,
  dataSensitivity: "INTERNAL",
  abertas: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  totalAbertas: 0,
  totalResolvidas: 0,
  piorSeveridade: null,
  categorias: [],
  principais: [],
  ...extra,
});

const DADOS: ExposureGraph = {
  companyId: "c1",
  geradoEm: "2026-11-09T00:00:00.000Z",
  aplicacoes: [
    app("a", {
      internetFacing: true,
      totalAbertas: 3,
      piorSeveridade: "CRITICAL",
      categorias: [
        { owaspCategory: "A03", abertas: 2, piorSeveridade: "CRITICAL" },
        { owaspCategory: "A05", abertas: 1, piorSeveridade: "LOW" },
      ],
    }),
    app("b", { totalAbertas: 4, piorSeveridade: "HIGH", categorias: [{ owaspCategory: "A03", abertas: 4, piorSeveridade: "HIGH" }] }),
    app("c"),
  ],
};

describe("categoriasDaEmpresa", () => {
  it("junta a mesma categoria de aplicações diferentes num item só, com o pior risco e a mais afetada primeiro", () => {
    const [a03, a05] = categoriasDaEmpresa(DADOS.aplicacoes);
    expect(a03).toMatchObject({ owaspCategory: "A03", abertas: 6, piorSeveridade: "CRITICAL" });
    expect(a03.aplicacoes.map((a) => a.id)).toEqual(["b", "a"]);
    expect(a05).toMatchObject({ owaspCategory: "A05", abertas: 1, piorSeveridade: "LOW" });
  });
});

describe("montarVisaoEmpresa", () => {
  const visao = montarVisaoEmpresa(DADOS, "Acme");

  it("empresa → aplicações → categorias, com a categoria compartilhada como um nó só", () => {
    expect(visao.nodes.map((n) => n.kind)).toEqual(["COMPANY", "APPLICATION", "APPLICATION", "APPLICATION", "CATEGORY", "CATEGORY"]);
    expect(visao.edges.filter((e) => e.target === idDaCategoria("A03")).map((e) => e.source).sort()).toEqual([idDaAplicacao("a"), idDaAplicacao("b")]);
    expect(visao.nodes.find((n) => n.id === ID_EMPRESA)).toMatchObject({ label: "Acme", risk: "CRITICAL", total: 3 });
  });

  it("aplicação sem nada aberto aparece neutra e sem aresta para categoria", () => {
    expect(visao.nodes.find((n) => n.id === idDaAplicacao("c"))?.risk).toBeUndefined();
    expect(visao.edges.some((e) => e.source === idDaAplicacao("c"))).toBe(false);
  });

  it("subtítulo diz ambiente, abertas e exposição", () => {
    expect(visao.nodes.find((n) => n.id === idDaAplicacao("a"))?.subtitulo).toBe("Produção · 3 abertas · exposta");
    expect(visao.nodes.find((n) => n.id === idDaCategoria("A03"))?.subtitulo).toBe("2 aplicações · 6 abertas");
  });

  it("selecionar a categoria acende as aplicações afetadas e a empresa, não a aplicação limpa", () => {
    const ctx = contextoDoNo(visao, idDaCategoria("A03"));
    expect(ctx.nos.has(idDaAplicacao("a")) && ctx.nos.has(idDaAplicacao("b")) && ctx.nos.has(ID_EMPRESA)).toBe(true);
    expect(ctx.nos.has(idDaAplicacao("c"))).toBe(false);
  });

  it("só expostas à Internet: some quem não é exposta, e a categoria só dela também", () => {
    const so = montarVisaoEmpresa(DADOS, "Acme", true);
    expect(so.nodes.filter((n) => n.kind === "APPLICATION").map((n) => n.id)).toEqual([idDaAplicacao("a")]);
    expect(so.nodes.find((n) => n.id === idDaCategoria("A03"))?.total).toBe(2);
  });

  it.each(LAYOUTS.map((l) => l.id))("layout %s funciona no grafo da empresa (não é árvore)", (layout) => {
    const v = aplicarLayout(visao, layout);
    expect(v.nodes).toHaveLength(visao.nodes.length);
    expect(v.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
  });

  it("empresa sem aplicações vira só o nó da empresa", () => {
    const vazio = montarVisaoEmpresa({ ...DADOS, aplicacoes: [] }, "Acme");
    expect(vazio.nodes.map((n) => n.id)).toEqual([ID_EMPRESA]);
  });
});
