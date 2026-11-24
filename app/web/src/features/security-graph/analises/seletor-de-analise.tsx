/**
 * seletor-de-analise.tsx
 *
 * Os modos do Exposure Graph (ADR-061): a visão atual e as três análises.
 * Mesmo desenho do seletor de layout (grupo de botões com `aria-pressed`).
 *
 * QUEM USA
 * `exposure-graph-page.tsx`, dentro da barra de análise do grafo.
 */

import { Clock3, FlaskConical, Radar, Waypoints, type LucideIcon } from "lucide-react";
import { cn } from "../../../lib/cn";

export type ModoDeAnalise = "atual" | "toxicas" | "impacto" | "tempo";

const MODOS: Array<{ id: ModoDeAnalise; nome: string; descricao: string; icone: LucideIcon }> = [
  { id: "atual", nome: "Visão atual", descricao: "O estado de hoje", icone: Radar },
  { id: "toxicas", nome: "Combinações tóxicas", descricao: "Onde fatores perigosos estão juntos na mesma vulnerabilidade", icone: FlaskConical },
  { id: "impacto", nome: "Raio de impacto", descricao: "Onde mais um pacote, CVE ou categoria aparece", icone: Waypoints },
  { id: "tempo", nome: "Máquina do tempo", descricao: "O grafo como ele era num dia passado", icone: Clock3 },
];

export function SeletorDeAnalise({ valor, aoMudar }: { valor: ModoDeAnalise; aoMudar(modo: ModoDeAnalise): void }) {
  return (
    <div role="group" aria-label="Análise do grafo" className="inline-flex flex-wrap gap-1 rounded-control border border-subtle bg-inset p-1">
      {MODOS.map((m) => {
        const Icone = m.icone;
        const ativo = valor === m.id;
        return (
          <button
            key={m.id}
            type="button"
            aria-pressed={ativo}
            title={m.descricao}
            onClick={() => aoMudar(m.id)}
            className={cn(
              "alvo-estendido flex items-center gap-2 rounded-control px-3 py-1 text-xs font-semibold transition-colors",
              ativo ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            <Icone className="h-4 w-4" aria-hidden="true" />
            {m.nome}
          </button>
        );
      })}
    </div>
  );
}
