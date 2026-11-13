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
 * `cyber-graph-2d.tsx`, `cyber-graph-detalhes.tsx` e `exposure-graph.tsx`.
 */

import {
  AppWindow,
  Boxes,
  Building2,
  Bug,
  Earth,
  FileCode2,
  Folder,
  Globe,
  Layers,
  Network,
  Package,
  Plug,
  ScanSearch,
  Server,
  ShieldAlert,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { DAST_RISK_LABELS } from "../../types/dast.types";
import type { Kind2D, Risco } from "./graph-2d-layout";

export const ICONE_DO_TIPO: Record<Kind2D, LucideIcon> = {
  INTERNET: Earth,
  ASSET: Server,
  ENDPOINT: Globe,
  GROUP: ScanSearch,
  FINDING: Bug,
  IP: Network,
  PORT: Plug,
  TECH: Layers,
  SUBDOMAIN: Waypoints,
  COMPANY: Building2,
  APPLICATION: AppWindow,
  CATEGORY: ShieldAlert,
  CODE: Boxes,
  FOLDER: Folder,
  FILE: FileCode2,
  PACKAGE: Package,
};

export const ROTULO_TIPO: Record<Kind2D, string> = {
  INTERNET: "Exposição",
  ASSET: "Alvo",
  ENDPOINT: "Endpoint",
  GROUP: "Grupo de findings",
  FINDING: "Finding",
  IP: "Endereço IP",
  PORT: "Porta aberta",
  TECH: "Tecnologia",
  SUBDOMAIN: "Subdomínio",
  COMPANY: "Empresa",
  APPLICATION: "Aplicação",
  CATEGORY: "Categoria OWASP",
  CODE: "Origem",
  FOLDER: "Pasta",
  FILE: "Arquivo",
  PACKAGE: "Pacote",
};

export const ROTULO_RISCO: Record<Risco, string> = { CRITICAL: "Crítico", ...DAST_RISK_LABELS };

/** Variável de cor do token: tipo para a estrutura, severidade para o que é achado. */
export function tokenDoNo(no: { kind: Kind2D; risk?: Risco }): string {
  if (no.kind === "INTERNET") return "--color-chart-2";
  if (no.kind === "COMPANY") return "--color-accent";
  // Aplicação e categoria sem nada aberto: neutras; com algo aberto, na cor do pior.
  if ((no.kind === "APPLICATION" || no.kind === "CATEGORY") && !no.risk) return "--color-chart-axis";
  if (no.kind === "ASSET") return "--color-accent";
  // Ramo SAST/SCA é estrutura: nunca cor de severidade (pasta, arquivo e pacote sim, pelo pior achado).
  if (no.kind === "CODE") return "--color-accent";
  if (no.kind === "ENDPOINT") return "--color-chart-3";
  // Ativos de descoberta são estrutura: nunca cor de severidade.
  if (no.kind === "IP") return "--color-chart-1";
  if (no.kind === "PORT") return "--color-chart-2";
  if (no.kind === "TECH") return "--color-chart-axis";
  if (no.kind === "SUBDOMAIN") return "--color-chart-3";
  return `--color-severity-${(no.risk ?? "INFO").toLowerCase()}`;
}

/** Cor CSS a partir de um token OKLCH (os tokens guardam só L C H). */
export const cor = (token: string, alfa = 1): string => `oklch(var(${token}) / ${alfa})`;
