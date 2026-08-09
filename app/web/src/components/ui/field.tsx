/**
 * field.tsx
 *
 * O QUE FAZ
 * Amarra rótulo, dica e mensagem de erro a um controle de formulário, gerando
 * os ids e os atributos ARIA corretos.
 *
 * POR QUE EXISTE
 * É o erro de acessibilidade mais comum de front-end, e ele é invisível: um
 * `<label>` sem `htmlFor` fica bonito na tela e faz o leitor de tela anunciar
 * "editar texto" sem dizer QUAL campo. A mensagem de erro escrita ao lado do
 * input, sem `aria-describedby`, simplesmente não existe para quem não enxerga.
 *
 * Em vez de confiar que cada tela lembre de `useId` + `htmlFor` +
 * `aria-describedby` + `aria-invalid`, o `Field` faz isso uma vez e entrega os
 * atributos prontos por render prop.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ARIA
 *   - `<label for>` ↔ `id` do controle (gerados por `useId`, únicos por
 *     instância mesmo com dois campos iguais na mesma página).
 *   - `aria-describedby` aponta para a dica E para o erro, nessa ordem.
 *   - `aria-invalid="true"` quando há erro.
 *   - `aria-required` quando obrigatório (além do `required` nativo).
 *   - A mensagem de erro é `role="alert"`: ao aparecer, é anunciada na hora,
 *     sem que a pessoa precise voltar ao campo.
 *
 * VISUAL
 *   Erro NUNCA é comunicado só por cor (WCAG 1.4.1): há ícone, texto e borda.
 *   O asterisco de obrigatório é `aria-hidden` — quem ouve recebe a informação
 *   por `aria-required`, e ouvir "asterisco" não ajuda ninguém.
 * ==========================================================================
 *
 * QUEM USA
 * `Input`, `Textarea`, `Select`, `Combobox`, `Checkbox`, `Radio`, `Switch`,
 * `Slider` e formulários de tela.
 */

import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/** O que o `Field` entrega ao controle. Espalhe direto no elemento. */
export interface AtributosDoControle {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": boolean | undefined;
  "aria-required": boolean | undefined;
  required: boolean | undefined;
}

export interface FieldProps {
  rotulo: ReactNode;
  /** Texto de apoio, abaixo do rótulo. */
  dica?: ReactNode;
  /** Mensagem de erro. Presente = campo inválido. */
  erro?: string | null;
  obrigatorio?: boolean;
  /** Esconde o rótulo visualmente, mantendo-o para leitor de tela. */
  rotuloOculto?: boolean;
  className?: string;
  children: (attrs: AtributosDoControle) => ReactNode;
}

export function Field({ rotulo, dica, erro, obrigatorio, rotuloOculto, className, children }: FieldProps) {
  const base = useId();
  const idControle = `${base}-controle`;
  const idDica = `${base}-dica`;
  const idErro = `${base}-erro`;

  const descritores = [dica ? idDica : null, erro ? idErro : null].filter(Boolean).join(" ");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={idControle} className={cn("text-sm font-medium text-fg", rotuloOculto && "sr-only")}>
        {rotulo}
        {obrigatorio && (
          <span aria-hidden="true" className="ml-1 text-danger-ink">
            *
          </span>
        )}
      </label>

      {dica && (
        <p id={idDica} className="text-xs text-fg-muted">
          {dica}
        </p>
      )}

      {children({
        id: idControle,
        "aria-describedby": descritores || undefined,
        "aria-invalid": erro ? true : undefined,
        "aria-required": obrigatorio || undefined,
        required: obrigatorio || undefined,
      })}

      {erro && (
        <p id={idErro} role="alert" className="flex items-start gap-1 text-xs text-danger-ink">
          {/* Ícone + texto: a cor sozinha não comunica erro (WCAG 1.4.1). */}
          <svg viewBox="0 0 16 16" className="mt-px h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 4.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />
          </svg>
          {erro}
        </p>
      )}
    </div>
  );
}

/**
 * Classes compartilhadas por todo controle de texto (input, textarea, gatilho
 * de select). Centralizadas para que os quatro não divirjam de altura, raio ou
 * cor de borda no primeiro ajuste que alguém fizer em um só.
 */
export const CLASSES_CONTROLE = cn(
  "w-full rounded-control border border-strong bg-inset px-3 text-sm text-fg",
  "placeholder:text-fg-muted",
  "transition-colors duration-fast ease-out",
  "hover:border-accent/60",
  "disabled:cursor-not-allowed disabled:opacity-50",
  // A borda vermelha acompanha o ícone e o texto do erro — nunca sozinha.
  "aria-[invalid=true]:border-danger",
);
