/**
 * progress.tsx — Progress e Avatar
 *
 * O QUE FAZ
 * Barra de progresso determinada e avatar com iniciais.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * Progress
 *   - `role="progressbar"` + `aria-valuenow/min/max` + `aria-valuetext`.
 *     `aria-valuetext` importa: "68" é lido como um número solto; "68% dos
 *     findings remediados" é a informação.
 *   - `aria-label` obrigatório quando não há rótulo visível.
 *   - A barra NÃO é o único portador do valor — o número aparece ao lado, para
 *     quem não distingue o preenchimento do trilho.
 *
 * Avatar
 *   - Imagem com `alt` = o nome da pessoa.
 *   - Fallback de iniciais é `aria-hidden` e o nome vai num `.sr-only`: "RS"
 *     lido em voz alta não identifica ninguém.
 * ==========================================================================
 *
 * QUEM USA
 * Taxa de remediação nos dashboards (Progress), membros de projeto e autoria de
 * comentário (Avatar).
 */

import { useState } from "react";
import { cn } from "../../lib/cn";

/* ==========================================================================
   Progress
   ========================================================================== */

export interface ProgressProps {
  /** 0 a 100. */
  valor: number;
  /** Rótulo acessível. Obrigatório se não houver rótulo visível ao lado. */
  rotulo: string;
  /** Frase completa lida em voz alta. Sem ela, usa "N por cento". */
  textoDoValor?: string;
  /** Mostra o número ao lado da barra. */
  mostrarValor?: boolean;
  /** Cor da barra. `automatico` pinta por faixa (ver abaixo). */
  tom?: "acento" | "sucesso" | "perigo" | "automatico";
  className?: string;
}

/**
 * No modo `automatico` a cor segue a faixa do valor — usado na taxa de
 * remediação, onde "baixo é ruim". A cor é REFORÇO: o número está sempre
 * visível ao lado, então quem não distingue verde de vermelho lê o valor.
 */
function tomAutomatico(v: number): string {
  if (v >= 70) return "bg-success";
  if (v >= 40) return "bg-warning";
  return "bg-danger";
}

const TONS = { acento: "bg-accent", sucesso: "bg-success", perigo: "bg-danger" } as const;

export function Progress({ valor, rotulo, textoDoValor, mostrarValor, tom = "acento", className }: ProgressProps) {
  const v = Math.min(100, Math.max(0, valor));
  const cor = tom === "automatico" ? tomAutomatico(v) : TONS[tom];

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        role="progressbar"
        aria-label={rotulo}
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={textoDoValor ?? `${Math.round(v)}%`}
        className="h-2 flex-1 overflow-hidden rounded-full bg-inset"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-slow ease-out", cor)}
          style={{ width: `${v}%` }}
        />
      </div>
      {mostrarValor && (
        <span className="w-12 shrink-0 text-right font-mono text-sm text-fg" data-numeric>
          {Math.round(v)}%
        </span>
      )}
    </div>
  );
}

/* ==========================================================================
   Avatar
   ========================================================================== */

/** Iniciais a partir do nome: primeiro + último, no máximo duas letras. */
function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function Avatar({
  nome,
  src,
  tamanho = "md",
  className,
}: {
  nome: string;
  src?: string | null;
  tamanho?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [falhou, setFalhou] = useState(false);
  const dimensoes = { sm: "h-6 w-6 text-xs", md: "h-8 w-8 text-xs", lg: "h-12 w-12 text-sm" }[tamanho];

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-surface font-medium text-accent-ink",
        dimensoes,
        className,
      )}
    >
      {src && !falhou ? (
        <img src={src} alt={nome} onError={() => setFalhou(true)} className="h-full w-full object-cover" />
      ) : (
        <>
          <span aria-hidden="true">{iniciaisDe(nome)}</span>
          <span className="sr-only">{nome}</span>
        </>
      )}
    </span>
  );
}
