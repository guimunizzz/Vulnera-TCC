/**
 * cyber-graph-detalhes.tsx
 *
 * O QUE FAZ
 * O que o CyberGraph mostra sobre o nó selecionado: o painel lateral resumido
 * (tipo, severidade, caminho de exposição) e o modal com tudo o que o scan
 * sabe do nó (descrição, solução, evidência, findings abaixo dele).
 *
 * POR QUE EXISTE
 * O 2D e o 3D compartilham a mesma seleção; o detalhe não depende do modo.
 * O modal é só leitura: triagem e promoção continuam na aba Achados, com as
 * permissões que já existem lá.
 *
 * QUEM USA
 * `cyber-graph.tsx`.
 */

import { ListChecks, Maximize2 } from "lucide-react";
import { Badge, SeverityBadge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogClose, DialogFooter, DialogTitle } from "../../components/ui/dialog";
import type { ReactNode } from "react";
import {
  DAST_TRIAGE_LABELS,
  DAST_TRIAGE_TONES,
  type DastFinding,
  type DastRisk,
} from "../../types/dast.types";
import type { Kind2D } from "./graph-2d-layout";
import type { DetalheDoNo } from "./node-detail";

const ROTULO_TIPO: Record<Kind2D, string> = {
  INTERNET: "Exposição",
  ASSET: "Alvo",
  ENDPOINT: "Endpoint",
  GROUP: "Grupo de findings",
  FINDING: "Finding",
};

const RISCOS: DastRisk[] = ["HIGH", "MEDIUM", "LOW", "INFO"];
/** O SeverityBadge usa o vocabulário de Vulnerability; INFO do ZAP é o NONE de lá. */
const SEVERIDADE_DO_RISCO: Record<DastRisk, string> = { HIGH: "HIGH", MEDIUM: "MEDIUM", LOW: "LOW", INFO: "NONE" };

function contarPorRisco(findings: DastFinding[]): Record<DastRisk, number> {
  const contagem: Record<DastRisk, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) contagem[f.risk] += 1;
  return contagem;
}

function ContagemPorRisco({ findings }: { findings: DastFinding[] }) {
  const contagem = contarPorRisco(findings);
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Findings por risco">
      {RISCOS.filter((r) => contagem[r] > 0).map((r) => (
        <li key={r}>
          <SeverityBadge severidade={SEVERIDADE_DO_RISCO[r]} />
          <span className="ml-1 font-mono text-xs text-fg" data-numeric>
            {contagem[r]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function resumo(detalhe: DetalheDoNo, targetUrl: string): string {
  switch (detalhe.kind) {
    case "INTERNET":
      return "Ponto de partida do scan: tudo à direita foi alcançado pelo ZAP a partir da rede, sem acesso interno.";
    case "ASSET":
      return `Alvo do scan (${targetUrl}). ${detalhe.endpoints} endpoint${detalhe.endpoints === 1 ? "" : "s"} com findings.`;
    case "ENDPOINT":
    case "GROUP":
      return `${detalhe.findings.length} finding${detalhe.findings.length === 1 ? "" : "s"} observado${detalhe.findings.length === 1 ? "" : "s"} neste endpoint.`;
    case "FINDING": {
      const texto = detalhe.finding?.description ?? "O ZAP não trouxe descrição para este alerta.";
      return texto.length > 220 ? `${texto.slice(0, 219)}…` : texto;
    }
  }
}

function Selos({ detalhe }: { detalhe: DetalheDoNo }) {
  const f = detalhe.finding;
  if (!detalhe.risk && !f) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {detalhe.risk && <SeverityBadge severidade={SEVERIDADE_DO_RISCO[detalhe.risk]} />}
      {f && <Badge tom={DAST_TRIAGE_TONES[f.triageStatus]}>{DAST_TRIAGE_LABELS[f.triageStatus]}</Badge>}
      {f?.promotedVulnerability && <Badge tom="acento">promovido</Badge>}
    </div>
  );
}

function Campo({ rotulo, children, largo }: { rotulo: string; children: ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase text-fg-muted">{rotulo}</dt>
      <dd className="mt-1 text-sm text-fg">{children}</dd>
    </div>
  );
}

const dataBr = (iso: string) => new Date(iso).toLocaleString("pt-BR");

/* ------------------------------------------------------------------ painel */

export function PainelDoNo({
  detalhe,
  targetUrl,
  totalFindings,
  aoSelecionar,
  aoExpandir,
  aoVerNaLista,
}: {
  detalhe: DetalheDoNo | null;
  targetUrl: string;
  totalFindings: DastFinding[];
  aoSelecionar(id: string): void;
  aoExpandir(): void;
  aoVerNaLista(findingId: string): void;
}) {
  if (!detalhe) {
    return (
      <aside className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-4" aria-label="Detalhes do nó">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Nenhum nó selecionado</p>
        <p className="text-sm text-fg-secondary">
          Clique num nó para ver o caminho de exposição dele. Duplo clique (ou <kbd className="font-mono">Shift+Enter</kbd>) abre os detalhes.
        </p>
        <ContagemPorRisco findings={totalFindings} />
      </aside>
    );
  }

  const f = detalhe.finding;
  return (
    <aside className="flex flex-col gap-3 rounded-container border border-subtle bg-surface p-4" aria-label="Detalhes do nó" aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{ROTULO_TIPO[detalhe.kind]}</p>
      <h3 className="break-words text-lg font-semibold leading-snug text-fg">{detalhe.label}</h3>
      <Selos detalhe={detalhe} />
      <p className="text-sm text-fg-secondary">{resumo(detalhe, targetUrl)}</p>

      {f && (
        <dl className="grid grid-cols-2 gap-3">
          <Campo rotulo="CWE">{f.cweId ? `CWE-${f.cweId}` : "—"}</Campo>
          <Campo rotulo="Confiança">{f.confidence}</Campo>
          <Campo rotulo="Observado em">{dataBr(f.createdAt)}</Campo>
          <Campo rotulo="Parâmetro">
            <span className="break-all font-mono text-xs">{f.param ?? "—"}</span>
          </Campo>
        </dl>
      )}
      {detalhe.url && (
        <dl>
          <Campo rotulo="URL">
            <span className="break-all font-mono text-xs">{detalhe.url}</span>
          </Campo>
        </dl>
      )}
      {!f && detalhe.findings.length > 0 && <ContagemPorRisco findings={detalhe.findings} />}

      <div>
        <p className="text-xs font-medium uppercase text-fg-muted">Caminho de exposição</p>
        <ol className="mt-2 flex flex-col gap-1">
          {detalhe.caminho.map((passo, i) => (
            <li key={passo.id}>
              <button
                type="button"
                onClick={() => aoSelecionar(passo.id)}
                aria-current={passo.id === detalhe.id ? "step" : undefined}
                className="flex w-full items-center gap-2 rounded-control px-1 py-1 text-left text-sm text-fg hover:bg-hovered"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-surface font-mono text-xs text-accent-ink">
                  {i + 1}
                </span>
                <span className={`truncate ${passo.id === detalhe.id ? "font-semibold" : ""}`}>{passo.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={aoExpandir} iconeInicio={<Maximize2 className="h-4 w-4" aria-hidden="true" />}>
          Expandir detalhes
        </Button>
        {f && (
          <Button size="sm" variant="secundario" onClick={() => aoVerNaLista(f.id)} iconeInicio={<ListChecks className="h-4 w-4" aria-hidden="true" />}>
            Triar em Achados
          </Button>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------- modal */

/** Só http(s) vira link: a referência vem do ZAP e não deve virar `javascript:`. */
function Referencias({ texto }: { texto: string }) {
  const linhas = texto.split(/\s+/).filter(Boolean);
  return (
    <ul className="flex flex-col gap-1">
      {linhas.map((linha, i) => (
        <li key={`${linha}-${i}`} className="break-all">
          {/^https?:\/\//i.test(linha) ? (
            <a href={linha} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">
              {linha}
            </a>
          ) : (
            linha
          )}
        </li>
      ))}
    </ul>
  );
}

export function ModalDoNo({
  detalhe,
  aberto,
  targetUrl,
  aoFechar,
  aoSelecionar,
  aoVerNaLista,
}: {
  detalhe: DetalheDoNo | null;
  aberto: boolean;
  targetUrl: string;
  aoFechar(): void;
  aoSelecionar(id: string): void;
  aoVerNaLista(findingId: string): void;
}) {
  const f = detalhe?.finding;
  return (
    <Dialog aberto={aberto && !!detalhe} aoFechar={aoFechar} tamanho="lg" className="relative">
      {detalhe && (
        <>
          {/* Wrapper posicionado: a classe `press` do Button redefine `position`. */}
          <div className="absolute right-4 top-4">
            <DialogClose />
          </div>
          <p className="pr-10 text-xs font-medium uppercase tracking-wide text-fg-muted">{ROTULO_TIPO[detalhe.kind]}</p>
          <DialogTitle className="mt-1 break-words pr-10">{detalhe.label}</DialogTitle>
          <div className="mt-2">
            <Selos detalhe={detalhe} />
          </div>
          <p className="mt-3 text-sm text-fg-secondary">
            {f ? "Detalhes do alerta como o ZAP reportou. Triagem e promoção ficam na aba Achados." : resumo(detalhe, targetUrl)}
          </p>

          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
            {f ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="URL" largo>
                  <span className="break-all font-mono text-xs">{f.url}</span>
                </Campo>
                <Campo rotulo="Parâmetro">
                  <span className="break-all font-mono text-xs">{f.param ?? "—"}</span>
                </Campo>
                <Campo rotulo="Confiança do ZAP">{f.confidence}</Campo>
                <Campo rotulo="CWE">{f.cweId ? `CWE-${f.cweId}` : "—"}</Campo>
                <Campo rotulo="WASC">{f.wascId ?? "—"}</Campo>
                <Campo rotulo="Regra do ZAP">
                  <span className="font-mono text-xs">{f.pluginId}</span>
                </Campo>
                <Campo rotulo="Observado em">{dataBr(f.createdAt)}</Campo>
                <Campo rotulo="Triagem" largo>
                  {DAST_TRIAGE_LABELS[f.triageStatus]}
                  {f.triagedByName && f.triagedAt && ` · por ${f.triagedByName} em ${dataBr(f.triagedAt)}`}
                  {f.triageNote && <span className="mt-1 block whitespace-pre-wrap text-fg-secondary">{f.triageNote}</span>}
                </Campo>
                {f.promotedVulnerability && (
                  <Campo rotulo="Vulnerabilidade" largo>
                    Promovido · severidade {f.promotedVulnerability.severityFinal}, situação {f.promotedVulnerability.status}
                  </Campo>
                )}
                {f.evidence && (
                  <Campo rotulo="Evidência" largo>
                    <span className="block max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-control bg-inset p-2 font-mono text-xs">
                      {f.evidence}
                    </span>
                  </Campo>
                )}
                {f.description && (
                  <Campo rotulo="Descrição" largo>
                    <span className="whitespace-pre-wrap">{f.description}</span>
                  </Campo>
                )}
                {f.solution && (
                  <Campo rotulo="Solução" largo>
                    <span className="whitespace-pre-wrap">{f.solution}</span>
                  </Campo>
                )}
                {f.reference && (
                  <Campo rotulo="Referências" largo>
                    <Referencias texto={f.reference} />
                  </Campo>
                )}
              </dl>
            ) : (
              <div className="flex flex-col gap-4">
                {detalhe.url && (
                  <dl>
                    <Campo rotulo="URL">
                      <span className="break-all font-mono text-xs">{detalhe.url}</span>
                    </Campo>
                  </dl>
                )}
                {detalhe.findings.length > 0 && <ContagemPorRisco findings={detalhe.findings} />}
                {detalhe.findings.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase text-fg-muted">Findings ({detalhe.findings.length})</p>
                    <ul className="mt-2 divide-y divide-subtle rounded-control border border-subtle">
                      {detalhe.findings.map((finding) => (
                        <li key={finding.id}>
                          <button
                            type="button"
                            onClick={() => aoSelecionar(`finding:${finding.id}`)}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-hovered"
                          >
                            <SeverityBadge severidade={SEVERIDADE_DO_RISCO[finding.risk]} className="shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-fg">{finding.title}</span>
                            <span className="hidden max-w-[40%] truncate font-mono text-xs text-fg-muted sm:block">
                              {finding.normalizedUrl}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secundario" onClick={aoFechar}>
              Fechar
            </Button>
            {f && (
              <Button onClick={() => aoVerNaLista(f.id)} iconeInicio={<ListChecks className="h-4 w-4" aria-hidden="true" />}>
                Triar em Achados
              </Button>
            )}
          </DialogFooter>
        </>
      )}
    </Dialog>
  );
}

