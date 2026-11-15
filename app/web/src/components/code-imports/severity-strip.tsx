/**
 * severity-strip.tsx
 *
 * Barra empilhada com a distribuição dos achados por severidade (ADR-052).
 * A cor nunca é o único código: o `title`/rótulo acessível traz os números,
 * e a variante com legenda escreve cada faixa por extenso.
 */

import { cn } from "../../lib/cn";
import { descreverSeveridades } from "../../lib/code-import";
import { CODE_SEVERITY_LABELS, CODE_SEVERITY_ORDER, type CodeSeverity } from "../../types/code-import.types";

const COR: Record<CodeSeverity, string> = {
  CRITICAL: "bg-severity-critical",
  HIGH: "bg-severity-high",
  MEDIUM: "bg-severity-medium",
  LOW: "bg-severity-low",
  INFO: "bg-severity-info",
};

export function SeverityStrip({
  counts,
  legenda,
  className,
}: {
  counts: Record<CodeSeverity, number>;
  /** Mostra a legenda com os números abaixo da barra. */
  legenda?: boolean;
  className?: string;
}) {
  const total = CODE_SEVERITY_ORDER.reduce((acc, s) => acc + (counts[s] ?? 0), 0);
  const descricao = `Distribuição por severidade: ${descreverSeveridades(counts)}`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div role="img" aria-label={descricao} title={descricao} className="flex h-2 w-full overflow-hidden rounded-full bg-inset">
        {total > 0 &&
          CODE_SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => (
            <span key={s} className={cn("h-full", COR[s])} style={{ width: `${(counts[s] / total) * 100}%` }} />
          ))}
      </div>
      {legenda && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" aria-hidden="true">
          {CODE_SEVERITY_ORDER.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className={cn("inline-block h-2 w-2 rounded-full", COR[s])} />
              {CODE_SEVERITY_LABELS[s]} <span className="font-mono text-fg" data-numeric>{counts[s] ?? 0}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
