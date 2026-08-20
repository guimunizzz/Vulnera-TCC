import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { SEVERITY_HEX } from "../../lib/severity-colors";

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
  NONE: "Nenhuma",
};

export interface SeverityDonutProps {
  bySeverity: Record<string, number>;
}

/** Donut de distribuição por severidade — mesma paleta do SeverityBadge (lib/severity-colors.ts). */
export function SeverityDonut({ bySeverity }: SeverityDonutProps) {
  const data = (["CRITICAL", "HIGH", "MEDIUM", "LOW", "NONE"] as const)
    .map((key) => ({ key, name: SEVERITY_LABELS[key], value: bySeverity[key] ?? 0 }))
    .filter((d) => d.value > 0);

  if (data.length === 0) {
    return <p className="text-sm text-fg-muted">Sem findings suficientes para o gráfico.</p>;
  }

  return (
    <div className="flex items-center gap-6">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((d) => (
                <Cell key={d.key} fill={SEVERITY_HEX[d.key]} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#141414", border: "1px solid #262626", borderRadius: 8, color: "#fafafa" }}
              itemStyle={{ color: "#fafafa" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SEVERITY_HEX[d.key] }} />
            <span className="text-fg">{d.name}</span>
            <span className="text-fg-muted">({d.value})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
