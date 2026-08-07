import { Card } from "../ui/card";
import { cn } from "../../lib/cn";

/** Card de KPI simples (número grande + rótulo) — usado nos 3 dashboards por role. */
export function KpiCard({ label, value, accentClassName }: { label: string; value: string | number; accentClassName?: string }) {
  return (
    <Card className="p-4">
      <p className={cn("text-2xl font-bold text-foreground", accentClassName)}>{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </Card>
  );
}
