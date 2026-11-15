/**
 * boletim.tsx
 *
 * O cabeçalho da Threat Intel (ADR-053) como boletim de estado: o título é a
 * RESPOSTA da página ("62 CVEs críticas ou altas afetam 41 tecnologias da
 * TechNova"), com os números reais, e não um slogan. Abaixo, a distribuição das
 * CVEs em aberto por severidade e a saúde de cada fonte na última sincronização
 * completa. A exploração ativa (KEV), quando existe, é a primeira coisa do
 * texto, na cor de perigo.
 */

import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import { SeverityStrip } from "../code-imports/severity-strip";
import { cn } from "../../lib/cn";
import { haQuanto } from "../../lib/threat-intel";
import type { ExecucaoSync, ResumoTI } from "../../types/threat-intel.types";

const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

/** As quatro fontes como a pessoa as conhece; o NVD junta o feed e a consulta por produto. */
const FONTES: { rotulo: string; chaves: string[] }[] = [
  { rotulo: "CISA KEV", chaves: ["KEV"] },
  { rotulo: "NVD", chaves: ["NVD_FEED", "NVD_PRODUTOS"] },
  { rotulo: "OSV", chaves: ["OSV"] },
  { rotulo: "FIRST EPSS", chaves: ["EPSS"] },
];

function SaudeDasFontes({ execucao }: { execucao: ExecucaoSync | null }) {
  if (!execucao) return <p className="text-sm text-fg-muted">A primeira sincronização ainda não rodou: ela começa 1 minuto depois de a API subir.</p>;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <span className="text-fg-muted">Sincronizado {haQuanto(execucao.finishedAt ?? execucao.startedAt)}</span>
      <ul className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Situação das fontes na última sincronização">
        {FONTES.map((f) => {
          const resultados = f.chaves.map((k) => execucao.sources[k]).filter(Boolean);
          const falhou = resultados.find((r) => !r!.ok);
          const consultada = resultados.length > 0;
          return (
            <li key={f.rotulo} className="flex items-center gap-2" title={falhou?.erro ?? (consultada ? undefined : "Nada a atualizar nesta execução")}>
              {/* Fonte sem consulta na execução (nada a atualizar, ex.: EPSS já recente) é anel neutro, não falha. */}
              <span
                aria-hidden="true"
                className={cn("h-2 w-2 rounded-full", !consultada ? "border border-strong" : falhou ? "bg-danger" : "bg-success")}
              />
              <span className={cn(falhou ? "text-danger-ink" : consultada ? "text-fg-secondary" : "text-fg-muted")}>{f.rotulo}</span>
              <span className="sr-only">{!consultada ? "nada a atualizar nesta execução" : falhou ? `indisponível: ${falhou.erro}` : "ok"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Boletim({ resumo, empresa, seletor }: { resumo: ResumoTI | undefined; empresa: string | null; seletor?: ReactNode }) {
  const c = resumo?.casamentos;
  const graves = c?.criticosAbertos ?? 0;
  const vigiadas = resumo?.inventario.confirmados ?? 0;
  const deQuem = empresa ? ` da ${empresa}` : "";

  let titulo: string;
  if (!resumo) titulo = "Threat Intel";
  else if (vigiadas === 0) titulo = `Nenhuma tecnologia${deQuem} sob vigilância ainda`;
  else if (graves === 0) titulo = `Nenhuma CVE crítica ou alta afeta as tecnologias${deQuem}`;
  else titulo = `${plural(graves, "CVE crítica ou alta afeta", "CVEs críticas ou altas afetam")} ${plural(c!.tecnologiasAfetadas, "tecnologia", "tecnologias")}${deQuem}`;

  const porSeveridade = c?.abertosPorSeveridade ?? {};
  const contagens = {
    CRITICAL: porSeveridade.CRITICAL ?? 0,
    HIGH: porSeveridade.HIGH ?? 0,
    MEDIUM: porSeveridade.MEDIUM ?? 0,
    LOW: porSeveridade.LOW ?? 0,
    INFO: (porSeveridade.NONE ?? 0) + (porSeveridade.null ?? 0),
  };

  return (
    <header data-ops-hero="threat" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">Threat Intelligence</p>
          <h1 className="text-balance text-2xl font-bold text-fg sm:text-3xl">{titulo}</h1>
          {resumo && (
            <p className="mt-2 max-w-[62ch] text-fg-secondary">
              {c!.kevAbertos > 0 && (
                <strong className="mr-1 inline-flex items-center gap-1 font-semibold text-danger-ink">
                  <Flame size={16} aria-hidden="true" />
                  {plural(c!.kevAbertos, "está sendo explorada", "estão sendo exploradas")} ativamente (CISA KEV).
                </strong>
              )}
              {vigiadas === 0
                ? "Adicione as bibliotecas e os produtos que a empresa usa, ou confirme as sugestões vindas dos SBOMs e dos scans: o Vulnera passa a cruzar cada um com as CVEs publicadas."
                : `${c!.kevAbertos === 0 && graves > 0 ? "Nenhuma está sendo explorada ativamente. " : ""}${plural(c!.novosSemana, "foi publicada", "foram publicadas")} nos últimos 7 dias, depois do mapeamento. O inventário vigia ${plural(vigiadas, "tecnologia", "tecnologias")}${resumo.inventario.sugeridos > 0 ? ` e tem ${plural(resumo.inventario.sugeridos, "sugestão", "sugestões")} para confirmar` : ""}.`}
            </p>
          )}
        </div>
        {seletor}
      </div>
      {resumo && vigiadas > 0 && <SeverityStrip counts={contagens} legenda className="max-w-2xl" />}
      {resumo && <SaudeDasFontes execucao={resumo.ultimaExecucao} />}
    </header>
  );
}
