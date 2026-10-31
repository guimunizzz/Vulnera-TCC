/**
 * graph-2d-layout.ts
 *
 * O QUE FAZ
 * Converte o `SecurityGraph` na visão 2D do CyberGraph: colunas
 * Internet → alvo → endpoint → grupo de findings → findings, com os findings
 * de cada endpoint agrupados num nó "Findings (N)" que expande sob demanda.
 *
 * POR QUE EXISTE
 * Com 300 nós, um card por finding vira uma coluna enorme. O agrupamento
 * mantém a leitura do caminho de exposição e só abre o que a pessoa pediu.
 * Os ativos de descoberta entram como ramos do alvo (IP, tecnologia,
 * subdomínios): os filhos estruturais deles (portas, tecnologias do IP,
 * subdomínios) ficam na coluna do meio, e as CVEs do IP viram um grupo como os
 * findings de um endpoint. Ramo com muitos filhos (subdomínios) recolhe.
 * A posição é calculada aqui (pura, testável) para o SVG só desenhar. A regra
 * de quais grupos escondem quais nós (`ocultosPorGrupo`) é a mesma no 3D, e a
 * transição de abrir/fechar (`interpolarVisao`) também é pura.
 *
 * QUEM USA
 * `cyber-graph.tsx`, `cyber-graph-2d.tsx` e `scene/graph-scene.ts`.
 */

import type { DastObservedAsset, DastRisk } from "../../types/dast.types";
import type { GraphEdge, GraphNode, GraphNodeKind, SecurityGraph } from "./graph-model";

export type Kind2D = GraphNodeKind | "GROUP";

export interface No2D {
  id: string;
  kind: Kind2D;
  label: string;
  /** Pior risco do nó (finding) ou dos findings abaixo dele (endpoint, grupo). */
  risk?: DastRisk;
  /** Findings abaixo do nó: endpoint e grupo. */
  total?: number;
  expandido?: boolean;
  /** Ramo que recolhe os filhos estruturais (subdomínios); clicar alterna. */
  expandivel?: boolean;
  sensorKey?: string;
  asset?: DastObservedAsset;
  x: number;
  y: number;
}

export interface Visao2D {
  nodes: No2D[];
  edges: GraphEdge[];
  largura: number;
  altura: number;
}

export const COLUNA_X: Record<Kind2D, number> = {
  INTERNET: 80,
  ASSET: 290,
  ENDPOINT: 500,
  IP: 500,
  SUBDOMAIN: 500,
  TECH: 500,
  PORT: 710,
  GROUP: 710,
  FINDING: 920,
};
/** Acima disso, os filhos estruturais de um ramo começam recolhidos. */
const MAX_ESTRUTURA_ABERTA = 6;
const LINHA = 84;
const MARGEM = 64;
const RISK_ORDER: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };

export const idDoGrupo = (endpointId: string): string => `grupo:${endpointId}`;

const piorRisco = (riscos: (DastRisk | undefined)[]): DastRisk | undefined =>
  riscos.reduce<DastRisk | undefined>((pior, r) => (r && (!pior || RISK_ORDER[r] < RISK_ORDER[pior]) ? r : pior), undefined);

export type Posicoes2D = ReadonlyMap<string, { x: number; y: number }>;

export type Direcao = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

/** Distância horizontal até onde dois nós contam como "mesma coluna". */
const MESMA_COLUNA = 60;

/**
 * Nó vizinho para a navegação por setas: ← e → vão para a coluna ao lado (o mais
 * alinhado na vertical), ↑ e ↓ andam dentro da mesma coluna. Espacial e não pelas
 * arestas: a pessoa segue o que vê, inclusive depois de arrastar nós.
 */
export function vizinhoNaDirecao<N extends { id: string; x: number; y: number }>(nos: N[], atual: N, direcao: Direcao): N | null {
  let melhor: N | null = null;
  let menor = Infinity;
  for (const no of nos) {
    if (no.id === atual.id) continue;
    const dx = no.x - atual.x;
    const dy = no.y - atual.y;
    let custo = Infinity;
    if (direcao === "ArrowRight" && dx > MESMA_COLUNA / 2) custo = dx + Math.abs(dy) * 1.5;
    else if (direcao === "ArrowLeft" && dx < -MESMA_COLUNA / 2) custo = -dx + Math.abs(dy) * 1.5;
    else if (direcao === "ArrowDown" && dy > 0 && Math.abs(dx) < MESMA_COLUNA) custo = dy;
    else if (direcao === "ArrowUp" && dy < 0 && Math.abs(dx) < MESMA_COLUNA) custo = -dy;
    if (custo < menor) {
      menor = custo;
      melhor = no;
    }
  }
  return melhor;
}

/** Caixa que envolve os nós com folga para rótulo e subtítulo (que ficam abaixo do círculo). */
export function caixaDoConteudo(nos: { x: number; y: number }[]): { x: number; y: number; largura: number; altura: number } {
  if (!nos.length) return { x: 0, y: 0, largura: 1, altura: 1 };
  const xs = nos.map((n) => n.x);
  const ys = nos.map((n) => n.y);
  const x = Math.min(...xs) - 150;
  const y = Math.min(...ys) - 60;
  return { x, y, largura: Math.max(...xs) + 150 - x, altura: Math.max(...ys) + 80 - y };
}

interface Ramo {
  no: GraphNode;
  findings: GraphNode[];
  estrutura: GraphNode[];
  risk?: DastRisk;
}

/** Filhos diretos do alvo, cada um com os findings e os filhos estruturais separados. */
function ramosDoAlvo(grafo: SecurityGraph): { filhos: Map<string, string[]>; ramos: Ramo[] } {
  const porId = new Map(grafo.nodes.map((n) => [n.id, n]));
  const filhos = new Map<string, string[]>();
  for (const edge of grafo.edges) filhos.set(edge.source, [...(filhos.get(edge.source) ?? []), edge.target]);
  const asset = grafo.nodes.find((n) => n.kind === "ASSET");
  // Ramos mais perigosos (e depois mais cheios) no topo, como numa lista de prioridade.
  const ramos = (asset ? filhos.get(asset.id) ?? [] : [])
    .flatMap((id) => porId.get(id) ?? [])
    .map((no) => {
      const diretos = (filhos.get(no.id) ?? []).flatMap((f) => porId.get(f) ?? []);
      const findings = diretos.filter((n) => n.kind === "FINDING");
      return { no, findings, estrutura: diretos.filter((n) => n.kind !== "FINDING"), risk: piorRisco(findings.map((f) => f.risk)) };
    })
    .sort((a, b) => RISK_ORDER[a.risk ?? "INFO"] - RISK_ORDER[b.risk ?? "INFO"] || b.findings.length - a.findings.length);
  return { filhos, ramos };
}

const recolhivel = (ramo: Ramo): boolean => ramo.estrutura.length > MAX_ESTRUTURA_ABERTA;

/** Grupos que um ramo abre e fecha: o dos findings (CVEs no IP) e, se tiver muitos filhos, o deles. */
const gruposDe = (ramo: Ramo): string[] => [...(ramo.findings.length ? [idDoGrupo(ramo.no.id)] : []), ...(recolhivel(ramo) ? [ramo.no.id] : [])];

/** Grupos que interagir com o nó alterna (no 3D, onde não existe nó de grupo). Vazio: o nó não agrupa nada. */
export function gruposDoNo(grafo: SecurityGraph, id: string): string[] {
  const ramo = ramosDoAlvo(grafo).ramos.find((r) => r.no.id === id);
  return ramo ? gruposDe(ramo) : [];
}

/** Grupos que precisam estar abertos para o nó aparecer (busca, painel, seleção vinda de fora). */
export function gruposParaMostrar(grafo: SecurityGraph, id: string): string[] {
  for (const ramo of ramosDoAlvo(grafo).ramos) {
    if (ramo.findings.some((f) => f.id === id)) return [idDoGrupo(ramo.no.id)];
    if (recolhivel(ramo) && ramo.estrutura.some((e) => e.id === id)) return [ramo.no.id];
  }
  return [];
}

/** Nós escondidos por grupo fechado, com tudo o que pende deles. Mesma regra do 2D. */
export function ocultosPorGrupo(grafo: SecurityGraph, expandidos: ReadonlySet<string>): Set<string> {
  const { filhos, ramos } = ramosDoAlvo(grafo);
  const ocultos = new Set<string>();
  const esconder = (id: string) => {
    ocultos.add(id);
    for (const filho of filhos.get(id) ?? []) esconder(filho);
  };
  for (const ramo of ramos) {
    if (ramo.findings.length && !expandidos.has(idDoGrupo(ramo.no.id))) ramo.findings.forEach((f) => esconder(f.id));
    if (recolhivel(ramo) && !expandidos.has(ramo.no.id)) ramo.estrutura.forEach((e) => esconder(e.id));
  }
  return ocultos;
}

export interface No2DExibido extends No2D {
  /** Saiu da visão (grupo fechou) e está encolhendo para dentro do pai. */
  saindo?: boolean;
  opacidade?: number;
}

export type Visao2DExibida = Omit<Visao2D, "nodes"> & { nodes: No2DExibido[] };

const paiEm = (edges: GraphEdge[], id: string): string | undefined => edges.find((e) => e.target === id)?.source;

/** Ancestral mais próximo do nó (pelas arestas dadas) que existe em `nos`. */
function ancoraEm<N>(edges: GraphEdge[], nos: ReadonlyMap<string, N>, id: string): N | undefined {
  let pai = paiEm(edges, id);
  const vistos = new Set<string>();
  while (pai && !nos.has(pai) && !vistos.has(pai)) {
    vistos.add(pai);
    pai = paiEm(edges, pai);
  }
  return pai ? nos.get(pai) : undefined;
}

/**
 * Quadro `t` (0 a 1, com desaceleração) da transição entre duas visões: quem fica
 * desliza para a posição nova, quem entra sai de onde o pai estava e quem sai
 * encolhe para dentro do pai, sumindo. As arestas de quem sai vão junto.
 */
export function interpolarVisao(de: Visao2D, para: Visao2D, t: number): Visao2DExibida {
  const e = 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
  const mistura = (a: number, b: number) => a + (b - a) * e;
  const antes = new Map(de.nodes.map((n) => [n.id, n]));
  const depois = new Map(para.nodes.map((n) => [n.id, n]));
  const ficam = para.nodes.map((n) => {
    const origem = antes.get(n.id) ?? ancoraEm(para.edges, antes, n.id) ?? n;
    return { ...n, x: mistura(origem.x, n.x), y: mistura(origem.y, n.y) };
  });
  const saem = de.nodes
    .filter((n) => !depois.has(n.id))
    .map((n) => {
      const destino = ancoraEm(de.edges, depois, n.id) ?? n;
      return { ...n, x: mistura(n.x, destino.x), y: mistura(n.y, destino.y), saindo: true, opacidade: 1 - e };
    });
  return { ...para, nodes: [...ficam, ...saem], edges: [...para.edges, ...de.edges.filter((a) => !depois.has(a.target))] };
}

/**
 * `posicoes` são os nós que a pessoa arrastou: substituem o layout padrão só
 * para eles. A largura/altura continuam as do padrão, para arrastar não reenquadrar.
 */
export function montarVisao2D(grafo: SecurityGraph, expandidos: ReadonlySet<string>, posicoes: Posicoes2D = new Map()): Visao2D {
  const internet = grafo.nodes.find((n) => n.kind === "INTERNET");
  const asset = grafo.nodes.find((n) => n.kind === "ASSET");
  if (!internet || !asset) return { nodes: [], edges: [], largura: 0, altura: 0 };
  const { ramos } = ramosDoAlvo(grafo);

  const nodes: No2D[] = [];
  const edges: GraphEdge[] = [{ source: internet.id, target: asset.id }];
  const no2d = (n: GraphNode, x: number, y: number): No2D => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    risk: n.risk,
    sensorKey: n.sensorKey,
    asset: n.asset,
    total: n.total,
    x,
    y,
  });
  let linha = 0;
  for (const ramo of ramos) {
    const grupoId = idDoGrupo(ramo.no.id);
    const fecha = recolhivel(ramo);
    const estrutura = !fecha || expandidos.has(ramo.no.id) ? ramo.estrutura : [];
    const expandido = expandidos.has(grupoId) && ramo.findings.length > 0;
    const linhasFindings = ramo.findings.length === 0 ? 0 : expandido ? ramo.findings.length : 1;
    const linhas = Math.max(1, estrutura.length + linhasFindings);
    const total = ramo.findings.length;
    nodes.push({
      ...no2d(ramo.no, COLUNA_X.ENDPOINT, MARGEM + (linha + (linhas - 1) / 2) * LINHA),
      risk: ramo.risk,
      total: total || ramo.no.total,
      ...(fecha ? { expandivel: true, expandido: estrutura.length > 0 } : {}),
    });
    edges.push({ source: asset.id, target: ramo.no.id });
    estrutura.forEach((e, i) => {
      nodes.push(no2d(e, COLUNA_X.GROUP, MARGEM + (linha + i) * LINHA));
      edges.push({ source: ramo.no.id, target: e.id });
    });
    const inicioFindings = linha + estrutura.length;
    if (total > 0) {
      const y = MARGEM + (inicioFindings + (linhasFindings - 1) / 2) * LINHA;
      nodes.push({ id: grupoId, kind: "GROUP", label: ramo.no.kind === "IP" ? "CVEs" : "Findings", risk: ramo.risk, total, expandido, x: COLUNA_X.GROUP, y });
      edges.push({ source: ramo.no.id, target: grupoId });
    }
    if (expandido) {
      ramo.findings.forEach((f, i) => {
        nodes.push(no2d(f, COLUNA_X.FINDING, MARGEM + (inicioFindings + i) * LINHA));
        edges.push({ source: grupoId, target: f.id });
      });
    }
    linha += linhas;
  }

  const altura = MARGEM * 2 + Math.max(linha - 1, 0) * LINHA;
  const meio = altura / 2;
  nodes.unshift(
    { id: internet.id, kind: "INTERNET", label: internet.label, x: COLUNA_X.INTERNET, y: meio },
    { id: asset.id, kind: "ASSET", label: asset.label, risk: piorRisco(ramos.map((e) => e.risk)), x: COLUNA_X.ASSET, y: meio },
  );
  const temFindings = nodes.some((n) => n.kind === "FINDING");
  const largura = (temFindings ? COLUNA_X.FINDING : COLUNA_X.GROUP) + 120;
  return { nodes: nodes.map((n) => ({ ...n, ...posicoes.get(n.id) })), edges, largura, altura };
}
