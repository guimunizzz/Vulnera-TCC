/**
 * input.tsx
 *
 * O QUE FAZ
 * Campo de texto de uma linha, com afixos opcionais (ícone/unidade) e variante
 * monoespaçada para dado técnico.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   ROLE/ARIA — `<input>` nativo. Rótulo, `aria-describedby` e `aria-invalid`
 *     vêm do `Field` (ver field.tsx); este componente não os inventa.
 *     Afixos são `aria-hidden`: são decoração visual do valor, e um leitor de
 *     tela que anunciasse "lupa" antes de cada busca só atrapalharia.
 *   TECLADO — comportamento nativo de campo de texto, sem interceptação.
 *   FOCO — `:focus-visible` global; a borda também muda, para quem enxerga.
 *   ALVO — 40px de altura (`h-10`); com o rótulo clicável do `Field`, a área
 *     efetiva passa de 44px.
 *
 * `mono` — obrigatória em vetor CVSS, id e qualquer coisa que a pessoa vá
 * conferir caractere a caractere. É onde `0`/`O` e `1`/`l` precisam se separar.
 *
 * QUEM USA
 * Login, Register, filtros, editor de finding, busca.
 */

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { CLASSES_CONTROLE } from "./field";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Ícone ou texto à esquerda (lupa, "R$"). */
  prefixo?: ReactNode;
  /** Ícone ou texto à direita (unidade, botão de limpar). */
  sufixo?: ReactNode;
  /** Fonte monoespaçada — para dado conferido caractere a caractere. */
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, prefixo, sufixo, mono, ...props },
  ref,
) {
  const campo = (
    <input
      ref={ref}
      className={cn(
        CLASSES_CONTROLE,
        "h-10",
        mono && "font-mono",
        prefixo && "pl-10",
        sufixo && "pr-10",
        className,
      )}
      {...props}
    />
  );

  if (!prefixo && !sufixo) return campo;

  return (
    <div className="relative">
      {prefixo && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 grid -translate-y-1/2 place-items-center text-fg-muted"
        >
          {prefixo}
        </span>
      )}
      {campo}
      {/* O sufixo NÃO leva `pointer-events-none`: às vezes é um botão de
          limpar, que precisa ser clicável. Quando é só decoração, quem chama
          passa um ícone e o clique cai no espaço vazio, sem prejuízo. */}
      {sufixo && (
        <span className="absolute right-3 top-1/2 grid -translate-y-1/2 place-items-center text-fg-muted">{sufixo}</span>
      )}
    </div>
  );
});
