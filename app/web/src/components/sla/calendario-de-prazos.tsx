/**
 * calendario-de-prazos.tsx
 *
 * O QUE FAZ
 * Calendário de prazos de SLA (ADR-062): mapa de calor das próximas semanas
 * (como o de contribuições do GitHub), em que cada dia esquenta pelo PESO das
 * vulnerabilidades abertas que vencem nele (crítica pesa mais que baixa); os
 * vencidos ficam numa pilha à parte. Clicar num dia lista o que vence nele,
 * com o link de cada vulnerabilidade.
 *
 * ACESSIBILIDADE
 * A grade é um `grid` com um único ponto de Tab (roving tabindex): setas andam
 * entre os dias, Enter/Espaço escolhem. Cada dia tem rótulo falado ("quinta,
 * 19 de novembro: 2 prazos, 1 crítico"). A cor nunca é a única informação: o
 * número de prazos aparece ao escolher o dia e no rótulo.
 *
 * DADOS
 * As abertas com prazo, pela busca de achados (o escopo do papel é o da busca).
 * Uma consulta só, compartilhada entre Dashboard e Remediação pelo cache.
 *
 * QUEM USA
 * O Dashboard (cartão compacto) e a Remediação (aba "Calendário").
 */

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Card, Skeleton } from "../ui/card";
import { SeverityBadge } from "../ui/badge";
import { ErrorState } from "../ui/empty-state";
import { useApiError } from "../../hooks/use-api-error";
import { vulnerabilitiesApi } from "../../lib/api/vulnerabilities.api";
import { buscarTodosFindings } from "../../lib/remediation-board";
import { montarCalendario, type DiaDoCalendario, type PrazoAberto } from "../../lib/calendario-de-prazos";
import { cn } from "../../lib/cn";

const DIAS_DA_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
/** Intensidade do calor por nível (1–4), sobre o token de severidade alta. */
const ALFA_DO_NIVEL = [0, 0.22, 0.42, 0.66, 0.92];

const dataLonga = (chave: string) => {
  const [a, m, d] = chave.split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
};

function rotuloDoDia(dia: DiaDoCalendario): string {
  const criticos = dia.itens.filter((i) => i.severityFinal === "CRITICAL").length;
  const n = dia.itens.length;
  if (n === 0) return `${dataLonga(dia.data)}: nenhum prazo`;
  return `${dataLonga(dia.data)}: ${n} prazo${n === 1 ? "" : "s"}${criticos ? `, ${criticos} crítico${criticos === 1 ? "" : "s"}` : ""}`;
}

/** As abertas com prazo de SLA (consulta compartilhada pelo cache). */
function usePrazosAbertos() {
  return useQuery({
    queryKey: ["findings", "sla-calendario"],
    queryFn: async (): Promise<PrazoAberto[]> => {
      const params = new URLSearchParams({ status: "OPEN,IN_PROGRESS", sortBy: "slaDueAt", sortOrder: "asc" });
      const resposta = await buscarTodosFindings(vulnerabilitiesApi.search, params);
      return resposta.data
        .filter((f) => f.slaDueAt)
        .map((f) => ({ id: f.id, title: f.title, severityFinal: f.severityFinal, applicationName: f.applicationName, slaDueAt: f.slaDueAt! }));
    },
    staleTime: 60_000,
  });
}

function ListaDePrazos({ titulo, itens }: { titulo: string; itens: PrazoAberto[] }) {
  return (
    <section aria-label={titulo} className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum prazo neste dia.</p>
      ) : (
        <ul className="space-y-1">
          {itens.slice(0, 12).map((i) => (
            <li key={i.id}>
              <Link to={`/findings/${i.id}`} className="flex items-center justify-between gap-2 rounded-control px-2 py-1 text-sm text-fg hover:bg-inset">
                <span className="min-w-0">
                  <span className="block truncate">{i.title}</span>
                  <span className="block truncate text-xs text-fg-muted">{i.applicationName}</span>
                </span>
                <SeverityBadge severidade={i.severityFinal} />
              </Link>
            </li>
          ))}
          {itens.length > 12 && (
            <li>
              <Link to="/findings?slaState=BREACHED,DUE_SOON" className="block px-2 py-1 text-xs font-semibold text-accent-ink hover:underline">
                e mais {itens.length - 12} — ver em Achados
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function CalendarioDePrazos({ semanas = 13, compacto = false }: { semanas?: number; compacto?: boolean }) {
  const prazos = usePrazosAbertos();
  const mensagemDeErro = useApiError();
  const calendario = useMemo(() => montarCalendario(prazos.data ?? [], new Date(), semanas), [prazos.data, semanas]);
  const dias = useMemo(() => calendario.semanas.flat(), [calendario]);
  const indiceDeHoje = Math.max(0, dias.findIndex((d) => d.hoje));
  const [escolhido, setEscolhido] = useState<string | "vencidos" | null>(null);
  const [foco, setFoco] = useState(indiceDeHoje);
  const celulas = useRef<Array<HTMLButtonElement | null>>([]);

  const moverFoco = (novo: number) => {
    const limitado = Math.max(0, Math.min(dias.length - 1, novo));
    setFoco(limitado);
    celulas.current[limitado]?.focus();
  };
  // A grade é semana × dia; no DOM a ordem é coluna a coluna (semana), então ↑↓ andam 1 e ←→ andam 7.
  const aoTeclar = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const passo: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    if (e.key in passo) {
      e.preventDefault();
      moverFoco(i + passo[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      moverFoco(indiceDeHoje);
    }
  };

  const diaEscolhido = typeof escolhido === "string" && escolhido !== "vencidos" ? dias.find((d) => d.data === escolhido) : undefined;
  const meses = calendario.semanas.map((s, i) => {
    const mes = new Date(`${s[0].data}T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
    const anterior = i > 0 ? new Date(`${calendario.semanas[i - 1][0].data}T12:00:00`).getMonth() : -1;
    return new Date(`${s[0].data}T12:00:00`).getMonth() !== anterior ? mes : "";
  });

  return (
    <Card
      titulo={
        <span className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent-ink" aria-hidden="true" /> Calendário de prazos
        </span>
      }
      descricao={compacto ? undefined : "Onde os prazos de SLA das próximas semanas pesam mais. Crítica pesa mais que baixa."}
    >
      {prazos.isLoading ? (
        <Skeleton className="h-[8rem] w-full" />
      ) : prazos.isError ? (
        <ErrorState descricao={mensagemDeErro(prazos.error)} aoTentarNovamente={() => void prazos.refetch()} />
      ) : (
        <div className={cn("flex flex-col gap-4", !compacto && "lg:flex-row")}>
          <div className="min-w-0 space-y-3">
            <div className="flex items-start gap-3">
              {/* Pilha de vencidos: à esquerda da grade, onde o passado estaria. */}
              <button
                type="button"
                onClick={() => setEscolhido("vencidos")}
                aria-pressed={escolhido === "vencidos"}
                className={cn(
                  "flex w-20 shrink-0 flex-col items-center gap-1 rounded-control border px-2 py-3 text-center transition-colors",
                  calendario.vencidos.length ? "border-danger/60 bg-danger-surface text-danger-ink" : "border-subtle bg-inset text-fg-muted",
                  escolhido === "vencidos" && "ring-2 ring-[oklch(var(--color-focus-ring))]",
                )}
              >
                <span className="font-mono text-xl font-semibold" data-numeric>
                  {calendario.vencidos.length}
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide">vencidos</span>
              </button>

              <div className="min-w-0 overflow-x-auto">
                <div className="flex gap-[3px] pl-8 text-[10px] text-fg-muted" aria-hidden="true">
                  {meses.map((m, i) => (
                    <span key={i} className="w-[14px] shrink-0 overflow-visible whitespace-nowrap">
                      {m}
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <div className="flex w-[1.75rem] flex-col gap-[3px] text-[10px] text-fg-muted" aria-hidden="true">
                    {DIAS_DA_SEMANA.map((d, i) => (
                      <span key={d} className="h-[14px] leading-[14px]">
                        {i % 2 === 0 ? d : ""}
                      </span>
                    ))}
                  </div>
                  <div role="grid" aria-label="Prazos de SLA por dia" className="flex gap-[3px]">
                    {calendario.semanas.map((semana, s) => (
                      <div key={semana[0].data} role="row" className="flex flex-col gap-[3px]">
                        {semana.map((dia, d) => {
                          const i = s * 7 + d;
                          return (
                            <button
                              key={dia.data}
                              ref={(el) => {
                                celulas.current[i] = el;
                              }}
                              type="button"
                              role="gridcell"
                              tabIndex={i === foco ? 0 : -1}
                              aria-label={rotuloDoDia(dia)}
                              aria-selected={escolhido === dia.data}
                              disabled={dia.passado}
                              onFocus={() => setFoco(i)}
                              onKeyDown={(e) => aoTeclar(e, i)}
                              onClick={() => setEscolhido(dia.data)}
                              className={cn(
                                "h-[14px] w-[14px] rounded-[3px] border transition-transform focus-visible:scale-125",
                                dia.passado ? "border-transparent opacity-30" : "border-subtle hover:scale-125",
                                dia.hoje && "outline outline-1 outline-offset-1 outline-[oklch(var(--color-accent-ink))]",
                                escolhido === dia.data && "ring-2 ring-[oklch(var(--color-focus-ring))]",
                              )}
                              style={{
                                background: dia.nivel
                                  ? `oklch(var(--color-severity-high) / ${ALFA_DO_NIVEL[dia.nivel]})`
                                  : "oklch(var(--color-bg-inset))",
                              }}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
              <span>Menos</span>
              {ALFA_DO_NIVEL.map((alfa, n) => (
                <span
                  key={n}
                  aria-hidden="true"
                  className="h-[10px] w-[10px] rounded-[2px] border border-subtle"
                  style={{ background: n ? `oklch(var(--color-severity-high) / ${alfa})` : "oklch(var(--color-bg-inset))" }}
                />
              ))}
              <span>Mais peso</span>
              {calendario.depois > 0 && <span className="ml-auto">+{calendario.depois} depois de {semanas} semanas</span>}
            </div>
          </div>

          <div className={cn("min-w-0 flex-1", !compacto && "lg:border-l lg:border-subtle lg:pl-4")}>
            {escolhido === "vencidos" ? (
              <ListaDePrazos titulo="Prazos vencidos" itens={calendario.vencidos} />
            ) : diaEscolhido ? (
              <ListaDePrazos titulo={dataLonga(diaEscolhido.data)} itens={diaEscolhido.itens} />
            ) : (
              <p className="text-sm text-fg-muted">Escolha um dia (ou os vencidos) para ver o que vence nele.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
