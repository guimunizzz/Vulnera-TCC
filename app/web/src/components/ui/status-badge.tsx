import { cn } from "../../lib/cn";
import type { ProjectStatus } from "../../types/project.types";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  PENDING: "bg-muted/20 text-muted",
  IN_PROGRESS: "bg-accent/20 text-accent",
  IN_REVIEW: "bg-severity-medium/20 text-severity-medium",
  COMPLETED: "bg-severity-low/20 text-severity-low",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  IN_REVIEW: "Em revisão",
  COMPLETED: "Concluído",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", STATUS_STYLES[status])}>
      {STATUS_LABELS[status]}
    </span>
  );
}
