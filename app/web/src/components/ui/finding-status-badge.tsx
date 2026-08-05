import { cn } from "../../lib/cn";
import type { VulnerabilityStatus } from "../../types/vulnerability.types";

const STATUS_STYLES: Record<VulnerabilityStatus, string> = {
  OPEN: "bg-severity-critical/20 text-severity-critical",
  IN_PROGRESS: "bg-accent/20 text-accent",
  FIXED: "bg-severity-medium/20 text-severity-medium",
  CLOSED: "bg-severity-low/20 text-severity-low",
};

const STATUS_LABELS: Record<VulnerabilityStatus, string> = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em andamento",
  FIXED: "Corrigido",
  CLOSED: "Fechado",
};

export function FindingStatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (status in STATUS_STYLES ? status : "OPEN") as VulnerabilityStatus;
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLES[key], className)}>
      {STATUS_LABELS[key]}
    </span>
  );
}
