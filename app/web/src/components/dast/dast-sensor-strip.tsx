/**
 * dast-sensor-strip.tsx
 *
 * O QUE FAZ
 * Faixa "Sensores deste scan": um cartão por sensor (OWASP ZAP, headers,
 * certificado SSL/TLS) com o status, quantos achados gerou e a mensagem do
 * sensor — o resumo do certificado, ou o motivo legível de uma falha.
 *
 * POR QUE EXISTE
 * "Sem dados" nunca pode parecer "seguro". Indisponível e erro aparecem em cor
 * de alerta e com o motivo escrito, em vez de uma lista de achados vazia.
 *
 * QUEM USA
 * `dast-scan-detail-page.tsx` (acima das abas, vale para Achados e CyberGraph).
 */

import { cn } from "../../lib/cn";
import { DAST_SENSOR_LABELS, DAST_SENSOR_STATUS_LABELS, type DastFinding, type DastSensorRun, type DastSensorStatus } from "../../types/dast.types";

const CLASSE_STATUS: Record<DastSensorStatus, { ponto: string; borda: string }> = {
  OK: { ponto: "bg-success", borda: "border-subtle" },
  NO_DATA: { ponto: "bg-severity-info", borda: "border-subtle" },
  NOT_APPLICABLE: { ponto: "bg-severity-info", borda: "border-subtle" },
  UNAVAILABLE: { ponto: "bg-warning", borda: "border-warning/60" },
  ERROR: { ponto: "bg-danger", borda: "border-danger/60" },
};

const segundos = (ms: number) => (ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`);

export function DastSensorStrip({ sensores, findings }: { sensores: DastSensorRun[]; findings: DastFinding[] }) {
  if (sensores.length === 0) return null;
  return (
    <section aria-label="Sensores deste scan" className="mt-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Sensores deste scan</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sensores.map((s) => {
          const qtd = findings.filter((f) => f.sensorKey === s.sensorKey).length;
          const classe = CLASSE_STATUS[s.status];
          return (
            <li key={s.sensorKey} className={cn("rounded-control border bg-surface px-3 py-2", classe.borda)}>
              <div className="flex items-center gap-2 text-sm">
                <span className={cn("h-2 w-2 shrink-0 rounded-full", classe.ponto)} aria-hidden="true" />
                <span className="font-medium text-fg">{DAST_SENSOR_LABELS[s.sensorKey] ?? s.sensorKey}</span>
                <span className="ml-auto whitespace-nowrap text-xs text-fg-muted">
                  {DAST_SENSOR_STATUS_LABELS[s.status]}
                  {s.status === "OK" && ` · ${qtd} ${qtd === 1 ? "achado" : "achados"}`} · {segundos(s.durationMs)}
                </span>
              </div>
              {s.message && <p className="mt-1 break-words text-xs text-fg-muted">{s.message}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
