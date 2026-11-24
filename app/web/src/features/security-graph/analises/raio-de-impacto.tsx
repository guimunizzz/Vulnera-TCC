/**
 * raio-de-impacto.tsx
 *
 * O QUE FAZ
 * Raio de impacto (ADR-061): escolher um pacote, uma CVE ou uma categoria
 * OWASP e ver onde mais ele aparece. O seletor mora na barra do grafo (com
 * busca); o painel lateral mostra o resumo — "lodash em 4 aplicações, 2
 * expostas" — e a lista, com a exposta e a mais grave primeiro.
 *
 * DE ONDE VEM
 * Pacote e CVE: o estado atual do SCA de cada projeto (última importação de
 * cada ferramenta, sem falso positivo). Categoria: vulnerabilidades abertas
 * gerenciadas. O backend só devolve relações comprovadas (D9).
 *
 * QUEM USA
 * `exposure-graph-page.tsx` (modo "Raio de impacto").
 */

import { Globe, Waypoints } from "lucide-react";
import { Combobox, type OpcaoSelect } from "../../../components/ui";
import { SeverityBadge } from "../../../components/ui/badge";
import { EmptyState, ErrorState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/card";
import type { Impacto, OpcaoDeImpacto, TipoDeImpacto } from "../../../types/exposure-graph.types";
import { idDaAplicacao, ROTULO_AMBIENTE } from "../exposure-graph-model";
import { chaveDoAlvo, ROTULO_TIPO_DE_IMPACTO, rotuloDoAlvo } from "./alvo-de-impacto";


export function SeletorDeImpacto({
  opcoes,
  carregando,
  valor,
  aoMudar,
}: {
  opcoes: OpcaoDeImpacto[] | undefined;
  carregando: boolean;
  valor: string | null;
  aoMudar(chave: string): void;
}) {
  const lista: OpcaoSelect[] = (opcoes ?? []).map((o) => ({
    valor: chaveDoAlvo(o.tipo, o.valor),
    rotulo: `${ROTULO_TIPO_DE_IMPACTO[o.tipo]} · ${rotuloDoAlvo(o.tipo, o.valor)}`,
    sufixo: `${o.aplicacoes} app${o.aplicacoes === 1 ? "" : "s"}`,
  }));
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <Waypoints className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden="true" />
      <Combobox
        opcoes={lista}
        valor={valor}
        aoMudar={aoMudar}
        disabled={carregando}
        placeholder={carregando ? "Carregando alvos…" : "Buscar pacote, CVE ou categoria…"}
        textoVazio="Nenhum pacote, CVE ou categoria com esse nome"
        aria-label="Alvo do raio de impacto"
        className="min-w-0 flex-1"
      />
    </div>
  );
}

export function PainelImpacto({
  alvo,
  dados,
  carregando,
  erro,
  aoTentarDeNovo,
  aoSelecionar,
}: {
  alvo: { tipo: TipoDeImpacto; valor: string } | null;
  dados: Impacto | undefined;
  carregando: boolean;
  erro: string | null;
  aoTentarDeNovo(): void;
  aoSelecionar(id: string): void;
}) {
  return (
    <aside aria-label="Raio de impacto" className="space-y-4 rounded-container border border-subtle bg-surface p-4 shadow-raised lg:sticky lg:top-4 lg:self-start">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
          <Waypoints className="h-4 w-4" aria-hidden="true" /> Raio de impacto
        </p>
        {alvo ? (
          <h3 className="break-words text-lg font-semibold text-fg">
            <span className="mr-1 text-sm font-medium text-fg-muted">{ROTULO_TIPO_DE_IMPACTO[alvo.tipo]}</span>
            {rotuloDoAlvo(alvo.tipo, alvo.valor)}
          </h3>
        ) : (
          <p className="text-sm text-fg-secondary">
            Escolha um pacote, uma CVE ou uma categoria OWASP na barra do grafo para ver em quantas aplicações ele aparece hoje.
          </p>
        )}
      </div>

      {!alvo ? null : carregando ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : erro ? (
        <ErrorState descricao={erro} aoTentarNovamente={aoTentarDeNovo} />
      ) : !dados || dados.resumo.aplicacoes === 0 ? (
        <EmptyState titulo="Nenhuma aplicação atingida" descricao="O alvo não aparece em nenhuma aplicação ativa hoje." />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2">
            {[
              ["Aplicações", dados.resumo.aplicacoes],
              ["Expostas", dados.resumo.expostas],
              ["Em produção", dados.resumo.emProducao],
            ].map(([rotulo, n]) => (
              <div key={rotulo} className="rounded-control border border-subtle bg-inset px-2 py-2 text-center">
                <dt className="text-[11px] text-fg-muted">{rotulo}</dt>
                <dd className="font-mono text-base font-semibold text-fg" data-numeric>
                  {n}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-2">
            {dados.aplicacoes.map((app) => (
              <li key={app.id}>
                <button
                  type="button"
                  onClick={() => aoSelecionar(idDaAplicacao(app.id))}
                  className="w-full space-y-1 rounded-control border border-subtle bg-inset p-3 text-left transition-colors hover:border-strong"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1 text-sm font-semibold text-fg">
                      {app.internetFacing && <Globe className="h-4 w-4 shrink-0 text-warning-ink" aria-label="Exposta à Internet" />}
                      <span className="truncate">{app.name}</span>
                    </span>
                    {app.piorSeveridade && <SeverityBadge severidade={app.piorSeveridade} />}
                  </span>
                  <span className="block text-xs text-fg-muted">
                    {ROTULO_AMBIENTE[app.environment] ?? app.environment} · {app.ocorrencias} ocorrência{app.ocorrencias === 1 ? "" : "s"}
                  </span>
                  {app.detalhes.length > 0 && (
                    <span className="block truncate font-mono text-xs text-fg-secondary" title={app.detalhes.join(", ")}>
                      {app.detalhes.join(", ")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
