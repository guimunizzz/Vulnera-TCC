/**
 * button.tsx
 *
 * O QUE FAZ
 * O botão do produto: variantes, tamanhos, estado de carregamento e ícone.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   - `<button>` nativo. Sem `role="button"` em `<div>`: o elemento nativo já
 *     traz tipo, foco, ativação por Enter/Espaço e semântica de formulário.
 *   - `aria-busy="true"` enquanto `carregando`.
 *   - `aria-disabled` em vez de `disabled` quando `carregando`: um `disabled`
 *     de verdade tira o botão da ordem de Tab, e o foco da pessoa é jogado para
 *     o body no exato instante em que ela clicou. Com `aria-disabled` o botão
 *     mantém o foco e o clique é ignorado no handler.
 *   - Botão só de ícone EXIGE `rotulo` — vira `aria-label`. Sem texto e sem
 *     rótulo, um leitor de tela anuncia "botão" e mais nada.
 *
 * TECLADO
 *   Tab foca · Enter e Espaço ativam (nativo) · nada mais é interceptado.
 *
 * FOCO
 *   `:focus-visible` global (base.css): anel de 2px na cor de foco, com offset.
 *   Nunca `:focus` — quem clica com mouse não é punido com um anel.
 *
 * LEITOR DE TELA
 *   Anuncia o texto (ou o `rotulo`), o estado desabilitado e, em carregamento,
 *   "ocupado". O spinner é `aria-hidden` — quem ouve não precisa dele, já ouviu
 *   "ocupado".
 *
 * ALVO DE TOQUE
 *   `md` e `lg` alcançam 44px. O `sm` (32px) é menor de propósito, para barra
 *   de ferramentas densa, e usa `::after` invisível para estender a área
 *   CLICÁVEL a 44px sem alterar o layout. Ver `.alvo-estendido` abaixo.
 * ==========================================================================
 *
 * QUEM USA
 * Praticamente toda tela.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

export type VarianteBotao = "primario" | "secundario" | "fantasma" | "destrutivo" | "sutil";
export type TamanhoBotao = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: VarianteBotao;
  size?: TamanhoBotao;
  /** Mostra spinner, bloqueia o clique e anuncia "ocupado". */
  carregando?: boolean;
  /** Ícone antes do texto. */
  iconeInicio?: ReactNode;
  /** Ícone depois do texto. */
  iconeFim?: ReactNode;
  /** Obrigatório quando não há texto visível — vira `aria-label`. */
  rotulo?: string;
  /** Ocupa toda a largura disponível. */
  larguraTotal?: boolean;
  children?: ReactNode;
}

const VARIANTES: Record<VarianteBotao, string> = {
  // Hover sempre se AFASTA do fundo (ver tokens.css §8, bloco de ação).
  primario: "bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active shadow-raised",
  secundario: "bg-raised text-fg border border-strong hover:bg-hovered active:bg-pressed",
  fantasma: "bg-transparent text-fg hover:bg-hovered active:bg-pressed",
  sutil: "bg-transparent text-fg-muted hover:bg-hovered hover:text-fg active:bg-pressed",
  destrutivo: "bg-danger text-danger-fg hover:bg-danger-hover shadow-raised",
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  sm: "h-8 px-3 text-xs gap-1 alvo-estendido",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primario",
    size = "md",
    carregando = false,
    iconeInicio,
    iconeFim,
    rotulo,
    larguraTotal,
    disabled,
    children,
    onClick,
    type = "button",
    ...props
  },
  ref,
) {
  const inativo = disabled || carregando;

  return (
    <button
      ref={ref}
      type={type}
      // `disabled` só quando é desabilitado DE VERDADE. Ver contrato acima.
      disabled={disabled && !carregando}
      aria-disabled={inativo || undefined}
      aria-busy={carregando || undefined}
      aria-label={rotulo}
      onClick={(e) => {
        if (inativo) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cn(
        "press relative inline-flex select-none items-center justify-center rounded-control font-medium",
        "transition-colors duration-fast ease-out",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTES[variant],
        TAMANHOS[size],
        larguraTotal && "w-full",
        className,
      )}
      {...props}
    >
      {carregando && <Spinner />}
      {/* Durante o carregamento o conteúdo fica invisível mas OCUPA o espaço —
          se sumisse, o botão encolheria e a página saltaria. */}
      <span className={cn("inline-flex items-center gap-2", carregando && "invisible")}>
        {iconeInicio && <span aria-hidden="true">{iconeInicio}</span>}
        {children}
        {iconeFim && <span aria-hidden="true">{iconeFim}</span>}
      </span>
    </button>
  );
});

/**
 * Link com aparência de botão.
 *
 * POR QUE EXISTE (e por que não é `<Button asChild>`)
 * O `asChild` do Radix injetava as props do botão no filho via `Slot`. Com o
 * Radix removido (ADR-023), a alternativa seria reimplementar `Slot` — mas o
 * `asChild` sempre foi ambíguo: `<Button asChild><Link>` renderiza um `<a>` que
 * PARECE botão, e quem lê o código precisa ir até o filho para descobrir se
 * aquilo navega ou executa.
 *
 * `LinkButton` diz no nome: navega. E é `<a>` de verdade — abre em nova aba com
 * Ctrl+clique, aparece no menu de contexto, é copiável. Um `<button>` que
 * navega por `onClick` não faz nada disso.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   `<a href>` nativo via `<Link>` do router. Enter ativa (Espaço NÃO — é o
 *   comportamento correto de link, e é assim que a pessoa distingue os dois).
 *   `:focus-visible` global.
 */
export function LinkButton({
  to,
  children,
  variant = "primario",
  size = "md",
  iconeInicio,
  larguraTotal,
  className,
  ...props
}: {
  to: string;
  children: ReactNode;
  variant?: VarianteBotao;
  size?: TamanhoBotao;
  iconeInicio?: ReactNode;
  larguraTotal?: boolean;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "to" | "className" | "children">) {
  return (
    <Link
      to={to}
      className={cn(
        "press inline-flex select-none items-center justify-center gap-2 rounded-control font-medium",
        "transition-colors duration-fast ease-out",
        VARIANTES[variant],
        TAMANHOS[size],
        larguraTotal && "w-full",
        className,
      )}
      {...props}
    >
      {iconeInicio && <span aria-hidden="true">{iconeInicio}</span>}
      {children}
    </Link>
  );
}

/** Spinner do estado de carregamento. `aria-hidden`: `aria-busy` já informou. */
function Spinner() {
  return (
    <span aria-hidden="true" className="absolute inset-0 grid place-items-center">
      {/* `data-motion-essencial`: continua girando mesmo com movimento
          reduzido — ver a exceção em base.css. */}
      <svg viewBox="0 0 16 16" className="h-4 w-4 animate-spin" fill="none" data-motion-essencial>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
        <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
