/**
 * remediation-page.tsx
 *
 * O QUE FAZ
 * O quadro de remediação (CP-7): os findings abertos organizados em colunas
 * por status, com "Mover para…" e atribuição de responsável.
 *
 * ==========================================================================
 * 🎯 POR QUE NÃO TEM ARRASTAR-E-SOLTAR
 * ==========================================================================
 * Porque arrastar não é operável por teclado, e este quadro move findings —
 * uma operação que grava no banco e entra na auditoria. Um quadro em que a
 * ação principal só existe para quem usa mouse deixaria metade do contrato de
 * acessibilidade do produto de fora justamente na tela mais operacional.
 *
 * O que existe no lugar é um MENU por cartão: "Mover para…" abre a lista de
 * transições VÁLIDAS a partir do status atual (a mesma máquina de estados do
 * backend, ADR-033), navegável por Tab e setas. Como efeito colateral, a tela
 * fica honesta sobre uma coisa que o arrastar esconde: nem todo movimento é
 * permitido — `CLOSED` é terminal, e um cartão arrastado para lá e recusado
 * pelo servidor voltaria sozinho, sem explicação.
 *
 * ==========================================================================
 * O QUE O QUADRO NÃO MOSTRA
 * ==========================================================================
 * `CLOSED`. Um quadro de trabalho mostra o que está em aberto; a coluna de
 * encerrados cresce para sempre e empurra as outras para fora da tela. Quem
 * precisa dos fechados usa a listagem com `status = CLOSED`.
 *
 * QUEM USA
 * Rota `/remediation` (ADMIN e PENTESTER — CLIENT não escreve em finding).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup, motion } from "motion/react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";
import { buscarTodosFindings } from "../lib/remediation-board";
import { projectsApi } from "../lib/api/projects.api";
import { useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { Breadcrumb } from "../components/ui/navigation";
import { Card, Skeleton } from "../components/ui/card";
import { ErrorState } from "../components/ui/empty-state";
import { Select } from "../components/ui/select";
import { Field } from "../components/ui/field";
import { Alert } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { DropdownMenu } from "../components/ui/dropdown-menu";
import { SeverityBadge } from "../components/ui/badge";
import { SlaBadge } from "../components/findings/sla-badge";
import { VrsBadge } from "../components/findings/vrs-badge";
import { ALLOWED_TRANSITIONS, transitionLabel, type VulnerabilityStatus } from "../types/vulnerability.types";
import type { FindingListItem } from "../types/vulnerability.types";
import type { AssigneeCandidate, User } from "../types/auth.types";
import { NumeroAnimado } from "../motion/components";
import { useMotion } from "../motion/use-motion";
import "./remediation-page.css";

/** As colunas do quadro. `CLOSED` fica de fora — ver o cabeçalho. */
const COLUNAS: Array<{ status: VulnerabilityStatus; titulo: string; descricao: string }> = [
  { status: "OPEN", titulo: "Aberto", descricao: "Ainda não começou" },
  { status: "IN_PROGRESS", titulo: "Em andamento", descricao: "Alguém está corrigindo" },
  { status: "FIXED", titulo: "Corrigido", descricao: "Aguardando validação" },
];

const STATUS_DO_QUADRO = COLUNAS.map((c) => c.status).join(",");

export function RemediationPage() {
  const { item, lista, troca, layout, reduzido } = useMotion();
  const [params, setParams] = useSearchParams();
  const usuarioAtual = useAuthStore((s) => s.user);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaMovimentacao, setUltimaMovimentacao] = useState<{ id: string; status: VulnerabilityStatus } | null>(null);
  const [ultimaAtribuicao, setUltimaAtribuicao] = useState<{ id: string; assignedTo: string | null } | null>(null);
  const jaMostrouQuadro = useRef(false);

  const projetoFiltrado = params.get("projectId") ?? "";
  const responsavelFiltrado = params.get("assignedTo") ?? "";

  const projetos = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  // Uma lista mínima e reutilizável para o filtro; os menus dos cartões
  // carregam somente seu recorte quando abertos (ver AssigneeMenu abaixo).
  const candidatosDoFiltro = useQuery({
    queryKey: ["assignee-candidates", projetoFiltrado],
    queryFn: () => vulnerabilitiesApi.assigneeCandidates(projetoFiltrado || undefined),
  });

  /**
   * UMA busca para o quadro inteiro, não uma por coluna: três requisições
   * devolveriam três retratos de instantes diferentes, e um finding movido
   * entre elas apareceria em duas colunas ao mesmo tempo.
   */
  const paramsDaBusca = useMemo(() => {
    const p = new URLSearchParams();
    p.set("status", STATUS_DO_QUADRO);
    p.set("pageSize", "100");
    p.set("sortBy", "vrsScore");
    p.set("sortOrder", "desc");
    if (projetoFiltrado) p.set("projectId", projetoFiltrado);
    if (responsavelFiltrado) p.set("assignedTo", responsavelFiltrado);
    return p;
  }, [projetoFiltrado, responsavelFiltrado]);

  const busca = useQuery({
    queryKey: ["findings", "remediation", paramsDaBusca.toString()],
    queryFn: () => buscarTodosFindings(vulnerabilitiesApi.search, paramsDaBusca),
  });

  const mover = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VulnerabilityStatus }) =>
      vulnerabilitiesApi.transition(id, status),
    onSuccess: (_resultado, variaveis) => {
      setErro(null);
      setUltimaMovimentacao(variaveis);
      void queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  const atribuir = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string | null }) =>
      vulnerabilitiesApi.assign(id, assignedTo),
    onSuccess: (_resultado, variaveis) => {
      setErro(null);
      setUltimaAtribuicao(variaveis);
      void queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  const porColuna = useMemo(() => {
    const mapa = new Map<VulnerabilityStatus, FindingListItem[]>();
    for (const col of COLUNAS) mapa.set(col.status, []);
    for (const f of busca.data?.data ?? []) {
      mapa.get(f.status as VulnerabilityStatus)?.push(f);
    }
    return mapa;
  }, [busca.data]);

  useEffect(() => {
    if (busca.isSuccess) jaMostrouQuadro.current = true;
  }, [busca.isSuccess]);

  const totalNoQuadro = busca.data?.data.length;
  const movimentoConfirmado = ultimaMovimentacao && busca.data?.data.some(
    (finding) => finding.id === ultimaMovimentacao.id && finding.status === ultimaMovimentacao.status,
  );

  const trocarFiltro = (chave: string, valor: string): void => {
    setUltimaMovimentacao(null);
    setUltimaAtribuicao(null);
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setParams(novo);
  };

  return (
    <div className="remediation-workspace space-y-5">
      <Breadcrumb itens={[{ rotulo: "Início", para: "/dashboard" }, { rotulo: "Remediação" }]} />

      <header className="remediation-hero relative overflow-hidden rounded-container border border-subtle p-5 sm:p-6">
        <div aria-hidden="true" className="remediation-hero-grid pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.16em] text-accent-ink">Operações de segurança / Fluxo de correção</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg">Quadro de remediação</h1>
          <p className="mt-2 max-w-prose text-sm text-fg-secondary">
            Acompanhe os findings em aberto da entrada à validação. Encerrados ficam na{" "}
            <Link to="/findings?status=CLOSED" className="rounded-control text-accent-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus">listagem</Link>.
          </p>
        </div>
        <dl className="remediation-flow relative mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-container border border-subtle sm:grid-cols-4" aria-label="Resumo das etapas do quadro">
          <div className="remediation-flow-total p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-fg-muted">No fluxo</dt>
            <dd className="mt-2 font-mono text-3xl font-semibold text-fg" data-numeric>{totalNoQuadro === undefined ? "—" : <NumeroAnimado valor={totalNoQuadro} />}</dd>
          </div>
          {COLUNAS.map((coluna) => (
            <div key={coluna.status} className={`remediation-flow-step remediation-flow-step--${coluna.status.toLowerCase()} p-4`}>
              <dt className="flex items-center gap-2 text-xs font-medium text-fg-secondary"><span className="remediation-flow-dot" aria-hidden="true" />{coluna.titulo}</dt>
              <dd className="mt-2 font-mono text-2xl font-semibold text-fg" data-numeric>{totalNoQuadro === undefined ? "—" : <NumeroAnimado valor={porColuna.get(coluna.status)?.length ?? 0} />}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Card titulo="Recorte do quadro" descricao="Escolha o projeto e a pessoa responsável." className="remediation-filters">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field rotulo="Projeto">
            {(props) => (
              <Select
                {...props}
                valor={projetoFiltrado}
                aoMudar={(v) => trocarFiltro("projectId", v)}
                opcoes={[
                  { valor: "", rotulo: "Todos os projetos" },
                  ...(projetos.data ?? []).map((p) => ({ valor: p.id, rotulo: p.name })),
                ]}
              />
            )}
          </Field>

          <Field rotulo="Responsável">
            {(props) => (
              <Select
                {...props}
                valor={responsavelFiltrado}
                aoMudar={(v) => trocarFiltro("assignedTo", v)}
                opcoes={[
                  { valor: "", rotulo: "Qualquer responsável" },
                  ...(usuarioAtual ? [{ valor: usuarioAtual.id, rotulo: "Atribuídos a mim" }] : []),
                  // "none" é o valor que a API entende como IS NULL.
                  { valor: "none", rotulo: "Sem responsável" },
                  ...(candidatosDoFiltro.data ?? [])
                    .filter((u) => u.id !== usuarioAtual?.id)
                    .map((u) => ({ valor: u.id, rotulo: u.name })),
                ]}
              />
            )}
          </Field>
        </div>
      </Card>

      {erro && (
        <Alert tom="perigo" aoFechar={() => setErro(null)}>
          {erro}
        </Alert>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {movimentoConfirmado ? "Finding movido para a nova etapa." : ""}
      </p>

      {busca.isLoading && (
        <div className="grid gap-4 lg:grid-cols-3" aria-busy="true" aria-label="Carregando quadro de remediação">
          <span className="sr-only">Carregando quadro de remediação</span>
          {COLUNAS.map((coluna) => <div key={coluna.status} className="remediation-column rounded-container border border-subtle p-4"><Skeleton className="h-6 w-32" /><Skeleton className="mt-3 h-4 w-44" /><Skeleton className="mt-6 h-40 w-full" /><Skeleton className="mt-3 h-40 w-full" /></div>)}
        </div>
      )}

      {busca.isError && <ErrorState titulo="Não foi possível carregar o quadro" descricao={getErrorMessage(busca.error)} aoTentarNovamente={() => void busca.refetch()} />}

      {busca.isSuccess && (
        <LayoutGroup id={`remediation-${paramsDaBusca.toString()}`}>
        <motion.div className="grid items-start gap-4 lg:grid-cols-3" variants={troca} initial="inicial" animate="visivel">
          {COLUNAS.map((coluna) => {
            const itens = porColuna.get(coluna.status) ?? [];
            return (
              <motion.section
                key={coluna.status}
                aria-label={`${coluna.titulo}: ${itens.length} finding(s)`}
                className={`remediation-column remediation-column--${coluna.status.toLowerCase()} flex min-w-0 flex-col gap-3 rounded-container border border-subtle p-3 sm:p-4`}
                variants={item}
                initial={jaMostrouQuadro.current ? false : "inicial"}
                animate="visivel"
              >
                <header className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2"><span aria-hidden="true" className="remediation-column-dot" /><h2 className="text-base font-semibold text-fg">{coluna.titulo}</h2></div>
                  <span className="rounded-control border border-subtle px-2 py-1 font-mono text-sm tabular-nums text-fg-secondary">{itens.length}</span>
                </header>
                <p className="-mt-2 pl-4 text-sm text-fg-muted">{coluna.descricao}</p>

                {itens.length === 0 && (
                  <p className="remediation-empty rounded-control border border-dashed border-subtle p-6 text-center text-sm text-fg-muted">
                    Nenhum finding nesta etapa.
                  </p>
                )}

                <motion.ul className="flex flex-col gap-3" variants={lista} initial={jaMostrouQuadro.current ? false : "inicial"} animate="visivel">
                  {itens.map((f, index) => {
                    const destinos = ALLOWED_TRANSITIONS[f.status as VulnerabilityStatus] ?? [];
                    const responsavel = f.assigneeName;
                    const movendo = mover.isPending && mover.variables?.id === f.id;
                    const atribuindo = atribuir.isPending && atribuir.variables?.id === f.id;

                    return (
                      <motion.li key={f.id} variants={index < 12 ? item : undefined} initial={jaMostrouQuadro.current ? false : "inicial"} animate="visivel">
                        <motion.article
                          layoutId={reduzido ? undefined : `finding-${f.id}`}
                          transition={{ layout }}
                          data-moving={movendo || undefined}
                          data-confirmed={ultimaMovimentacao?.id === f.id && ultimaMovimentacao.status === f.status || undefined}
                          data-assigned={ultimaAtribuicao?.id === f.id && ultimaAtribuicao.assignedTo === f.assignedTo || undefined}
                          className="remediation-finding space-y-3 rounded-control border border-subtle bg-raised p-4"
                        >
                          <Link
                            to={`/findings/${f.id}`}
                            className="block rounded-control text-sm font-semibold leading-6 text-fg underline-offset-2 hover:text-accent-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          >
                            {f.title}
                          </Link>

                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityBadge severidade={f.severityFinal} cvss={f.cvssScore} />
                            {f.vrsScore != null && <VrsBadge score={f.vrsScore} band={f.vrsBand} />}
                            <SlaBadge state={f.slaState} remainingMs={f.slaRemainingMs} dueAt={f.slaDueAt} />
                          </div>

                          <p className="text-sm text-fg-muted">
                            {f.projectName}
                            {responsavel ? ` · ${responsavel}` : " · sem responsável"}
                          </p>

                          <div className="flex flex-wrap gap-2 border-t border-subtle pt-3">
                            {/* Menu, não arrastar: operável por teclado e só com
                                as transições que o backend aceita. */}
                            <DropdownMenu
                              rotulo={`Mover "${f.title}" para outra etapa`}
                              gatilho={
                                <Button variant="secundario" size="sm" disabled={movendo || atribuindo}>
                                  {movendo ? "Movendo…" : "Mover para…"}
                                </Button>
                              }
                              itens={destinos.map((destino) => ({
                                id: destino,
                                rotulo: transitionLabel(f.status as VulnerabilityStatus, destino),
                                aoEscolher: () => mover.mutate({ id: f.id, status: destino }),
                              }))}
                            />

                            <AssigneeMenu
                              finding={f}
                              usuarioAtual={usuarioAtual}
                              disabled={movendo || atribuindo}
                              onAssign={(assignedTo) => {
                                setUltimaAtribuicao(null);
                                atribuir.mutate({ id: f.id, assignedTo });
                              }}
                            />
                            {atribuindo && <span className="self-center text-xs text-fg-muted" role="status">Atualizando…</span>}
                          </div>
                        </motion.article>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              </motion.section>
            );
          })}
        </motion.div>
        </LayoutGroup>
      )}
    </div>
  );
}

export function AssigneeMenu({
  finding,
  usuarioAtual,
  onAssign,
  disabled = false,
}: {
  finding: FindingListItem;
  usuarioAtual: User | null;
  onAssign: (assignedTo: string | null) => void;
  disabled?: boolean;
}) {
  // A lista antiga de /users é deliberadamente restrita para PENTESTER e só
  // devolve o próprio usuário. Este contrato por finding traz todos os
  // candidatos que o backend validará (admins, clientes da company e
  // pentesters membros do projeto), permitindo a troca real de responsável.
  const [aberto, setAberto] = useState(false);
  const candidatos = useQuery({
    queryKey: ["assignees", finding.id],
    queryFn: () => vulnerabilitiesApi.assignees(finding.id),
    enabled: aberto,
  });
  const opcoes = (candidatos.data ?? []).filter((u) => u.id !== finding.assignedTo);

  return (
    <DropdownMenu
      rotulo={`Responsável por "${finding.title}"`}
      gatilho={
        <Button variant="sutil" size="sm" disabled={disabled}>
          {finding.assigneeName ? "Trocar responsável" : "Atribuir"}
        </Button>
      }
      aoAbrir={() => setAberto(true)}
      itens={[
        ...(usuarioAtual && usuarioAtual.id !== finding.assignedTo
          ? [{ id: "eu", rotulo: "Atribuir a mim", aoEscolher: () => onAssign(usuarioAtual.id) }]
          : []),
        ...opcoes.map((u: AssigneeCandidate) => ({
          id: `user-${u.id}`,
          rotulo: `Atribuir a ${u.name}`,
          aoEscolher: () => onAssign(u.id),
        })),
        ...(finding.assignedTo
          ? [{ id: "limpar", rotulo: "Remover responsável", aoEscolher: () => onAssign(null) }]
          : []),
      ]}
    />
  );
}
