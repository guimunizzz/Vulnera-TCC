import { describe, expect, it } from "vitest";
import type { DastFinding, DastRisk } from "../../types/dast.types";
import { idDoGrupo, montarVisao2D, vizinhoNaDirecao, type No2D } from "./graph-2d-layout";
import { aplicarLayout, arvoreDoCentro, layoutClusters, LAYOUTS, type LayoutId } from "./graph-layouts";
import { buildSecurityGraph } from "./graph-model";

const finding = (id: string, risk: DastRisk, url: string) => ({ id, risk, normalizedUrl: url, title: `F ${id}` }) as DastFinding;

// 6 endpoints com 3 findings cada, todos os grupos abertos: 2 + 6 + 6 + 18 = 32 nós.
const RISCOS: DastRisk[] = ["HIGH", "MEDIUM", "LOW"];
const FINDINGS = Array.from({ length: 18 }, (_, i) => finding(`f${i}`, RISCOS[i % 3], `http://x/p${Math.floor(i / 3)}`));
const grafo = buildSecurityGraph("http://x/", FINDINGS);
const abertos = new Set(grafo.nodes.filter((n) => n.kind === "ENDPOINT").map((n) => idDoGrupo(n.id)));
const base = montarVisao2D(grafo, abertos);

const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const menorDistancia = (nos: No2D[]) => {
  let menor = Infinity;
  for (let i = 0; i < nos.length; i++) for (let j = i + 1; j < nos.length; j++) menor = Math.min(menor, distancia(nos[i], nos[j]));
  return menor;
};

describe("aplicarLayout", () => {
  it("hierárquico devolve a visão em colunas como está", () => {
    expect(aplicarLayout(base, "hierarquico")).toBe(base);
  });

  it.each(LAYOUTS.filter((l) => l.id !== "hierarquico").map((l) => l.id))(
    "%s: mesmos nós e arestas, sem sobreposição, tudo dentro da caixa e determinístico",
    (layout: LayoutId) => {
      const v = aplicarLayout(base, layout);
      expect(v.forma).toBe("livre");
      expect(v.nodes.map((n) => n.id)).toEqual(base.nodes.map((n) => n.id));
      expect(v.edges).toEqual(base.edges);
      // Círculo maior tem raio 40: menos que isso entre centros seria um nó em cima do outro.
      expect(menorDistancia(v.nodes)).toBeGreaterThan(55);
      for (const n of v.nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.x).toBeLessThanOrEqual(v.largura);
        expect(n.y).toBeLessThanOrEqual(v.altura);
        expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
      }
      expect(aplicarLayout(base, layout)).toEqual(v);
    },
  );

  it("posições arrastadas vencem o layout só para o nó arrastado, sem mudar a caixa", () => {
    const sem = aplicarLayout(base, "radial");
    const com = aplicarLayout(base, "radial", new Map([["asset", { x: 5, y: 7 }]]));
    expect(com.nodes.find((n) => n.id === "asset")).toMatchObject({ x: 5, y: 7 });
    expect(com.nodes.find((n) => n.id === "internet")).toEqual(sem.nodes.find((n) => n.id === "internet"));
    expect([com.largura, com.altura]).toEqual([sem.largura, sem.altura]);
  });

  it("radial põe o alvo no centro (não a Internet) e cada nível mais longe que o anterior", () => {
    const v = aplicarLayout(base, "radial");
    const no = (id: string) => v.nodes.find((n) => n.id === id)!;
    const alvo = no("asset");
    const r = (id: string) => distancia(no(id), alvo);
    expect(r("internet")).toBeGreaterThan(100);
    const endpoint = v.nodes.find((n) => n.kind === "ENDPOINT")!.id;
    const grupo = idDoGrupo(endpoint);
    const filho = v.edges.find((e) => e.source === grupo)!.target;
    expect(r(grupo)).toBeGreaterThan(r(endpoint));
    expect(r(filho)).toBeGreaterThan(r(grupo));
  });

  it("estrela deixa os filhos de um hub à mesma distância dele", () => {
    const v = aplicarLayout(base, "estrela");
    const grupo = idDoGrupo(v.nodes.find((n) => n.kind === "ENDPOINT")!.id);
    const hub = v.nodes.find((n) => n.id === grupo)!;
    const filhos = v.edges.filter((e) => e.source === grupo).map((e) => v.nodes.find((n) => n.id === e.target)!);
    const ds = filhos.map((f) => distancia(f, hub));
    expect(Math.max(...ds) - Math.min(...ds)).toBeLessThan(0.001);
  });

  it("orgânico mantém nós ligados mais perto que não ligados, em média", () => {
    const v = aplicarLayout(base, "organico");
    const porId = new Map(v.nodes.map((n) => [n.id, n]));
    const ligados = v.edges.map((e) => distancia(porId.get(e.source)!, porId.get(e.target)!));
    const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const todos: number[] = [];
    for (let i = 0; i < v.nodes.length; i++) for (let j = i + 1; j < v.nodes.length; j++) todos.push(distancia(v.nodes[i], v.nodes[j]));
    expect(media(ligados)).toBeLessThan(media(todos) / 2);
  });
});

describe("layoutClusters", () => {
  it("uma ilha por severidade presente, estrutura no meio, cada nó dentro da sua ilha", () => {
    const { pos, zonas } = layoutClusters(base.nodes);
    expect(zonas.map((z) => z.rotulo)).toEqual(["Estrutura · 2", "Alto · 18", "Médio · 6", "Baixo · 6"]);
    for (const no of base.nodes) {
      const zona = zonas.find((z) => (no.kind === "INTERNET" || no.kind === "ASSET" ? !z.risk : z.risk === no.risk))!;
      expect(distancia(pos.get(no.id)!, zona)).toBeLessThan(zona.r);
    }
    // Ilhas não se sobrepõem.
    for (let i = 0; i < zonas.length; i++)
      for (let j = i + 1; j < zonas.length; j++) expect(distancia(zonas[i], zonas[j])).toBeGreaterThan(zonas[i].r + zonas[j].r);
  });
});

describe("arvoreDoCentro", () => {
  it("em grafo com nó compartilhado (categoria de duas aplicações) cada nó entra uma vez só", () => {
    const nos = ["empresa", "app1", "app2", "cat"].map((id) => ({ id }));
    const arestas = [
      { source: "empresa", target: "app1" },
      { source: "empresa", target: "app2" },
      { source: "app1", target: "cat" },
      { source: "app2", target: "cat" },
    ];
    const arv = arvoreDoCentro(nos, arestas)!;
    expect(arv.raiz).toBe("empresa");
    expect(arv.ordem).toHaveLength(4);
    expect(arv.pai.get("cat")).toBe("app1");
  });
});

describe("vizinhoNaDirecao livre", () => {
  it("anda pelo cone da seta, inclusive na diagonal, e para quando não há ninguém naquele lado", () => {
    const nos = [
      { id: "c", x: 0, y: 0 },
      { id: "ne", x: 100, y: -80 },
      { id: "s", x: 10, y: 200 },
    ];
    expect(vizinhoNaDirecao(nos, nos[0], "ArrowRight", true)?.id).toBe("ne");
    expect(vizinhoNaDirecao(nos, nos[0], "ArrowDown", true)?.id).toBe("s");
    expect(vizinhoNaDirecao(nos, nos[0], "ArrowLeft", true)).toBeNull();
  });
});
