/**
 * navigation.tsx — Breadcrumb, Pagination e ScrollArea
 *
 * O QUE FAZ
 * As três peças de "onde estou / como ando": trilha de navegação, paginação e
 * área rolável com sombras de borda.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * Breadcrumb
 *   - `<nav aria-label="Trilha de navegação">` com `<ol>`: a ordem importa, e a
 *     lista ordenada é o que faz o leitor anunciar "1 de 4".
 *   - O item atual leva `aria-current="page"` e NÃO é link — um link para a
 *     página em que já se está é uma armadilha.
 *   - Os separadores são `aria-hidden`: "barra" repetida três vezes é ruído.
 *
 * Pagination
 *   - `<nav aria-label="Paginação">`.
 *   - Cada botão de página diz "Página 3" no `aria-label`; o número sozinho não
 *     tem contexto.
 *   - A página atual leva `aria-current="page"`.
 *   - A faixa exibida é anunciada por `aria-live="polite"` ao mudar — senão,
 *     clicar em "próxima" é um evento silencioso.
 *
 * ScrollArea
 *   - `tabIndex={0}` quando há conteúdo transbordando: um container rolável que
 *     não recebe foco não pode ser rolado por teclado (WCAG 2.1.1).
 *   - `role="region"` + `aria-label` para que ele apareça na lista de regiões.
 *   - As sombras de borda são `aria-hidden` — pura affordance visual.
 * ==========================================================================
 *
 * QUEM USA
 * Breadcrumb: detalhe de projeto e de finding. Pagination: listas. ScrollArea:
 * tabelas largas e painéis de filtro.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

/* ==========================================================================
   Breadcrumb
   ========================================================================== */

export interface ItemTrilha {
  rotulo: string;
  /** Ausente = é o item atual. */
  para?: string;
}

export function Breadcrumb({ itens, className }: { itens: ItemTrilha[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={className}>
      <ol className="flex flex-wrap items-center gap-2 text-xs">
        {itens.map((item, i) => {
          const ultimo = i === itens.length - 1;
          return (
            <li key={`${item.rotulo}-${i}`} className="flex items-center gap-2">
              {item.para && !ultimo ? (
                <Link to={item.para} className="text-fg-muted transition-colors duration-fast hover:text-accent-ink">
                  {item.rotulo}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-fg">
                  {item.rotulo}
                </span>
              )}
              {!ultimo && (
                <span aria-hidden="true" className="text-fg-muted">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ==========================================================================
   Pagination
   ========================================================================== */

/**
 * Quais números mostrar: sempre a primeira, a última, a atual e uma vizinha de
 * cada lado; o resto vira reticências. Com 40 páginas, listar todas empurraria
 * a tabela para fora da tela.
 */
function janelaDePaginas(atual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const itens = new Set<number>([1, total, atual, atual - 1, atual + 1]);
  const ordenadas = [...itens].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const saida: (number | "…")[] = [];
  for (let i = 0; i < ordenadas.length; i++) {
    if (i > 0 && ordenadas[i] - ordenadas[i - 1] > 1) saida.push("…");
    saida.push(ordenadas[i]);
  }
  return saida;
}

export function Pagination({
  pagina,
  totalPaginas,
  aoMudar,
  className,
}: {
  pagina: number;
  totalPaginas: number;
  aoMudar: (p: number) => void;
  className?: string;
}) {
  if (totalPaginas <= 1) return null;

  const botao = (ativo: boolean) =>
    cn(
      "alvo-estendido grid h-8 min-w-8 place-items-center rounded-control px-2 text-sm tabular-nums",
      "transition-colors duration-fast",
      ativo ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hovered hover:text-fg",
      "disabled:pointer-events-none disabled:opacity-40",
    );

  return (
    <nav aria-label="Paginação" className={cn("flex items-center justify-between gap-4", className)}>
      <span className="sr-only" role="status" aria-live="polite">
        Página {pagina} de {totalPaginas}
      </span>

      <button
        type="button"
        onClick={() => aoMudar(pagina - 1)}
        disabled={pagina <= 1}
        aria-label="Página anterior"
        className={botao(false)}
      >
        ‹
      </button>

      <div className="flex items-center gap-1">
        {janelaDePaginas(pagina, totalPaginas).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-fg-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => aoMudar(p)}
              aria-label={`Página ${p}`}
              aria-current={p === pagina ? "page" : undefined}
              className={botao(p === pagina)}
            >
              {p}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={() => aoMudar(pagina + 1)}
        disabled={pagina >= totalPaginas}
        aria-label="Próxima página"
        className={botao(false)}
      >
        ›
      </button>
    </nav>
  );
}

/* ==========================================================================
   ScrollArea
   ========================================================================== */

/**
 * Área rolável com sombras nas bordas quando há mais conteúdo.
 *
 * A sombra existe por um motivo concreto: numa tabela larga, sem nenhuma pista
 * visual, a pessoa não descobre que existem colunas à direita. A barra de
 * rolagem sozinha não basta — em macOS ela fica invisível até se rolar.
 */
export function ScrollArea({
  children,
  rotulo,
  orientacao = "horizontal",
  className,
}: {
  children: ReactNode;
  rotulo: string;
  orientacao?: "horizontal" | "vertical";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [sombras, setSombras] = useState({ inicio: false, fim: false });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (orientacao === "horizontal") {
      setSombras({
        inicio: el.scrollLeft > 1,
        fim: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    } else {
      setSombras({
        inicio: el.scrollTop > 1,
        fim: el.scrollTop + el.clientHeight < el.scrollHeight - 1,
      });
    }
  }, [orientacao]);

  useEffect(() => {
    medir();
    const el = ref.current;
    if (!el) return;
    // O ResizeObserver cobre a mudança de tamanho do CONTEÚDO (uma linha nova
    // na tabela), que o evento de scroll sozinho nunca detectaria.
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    for (const filho of Array.from(el.children)) obs.observe(filho);
    return () => obs.disconnect();
  }, [medir, children]);

  const rolavel = sombras.inicio || sombras.fim;

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={medir}
        role={rolavel ? "region" : undefined}
        aria-label={rolavel ? rotulo : undefined}
        // Só recebe foco quando de fato rola — um `tabIndex=0` inútil
        // acrescentaria uma parada de Tab sem função.
        tabIndex={rolavel ? 0 : undefined}
        className={cn(orientacao === "horizontal" ? "overflow-x-auto" : "overflow-y-auto", className)}
      >
        {children}
      </div>

      {orientacao === "horizontal" && (
        <>
          <SombraDeBorda visivel={sombras.inicio} lado="esquerda" />
          <SombraDeBorda visivel={sombras.fim} lado="direita" />
        </>
      )}
    </div>
  );
}

function SombraDeBorda({ visivel, lado }: { visivel: boolean; lado: "esquerda" | "direita" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-0 h-full w-6 transition-opacity duration-fast",
        lado === "esquerda" ? "left-0" : "right-0",
        visivel ? "opacity-100" : "opacity-0",
      )}
      style={{
        background: `linear-gradient(to ${lado === "esquerda" ? "right" : "left"}, oklch(var(--color-bg-canvas)), transparent)`,
      }}
    />
  );
}
