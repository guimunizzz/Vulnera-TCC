/**
 * badge.tsx — Badge, SeverityBadge e StatusBadge
 *
 * O QUE FAZ
 * Chips de estado. `Badge` é o genérico; os outros dois são as especializações
 * do domínio (severidade CVSS e estado de finding/projeto).
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   `<span>` com texto. Sem `role` — um chip de estado é conteúdo, não widget.
 *   Quando o texto visível é abreviado ("CRIT"), `title` + `aria-label` trazem
 *   a forma longa.
 *
 * COR NUNCA SOZINHA (WCAG 1.4.1)
 *   Toda severidade tem TEXTO próprio ("Crítica", "Alta"). Quem não distingue
 *   vermelho de laranja lê a palavra. O ponto colorido é redundante de
 *   propósito — reforço, não portador da informação.
 *
 * CONTRASTE
 *   Cada par texto/fundo dos cinco níveis foi medido nos dois temas por
 *   `scripts/check-contrast.mjs`. O pior caso mede 6.44:1 (chip LOW no tema
 *   claro), acima dos 4.5:1 exigidos.
 * ==========================================================================
 *
 * QUEM USA
 * Lista de findings, dashboards, tabelas, PDFs (via o mesmo vocabulário).
 */

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/* ==========================================================================
   Badge genérico
   ========================================================================== */

export type TomBadge = "neutro" | "acento" | "sucesso" | "atencao" | "perigo";

const TONS: Record<TomBadge, string> = {
  neutro: "bg-severity-info-surface text-severity-info-ink",
  acento: "bg-accent-surface text-accent-ink",
  sucesso: "bg-success-surface text-success-ink",
  atencao: "bg-warning-surface text-warning-ink",
  perigo: "bg-danger-surface text-danger-ink",
};

export function Badge({
  children,
  tom = "neutro",
  className,
  ...props
}: {
  children: ReactNode;
  tom?: TomBadge;
  className?: string;
  title?: string;
  "aria-label"?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium uppercase",
        TONS[tom],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/* ==========================================================================
   Severidade
   ========================================================================== */

export type Severidade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";

/** Vocabulário único de severidade. O mesmo usado nos PDFs e nos gráficos. */
export const ROTULO_SEVERIDADE: Record<Severidade, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
  NONE: "Informativa",
};

const CLASSES_SEVERIDADE: Record<Severidade, { chip: string; ponto: string }> = {
  CRITICAL: { chip: "bg-severity-critical-surface text-severity-critical-ink", ponto: "bg-severity-critical" },
  HIGH: { chip: "bg-severity-high-surface text-severity-high-ink", ponto: "bg-severity-high" },
  MEDIUM: { chip: "bg-severity-medium-surface text-severity-medium-ink", ponto: "bg-severity-medium" },
  LOW: { chip: "bg-severity-low-surface text-severity-low-ink", ponto: "bg-severity-low" },
  NONE: { chip: "bg-severity-info-surface text-severity-info-ink", ponto: "bg-severity-info" },
};

export function SeverityBadge({
  severidade,
  cvss,
  className,
}: {
  severidade: string;
  /** Nota CVSS exibida ao lado, em mono e tabular. */
  cvss?: number | null;
  className?: string;
}) {
  const s = (severidade in CLASSES_SEVERIDADE ? severidade : "NONE") as Severidade;
  const { chip, ponto } = CLASSES_SEVERIDADE[s];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium uppercase",
        chip,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", ponto)} />
      {ROTULO_SEVERIDADE[s]}
      {cvss != null && (
        <span className="font-mono normal-case opacity-80" data-numeric>
          {cvss.toFixed(1)}
        </span>
      )}
    </span>
  );
}

/* ==========================================================================
   Estados (finding e projeto)
   ========================================================================== */

/**
 * Os estados vêm da máquina de 4 estados do ADR-021 (Vulnerability) e da
 * máquina mínima de Project (Fase 4). O mapa cobre os dois; um estado
 * desconhecido cai no tom neutro em vez de quebrar.
 */
const ROTULO_ESTADO: Record<string, { texto: string; tom: TomBadge }> = {
  // Vulnerability
  OPEN: { texto: "Aberto", tom: "perigo" },
  IN_PROGRESS: { texto: "Em andamento", tom: "atencao" },
  FIXED: { texto: "Corrigido", tom: "sucesso" },
  CLOSED: { texto: "Fechado", tom: "neutro" },
  // Project
  PENDING: { texto: "Pendente", tom: "neutro" },
  IN_REVIEW: { texto: "Em revisão", tom: "acento" },
  COMPLETED: { texto: "Concluído", tom: "sucesso" },
  // Subscription
  PENDING_APPROVAL: { texto: "Aguardando aprovação", tom: "atencao" },
  ACTIVE: { texto: "Ativa", tom: "sucesso" },
  REJECTED: { texto: "Rejeitada", tom: "perigo" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const info = ROTULO_ESTADO[status] ?? { texto: status, tom: "neutro" as TomBadge };
  return (
    <Badge tom={info.tom} className={className}>
      {info.texto}
    </Badge>
  );
}
