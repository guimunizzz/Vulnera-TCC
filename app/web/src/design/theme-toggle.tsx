/**
 * theme-toggle.tsx
 *
 * O QUE FAZ
 * O controle de troca de tema: três opções (Escuro, Claro, Sistema) num grupo
 * de botões.
 *
 * POR QUE TRÊS BOTÕES E NÃO UM INTERRUPTOR
 * Um interruptor só tem dois estados, e "Sistema" é um terceiro estado
 * legítimo e diferente — não é "claro" nem "escuro", é "siga o SO". Interruptor
 * de dois estados que na verdade tem três é a origem do bug clássico "escolhi
 * claro, mas de noite virou escuro sozinho".
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - `role="radiogroup"` com `aria-label="Tema"`; cada opção é
 *     `role="radio"` + `aria-checked`.
 *   - Roving tabindex: Tab entra no grupo uma vez; ← → andam entre as opções.
 *   - O ícone é `aria-hidden`; o nome do tema é texto de verdade (em telas
 *     largas) ou `.sr-only` (em telas estreitas).
 *
 * QUEM USA
 * `AppLayout` (barra superior) e `/styleguide`.
 */

import { useRef } from "react";
import { cn } from "../lib/cn";
import { useTheme } from "./theme-provider";
import { ROTULO_TEMA, TEMAS, type Theme } from "./theme";

const ICONE: Record<Theme, JSX.Element> = {
  dark: (
    <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
  ),
  light: (
    <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0-9.5v2m0 10v2M2.6 2.6l1.4 1.4m8 8 1.4 1.4M1.5 8h2m9 0h2M2.6 13.4l1.4-1.4m8-8 1.4-1.4" />
  ),
  system: (
    <path d="M2 3.5h12v7H2v-7Zm4 9h4m-2-2v2" />
  ),
};

export function ThemeToggle({ compacto = false }: { compacto?: boolean }) {
  const { tema, definirTema } = useTheme();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const indiceAtual = TEMAS.indexOf(tema);

  const aoTeclar = (e: React.KeyboardEvent) => {
    let alvo = -1;
    if (e.key === "ArrowRight") alvo = (indiceAtual + 1) % TEMAS.length;
    else if (e.key === "ArrowLeft") alvo = (indiceAtual - 1 + TEMAS.length) % TEMAS.length;
    if (alvo < 0) return;
    e.preventDefault();
    // Em radiogroup a seta JÁ seleciona (diferente das Tabs, onde a seleção
    // dispara requisições e por isso é manual). Trocar de tema é barato.
    definirTema(TEMAS[alvo]);
    refs.current[alvo]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      onKeyDown={aoTeclar}
      className="inline-flex items-center gap-1 rounded-control border border-subtle bg-inset p-1"
    >
      {TEMAS.map((t, i) => {
        const ativo = t === tema;
        return (
          <button
            key={t}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={ativo}
            tabIndex={ativo ? 0 : -1}
            onClick={() => definirTema(t)}
            className={cn(
              "alvo-estendido flex items-center gap-2 rounded-control px-2 py-1 text-xs font-medium",
              "transition-colors duration-fast ease-out",
              ativo ? "bg-raised text-fg shadow-raised" : "text-fg-muted hover:text-fg",
            )}
          >
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill={t === "dark" ? "currentColor" : "none"}
              stroke={t === "dark" ? "none" : "currentColor"}
              strokeWidth="1.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {ICONE[t]}
            </svg>
            <span className={cn(compacto && "sr-only")}>{ROTULO_TEMA[t]}</span>
          </button>
        );
      })}
    </div>
  );
}
