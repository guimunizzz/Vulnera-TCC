/**
 * painel-exposicao.tsx
 *
 * O QUE FAZ
 * Painel lateral do Exposure Graph: resumo da empresa sem seleção; com uma
 * aplicação, contexto de risco, abertas por severidade, categorias e as
 * principais vulnerabilidades (com link); com uma categoria, as aplicações
 * afetadas.
 *
 * POR QUE EXISTE
 * O grafo 2D e o mapa 3D mostram a mesma empresa e dividem a seleção; o painel
 * é o mesmo para os dois, para a pessoa não reaprender a leitura ao trocar.
 *
 * QUEM USA
 * `exposure-graph-page.tsx`.
 */

import { Link } from "react-router-dom";
import { Globe } from "lucide-react";
import { LinkButton } from "../../components/ui/button";
import { Badge, SeverityBadge } from "../../components/ui/badge";
import type { AplicacaoExposta, ExposureGraph, SeveridadeVuln } from "../../types/exposure-graph.types";
import {
  categoriasDaEmpresa,
  ID_EMPRESA,
  idDaAplicacao,
  idDaCategoria,
  rotuloCategoria,
  ROTULO_AMBIENTE,
  ROTULO_CRITICIDADE,
} from "./exposure-graph-model";
import { cor, ROTULO_RISCO, tokenDoNo } from "./node-visual";

const SEVERIDADES: SeveridadeVuln[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const SENSIBILIDADE: Record<string, string> = { PUBLIC: "Pública", INTERNAL: "Interna", CONFIDENTIAL: "Confidencial", RESTRICTED: "Restrita" };

function ContagemPorSeveridade({ abertas }: { abertas: Record<SeveridadeVuln, number> }) {
  return (
    <dl className="grid grid-cols-4 gap-2">
      {SEVERIDADES.map((s) => (
        <div key={s} className="rounded-control border border-subtle bg-inset px-2 py-1.5 text-center">
          <dt className="flex items-center justify-center gap-1 text-[11px] text-fg-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: cor(tokenDoNo({ kind: "FINDING", risk: s })) }} aria-hidden="true" />
            {ROTULO_RISCO[s]}
          </dt>
          <dd className="font-mono text-base font-semibold text-fg" data-numeric>
            {abertas[s]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PainelAplicacao({ app, aoSelecionar }: { app: AplicacaoExposta; aoSelecionar(id: string): void }) {
  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Aplicação</p>
        <h3 className="break-words text-lg font-semibold text-fg">{app.name}</h3>
        {app.url && <p className="break-all font-mono text-xs text-fg-muted">{app.url}</p>}
        <div className="flex flex-wrap gap-1.5">
          <Badge>{ROTULO_AMBIENTE[app.environment] ?? app.environment}</Badge>
          <Badge tom={app.criticality === "CRITICAL" || app.criticality === "HIGH" ? "atencao" : "neutro"}>
            Criticidade {(ROTULO_CRITICIDADE[app.criticality] ?? app.criticality).toLowerCase()}
          </Badge>
          <Badge>Dados {(SENSIBILIDADE[app.dataSensitivity] ?? app.dataSensitivity).toLowerCase()}</Badge>
          {app.internetFacing && (
            <Badge tom="perigo">
              <Globe className="mr-1 inline h-3 w-3" aria-hidden="true" />
              Exposta à Internet
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-fg-secondary">
          <strong className="text-fg">{app.totalAbertas}</strong> aberta{app.totalAbertas === 1 ? "" : "s"} ·{" "}
          {app.totalResolvidas} resolvida{app.totalResolvidas === 1 ? "" : "s"}
        </p>
        <ContagemPorSeveridade abertas={app.abertas} />
      </div>
      {app.categorias.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Categorias OWASP abertas</p>
          <ul className="space-y-1">
            {app.categorias.map((c) => (
              <li key={c.owaspCategory}>
                <button
                  type="button"
                  onClick={() => aoSelecionar(idDaCategoria(c.owaspCategory))}
                  className="flex w-full items-center justify-between gap-2 rounded-control px-2 py-1 text-left text-sm text-fg hover:bg-inset"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor(tokenDoNo({ kind: "CATEGORY", risk: c.piorSeveridade })) }} aria-hidden="true" />
                    <span className="truncate">{rotuloCategoria(c.owaspCategory)}</span>
                  </span>
                  <span className="font-mono text-xs text-fg-muted" data-numeric>
                    {c.abertas}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {app.principais.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Mais graves em aberto</p>
          <ul className="space-y-1.5">
            {app.principais.map((v) => (
              <li key={v.id} className="flex items-start gap-2">
                <SeverityBadge severidade={v.severityFinal} className="shrink-0" />
                <Link to={`/findings/${v.id}`} className="min-w-0 break-words text-sm text-accent-ink hover:underline">
                  {v.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <LinkButton to={`/applications/${app.id}/dashboard`} variant="secundario" size="sm">
        Abrir dashboard da aplicação
      </LinkButton>
    </>
  );
}

export function PainelExposicao({
  dados,
  selecionadoId,
  aoSelecionar,
}: {
  dados: ExposureGraph;
  selecionadoId: string | null;
  aoSelecionar(id: string): void;
}) {
  const app = dados.aplicacoes.find((a) => idDaAplicacao(a.id) === selecionadoId);
  const categoria = categoriasDaEmpresa(dados.aplicacoes).find((c) => idDaCategoria(c.owaspCategory) === selecionadoId);
  const totalAbertas = dados.aplicacoes.reduce((s, a) => s + a.totalAbertas, 0);
  const expostas = dados.aplicacoes.filter((a) => a.internetFacing);
  const somadas = SEVERIDADES.reduce(
    (acc, s) => ({ ...acc, [s]: dados.aplicacoes.reduce((t, a) => t + a.abertas[s], 0) }),
    {} as Record<SeveridadeVuln, number>,
  );

  return (
    <aside aria-label="Detalhes da seleção" className="space-y-4 rounded-container border border-subtle bg-surface p-4 shadow-raised lg:sticky lg:top-4 lg:self-start">
      {app ? (
        <PainelAplicacao app={app} aoSelecionar={aoSelecionar} />
      ) : categoria ? (
        <>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Categoria OWASP</p>
            <h3 className="text-lg font-semibold text-fg">{rotuloCategoria(categoria.owaspCategory)}</h3>
            <p className="text-sm text-fg-secondary">
              {categoria.abertas} aberta{categoria.abertas === 1 ? "" : "s"} em {categoria.aplicacoes.length} aplicaç
              {categoria.aplicacoes.length === 1 ? "ão" : "ões"}. Pior severidade: {ROTULO_RISCO[categoria.piorSeveridade].toLowerCase()}.
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Aplicações afetadas</p>
            <ul className="space-y-1">
              {categoria.aplicacoes.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => aoSelecionar(idDaAplicacao(a.id))}
                    className="flex w-full items-center justify-between gap-2 rounded-control px-2 py-1 text-left text-sm text-fg hover:bg-inset"
                  >
                    <span className="truncate">{a.name}</span>
                    <span className="font-mono text-xs text-fg-muted" data-numeric>
                      {a.abertas}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-fg-muted">
            A mesma classe de falha em várias aplicações costuma ter a mesma causa (biblioteca, padrão de código, configuração): corrigir na origem
            fecha todas.
          </p>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{selecionadoId === ID_EMPRESA ? "Empresa" : "Resumo"}</p>
            <h3 className="text-lg font-semibold text-fg">
              {dados.aplicacoes.length} aplicaç{dados.aplicacoes.length === 1 ? "ão ativa" : "ões ativas"}
            </h3>
            <p className="text-sm text-fg-secondary">
              {totalAbertas} vulnerabilidade{totalAbertas === 1 ? "" : "s"} em aberto · {expostas.length} exposta{expostas.length === 1 ? "" : "s"} à
              Internet
            </p>
          </div>
          <ContagemPorSeveridade abertas={somadas} />
          <p className="text-xs text-fg-muted">
            Selecione uma aplicação ou categoria para ver o contexto. Os dados são o estado atual das vulnerabilidades gerenciadas (abertas e em
            andamento); achados DAST ainda não triados não entram, porque não têm vínculo com a aplicação antes da promoção.
          </p>
        </>
      )}
    </aside>
  );
}
