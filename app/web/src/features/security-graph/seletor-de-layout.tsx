/**
 * seletor-de-layout.tsx
 *
 * O QUE FAZ
 * Botões de alternância entre os layouts do grafo (a escolha é lembrada por
 * `use-layout-salvo.ts`).
 *
 * POR QUE EXISTE
 * O CyberGraph do scan e o Exposure Graph da empresa oferecem os mesmos
 * layouts; o controle e a memória da escolha são um só para não divergirem.
 *
 * QUEM USA
 * `cyber-graph.tsx` e `exposure-graph.tsx`.
 */

import { Boxes, Columns3, Orbit, Share2, Star, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";
import { LAYOUTS, type LayoutId } from "./graph-layouts";

const ICONE: Record<LayoutId, LucideIcon> = {
  hierarquico: Columns3,
  radial: Orbit,
  estrela: Star,
  organico: Share2,
  clusters: Boxes,
};

export function SeletorDeLayout({
  valor,
  aoMudar,
  disponiveis = LAYOUTS.map((l) => l.id),
}: {
  valor: LayoutId;
  aoMudar(layout: LayoutId): void;
  disponiveis?: LayoutId[];
}) {
  return (
    <div role="group" aria-label="Layout do grafo" className="inline-flex flex-wrap gap-0.5 rounded-control border border-subtle bg-inset p-0.5">
      {LAYOUTS.filter((l) => disponiveis.includes(l.id)).map((l) => {
        const Icone = ICONE[l.id];
        const ativo = valor === l.id;
        return (
          <button
            key={l.id}
            type="button"
            aria-pressed={ativo}
            title={l.descricao}
            onClick={() => aoMudar(l.id)}
            className={cn(
              "alvo-estendido flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-semibold transition-colors",
              ativo ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            <Icone className="h-3.5 w-3.5" aria-hidden="true" />
            {l.nome}
          </button>
        );
      })}
    </div>
  );
}
