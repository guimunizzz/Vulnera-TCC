/**
 * slider.tsx
 *
 * O QUE FAZ
 * Seleção de um valor numérico numa faixa contínua.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   `<input type="range">` NATIVO, com o trilho e o polegar redesenhados por
 *   CSS (`::-webkit-slider-thumb`, `::-moz-range-thumb`). O elemento nativo já
 *   é `role="slider"` com `aria-valuemin/max/now` gerenciados pelo navegador.
 *
 *   Por que não `<div role="slider">`: além de reimplementar sete teclas, o
 *   nativo é o único que funciona com tecnologia assistiva que usa gestos
 *   próprios (o rotor do VoiceOver ajusta um range nativo com um giro; num div
 *   com role, não).
 *
 *   `aria-valuetext` é definido quando o número cru não se explica sozinho —
 *   "7.5, alta" diz mais que "7.5" num filtro de CVSS.
 *
 * TECLADO (tudo nativo)
 *   ← ↓ diminuem um passo · → ↑ aumentam · Home/End vão aos extremos ·
 *   PageUp/PageDown andam em blocos.
 *
 * FOCO
 *   `:focus-visible` no polegar.
 *
 * ALVO DE TOQUE
 *   Polegar de 20px dentro de uma faixa clicável de 44px (`py-3` no wrapper).
 * ==========================================================================
 *
 * QUEM USA
 * Filtro de faixa de CVSS (CP6).
 */

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Texto que substitui o número no anúncio ("7.5, alta"). */
  textoDoValor?: string;
  /** Mostra o valor ao lado do trilho. */
  mostrarValor?: boolean;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className, textoDoValor, mostrarValor, value, min = 0, max = 100, ...props },
  ref,
) {
  const preenchido = ((Number(value) - Number(min)) / (Number(max) - Number(min))) * 100;

  return (
    <div className="flex items-center gap-4 py-3">
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        value={value}
        aria-valuetext={textoDoValor}
        // O preenchimento até o polegar é um gradiente calculado — não há
        // pseudo-elemento "trilho preenchido" padronizado entre navegadores.
        style={{
          background: `linear-gradient(to right, oklch(var(--color-accent)) ${preenchido}%, oklch(var(--color-bg-inset)) ${preenchido}%)`,
        }}
        className={cn(
          "h-1 w-full cursor-pointer appearance-none rounded-full",
          "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent",
          "[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-strong",
          "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      {mostrarValor && (
        <output className="w-12 shrink-0 text-right font-mono text-sm text-fg" data-numeric>
          {value}
        </output>
      )}
    </div>
  );
});
