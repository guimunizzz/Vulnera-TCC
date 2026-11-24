/**
 * conformidade-page.tsx
 *
 * O QUE FAZ
 * Conformidade (ADR-063): para LGPD, ISO/IEC 27001:2022 e NIST CSF 2.0, quais
 * requisitos têm vulnerabilidade ABERTA relacionada na empresa, quantas, a pior
 * severidade e em quais aplicações. O mapeamento OWASP → requisito é o do
 * catálogo versionado (`lib/conformidade/catalogo.ts`).
 *
 * DADOS
 * As abertas por categoria e aplicação que o Exposure Graph já calcula — a
 * mesma consulta e o mesmo cache (`["exposure-graph"]`); nenhum endpoint novo.
 *
 * O QUE NÃO AFIRMA
 * Não diz "conforme". Diz "sem vulnerabilidade aberta relacionada": a falta de
 * achado não é prova de conformidade. É referência de apoio, não auditoria.
 *
 * QUEM USA
 * `App.tsx` (rota `/conformidade`, ADMIN e CLIENT) e o item da navegação.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Scale, TriangleAlert } from "lucide-react";
import { Breadcrumb } from "../components/ui/navigation";
import { Card, Skeleton } from "../components/ui/card";
import { SeverityBadge } from "../components/ui/badge";
import { Tabs } from "../components/ui/tabs";
import { EmptyState, ErrorState } from "../components/ui/empty-state";
import { getApiErrorCode, useApiError } from "../hooks/use-api-error";
import { exposureGraphApi } from "../lib/api/exposure-graph.api";
import { avaliarTudo, type ReferenciaAvaliada, type RequisitoAvaliado } from "../lib/conformidade/avaliar";
import { REFERENCIAS } from "../lib/conformidade/catalogo";
import { cn } from "../lib/cn";
import { useAuthStore } from "../store/auth.store";
import { OWASP_LABELS, type OwaspCategory } from "../types/vulnerability.types";
import type { SeveridadeVuln } from "../types/exposure-graph.types";

const SEVERIDADES: SeveridadeVuln[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const ROTULO_SEVERIDADE: Record<SeveridadeVuln, string> = { CRITICAL: "Crítica", HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" };

/** Onde ver as abertas de uma categoria: Achados (ADMIN) ou o Exposure Graph (CLIENT não abre /findings). */
function linkDaCategoria(owasp: string, podeVerAchados: boolean): string {
  return podeVerAchados ? `/findings?owaspCategory=${owasp}&status=OPEN,IN_PROGRESS` : "/exposure-graph";
}

function BarraDoResumo({ referencia }: { referencia: ReferenciaAvaliada }) {
  const total = referencia.requisitos.length;
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-inset" role="img" aria-label={`${referencia.emRisco} de ${total} requisitos com vulnerabilidade aberta relacionada`}>
        {SEVERIDADES.map((s) =>
          referencia.porSeveridade[s] ? (
            <span
              key={s}
              style={{ width: `${(referencia.porSeveridade[s] / total) * 100}%`, background: `oklch(var(--color-severity-${s.toLowerCase()}))` }}
              className="h-full"
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
        {SEVERIDADES.filter((s) => referencia.porSeveridade[s]).map((s) => (
          <li key={s} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: `oklch(var(--color-severity-${s.toLowerCase()}))` }} aria-hidden="true" />
            {referencia.porSeveridade[s]} com pior severidade {ROTULO_SEVERIDADE[s].toLowerCase()}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-inset ring-1 ring-[oklch(var(--color-border-default))]" aria-hidden="true" />
          {total - referencia.emRisco} sem vulnerabilidade aberta relacionada
        </li>
      </ul>
    </div>
  );
}

function LinhaDoRequisito({ requisito, podeVerAchados }: { requisito: RequisitoAvaliado; podeVerAchados: boolean }) {
  return (
    <li className={cn("rounded-control border p-3", requisito.emRisco ? "border-subtle bg-surface" : "border-subtle bg-inset")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            <span className="mr-2 font-mono text-xs text-accent-ink">{requisito.id}</span>
            {requisito.titulo}
          </p>
          <p className="mt-[0.125rem] text-xs text-fg-secondary">{requisito.resumo}</p>
        </div>
        {requisito.emRisco && requisito.pior ? (
          <span className="flex shrink-0 items-center gap-2 text-xs text-fg-secondary">
            <TriangleAlert className="h-4 w-4 text-danger-ink" aria-hidden="true" />
            <span data-numeric>
              {requisito.abertas} aberta{requisito.abertas === 1 ? "" : "s"}
            </span>
            <SeverityBadge severidade={requisito.pior} />
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 text-xs text-fg-muted">
            <CircleCheck className="h-4 w-4" aria-hidden="true" /> Sem vulnerabilidade aberta relacionada
          </span>
        )}
      </div>
      {requisito.emRisco && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {requisito.porCategoria.map((c) => (
            <Link
              key={c.owasp}
              to={linkDaCategoria(c.owasp, podeVerAchados)}
              className="rounded-full border border-subtle bg-inset px-2 py-[0.125rem] font-medium text-fg hover:border-strong"
              title={OWASP_LABELS[c.owasp as OwaspCategory]}
            >
              {c.owasp} · {c.abertas}
            </Link>
          ))}
          <span className="text-fg-muted">
            em {requisito.aplicacoes.map((a) => a.name).slice(0, 4).join(", ")}
            {requisito.aplicacoes.length > 4 ? ` e mais ${requisito.aplicacoes.length - 4}` : ""}
          </span>
        </div>
      )}
    </li>
  );
}

function PainelDaReferencia({ referencia, podeVerAchados }: { referencia: ReferenciaAvaliada; podeVerAchados: boolean }) {
  const grupos = [...new Set(referencia.requisitos.map((r) => r.grupo))];
  return (
    <div className="space-y-4">
      <Card
        titulo={`${referencia.nome} · ${referencia.versao}`}
        descricao={referencia.descricao}
      >
        <p className="mb-3 text-sm text-fg">
          <strong className="font-mono text-2xl font-semibold" data-numeric>
            {referencia.emRisco}
          </strong>{" "}
          de {referencia.requisitos.length} requisitos com vulnerabilidade aberta relacionada.
        </p>
        <BarraDoResumo referencia={referencia} />
      </Card>
      {grupos.map((grupo) => {
        // Em risco primeiro (mais grave antes), depois o resto na ordem do catálogo.
        const requisitos = referencia.requisitos
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => r.grupo === grupo)
          .sort((a, b) => Number(b.r.emRisco) - Number(a.r.emRisco) || (a.r.pior && b.r.pior ? SEVERIDADES.indexOf(a.r.pior) - SEVERIDADES.indexOf(b.r.pior) : 0) || a.i - b.i)
          .map(({ r }) => r);
        return (
          <section key={grupo} aria-label={grupo} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{grupo}</h2>
            <ul className="space-y-2">
              {requisitos.map((r) => (
                <LinhaDoRequisito key={r.id} requisito={r} podeVerAchados={podeVerAchados} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function ConformidadePage() {
  const mensagemDeErro = useApiError();
  const papel = useAuthStore((s) => s.user?.role);
  // Mesma chave do Exposure Graph: a página reaproveita o cache.
  const consulta = useQuery({ queryKey: ["exposure-graph"], queryFn: exposureGraphApi.obter });
  const avaliacao = useMemo(() => (consulta.data ? avaliarTudo(consulta.data.aplicacoes) : null), [consulta.data]);
  const semEmpresa = getApiErrorCode(consulta.error) === "COMPANY_NOT_FOUND";
  const podeVerAchados = papel === "ADMIN" || papel === "PENTESTER";

  return (
    <div className="space-y-6">
      <Breadcrumb itens={[{ rotulo: "Início", para: "/dashboard" }, { rotulo: "Conformidade" }]} />
      <header className="atmosfera-veu space-y-1">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">
          <Scale className="h-4 w-4" aria-hidden="true" /> Visão da empresa
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Conformidade</h1>
        <p className="max-w-prose text-sm text-fg-secondary">
          Quais requisitos da LGPD, da ISO/IEC 27001 e do NIST CSF as vulnerabilidades abertas colocam em risco, pela categoria OWASP de cada uma.
        </p>
      </header>

      {consulta.isLoading ? (
        <Skeleton className="h-[28rem] w-full" />
      ) : semEmpresa ? (
        <EmptyState titulo="Sua conta não está vinculada a uma empresa" descricao="A conformidade é calculada para a empresa de quem está logado." />
      ) : consulta.isError || !avaliacao ? (
        <ErrorState descricao={mensagemDeErro(consulta.error)} aoTentarNovamente={() => void consulta.refetch()} />
      ) : (
        <Tabs
          paramUrl="referencia"
          abas={REFERENCIAS.map((r) => ({
            id: r.id,
            rotulo: `${r.nome} (${avaliacao[r.id].emRisco})`,
            conteudo: <PainelDaReferencia referencia={avaliacao[r.id]} podeVerAchados={podeVerAchados} />,
          }))}
        />
      )}

      <p className="text-xs text-fg-muted">
        Referência de apoio, não parecer jurídico nem auditoria. O mapeamento liga cada categoria OWASP aos requisitos que ela costuma afetar;
        &quot;sem vulnerabilidade aberta relacionada&quot; não prova conformidade — só que o Vulnera não tem evidência contra o requisito hoje.
        Os resumos dos requisitos são paráfrases; o texto oficial é o da norma.
      </p>
    </div>
  );
}
