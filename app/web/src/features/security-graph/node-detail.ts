/**
 * node-detail.ts
 *
 * O QUE FAZ
 * Junta o que o grafo e a lista de findings sabem sobre um nó selecionado:
 * tipo, pior risco, findings abaixo dele e o caminho de exposição em ordem.
 *
 * POR QUE EXISTE
 * Painel e modal do CyberGraph mostram a mesma coisa nos modos 2D e 3D; a
 * montagem é pura para ser testada sem renderizar nada.
 *
 * QUEM USA
 * `cyber-graph.tsx` e `cyber-graph-detalhes.tsx`.
 */

import type { DastFinding, DastRisk } from "../../types/dast.types";
import { idDoGrupo, type Kind2D } from "./graph-2d-layout";
import { caminhoAte, type SecurityGraph } from "./graph-model";

const RISK_ORDER: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, INFO: 3 };

export interface PassoDoCaminho {
  id: string;
  kind: Kind2D;
  label: string;
}

export interface DetalheDoNo {
  id: string;
  kind: Kind2D;
  label: string;
  risk?: DastRisk;
  /** Só para FINDING. */
  finding?: DastFinding;
  /** Findings abaixo do nó (o próprio, no caso de FINDING). */
  findings: DastFinding[];
  endpoints: number;
  /** URL completa do endpoint (ENDPOINT e GROUP). */
  url?: string;
  caminho: PassoDoCaminho[];
}

/** URL absoluta para exibir: o scan simulado grava `normalizedUrl` relativo ("/login"). */
export function urlCompleta(url: string, base?: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/**
 * Junta o que o grafo e a lista de findings sabem sobre um nó.
 * Grupo é só visual (2D): herda o caminho do endpoint dele.
 */
export function descreverNo(
  grafo: SecurityGraph,
  findingsPorNo: ReadonlyMap<string, DastFinding>,
  id: string,
  targetUrl?: string,
): DetalheDoNo | null {
  const grupo = id.startsWith("grupo:");
  const baseId = grupo ? id.slice("grupo:".length) : id;
  const base = grafo.nodes.find((n) => n.id === baseId);
  if (!base) return null;

  const abaixo: DastFinding[] = [];
  const descer = (origem: string) => {
    for (const edge of grafo.edges) {
      if (edge.source !== origem) continue;
      const finding = findingsPorNo.get(edge.target);
      if (finding) abaixo.push(finding);
      descer(edge.target);
    }
  };
  descer(baseId);
  const proprio = findingsPorNo.get(baseId);
  const findings = (proprio ? [proprio] : abaixo).sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  const caminho: PassoDoCaminho[] = caminhoAte(grafo, baseId).map((n) => ({ id: n.id, kind: n.kind, label: n.label }));
  if (grupo) caminho.push({ id, kind: "GROUP", label: `Findings (${findings.length})` });

  return {
    id,
    kind: grupo ? "GROUP" : base.kind,
    label: grupo ? `Findings de ${base.label}` : base.label,
    risk: base.kind === "INTERNET" ? undefined : findings[0]?.risk,
    finding: proprio,
    findings,
    endpoints: grafo.nodes.filter((n) => n.kind === "ENDPOINT").length,
    url: base.kind === "ENDPOINT" ? urlCompleta(baseId.slice("endpoint:".length), targetUrl) : undefined,
    caminho,
  };
}

export const grupoDoFinding = (grafo: SecurityGraph, findingNodeId: string): string | null => {
  const pai = grafo.edges.find((e) => e.target === findingNodeId);
  return pai ? idDoGrupo(pai.source) : null;
};
