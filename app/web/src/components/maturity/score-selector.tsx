/**
 * score-selector.tsx
 *
 * Seletor de resposta 1-5 do checklist de maturidade. `role="radiogroup"` com
 * 5 botões `role="radio"` — mesma semântica de um grupo de rádio nativo, só
 * que com aparência de segmented control (o rádio nativo não dá pra estilizar
 * em linha sem reimplementar metade do CSS de qualquer forma).
 *
 * Desabilitado (`somenteLeitura`) para quem só pode LER a avaliação
 * (CLIENT/PENTESTER — RN19).
 */

import { cn } from "../../lib/cn";

const OPCOES = [1, 2, 3, 4, 5] as const;

export interface ScoreSelectorProps {
  value: number | null;
  onChange: (score: number) => void;
  somenteLeitura?: boolean;
  /** Rótulo da pergunta — vira `aria-label` do grupo. */
  rotulo: string;
}

export function ScoreSelector({ value, onChange, somenteLeitura, rotulo }: ScoreSelectorProps) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex gap-2">
      {OPCOES.map((n) => {
        const selecionado = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={selecionado}
            disabled={somenteLeitura}
            onClick={() => onChange(n)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-control border text-sm font-semibold transition-colors duration-fast",
              selecionado
                ? "border-accent bg-accent text-accent-fg"
                : "border-subtle bg-surface text-fg hover:bg-hovered",
              somenteLeitura && "pointer-events-none opacity-60",
            )}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
