/**
 * agendamentos-page.tsx
 *
 * Página "Agendamentos" (ADR-056): scans DAST que rodam sozinhos, no dia e
 * horário escolhidos, contra alvos com autorização de teste registrada.
 *
 * QUEM VÊ O QUÊ (a API decide; a tela só não oferece o que não pode)
 *  - ADMIN: todos; cria, edita, pausa e remove.
 *  - PENTESTER: os das aplicações dos seus projetos; idem.
 *  - CLIENT: os da própria empresa, somente leitura (sem link para o scan,
 *    porque o módulo DAST não existe para ele).
 *
 * O cron nunca aparece: a lista diz "Toda segunda às 03:00 (horário de
 * Brasília)" e quando é o próximo disparo. Se o motor de fila não executa
 * agendamentos (QUEUE_DRIVER=memory), a página avisa em vez de prometer.
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CalendarOff, CalendarCheck2, History, Pencil, Play, Trash2 } from "lucide-react";
import { dastSchedulesApi } from "../lib/api/dast-schedules.api";
import { useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { Breadcrumb } from "../components/ui/navigation";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert } from "../components/ui/alert";
import { Switch } from "../components/ui/switch";
import { Skeleton } from "../components/ui/card";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "../components/ui/dialog";
import { useToast } from "../components/ui/toast";
import { AgendamentoDialog } from "../components/agendamentos/agendamento-dialog";
import { BotaoVerTour, TourGuiado, type PassoTour } from "../components/tour/tour-guiado";
import { useTourAutomatico } from "../components/tour/use-tour-automatico";
import {
  dataCurta,
  dataHora,
  descreverDesfecho,
  descreverQuando,
  emQuantoTempo,
  nomeDoAlvo,
  ROTULO_PROBLEMA_CURTO,
  ROTULO_STATUS_EXECUCAO,
  rotuloFuso,
} from "../lib/agendamento";
import type { AgendamentoVisivel } from "../types/dast-schedule.types";

/** Tour da primeira visita. Passo cujo alvo não está na tela (lista vazia, motor ligado) é pulado. */
const PASSOS_TOUR: PassoTour[] = [
  {
    alvo: '[data-nav="/agendamentos"]',
    titulo: "Agendamentos chegaram",
    texto: "Scans DAST que rodam sozinhos, no dia e no horário que você escolher — sem precisar lembrar de disparar.",
  },
  {
    alvo: '[data-tour="agenda-novo"]',
    titulo: "Crie um agendamento",
    texto: "Escolha uma aplicação ou cole só uma URL, depois o dia e o horário. Nada de cron: você escolhe \"Toda segunda às 03:00\" e o Vulnera cuida do resto. Os próximos disparos também aparecem na tela de DAST.",
  },
  {
    alvo: '[data-tour="agenda-motor"]',
    titulo: "O motor de agendamento está desligado",
    texto: "Os agendamentos ficam guardados, mas só disparam com a fila BullMQ ligada (QUEUE_DRIVER=bullmq). Fale com quem administra o servidor.",
  },
  {
    alvo: '[data-tour="agenda-numeros"]',
    titulo: "Num relance",
    texto: "Quantos estão ativos, quantos estão pausados e quantos precisam da sua atenção (autorização vencida ou última execução que não rodou).",
  },
  {
    alvo: '[data-tour="agenda-quando"]',
    titulo: "Quando roda",
    texto: "A frequência em português e o próximo disparo. Pausado ou sem motor, aparece aqui também.",
  },
  {
    alvo: '[data-tour="agenda-autorizacao"]',
    titulo: "Autorização do alvo",
    texto: "Só se escaneia alvo autorizado. A autorização é conferida de novo a cada execução: vencida ou com o endereço mudado, o scan não roda e você é avisado no sino.",
  },
  {
    alvo: '[data-tour="agenda-ultima"]',
    titulo: "O que aconteceu da última vez",
    texto: "\"Scan iniciado\" leva ao resultado em DAST. Se não rodou, o motivo fica escrito aqui.",
  },
  {
    alvo: '[data-tour="agenda-ativo"]',
    titulo: "Pausar sem apagar",
    texto: "Desligue para suspender os disparos e ligue de novo quando quiser. Editar muda o horário; o modo (Real ou Simulado) fica fixo.",
  },
  { alvo: '[data-tour="ver-tour"]', titulo: "Quer rever?", texto: "O tour fica aqui." },
];

function Kpi({ icone, rotulo, valor, dica }: { icone: React.ReactNode; rotulo: string; valor: number; dica: string }) {
  return (
    <div data-ops-lift className="flex flex-col gap-2 rounded-container border border-subtle bg-surface p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-fg-muted">
        {icone}
        {rotulo}
      </div>
      <span className="font-mono text-2xl font-bold text-fg" data-numeric>
        {valor}
      </span>
      <span className="text-xs text-fg-muted">{dica}</span>
    </div>
  );
}

const precisaAtencao = (s: AgendamentoVisivel) =>
  s.enabled && ((s.authorization?.problem ?? null) !== null || (s.lastOutcome !== null && s.lastOutcome !== "STARTED"));

function CartaoAgendamento({
  s,
  primeiro,
  motorLigado,
  verScan,
  aoEditar,
  aoRemover,
}: {
  s: AgendamentoVisivel;
  primeiro: boolean;
  motorLigado: boolean;
  verScan: boolean;
  aoEditar: () => void;
  aoRemover: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const getErrorMessage = useApiError();
  const tour = (nome: string) => (primeiro ? nome : undefined);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const alternar = useMutation({
    mutationFn: (enabled: boolean) => dastSchedulesApi.atualizar(s.id, { enabled }),
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["dast-schedules"] });
      toast.sucesso(enabled ? "Agendamento retomado" : "Agendamento pausado", `${nomeDoAlvo(s)} — ${descreverQuando(s)}`);
    },
    onError: (err: unknown) => toast.erro("Não foi possível mudar o agendamento", getErrorMessage(err)),
  });

  // Mesmo caminho do disparo agendado: o resultado é o desfecho em português, com o scan quando houve.
  const rodar = useMutation({
    mutationFn: () => dastSchedulesApi.rodarAgora(s.id),
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ["dast-schedules"] });
      const desfecho = descreverDesfecho(resultado.outcome);
      const scanId = resultado.scanId;
      toast.mostrar({
        tipo: desfecho?.tom === "sucesso" ? "sucesso" : desfecho?.tom === "perigo" ? "erro" : "info",
        titulo: desfecho?.texto ?? "Pedido enviado",
        descricao: `${nomeDoAlvo(s)} — ${descreverQuando(s)}`,
        acao: scanId && verScan ? { rotulo: "Ver scan", aoClicar: () => navigate(`/dast/scans/${scanId}`) } : undefined,
      });
    },
    onError: (err: unknown) => toast.erro("Não foi possível rodar agora", getErrorMessage(err)),
  });

  // Carrega só quando a pessoa abre o histórico; a lista da página não paga por isso.
  const historico = useQuery({
    queryKey: ["dast-schedules", "historico", s.id],
    queryFn: () => dastSchedulesApi.historico(s.id),
    enabled: historicoAberto,
  });

  const desfecho = descreverDesfecho(s.lastOutcome);
  const problema = s.authorization?.problem ?? null;

  let proximo: string;
  if (!s.enabled) proximo = "Pausado — não vai rodar até ser ligado de novo.";
  else if (!motorLigado) proximo = "Não dispara: o motor de agendamento está desligado.";
  else if (problema) proximo = "Vai tentar, mas não roda sem autorização válida.";
  else if (s.nextRunAt) proximo = `Próximo: ${dataHora(s.nextRunAt)} (${emQuantoTempo(s.nextRunAt)})`;
  else proximo = "Próximo disparo ainda não calculado.";

  return (
    <li>
      <article
        aria-label={`Agendamento de ${nomeDoAlvo(s)}`}
        className={`flex flex-col gap-4 rounded-container border bg-surface p-4 ${s.enabled ? "border-subtle" : "border-dashed border-default opacity-80"}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-fg">{nomeDoAlvo(s)}</h3>
              {s.mode === "SIMULATED" ? <Badge tom="atencao">SIMULADO</Badge> : <Badge tom="acento">REAL</Badge>}
              {s.kind === "URL" && <Badge tom="neutro">Só URL</Badge>}
              {s.application && !s.application.active && <Badge tom="perigo">Aplicação desativada</Badge>}
            </div>
            <p className="mt-1 truncate font-mono text-xs text-fg-muted">{s.url}</p>
            <p className="mt-1 text-xs text-fg-muted">
              {s.application ? s.application.companyName : "Sem aplicação nem projeto · visível a todo o time de segurança"}
              {s.projectName ? ` · ${s.projectName}` : ""}
            </p>
          </div>
          {s.canEdit && (
            <div data-tour={tour("agenda-ativo")} className="flex items-center gap-2">
              <Switch checked={s.enabled} onCheckedChange={(v) => alternar.mutate(v)} rotulo={s.enabled ? "Ativo" : "Pausado"} disabled={alternar.isPending} />
              <Button variant="sutil" size="sm" iconeInicio={<Play size={14} aria-hidden="true" />} onClick={() => rodar.mutate()} carregando={rodar.isPending}>
                Rodar agora
              </Button>
              <Button variant="sutil" size="sm" iconeInicio={<Pencil size={14} aria-hidden="true" />} onClick={aoEditar}>
                Editar
              </Button>
              <Button variant="sutil" size="sm" iconeInicio={<Trash2 size={14} aria-hidden="true" />} onClick={aoRemover} rotulo={`Remover agendamento de ${nomeDoAlvo(s)}`} />
            </div>
          )}
        </div>

        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div data-tour={tour("agenda-quando")}>
            <dt className="text-xs uppercase tracking-[0.1em] text-fg-muted">Quando</dt>
            <dd className="mt-1 font-semibold text-fg">{descreverQuando(s)}</dd>
            <dd className="text-xs text-fg-muted">{rotuloFuso(s.timezone)}</dd>
            <dd className="mt-1 text-xs text-fg-muted">{proximo}</dd>
          </div>
          <div data-tour={tour("agenda-autorizacao")}>
            <dt className="text-xs uppercase tracking-[0.1em] text-fg-muted">Autorização do alvo</dt>
            <dd className="mt-1">
              {!s.authorization ? (
                <Badge tom="neutro">Confirmada por quem criou</Badge>
              ) : problema ? (
                <Badge tom="perigo">{ROTULO_PROBLEMA_CURTO[problema]}</Badge>
              ) : (
                <Badge tom="sucesso">Autorizado até {dataCurta(s.authorization.until!)}</Badge>
              )}
            </dd>
            {s.authorization?.host && <dd className="mt-1 font-mono text-xs text-fg-muted">{s.authorization.host}</dd>}
          </div>
          <div data-tour={tour("agenda-ultima")}>
            <dt className="text-xs uppercase tracking-[0.1em] text-fg-muted">Última execução</dt>
            {desfecho ? (
              <>
                <dd className="mt-1">
                  <Badge tom={desfecho.tom}>{desfecho.texto}</Badge>
                </dd>
                <dd className="mt-1 text-xs text-fg-muted">
                  {s.lastRunAt && dataHora(s.lastRunAt)}
                  {verScan && s.lastScanId && (
                    <>
                      {" · "}
                      <Link to={`/dast/scans/${s.lastScanId}`} className="text-accent-ink underline">
                        Ver scan
                      </Link>
                    </>
                  )}
                </dd>
              </>
            ) : (
              <dd className="mt-1 text-fg-muted">Ainda não rodou.</dd>
            )}
          </div>
        </dl>

        <div className="flex flex-wrap items-center gap-2 border-t border-subtle pt-3">
          <Button
            variant="sutil"
            size="sm"
            iconeInicio={<History size={14} aria-hidden="true" />}
            aria-expanded={historicoAberto}
            onClick={() => setHistoricoAberto((aberto) => !aberto)}
          >
            Histórico
          </Button>
        </div>

        {historicoAberto && (
          <section aria-label={`Histórico de ${nomeDoAlvo(s)}`} className="flex flex-col gap-2">
            {historico.isLoading && <p className="text-sm text-fg-muted">Carregando execuções…</p>}
            {historico.isError && <p className="text-sm text-danger">Não foi possível carregar o histórico. Tente de novo em instantes.</p>}
            {historico.isSuccess && historico.data.length === 0 && <p className="text-sm text-fg-muted">Este agendamento ainda não gerou execuções.</p>}
            {historico.isSuccess && historico.data.length > 0 && (
              <ol aria-label="Últimas execuções" className="flex flex-col divide-y divide-subtle">
                {historico.data.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 text-sm">
                    <span className="text-fg-muted">{dataHora(e.createdAt)}</span>
                    <Badge tom={e.status === "COMPLETED" ? "sucesso" : e.status === "FAILED" ? "perigo" : e.status === "CANCELLED" ? "neutro" : "acento"}>
                      {ROTULO_STATUS_EXECUCAO[e.status] ?? e.status}
                    </Badge>
                    {e.simulated && <Badge tom="atencao">SIMULADO</Badge>}
                    <span className="font-mono text-xs text-fg-muted">
                      Alto {e.alertsHigh} · Médio {e.alertsMedium} · Baixo {e.alertsLow} · Info {e.alertsInfo}
                    </span>
                    {e.diff && (
                      <span className="text-xs font-semibold text-fg">
                        ↗ {e.diff.novos} novos · ↘ {e.diff.resolvidos} resolvidos
                      </span>
                    )}
                    {verScan && (
                      <Link to={`/dast/scans/${e.id}`} aria-label={`Ver scan de ${dataHora(e.createdAt)}`} className="text-accent-ink underline">
                        Ver scan
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </article>
    </li>
  );
}

export function AgendamentosPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const getErrorMessage = useApiError();
  const papel = useAuthStore((st) => st.user?.role);
  const [dialogo, setDialogo] = useState<{ aberto: boolean; editando: AgendamentoVisivel | null }>({ aberto: false, editando: null });
  const [removendo, setRemovendo] = useState<AgendamentoVisivel | null>(null);

  const painelQuery = useQuery({ queryKey: ["dast-schedules", "painel"], queryFn: dastSchedulesApi.painel });
  const painel = painelQuery.data;
  const agendamentos = useMemo(() => painel?.schedules ?? [], [painel]);
  const tour = useTourAutomatico("agendamentos-lista", painelQuery.isSuccess);

  const resumo = useMemo(
    () => ({
      ativos: agendamentos.filter((s) => s.enabled).length,
      pausados: agendamentos.filter((s) => !s.enabled).length,
      atencao: agendamentos.filter(precisaAtencao).length,
    }),
    [agendamentos],
  );

  const remover = useMutation({
    mutationFn: (s: AgendamentoVisivel) => dastSchedulesApi.remover(s.id),
    onSuccess: (_, s) => {
      queryClient.invalidateQueries({ queryKey: ["dast-schedules"] });
      setRemovendo(null);
      toast.sucesso("Agendamento removido", `${nomeDoAlvo(s)} — ${descreverQuando(s)}`);
    },
    onError: (err: unknown) => toast.erro("Não foi possível remover", getErrorMessage(err)),
  });

  const podeCriar = !!painel?.canCreate;
  const novo = () => setDialogo({ aberto: true, editando: null });

  return (
    <div>
      <Breadcrumb itens={[{ rotulo: "Agendamentos" }]} />

      <div data-ops-hero="dast" className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">DAST no piloto automático</p>
          <h1 className="text-2xl font-bold text-fg">Agendamentos</h1>
          <p className="mt-1 max-w-2xl text-fg-muted">
            Escolha uma aplicação ou cole uma URL, o dia e o horário: o scan roda sozinho e aparece em DAST como qualquer outro.
            Nas aplicações, a autorização de teste é conferida de novo a cada execução.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span data-tour="ver-tour">
            <BotaoVerTour aoClicar={tour.abrir} />
          </span>
          {podeCriar && (
            <Button onClick={novo} iconeInicio={<CalendarClock size={16} aria-hidden="true" />} data-tour="agenda-novo">
              Novo agendamento
            </Button>
          )}
        </div>
      </div>

      {painel && !painel.runsSchedules && (
        <div data-tour="agenda-motor" className="mt-6">
          <Alert tom="atencao" titulo="Os agendamentos não estão disparando">
            O motor de fila está em modo memória (<code>QUEUE_DRIVER=memory</code>). Os agendamentos ficam salvos, mas só rodam com a fila
            BullMQ ligada (<code>QUEUE_DRIVER=bullmq</code>).
          </Alert>
        </div>
      )}

      {painelQuery.isLoading && (
        <div className="mt-6 flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">Carregando agendamentos</span>
          <Skeleton className="h-24 w-full bg-inset" />
          <Skeleton className="h-24 w-full bg-inset" />
        </div>
      )}

      {painelQuery.isError && (
        <ErrorState
          className="mt-6"
          titulo="Não foi possível carregar os agendamentos"
          descricao="A API não respondeu. Tente novamente em instantes."
          aoTentarNovamente={() => painelQuery.refetch()}
        />
      )}

      {painelQuery.isSuccess && agendamentos.length === 0 && (
        <EmptyState
          className="mt-6"
          icone={<CalendarClock size={28} strokeWidth={1.5} aria-hidden="true" />}
          titulo="Nenhum agendamento ainda"
          descricao={
            podeCriar
              ? "Agende um scan para rodar todo dia ou toda semana, no horário que incomodar menos — por exemplo, toda segunda às 03:00."
              : "Quando o time de segurança agendar scans para as aplicações da sua empresa, eles aparecem aqui."
          }
          acao={podeCriar ? <Button onClick={novo}>Criar o primeiro agendamento</Button> : undefined}
        />
      )}

      {painelQuery.isSuccess && agendamentos.length > 0 && (
        <>
          <section aria-label="Resumo dos agendamentos" data-tour="agenda-numeros" className="mt-6 grid gap-4 sm:grid-cols-3">
            <Kpi icone={<CalendarCheck2 size={14} aria-hidden="true" />} rotulo="Ativos" valor={resumo.ativos} dica="vão rodar no próximo horário" />
            <Kpi icone={<CalendarOff size={14} aria-hidden="true" />} rotulo="Pausados" valor={resumo.pausados} dica="guardados, sem disparar" />
            <Kpi icone={<AlertTriangle size={14} aria-hidden="true" />} rotulo="Precisam de atenção" valor={resumo.atencao} dica="autorização ou última execução" />
          </section>

          <h2 className="mb-3 mt-8 text-lg font-semibold text-fg">Agendamentos</h2>
          <ul className="flex flex-col gap-3" aria-label="Lista de agendamentos">
            {agendamentos.map((s, i) => (
              <CartaoAgendamento
                key={s.id}
                s={s}
                primeiro={i === 0}
                motorLigado={!!painel?.runsSchedules}
                verScan={papel !== "CLIENT"}
                aoEditar={() => setDialogo({ aberto: true, editando: s })}
                aoRemover={() => setRemovendo(s)}
              />
            ))}
          </ul>
        </>
      )}

      <AgendamentoDialog aberto={dialogo.aberto} editando={dialogo.editando} aoFechar={() => setDialogo({ aberto: false, editando: null })} />

      <Dialog aberto={!!removendo} aoFechar={() => setRemovendo(null)} tamanho="sm">
        <DialogTitle>Remover agendamento?</DialogTitle>
        <DialogDescription>
          {removendo && `${nomeDoAlvo(removendo)} — ${descreverQuando(removendo)}. `}
          Os scans que ele já gerou continuam em DAST. Para só parar por um tempo, use a chave "Ativo".
        </DialogDescription>
        <DialogFooter>
          <Button variant="fantasma" onClick={() => setRemovendo(null)} disabled={remover.isPending}>
            Cancelar
          </Button>
          <Button variant="destrutivo" onClick={() => removendo && remover.mutate(removendo)} carregando={remover.isPending}>
            Remover
          </Button>
        </DialogFooter>
      </Dialog>

      <TourGuiado passos={PASSOS_TOUR} aberto={tour.aberto} aoFechar={tour.fechar} />
    </div>
  );
}
