/**
 * node-visual.ts
 *
 * O QUE FAZ
 * Identidade visual de cada tipo de nó do CyberGraph: ícone, rótulo e token de cor.
 *
 * POR QUE EXISTE
 * O nó no 2D, o painel e o modal precisam falar a mesma língua visual: o mesmo
 * ícone e a mesma cor para o mesmo tipo/severidade.
 *
 * QUEM USA
 * `cyber-graph-2d.tsx` e `cyber-graph-detalhes.tsx`.
 */

import { Bug, Earth, Globe, ScanSearch, Server, type LucideIcon } from "lucide-react";
import type { DastRisk } from "../../types/dast.types";
import type { Kind2D } from "./graph-2d-layout";

export const ICONE_DO_TIPO: Record<Kind2D, LucideIcon> = { INTERNET: Earth, ASSET: Server, ENDPOINT: Globe, GROUP: ScanSearch, FINDING: Bug };

export const ROTULO_TIPO: Record<Kind2D, string> = {
  INTERNET: "Exposição",
  ASSET: "Alvo",
  ENDPOINT: "Endpoint",
  GROUP: "Grupo de findings",
  FINDING: "Finding",
};

/** Variável de cor do token: tipo para a estrutura, severidade para o que é achado. */
export function tokenDoNo(no: { kind: Kind2D; risk?: DastRisk }): string {
  if (no.kind === "INTERNET") return "--color-chart-2";
  if (no.kind === "ASSET") return "--color-accent";
  if (no.kind === "ENDPOINT") return "--color-chart-3";
  return `--color-severity-${(no.risk ?? "INFO").toLowerCase()}`;
}

/** Cor CSS a partir de um token OKLCH (os tokens guardam só L C H). */
export const cor = (token: string, alfa = 1): string => `oklch(var(${token}) / ${alfa})`;
