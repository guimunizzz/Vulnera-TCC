/**
 * glitch-text.tsx
 *
 * O QUE FAZ
 * Texto com efeito de glitch (duplicata RGB-split via `::before`/`::after`,
 * ver `landing.css`). Duas variantes: `auto` dispara sozinho em loop (headline
 * do hero, badges CRITICAL/HIGH do mockup de risk score); `hover` só corre em
 * resposta a hover/foco (título de card de feature, CTA).
 *
 * POR QUE `data-text` E NÃO SÓ CSS EM CIMA DO `children`
 * O truque de RGB-split precisa que `::before`/`::after` tenham o MESMO texto
 * do elemento real, deslocado e recolorido. CSS não lê o texto de dentro do
 * elemento para um pseudo-elemento — só `content: attr(...)`. Por isso o
 * texto entra duas vezes: uma vez normal (o que o leitor de tela e o SEO
 * veem) e uma vez em `data-text` (o que os pseudo-elementos decorativos
 * espelham). Os pseudo-elementos são puramente visuais — não têm texto
 * próprio acessível, então não duplicam nada para quem usa leitor de tela.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * O texto real (não decorativo) é o único conteúdo textual — os
 * `::before`/`::after` de `landing.css` não têm `content` próprio fora do
 * `attr(data-text)` puramente visual, e o elemento em si não ganha `aria-*`
 * extra: um leitor de tela lê exatamente o texto normal, uma vez.
 * `prefers-reduced-motion: reduce` zera as duas variantes (ver `landing.css`).
 * ==========================================================================
 *
 * QUEM USA
 * `landing-page.tsx` (headline do hero, títulos de feature card, badges de
 * severidade do mockup de risk score).
 */

import { cn } from "../../lib/cn";

export interface GlitchTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "span" | "div";
  /** `auto` = loop contínuo · `hover` = só em hover/foco. */
  variante?: "auto" | "hover";
  className?: string;
}

export function GlitchText({ text, as: Tag = "span", variante = "auto", className }: GlitchTextProps) {
  return (
    <Tag
      className={cn("glitch-text", variante === "auto" ? "glitch-text--auto" : "glitch-text--hover", className)}
      data-text={text}
    >
      {text}
    </Tag>
  );
}
