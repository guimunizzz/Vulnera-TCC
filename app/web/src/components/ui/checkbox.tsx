/**
 * checkbox.tsx — Checkbox e Radio
 *
 * O QUE FAZ
 * Caixa de seleção e botão de opção, com estado indeterminado no checkbox.
 *
 * POR QUE OS DOIS NO MESMO ARQUIVO
 * São o mesmo componente com `type` e formato diferentes: mesma estrutura,
 * mesmo contrato de acessibilidade, mesmos estados visuais. Separá-los
 * duplicaria 40 linhas idênticas que passariam a divergir na primeira correção.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE/ARIA
 *   `<input type="checkbox">` / `<input type="radio">` NATIVOS, visualmente
 *   escondidos por `.sr-only` e desenhados por um `<span>` irmão. O input real
 *   continua no DOM, no fluxo de foco e no formulário.
 *
 *   Por que não `<div role="checkbox">`: além de exigir reimplementar Espaço,
 *   estado e `aria-checked`, um `role` falso não participa de `<form>`, não é
 *   preenchido pelo autofill e não aparece na validação nativa. O nativo
 *   escondido dá tudo isso de graça.
 *
 *   Indeterminado: `input.indeterminate = true` via ref (não existe como
 *   atributo JSX) + `aria-checked="mixed"`. É o estado do "selecionar tudo"
 *   quando só parte da tabela está marcada.
 *
 * TECLADO
 *   Checkbox: Tab foca · Espaço alterna.
 *   Radio: Tab entra no GRUPO (só um radio do grupo é focável) · setas movem
 *   entre as opções e já selecionam. Comportamento nativo — não interceptamos.
 *
 * FOCO
 *   O input escondido recebe o foco; o anel é desenhado no `<span>` visível via
 *   `peer-focus-visible`. Sem isso o anel apareceria num elemento de 1px.
 *
 * ALVO DE TOQUE
 *   O `<label>` inteiro é clicável e tem no mínimo 44px de altura.
 * ==========================================================================
 *
 * QUEM USA
 * Filtros multi-seleção (CP6), seleção de linhas da `Table`, formulários.
 */

import { forwardRef, useEffect, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface BaseProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  rotulo: ReactNode;
  /** Texto de apoio abaixo do rótulo. */
  descricao?: ReactNode;
}

export interface CheckboxProps extends BaseProps {
  /** Nem marcado nem desmarcado — "alguns selecionados". */
  indeterminado?: boolean;
}

const CAIXA = cn(
  "grid h-5 w-5 shrink-0 place-items-center border border-strong bg-inset text-accent-fg",
  "transition-[background-color,border-color] duration-fast ease-out",
  "peer-hover:border-accent",
  "peer-checked:border-accent peer-checked:bg-accent",
  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
  "peer-disabled:opacity-50",
);

const LINHA = "flex min-h-touch cursor-pointer items-start gap-3 py-2 has-[:disabled]:cursor-not-allowed";

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { rotulo, descricao, indeterminado, className, checked, ...props },
  refExterna,
) {
  const refInterna = useRef<HTMLInputElement>(null);
  const ref = (refExterna as React.RefObject<HTMLInputElement>) ?? refInterna;

  // `indeterminate` só existe como propriedade do elemento, nunca como
  // atributo HTML — não há como setá-lo pelo JSX.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminado);
  }, [indeterminado, ref]);

  return (
    <label className={cn(LINHA, className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        aria-checked={indeterminado ? "mixed" : undefined}
        className="peer sr-only"
        {...props}
      />
      {/* `peer-checked:[&>svg]:opacity-100` e não `peer-checked:opacity-100` no
          próprio svg: as variantes `peer-*` do Tailwind só alcançam IRMÃOS do
          peer. O svg é neto — precisa ser endereçado a partir do irmão. */}
      <span
        className={cn(
          CAIXA,
          "rounded-control [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
          indeterminado && "border-accent bg-accent",
        )}
        aria-hidden="true"
      >
        {indeterminado ? (
          <span className="h-px w-3 bg-current" />
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm text-fg">{rotulo}</span>
        {descricao && <span className="text-xs text-fg-muted">{descricao}</span>}
      </span>
    </label>
  );
});

export type RadioProps = BaseProps;

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { rotulo, descricao, className, ...props },
  ref,
) {
  return (
    <label className={cn(LINHA, className)}>
      <input ref={ref} type="radio" className="peer sr-only" {...props} />
      <span className={cn(CAIXA, "rounded-full peer-checked:[&>span]:scale-100")} aria-hidden="true">
        <span className="h-2 w-2 scale-0 rounded-full bg-current transition-transform duration-fast" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm text-fg">{rotulo}</span>
        {descricao && <span className="text-xs text-fg-muted">{descricao}</span>}
      </span>
    </label>
  );
});

/**
 * Agrupador de `Radio`.
 *
 * `role="radiogroup"` + `aria-labelledby` é o que faz o leitor de tela anunciar
 * "Ambiente, grupo de opções, 1 de 3" em vez de três rádios soltos sem contexto.
 * O `name` compartilhado é o que faz as setas navegarem entre eles.
 */
export function RadioGroup({
  rotulo,
  children,
  className,
}: {
  rotulo: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-1", className)}>
      <legend className="mb-2 text-sm font-medium text-fg">{rotulo}</legend>
      {children}
    </fieldset>
  );
}
