/**
 * proximos-agendados.tsx
 *
 * Quadro "Próximos scans agendados" da tela de DAST (ADR-056): os próximos
 * disparos (aplicação ou só URL), em ordem, com o tempo que falta. É a mesma
 * leitura da página /agendamentos (`GET /dast-schedules`), então o recorte por
 * papel é o mesmo e quem decide é a API.
 *
 * Se o motor de fila não executa agendamentos (QUEUE_DRIVER=memory), o quadro
 * diz isso em vez de prometer um horário que não vai acontecer.
 */

import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { dastSchedulesApi } from "../../lib/api/dast-schedules.api";
import { LinkButton } from "../ui/button";
import { Badge } from "../ui/badge";
import { dataHora, descreverQuando, emQuantoTempo, nomeDoAlvo } from "../../lib/agendamento";

const MAXIMO = 3;

export function ProximosAgendados() {
  const painelQuery = useQuery({ queryKey: ["dast-schedules", "painel"], queryFn: dastSchedulesApi.painel });
  // Informativo: se a leitura falhar, a tela de DAST continua normal, sem o quadro.
  if (!painelQuery.isSuccess) return null;

  const painel = painelQuery.data;
  const ativos = painel.schedules.filter((s) => s.enabled);
  const proximos = ativos
    .filter((s) => s.nextRunAt)
    .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime())
    .slice(0, MAXIMO);

  return (
    <section aria-labelledby="titulo-proximos-agendados" className="mt-6 rounded-container border border-subtle bg-surface p-4" data-tour="dast-proximos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-proximos-agendados" className="flex items-center gap-2 text-sm font-semibold text-fg">
          <CalendarClock size={16} aria-hidden="true" />
          Próximos scans agendados
        </h2>
        <LinkButton to="/agendamentos" variant="secundario" size="sm">
          {ativos.length > 0 ? "Ver agendamentos" : "Agendar um scan"}
        </LinkButton>
      </div>

      {!painel.runsSchedules && ativos.length > 0 && (
        <p className="mt-3 text-sm text-warning-ink">
          Há {ativos.length} {ativos.length === 1 ? "agendamento ativo" : "agendamentos ativos"}, mas o motor de agendamento está desligado (QUEUE_DRIVER=memory): nenhum vai disparar sozinho.
        </p>
      )}

      {ativos.length === 0 && <p className="mt-3 text-sm text-fg-muted">Nenhum scan agendado. Agende para rodar todo dia ou toda semana, sem precisar lembrar.</p>}

      {proximos.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2" aria-label="Próximos disparos">
          {proximos.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-inset px-3 py-2 text-sm">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="font-semibold text-fg">{nomeDoAlvo(s)}</span>
                {s.mode === "SIMULATED" ? <Badge tom="atencao">SIMULADO</Badge> : <Badge tom="acento">REAL</Badge>}
                <span className="text-xs text-fg-muted">{descreverQuando(s)}</span>
              </span>
              <span className="text-xs text-fg">
                <time dateTime={s.nextRunAt!}>{dataHora(s.nextRunAt!)}</time> <span className="text-fg-muted">({emQuantoTempo(s.nextRunAt!)})</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
