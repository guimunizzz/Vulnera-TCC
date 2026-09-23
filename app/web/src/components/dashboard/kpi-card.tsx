/**
 * kpi-card.tsx
 *
 * O QUE FAZ
 * Apresenta uma métrica real dos dashboards por papel, com hierarquia visual,
 * contador acessível e ícone opcional.
 *
 * POR QUE EXISTE
 * Mantém o mesmo contrato usado pelos três perfis e concentra o tratamento de
 * número/movimento sem transformar decoração em dado fictício.
 *
 * QUEM USA
 * `admin-dashboard`, `client-dashboard` e `pentester-dashboard`.
 */

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Card } from "../ui/card";
import { cn } from "../../lib/cn";
import { NumeroAnimado } from "../../motion/components";
import { useMotion } from "../../motion/use-motion";
import { DURACAO, EASE } from "../../motion/tokens";

export interface KpiCardProps {
  label: string;
  value: string | number;
  accentClassName?: string;
  icon?: ReactNode;
  tone?: "accent" | "warning" | "critical" | "neutral";
}

const TOM = {
  accent: { icon: "bg-accent-surface text-accent-ink", line: "bg-accent" },
  warning: { icon: "bg-warning-surface text-warning-ink", line: "bg-warning" },
  critical: { icon: "bg-danger-surface text-danger-ink", line: "bg-danger" },
  neutral: { icon: "bg-raised text-fg-secondary", line: "bg-fg-muted" },
} as const;

function DefaultKpiIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M2 10.5 5.2 7l2.2 2.1L12.8 3.5M11 3.5h1.8v1.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function KpiCard({ label, value, accentClassName, icon, tone = "accent" }: KpiCardProps) {
  const { reduzido } = useMotion();
  const estilo = TOM[tone];

  return (
    <article aria-label={label} data-dashboard-kpi className="h-full">
      <Card semPadding className="dashboard-kpi group relative h-full overflow-hidden bg-transparent transition-colors duration-base hover:border-strong">
        <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-px", estilo.line)} />
        <div className="relative flex min-h-[8rem] flex-col justify-between gap-5 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-fg-secondary">{label}</p>
            <motion.div
              aria-hidden="true"
              className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-control", estilo.icon)}
              initial={reduzido ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: reduzido ? DURACAO.instant : DURACAO.base, ease: EASE.out }}
            >
              {icon ?? <DefaultKpiIcon />}
            </motion.div>
          </div>

          <p className={cn("font-mono text-3xl font-bold text-fg", accentClassName)} data-numeric>
            {typeof value === "number" ? <NumeroAnimado valor={value} /> : value}
          </p>

          <span
            aria-hidden="true"
            className="dashboard-kpi-orbit-fallback pointer-events-none absolute bottom-0 right-4 h-20 w-20 rounded-full border border-accent/20"
          />
        </div>
      </Card>
    </article>
  );
}
