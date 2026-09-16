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

import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";
import { usersApi } from "../lib/api/users.api";
import { projectsApi } from "../lib/api/projects.api";
import { useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { Breadcrumb } from "../components/ui/navigation";
import { Card, Skeleton } from "../components/ui/card";
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

/** As colunas do quadro. `CLOSED` fica de fora — ver o cabeçalho. */
const COLUNAS: Array<{ status: VulnerabilityStatus; titulo: string; descricao: string }> = [
  { status: "OPEN", titulo: "Aberto", descricao: "Ainda não começou" },
  { status: "IN_PROGRESS", titulo: "Em andamento", descricao: "Alguém está corrigindo" },
  { status: "FIXED", titulo: "Corrigido", descricao: "Aguardando validação" },
];

const STATUS_DO_QUADRO = COLUNAS.map((c) => c.status).join(",");

export function RemediationPage() {
  const [params, setParams] = useSearchParams();
  const usuarioAtual = useAuthStore((s) => s.user);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);

  const projetoFiltrado = params.get("projectId") ?? "";
  const responsavelFiltrado = params.get("assignedTo") ?? "";

  const projetos = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  const usuarios = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

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
    queryFn: () => vulnerabilitiesApi.search(paramsDaBusca),
  });

  const mover = useMutation({
    mutationFn: ({ id, status }: { id: string; status: VulnerabilityStatus }) =>
      vulnerabilitiesApi.transition(id, status),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  const atribuir = useMutation({
    mutationFn: ({ id, assignedTo }: { id: string; assignedTo: string | null }) =>
      vulnerabilitiesApi.assign(id, assignedTo),
    onSuccess: () => {
      setErro(null);
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

  const trocarFiltro = (chave: string, valor: string): void => {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setParams(novo);
  };

  return (
    <div className="space-y-6">
      <Breadcrumb itens={[{ rotulo: "Início", para: "/dashboard" }, { rotulo: "Remediação" }]} />

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-fg">Quadro de remediação</h1>
        <p className="text-sm text-fg-secondary">
          Os findings em aberto, por etapa. Encerrados não aparecem aqui — use a{" "}
          <Link to="/findings?status=CLOSED" className="text-accent-ink hover:underline">
            listagem
          </Link>{" "}
          para vê-los.
        </p>
      </header>

      <Card titulo="Filtros">
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
                  ...(usuarios.data ?? [])
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

      {busca.isLoading && (
        <div className="grid gap-4 md:grid-cols-3" aria-busy="true">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {busca.isError && <Alert tom="perigo">{getErrorMessage(busca.error)}</Alert>}

      {busca.isSuccess && (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUNAS.map((coluna) => {
            const itens = porColuna.get(coluna.status) ?? [];
            return (
              <section
                key={coluna.status}
                aria-label={`${coluna.titulo}: ${itens.length} finding(s)`}
                className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-3"
              >
                <header className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-fg">{coluna.titulo}</h2>
                  <span className="text-xs tabular-nums text-fg-muted">{itens.length}</span>
                </header>
                <p className="-mt-2 text-xs text-fg-muted">{coluna.descricao}</p>

                {itens.length === 0 && (
                  <p className="rounded-control border border-dashed border-subtle p-4 text-center text-xs text-fg-muted">
                    Nada nesta etapa.
                  </p>
                )}

                <ul className="flex flex-col gap-3">
                  {itens.map((f) => {
                    const destinos = ALLOWED_TRANSITIONS[f.status as VulnerabilityStatus] ?? [];
                    const responsavel = f.assigneeName;

                    return (
                      <li key={f.id}>
                        <article className="space-y-2 rounded-control border border-subtle bg-raised p-3">
                          <Link
                            to={`/findings/${f.id}`}
                            className="block text-sm font-medium text-fg underline-offset-2 hover:underline"
                          >
                            {f.title}
                          </Link>

                          <div className="flex flex-wrap items-center gap-2">
                            <SeverityBadge severidade={f.severityFinal} cvss={f.cvssScore} />
                            {f.vrsScore != null && <VrsBadge score={f.vrsScore} band={f.vrsBand} />}
                            <SlaBadge state={f.slaState} remainingMs={f.slaRemainingMs} dueAt={f.slaDueAt} />
                          </div>

                          <p className="text-xs text-fg-muted">
                            {f.projectName}
                            {responsavel ? ` · ${responsavel}` : " · sem responsável"}
                          </p>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {/* Menu, não arrastar: operável por teclado e só com
                                as transições que o backend aceita. */}
                            <DropdownMenu
                              rotulo={`Mover "${f.title}" para outra etapa`}
                              gatilho={
                                <Button variant="secundario" size="sm">
                                  Mover para…
                                </Button>
                              }
                              itens={destinos.map((destino) => ({
                                id: destino,
                                rotulo: transitionLabel(f.status as VulnerabilityStatus, destino),
                                aoEscolher: () => mover.mutate({ id: f.id, status: destino }),
                              }))}
                            />

                            <DropdownMenu
                              rotulo={`Responsável por "${f.title}"`}
                              gatilho={
                                <Button variant="sutil" size="sm">
                                  {responsavel ? "Trocar responsável" : "Atribuir"}
                                </Button>
                              }
                              itens={[
                                ...(usuarioAtual
                                  ? [
                                      {
                                        id: "eu",
                                        rotulo: "Atribuir a mim",
                                        aoEscolher: () =>
                                          atribuir.mutate({ id: f.id, assignedTo: usuarioAtual.id }),
                                      },
                                    ]
                                  : []),
                                ...(f.assignedTo
                                  ? [
                                      {
                                        id: "limpar",
                                        rotulo: "Remover responsável",
                                        aoEscolher: () => atribuir.mutate({ id: f.id, assignedTo: null }),
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
