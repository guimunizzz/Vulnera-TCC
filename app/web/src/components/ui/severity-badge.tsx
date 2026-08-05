import { cn } from "../../lib/cn";
import type { VulnerabilitySeverity } from "../../types/vulnerability.types";

const SEVERITY_STYLES: Record<VulnerabilitySeverity, string> = {
  NONE: "bg-muted/20 text-muted",
  LOW: "bg-severity-low/20 text-severity-low",
  MEDIUM: "bg-severity-medium/20 text-severity-medium",
  HIGH: "bg-severity-high/20 text-severity-high",
  CRITICAL: "bg-severity-critical/20 text-severity-critical",
};

const SEVERITY_LABELS: Record<VulnerabilitySeverity, string> = {
  NONE: "Nenhuma",
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

/** Badge colorido por severidade — aceita string bruta pra não quebrar se vier algo inesperado da API. */
export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const key = (severity in SEVERITY_STYLES ? severity : "NONE") as VulnerabilitySeverity;
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", SEVERITY_STYLES[key], className)}>
      {SEVERITY_LABELS[key]}
    </span>
  );
}
