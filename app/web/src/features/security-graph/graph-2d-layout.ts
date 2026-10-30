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
 * A posição é calculada aqui (pura, testável) para o SVG só desenhar.
 *
 * QUEM USA
 * `cyber-graph.tsx` e `cyber-graph-2d.tsx`.
 */

import type { DastRisk } from "../../types/dast.types";
import type { GraphEdge, GraphNodeKind, SecurityGraph } from "./graph-model";

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
  x: number;
  y: number;
}

export interface Visao2D {
  nodes: No2D[];
  edges: GraphEdge[];
  largura: number;
  altura: number;
}

export const COLUNA_X: Record<Kind2D, number> = { INTERNET: 80, ASSET: 290, ENDPOINT: 500, GROUP: 710, FINDING: 920 };
const LINHA = 84;
const MARGEM = 64;
const RISK_ORDER: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };

export const idDoGrupo = (endpointId: string): string => `grupo:${endpointId}`;

const piorRisco = (riscos: (DastRisk | undefined)[]): DastRisk | undefined =>
  riscos.reduce<DastRisk | undefined>((pior, r) => (r && (!pior || RISK_ORDER[r] < RISK_ORDER[pior]) ? r : pior), undefined);

export type Posicoes2D = ReadonlyMap<string, { x: number; y: number }>;

/**
 * `posicoes` são os nós que a pessoa arrastou: substituem o layout padrão só
 * para eles. A largura/altura continuam as do padrão, para arrastar não reenquadrar.
 */
export function montarVisao2D(grafo: SecurityGraph, expandidos: ReadonlySet<string>, posicoes: Posicoes2D = new Map()): Visao2D {
  const porId = new Map(grafo.nodes.map((n) => [n.id, n]));
  const filhos = new Map<string, string[]>();
  for (const edge of grafo.edges) filhos.set(edge.source, [...(filhos.get(edge.source) ?? []), edge.target]);

  const internet = grafo.nodes.find((n) => n.kind === "INTERNET");
  const asset = grafo.nodes.find((n) => n.kind === "ASSET");
  if (!internet || !asset) return { nodes: [], edges: [], largura: 0, altura: 0 };

  // Endpoints mais perigosos (e depois mais cheios) no topo, como numa lista de prioridade.
  const endpoints = (filhos.get(asset.id) ?? [])
    .map((id) => {
      const findings = (filhos.get(id) ?? []).flatMap((f) => porId.get(f) ?? []);
      return { id, findings, risk: piorRisco(findings.map((f) => f.risk)) };
    })
    .sort((a, b) => RISK_ORDER[a.risk ?? "INFO"] - RISK_ORDER[b.risk ?? "INFO"] || b.findings.length - a.findings.length);

  const nodes: No2D[] = [];
  const edges: GraphEdge[] = [{ source: internet.id, target: asset.id }];
  let linha = 0;
  for (const endpoint of endpoints) {
    const grupoId = idDoGrupo(endpoint.id);
    const expandido = expandidos.has(grupoId) && endpoint.findings.length > 0;
    const linhas = expandido ? endpoint.findings.length : 1;
    const y = MARGEM + (linha + (linhas - 1) / 2) * LINHA;
    const total = endpoint.findings.length;
    nodes.push({ id: endpoint.id, kind: "ENDPOINT", label: porId.get(endpoint.id)?.label ?? endpoint.id, risk: endpoint.risk, total, x: COLUNA_X.ENDPOINT, y });
    edges.push({ source: asset.id, target: endpoint.id });
    if (total > 0) {
      nodes.push({ id: grupoId, kind: "GROUP", label: "Findings", risk: endpoint.risk, total, expandido, x: COLUNA_X.GROUP, y });
      edges.push({ source: endpoint.id, target: grupoId });
    }
    if (expandido) {
      endpoint.findings.forEach((f, i) => {
        nodes.push({ id: f.id, kind: "FINDING", label: f.label, risk: f.risk, x: COLUNA_X.FINDING, y: MARGEM + (linha + i) * LINHA });
        edges.push({ source: grupoId, target: f.id });
      });
    }
    linha += linhas;
  }

  const altura = MARGEM * 2 + Math.max(linha - 1, 0) * LINHA;
  const meio = altura / 2;
  nodes.unshift(
    { id: internet.id, kind: "INTERNET", label: internet.label, x: COLUNA_X.INTERNET, y: meio },
    { id: asset.id, kind: "ASSET", label: asset.label, risk: piorRisco(endpoints.map((e) => e.risk)), x: COLUNA_X.ASSET, y: meio },
  );
  const temFindings = nodes.some((n) => n.kind === "FINDING");
  const largura = (temFindings ? COLUNA_X.FINDING : COLUNA_X.GROUP) + 120;
  return { nodes: nodes.map((n) => ({ ...n, ...posicoes.get(n.id) })), edges, largura, altura };
}
