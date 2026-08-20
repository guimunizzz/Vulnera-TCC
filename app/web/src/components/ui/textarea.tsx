/**
 * textarea.tsx
 *
 * O QUE FAZ
 * Campo de texto multilinha, com contador de caracteres opcional e crescimento
 * automático de altura.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   ROLE/ARIA — `<textarea>` nativo; rótulo e descritores vêm do `Field`.
 *     O contador é `aria-live="polite"` e só fala quando FALTA POUCO (últimos
 *     10%). Anunciar "428 de 2000" a cada tecla tornaria o campo inutilizável
 *     com leitor de tela; anunciar "restam 40 caracteres" perto do limite é a
 *     única hora em que a informação importa.
 *   TECLADO — nativo. Enter quebra linha (não envia formulário).
 *   FOCO — `:focus-visible` global + mudança de borda.
 *
 * ⚠️ O crescimento automático mede `scrollHeight`, o que força um reflow. Está
 * limitado por `maxLinhas` justamente para não crescer sem fim num campo de
 * descrição de finding colado de um relatório de 300 linhas.
 *
 * QUEM USA
 * Editor de finding (descrição, impacto, recomendação), justificativa de
 * override, comentários.
 */

import { forwardRef, useCallback, useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import { CLASSES_CONTROLE } from "./field";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Mostra "usados / limite" abaixo do campo. Requer `maxLength`. */
  mostrarContador?: boolean;
  /** Cresce com o conteúdo até este número de linhas. */
  maxLinhas?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, mostrarContador, maxLinhas, maxLength, value, onChange, rows = 4, ...props },
  refExterna,
) {
  const refInterna = useRef<HTMLTextAreaElement>(null);
  const ref = (refExterna as React.RefObject<HTMLTextAreaElement>) ?? refInterna;

  const ajustarAltura = useCallback(() => {
    const el = ref.current;
    if (!el || !maxLinhas) return;
    // Zerar antes de medir é obrigatório: `scrollHeight` de um elemento já alto
    // devolve a altura atual, e o campo só cresceria, nunca encolheria.
    el.style.height = "auto";
    const linha = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const teto = linha * maxLinhas;
    el.style.height = `${Math.min(el.scrollHeight, teto)}px`;
    el.style.overflowY = el.scrollHeight > teto ? "auto" : "hidden";
  }, [maxLinhas, ref]);

  useEffect(ajustarAltura, [value, ajustarAltura]);

  const usados = typeof value === "string" ? value.length : 0;
  const restantes = maxLength ? maxLength - usados : Infinity;
  // Só anuncia perto do limite — ver contrato acima.
  const anunciar = maxLength ? restantes <= maxLength * 0.1 : false;

  return (
    <div className="flex flex-col gap-1">
      <textarea
        ref={ref}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => {
          onChange?.(e);
          ajustarAltura();
        }}
        className={cn(CLASSES_CONTROLE, "resize-y py-2 leading-sm", className)}
        {...props}
      />
      {mostrarContador && maxLength && (
        <p
          className={cn("self-end text-xs tabular-nums", restantes <= 0 ? "text-danger-ink" : "text-fg-muted")}
          aria-live={anunciar ? "polite" : "off"}
        >
          {anunciar ? `Restam ${restantes} caracteres` : `${usados} / ${maxLength}`}
        </p>
      )}
    </div>
  );
});
