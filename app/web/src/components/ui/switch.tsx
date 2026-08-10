/**
 * switch.tsx
 *
 * O QUE FAZ
 * Interruptor de dois estados, com efeito imediato.
 *
 * QUANDO USAR — E QUANDO NÃO
 * `Switch` é para o que acontece NA HORA ("comparar com período anterior",
 * "mostrar resolvidos"). Se a escolha só vale depois de um "Salvar", use
 * `Checkbox`: o interruptor promete efeito imediato, e quebrar essa promessa
 * faz a pessoa achar que o clique não funcionou.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE/ARIA
 *   `<button role="switch">` com `aria-checked`. Não é `<input type=checkbox>`
 *   porque o leitor de tela anunciaria "caixa de seleção, marcada" — e a
 *   promessa de um switch é outra. Com `role="switch"` o anúncio é "ativado" /
 *   "desativado", que é o que a pessoa precisa ouvir.
 *   `aria-labelledby` aponta para o rótulo visível.
 *
 * TECLADO
 *   Tab foca · Enter e Espaço alternam (nativo de `<button>`).
 *
 * FOCO
 *   `:focus-visible` global, no próprio trilho.
 *
 * ALVO DE TOQUE
 *   Linha de 44px; o rótulo também alterna, ampliando a área.
 *
 * ESTADO SEM COR
 *   O polegar MUDA DE POSIÇÃO, não só de cor — para daltônicos e para monitores
 *   ruins, a posição é a informação (WCAG 1.4.1).
 * ==========================================================================
 *
 * QUEM USA
 * Barra de filtros (CP6), preferências.
 */

import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (valor: boolean) => void;
  rotulo: ReactNode;
  descricao?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, rotulo, descricao, disabled, className }: SwitchProps) {
  const idRotulo = useId();

  return (
    <div className={cn("flex min-h-touch items-center justify-between gap-4", className)}>
      <span className="flex flex-col gap-1">
        <span id={idRotulo} className="text-sm text-fg">
          {rotulo}
        </span>
        {descricao && <span className="text-xs text-fg-muted">{descricao}</span>}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={idRotulo}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full border border-strong",
          "transition-colors duration-fast ease-out",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "border-accent bg-accent" : "bg-inset",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full shadow-raised",
            "transition-[left,background-color] duration-fast ease-out",
            checked ? "left-5 bg-accent-fg" : "left-1 bg-fg-muted",
          )}
        />
      </button>
    </div>
  );
}
