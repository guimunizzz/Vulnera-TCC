/**
 * painel-combinacoes.tsx
 *
 * O QUE FAZ
 * Painel lateral das combinações tóxicas (ADR-061): o critério, a lista em
 * ordem de prioridade e, para a combinação escolhida, a CADEIA DE EXPOSIÇÃO —
 * Internet → aplicação → categoria → vulnerabilidade → ameaça — com o dado
 * que comprova cada elo.
 *
 * NOME (D8)
 * "Combinação tóxica" e "cadeia de exposição", nunca "caminho de ataque": o
 * Vulnera prova que os fatores estão juntos, não que um atacante passa por
 * eles. O texto da tela diz isso.
 *
 * QUEM USA
 * `exposure-graph-page.tsx` (modo "Combinações tóxicas").
 */

import { Database, FlaskConical, Globe, Layers, ShieldAlert, Siren, type LucideIcon } from "lucide-react";
import { LinkButton } from "../../../components/ui/button";
import { SeverityBadge } from "../../../components/ui/badge";
import { EmptyState, ErrorState } from "../../../components/ui/empty-state";
import { Skeleton } from "../../../components/ui/card";
import { cn } from "../../../lib/cn";
import type { Agravante, CodigoDoAgravante, CombinacaoToxica, CombinacoesToxicas } from "../../../types/exposure-graph.types";
import { rotuloCategoria, ROTULO_AMBIENTE } from "../exposure-graph-model";

const SENSIBILIDADE: Record<string, string> = { PUBLIC: "pública", INTERNAL: "interna", CONFIDENTIAL: "confidencial", RESTRICTED: "restrita" };

/** Cor do chip por agravante: ameaça e gravidade em tom de perigo, contexto em atenção. */
const TOM: Record<CodigoDoAgravante, string> = {
  INTERNET: "border-warning/50 bg-warning-surface text-warning-ink",
  GRAVE: "border-danger/50 bg-danger-surface text-danger-ink",
  AMEACA_ATIVA: "border-danger/50 bg-danger-surface text-danger-ink",
  DADO_SENSIVEL: "border-warning/50 bg-warning-surface text-warning-ink",
  PRODUCAO: "border-subtle bg-inset text-fg-secondary",
};

export function ChipDeAgravante({ agravante }: { agravante: Agravante }) {
  return (
    <span title={agravante.detalhe} className={cn("inline-flex items-center rounded-full border px-2 py-[0.125rem] text-[11px] font-semibold", TOM[agravante.codigo])}>
      {agravante.rotulo}
    </span>
  );
}

function Elo({ icone: Icone, titulo, detalhe, ultimo = false, perigo = false }: { icone: LucideIcon; titulo: string; detalhe?: string; ultimo?: boolean; perigo?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {/* O traço que liga um elo ao próximo. */}
      {!ultimo && <span aria-hidden="true" className="absolute left-[0.9rem] top-8 h-[calc(100%-1.5rem)] w-px bg-[oklch(var(--color-border-default))]" />}
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[1.75rem] w-[1.75rem] shrink-0 items-center justify-center rounded-full border",
          perigo ? "border-danger bg-danger-surface text-danger-ink" : "border-subtle bg-inset text-accent-ink",
        )}
      >
        <Icone className="h-4 w-4" />
      </span>
      <div className="min-w-0 pt-[0.125rem]">
        <p className="text-sm font-semibold text-fg">{titulo}</p>
        {detalhe && <p className="text-xs text-fg-muted">{detalhe}</p>}
      </div>
    </li>
  );
}

function CadeiaDeExposicao({ combinacao }: { combinacao: CombinacaoToxica }) {
  const { aplicacao: app } = combinacao;
  const ameaca = combinacao.agravantes.find((a) => a.codigo === "AMEACA_ATIVA");
  return (
    <section aria-label="Cadeia de exposição" className="space-y-3 rounded-control border border-subtle bg-inset p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Cadeia de exposição</p>
      <ol>
        <Elo icone={Globe} titulo="Internet" detalhe="A aplicação está exposta à Internet." />
        <Elo
          icone={Database}
          titulo={app.name}
          detalhe={`${ROTULO_AMBIENTE[app.environment] ?? app.environment} · dados ${SENSIBILIDADE[app.dataSensitivity] ?? app.dataSensitivity}`}
        />
        <Elo icone={Layers} titulo={rotuloCategoria(combinacao.owaspCategory)} />
        <Elo icone={ShieldAlert} titulo={combinacao.title} detalhe={combinacao.vrsScore !== null ? `VRS ${combinacao.vrsScore}` : undefined} perigo ultimo={!ameaca} />
        {ameaca && <Elo icone={Siren} titulo={ameaca.rotulo} detalhe={ameaca.detalhe} perigo ultimo />}
      </ol>
      <LinkButton to={`/findings/${combinacao.vulnerabilityId}`} variant="secundario" size="sm">
        Abrir a vulnerabilidade
      </LinkButton>
    </section>
  );
}

export function PainelCombinacoes({
  dados,
  carregando,
  erro,
  aoTentarDeNovo,
  escolhida,
  aoEscolher,
}: {
  dados: CombinacoesToxicas | undefined;
  carregando: boolean;
  erro: string | null;
  aoTentarDeNovo(): void;
  escolhida: string | null;
  aoEscolher(combinacao: CombinacaoToxica): void;
}) {
  const atual = dados?.combinacoes.find((c) => c.vulnerabilityId === escolhida) ?? null;

  return (
    <aside aria-label="Combinações tóxicas" className="space-y-4 rounded-container border border-subtle bg-surface p-4 shadow-raised lg:sticky lg:top-4 lg:self-start">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
          <FlaskConical className="h-4 w-4" aria-hidden="true" /> Combinações tóxicas
        </p>
        <p className="text-sm text-fg-secondary">
          Vulnerabilidades abertas em que fatores perigosos estão <strong className="font-semibold text-fg">juntos</strong>: exposição à
          Internet, gravidade alta ou crítica e pelo menos mais um — exploração conhecida (KEV) ou provável (EPSS), dados sensíveis ou produção.
        </p>
      </div>

      {carregando ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : erro ? (
        <ErrorState descricao={erro} aoTentarNovamente={aoTentarDeNovo} />
      ) : !dados || dados.total === 0 ? (
        <EmptyState titulo="Nenhuma combinação tóxica" descricao="Nenhuma vulnerabilidade aberta junta exposição, gravidade e outro agravante hoje." />
      ) : (
        <>
          {atual && <CadeiaDeExposicao combinacao={atual} />}
          <p className="text-xs text-fg-muted" data-numeric>
            {dados.total} combinaç{dados.total === 1 ? "ão" : "ões"}
            {dados.total > dados.combinacoes.length ? ` · as ${dados.combinacoes.length} mais graves` : ""}
          </p>
          <ol className="space-y-2">
            {dados.combinacoes.map((c, i) => (
              <li key={c.vulnerabilityId}>
                <button
                  type="button"
                  aria-pressed={c.vulnerabilityId === escolhida}
                  onClick={() => aoEscolher(c)}
                  className={cn(
                    "w-full space-y-2 rounded-control border p-3 text-left transition-colors",
                    c.vulnerabilityId === escolhida ? "border-accent bg-accent-surface" : "border-subtle bg-inset hover:border-strong",
                  )}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="mr-1 font-mono text-xs text-fg-muted" data-numeric>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-semibold text-fg">{c.title}</span>
                      <span className="block truncate text-xs text-fg-muted">{c.aplicacao.name}</span>
                    </span>
                    <SeverityBadge severidade={c.severityFinal} />
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {c.agravantes.map((a) => (
                      <ChipDeAgravante key={a.codigo} agravante={a} />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="text-xs text-fg-muted">
        A combinação mostra que os fatores estão juntos, não que um atacante passa por eles: o Vulnera não coleta topologia de rede nem
        permissões, então não afirma caminho de ataque.
      </p>
    </aside>
  );
}
