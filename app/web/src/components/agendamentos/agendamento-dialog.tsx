/**
 * agendamento-dialog.tsx
 *
 * O QUE FAZ
 * Cria ou edita um scan DAST agendado (ADR-056) em quatro passos curtos:
 *   1. Alvo — uma aplicação (o scan usa a URL dela) OU só uma URL.
 *      Aplicação: se ainda não tem autorização de teste vigente, ela é
 *      registrada aqui mesmo (prazo + confirmação do responsável).
 *      Só URL (decisão de 2026-11-19): sem aplicação, empresa nem projeto,
 *      visível a todo o time de segurança; basta confirmar que há autorização
 *      para testar a URL (fica no AuditLog, sem prazo).
 *   2. Projeto — obrigatório para PENTESTER (projeto de que é membro).
 *   3. Quando — "todo dia" ou "toda semana", horário e fuso, com uma prévia
 *      em português ("Toda segunda às 03:00 (horário de Brasília)"). O cron
 *      nunca aparece: o servidor gera o padrão.
 *   4. Modo — Simulado (não toca o alvo) ou Real (exige confirmação).
 *
 * EDIÇÃO
 * Alvo, projeto e modo ficam travados (a API recusa mudá-los): só "quando" e
 * ligado/desligado mudam. Para trocar o modo, cria-se outro agendamento.
 *
 * O backend reconfere tudo (inclusive a autorização, de novo, na hora de
 * rodar); a validação aqui só evita um envio que certamente falharia.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ShieldCheck, ShieldAlert, FlaskConical, Radar } from "lucide-react";
import { dastSchedulesApi } from "../../lib/api/dast-schedules.api";
import { useApiError } from "../../hooks/use-api-error";
import { useToast } from "../ui/toast";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { cn } from "../../lib/cn";
import {
  DIAS_CURTOS,
  DIAS_SEMANA,
  FUSOS,
  FUSO_PADRAO,
  HORARIOS_SUGERIDOS,
  ORDEM_DIAS_TELA,
  dataCurta,
  dataDaquiA,
  descreverProblemaAutorizacao,
  descreverQuandoCompleto,
  fimDoDia,
  horario,
} from "../../lib/agendamento";
import type { AgendamentoVisivel, FrequenciaAgendamento, ModoAgendamento, QuandoAgendamento } from "../../types/dast-schedule.types";

/** URL http(s) completa, como a API exige (sem usuário/senha embutidos). */
function urlHttp(valor: string): boolean {
  try {
    const u = new URL(valor.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password;
  } catch {
    return false;
  }
}

const CLASSE_SELECT = "h-touch w-full rounded-control border border-default bg-surface px-3 text-sm text-fg";
const QUANDO_PADRAO: QuandoAgendamento = { frequency: "WEEKLY", hour: 3, minute: 0, dayOfWeek: 1, timezone: FUSO_PADRAO };

function Passo({ numero, titulo, children, tour }: { numero: number; titulo: string; children: React.ReactNode; tour?: string }) {
  return (
    <section className="flex flex-col gap-3 border-t border-subtle pt-4 first:border-t-0 first:pt-0" aria-label={titulo} data-tour={tour}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-surface font-mono text-xs text-accent-ink" aria-hidden="true">
          {numero}
        </span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/** Botão de alternância (frequência, dia, horário sugerido) com aria-pressed. */
function Pilula({ ativo, aoClicar, children, rotulo }: { ativo: boolean; aoClicar: () => void; children: React.ReactNode; rotulo?: string }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={rotulo}
      onClick={aoClicar}
      className={cn(
        "min-h-touch rounded-control border px-3 text-sm transition-colors",
        ativo ? "border-accent bg-accent-surface font-semibold text-accent-ink" : "border-default bg-surface text-fg hover:bg-hovered",
      )}
    >
      {children}
    </button>
  );
}

export function AgendamentoDialog({ aberto, aoFechar, editando }: { aberto: boolean; aoFechar: () => void; editando?: AgendamentoVisivel | null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const getErrorMessage = useApiError();
  const idPrevia = useId();

  const [tipoAlvo, setTipoAlvo] = useState<"APLICACAO" | "URL">("APLICACAO");
  const [targetUrl, setTargetUrl] = useState("");
  const [confirmouUrl, setConfirmouUrl] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [quando, setQuando] = useState<QuandoAgendamento>(QUANDO_PADRAO);
  const [modo, setModo] = useState<ModoAgendamento>("SIMULATED");
  const [confirmouReal, setConfirmouReal] = useState(false);
  const [autorizarAte, setAutorizarAte] = useState(dataDaquiA(30));
  const [confirmouAutorizacao, setConfirmouAutorizacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Reabre limpo, ou com os valores do agendamento em edição.
  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setConfirmouReal(false);
    setConfirmouAutorizacao(false);
    setAutorizarAte(dataDaquiA(30));
    setConfirmouUrl(false);
    if (editando) {
      setTipoAlvo(editando.kind === "URL" ? "URL" : "APLICACAO");
      setTargetUrl(editando.url ?? "");
      setApplicationId(editando.applicationId ?? "");
      setProjectId(editando.projectId ?? "");
      setModo(editando.mode);
      setQuando({ frequency: editando.frequency, hour: editando.hour, minute: editando.minute, dayOfWeek: editando.dayOfWeek, timezone: editando.timezone });
    } else {
      setTipoAlvo("APLICACAO");
      setTargetUrl("");
      setApplicationId("");
      setProjectId("");
      setModo("SIMULATED");
      setQuando(QUANDO_PADRAO);
    }
  }, [aberto, editando]);

  const alvosQuery = useQuery({ queryKey: ["dast-schedules", "alvos"], queryFn: dastSchedulesApi.alvos, enabled: aberto && !editando && tipoAlvo === "APLICACAO" });
  const alvos = useMemo(() => alvosQuery.data ?? [], [alvosQuery.data]);
  const alvo = tipoAlvo === "APLICACAO" ? (alvos.find((a) => a.applicationId === applicationId) ?? null) : null;
  const urlValida = urlHttp(targetUrl);

  // Um só projeto possível (caso comum do PENTESTER): já vem escolhido.
  useEffect(() => {
    if (alvo && alvo.projects.length === 1 && alvo.projectRequired) setProjectId(alvo.projects[0]!.id);
  }, [alvo]);

  const autorizar = useMutation({
    mutationFn: () => dastSchedulesApi.autorizar(applicationId, fimDoDia(autorizarAte)),
    onSuccess: () => {
      setConfirmouAutorizacao(false);
      queryClient.invalidateQueries({ queryKey: ["dast-schedules"] });
      toast.sucesso("Autorização registrada", `Testes autorizados até ${dataCurta(fimDoDia(autorizarAte))}.`);
    },
    onError: (err: unknown) => setErro(getErrorMessage(err)),
  });

  const salvar = useMutation({
    mutationFn: () =>
      editando
        ? dastSchedulesApi.atualizar(editando.id, quando)
        : tipoAlvo === "URL"
          ? dastSchedulesApi.criarPorUrl({ ...quando, targetUrl: targetUrl.trim(), mode: modo, confirmedAuthorization: true })
          : dastSchedulesApi.criar(applicationId, { ...quando, mode: modo, projectId: projectId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dast-schedules"] });
      toast.sucesso(editando ? "Agendamento atualizado" : "Agendamento criado", descreverQuandoCompleto(quando));
      aoFechar();
    },
    onError: (err: unknown) => setErro(getErrorMessage(err)),
  });

  const faltando: string[] = [];
  if (!editando && tipoAlvo === "URL") {
    if (!urlValida) faltando.push("informe uma URL http(s) válida");
    if (!confirmouUrl) faltando.push("confirme a autorização para testar a URL");
  } else if (!editando) {
    if (!alvo) faltando.push("escolha a aplicação");
    else if (alvo.authorization.problem !== null) faltando.push("registre a autorização do alvo");
    if (alvo?.projectRequired && !projectId) faltando.push("escolha o projeto");
  }
  if (!editando) {
    if (modo === "REAL" && !confirmouReal) faltando.push("confirme o scan real");
  }
  if (quando.frequency === "WEEKLY" && quando.dayOfWeek === null) faltando.push("escolha o dia da semana");
  const ocupado = salvar.isPending || autorizar.isPending;
  // Os passos se numeram pelo que está na tela: sem projeto (URL solta, ou
  // aplicação sem projetos), "Quando" é o 2 — nada de pular do 1 para o 3.
  const mostraProjeto = editando ? !!editando.projectName : !!alvo && alvo.projects.length > 0;
  const numeroQuando = mostraProjeto ? 3 : 2;

  const setFrequencia = (frequency: FrequenciaAgendamento) =>
    setQuando((q) => ({ ...q, frequency, dayOfWeek: frequency === "WEEKLY" ? (q.dayOfWeek ?? 1) : null }));

  return (
    <Dialog aberto={aberto} aoFechar={aoFechar} tamanho="lg" fecharAoClicarFora={false}>
      <DialogTitle>
        <span className="flex items-center gap-2">
          <CalendarClock size={20} aria-hidden="true" />
          {editando ? "Editar agendamento" : "Novo agendamento"}
        </span>
      </DialogTitle>
      <DialogDescription>
        {editando
          ? "Mude o horário ou a frequência. Alvo, projeto e modo ficam como estão — para trocá-los, crie outro agendamento."
          : "O scan roda sozinho no horário escolhido, contra a URL da aplicação, e aparece em DAST como qualquer outro."}
      </DialogDescription>

      <form
        className="mt-4 flex max-h-[65vh] flex-col gap-5 overflow-y-auto pr-1"
        onSubmit={(e) => {
          e.preventDefault();
          setErro(null);
          if (faltando.length === 0) salvar.mutate();
        }}
      >
        <Passo numero={1} titulo="O que escanear" tour="agenda-form-alvo">
          {editando ? (
            <p className="text-sm text-fg">
              <strong>{editando.application?.name ?? "Só URL"}</strong> <span className="font-mono text-xs text-fg-muted">{editando.url}</span>
            </p>
          ) : (
            <>
              <div role="group" aria-label="Tipo de alvo" className="flex flex-wrap gap-2">
                <Pilula ativo={tipoAlvo === "APLICACAO"} aoClicar={() => setTipoAlvo("APLICACAO")}>
                  Uma aplicação
                </Pilula>
                <Pilula ativo={tipoAlvo === "URL"} aoClicar={() => setTipoAlvo("URL")}>
                  Só uma URL
                </Pilula>
              </div>
              {tipoAlvo === "URL" && (
                <div className="flex flex-col gap-3" data-tour="agenda-form-url">
                  <Field rotulo="URL do alvo" obrigatorio dica="Sem aplicação nem projeto: o agendamento fica visível a todo o time de segurança.">
                    {(attrs) => (
                      <Input
                        {...attrs}
                        type="url"
                        inputMode="url"
                        placeholder="https://alvo.exemplo.com"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        aria-invalid={targetUrl !== "" && !urlValida}
                      />
                    )}
                  </Field>
                  {targetUrl !== "" && !urlValida && <p className="text-xs text-danger-ink">Use um endereço completo começando com http:// ou https://.</p>}
                  <Checkbox
                    rotulo="Tenho autorização do responsável para testar esta URL."
                    descricao="A confirmação fica registrada na auditoria. Sem prazo: vale enquanto o agendamento existir."
                    checked={confirmouUrl}
                    onChange={(e) => setConfirmouUrl(e.target.checked)}
                  />
                </div>
              )}
              {tipoAlvo === "APLICACAO" && (
              <>
              <Field rotulo="Aplicação" obrigatorio dica="O scan usa a URL cadastrada na aplicação.">
                {(attrs) => (
                  <select {...attrs} className={CLASSE_SELECT} value={applicationId} onChange={(e) => setApplicationId(e.target.value)} disabled={ocupado || alvosQuery.isLoading}>
                    <option value="">{alvosQuery.isLoading ? "Carregando aplicações..." : "Selecione uma aplicação..."}</option>
                    {alvos.map((a) => (
                      <option key={a.applicationId} value={a.applicationId}>
                        {a.name} — {a.companyName}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {alvosQuery.isSuccess && alvos.length === 0 && (
                <Alert tom="atencao">Nenhuma aplicação disponível. Você precisa participar de um projeto de uma aplicação com URL cadastrada.</Alert>
              )}
              {alvo && (
                <div className="rounded-container border border-subtle bg-inset p-3 text-sm">
                  <p className="font-mono text-xs text-fg-muted">{alvo.url}</p>
                  {alvo.authorization.problem === null ? (
                    <p className="mt-2 flex items-center gap-2 text-success-ink">
                      <ShieldCheck size={16} aria-hidden="true" />
                      Autorizado para testes até {dataCurta(alvo.authorization.until!)} ({alvo.authorization.host}).
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-3" data-tour="agenda-form-autorizacao">
                      <p className="flex items-start gap-2 text-warning-ink">
                        <ShieldAlert size={16} className="mt-1 shrink-0" aria-hidden="true" />
                        {descreverProblemaAutorizacao(alvo.authorization.problem)}
                      </p>
                      <p className="text-xs text-fg-muted">
                        Só se agenda scan contra alvo com autorização registrada. Ela vale para o endereço{" "}
                        <span className="font-mono">{alvo.authorization.currentHost}</span> e é conferida de novo a cada execução.
                      </p>
                      <Field rotulo="Autorizado até" dica="No máximo um ano.">
                        {(attrs) => (
                          <Input {...attrs} type="date" value={autorizarAte} min={dataDaquiA(1)} max={dataDaquiA(365)} onChange={(e) => setAutorizarAte(e.target.value)} />
                        )}
                      </Field>
                      <Checkbox
                        rotulo="O responsável por este alvo autorizou os testes de segurança."
                        checked={confirmouAutorizacao}
                        onChange={(e) => setConfirmouAutorizacao(e.target.checked)}
                      />
                      <div>
                        <Button type="button" variant="secundario" onClick={() => autorizar.mutate()} disabled={!confirmouAutorizacao || !autorizarAte} carregando={autorizar.isPending}>
                          Registrar autorização
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </>
              )}
            </>
          )}
        </Passo>

        {mostraProjeto && (
          <Passo numero={2} titulo="Projeto">
            {editando ? (
              <p className="text-sm text-fg">{editando.projectName}</p>
            ) : (
              <Field
                rotulo="Projeto"
                obrigatorio={alvo!.projectRequired}
                dica={alvo!.projectRequired ? "Só aparecem os projetos em que você participa." : "Opcional: liga os scans a um projeto da aplicação."}
              >
                {(attrs) => (
                  <select {...attrs} className={CLASSE_SELECT} value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={ocupado}>
                    <option value="">{alvo!.projectRequired ? "Selecione um projeto..." : "Sem projeto"}</option>
                    {alvo!.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
          </Passo>
        )}

        <Passo numero={numeroQuando} titulo="Quando rodar" tour="agenda-form-quando">
          <div role="group" aria-label="Frequência" className="flex flex-wrap gap-2">
            <Pilula ativo={quando.frequency === "DAILY"} aoClicar={() => setFrequencia("DAILY")}>
              Todo dia
            </Pilula>
            <Pilula ativo={quando.frequency === "WEEKLY"} aoClicar={() => setFrequencia("WEEKLY")}>
              Toda semana
            </Pilula>
          </div>

          {quando.frequency === "WEEKLY" && (
            <div role="group" aria-label="Dia da semana" className="flex flex-wrap gap-2">
              {ORDEM_DIAS_TELA.map((dia) => (
                <Pilula key={dia} ativo={quando.dayOfWeek === dia} aoClicar={() => setQuando((q) => ({ ...q, dayOfWeek: dia }))} rotulo={DIAS_SEMANA[dia]}>
                  {DIAS_CURTOS[dia]}
                </Pilula>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <Field rotulo="Horário">
              {(attrs) => (
                <Input
                  {...attrs}
                  type="time"
                  value={horario(quando.hour, quando.minute)}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    if (Number.isInteger(h) && Number.isInteger(m)) setQuando((q) => ({ ...q, hour: h!, minute: m! }));
                  }}
                />
              )}
            </Field>
            <div role="group" aria-label="Horários sugeridos" className="flex flex-wrap gap-2">
              {HORARIOS_SUGERIDOS.map((s) => (
                <Pilula
                  key={s.rotulo}
                  ativo={quando.hour === s.hora && quando.minute === s.minuto}
                  aoClicar={() => setQuando((q) => ({ ...q, hour: s.hora, minute: s.minuto }))}
                >
                  {s.rotulo} · {horario(s.hora, s.minuto)}
                </Pilula>
              ))}
            </div>
          </div>

          <Field rotulo="Fuso horário" className="max-w-xs">
            {(attrs) => (
              <select {...attrs} className={CLASSE_SELECT} value={quando.timezone} onChange={(e) => setQuando((q) => ({ ...q, timezone: e.target.value }))}>
                {FUSOS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <p id={idPrevia} role="status" className="rounded-container border border-accent bg-accent-surface px-3 py-2 text-sm font-medium text-accent-ink">
            {quando.frequency === "WEEKLY" && quando.dayOfWeek === null ? "Escolha o dia da semana." : `Vai rodar: ${descreverQuandoCompleto(quando)}`}
          </p>
        </Passo>

        <Passo numero={numeroQuando + 1} titulo="Modo" tour="agenda-form-modo">
          {editando ? (
            <p className="text-sm text-fg">{editando.mode === "REAL" ? "Real — o ZAP envia requisições ao alvo." : "Simulado — demonstração, não toca o alvo."}</p>
          ) : (
            <>
              <div role="radiogroup" aria-label="Modo do scan" className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { valor: "SIMULATED", titulo: "Simulado", texto: "Demonstração: nada é enviado ao alvo e os achados são fictícios. Bom para conhecer o fluxo.", Icone: FlaskConical },
                    { valor: "REAL", titulo: "Real", texto: "O OWASP ZAP envia requisições de verdade ao alvo. Falha vira falha, nunca resultado simulado.", Icone: Radar },
                  ] as const
                ).map(({ valor, titulo, texto, Icone }) => (
                  <label
                    key={valor}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-container border p-3 transition-colors",
                      modo === valor ? "border-accent bg-accent-surface" : "border-default bg-surface hover:bg-hovered",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                      <input type="radio" name="modo-agendamento" value={valor} checked={modo === valor} onChange={() => setModo(valor)} className="accent-[var(--color-accent)]" />
                      <Icone size={16} aria-hidden="true" />
                      {titulo}
                    </span>
                    <span className="text-xs text-fg-muted">{texto}</span>
                  </label>
                ))}
              </div>
              {modo === "REAL" && (
                <Checkbox
                  rotulo="Confirmo que este scan real está autorizado e pode rodar sem acompanhamento."
                  checked={confirmouReal}
                  onChange={(e) => setConfirmouReal(e.target.checked)}
                />
              )}
              <p className="text-xs text-fg-muted">O modo não muda depois de criado.</p>
            </>
          )}
        </Passo>

        {erro && <Alert tom="perigo">{erro}</Alert>}

        <DialogFooter className="sticky bottom-0 flex-wrap bg-surface pt-2">
          {/* Linha própria: com o aviso longo, os botões não quebram o texto em duas linhas. */}
          {faltando.length > 0 && <p className="w-full text-xs text-fg-muted">Para salvar: {faltando.join(", ")}.</p>}
          <Button type="button" variant="fantasma" onClick={aoFechar} disabled={ocupado}>
            Cancelar
          </Button>
          <Button type="submit" disabled={faltando.length > 0} carregando={salvar.isPending} aria-describedby={idPrevia}>
            {editando ? "Salvar alterações" : "Criar agendamento"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
