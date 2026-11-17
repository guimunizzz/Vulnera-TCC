/**
 * tour-guiado.tsx
 *
 * O QUE FAZ
 * Tour guiado por passos: escurece a tela, recorta um "holofote" sobre o
 * elemento do passo e mostra um balão com título, texto e os botões Pular
 * tour / Voltar / Próximo. Na primeira visita ele abre sozinho
 * (`useTourAutomatico`); depois, só pelo botão "Ver tour".
 *
 * POR QUE NÃO É UMA BIBLIOTECA
 * O projeto evita dependência nova para o que cabe em poucos componentes, e
 * as peças de acessibilidade já existem (`Portal`, `useFocusTrap`,
 * movimento reduzido). Assim o tour segue os tokens e o tema do produto.
 *
 * ACESSIBILIDADE
 * Diálogo com título e descrição, foco preso no balão e devolvido ao fechar,
 * Esc pula, setas avançam/voltam, contagem "2 de 6" anunciada. Passo cujo
 * alvo não está na tela (menu escondido no celular, aba sem dados) é pulado
 * em vez de apontar para o nada. Movimento reduzido: sem rolagem suave nem
 * transição do holofote.
 *
 * QUEM USA
 * `sast-sca-page.tsx` e `code-import-detail-page.tsx` (ADR-052).
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { Portal } from "../ui/_internal/portal";
import { useFocusTrap } from "../ui/_internal/use-focus-trap";
import { Button } from "../ui/button";
import { useMovimentoReduzido } from "../../design/accessibility";
import type { ResultadoTour } from "../../lib/tour";

export interface PassoTour {
  /** Seletor CSS do elemento destacado (use `data-tour="..."`). */
  alvo: string;
  titulo: string;
  texto: string;
}

interface Retangulo {
  top: number;
  left: number;
  width: number;
  height: number;
}

const FOLGA = 8;
const LARGURA_BALAO = 352;

/** Elemento do passo, se está na página e tem tamanho (menu fechado no celular não conta). */
function alvoVisivel(seletor: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(seletor);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

export function TourGuiado({
  passos,
  aberto,
  aoFechar,
}: {
  passos: PassoTour[];
  aberto: boolean;
  /** `null`: nenhum passo tinha alvo na tela — o tour não aconteceu e não deve contar como visto. */
  aoFechar(resultado: ResultadoTour | null): void;
}) {
  const [visiveis, setVisiveis] = useState<PassoTour[]>([]);
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Retangulo | null>(null);
  const reduzido = useMovimentoReduzido();
  const balaoRef = useRef<HTMLDivElement>(null);
  const proximoRef = useRef<HTMLButtonElement>(null);
  const base = useId();

  // Ao abrir, fica só com os passos que têm o que apontar AGORA.
  useLayoutEffect(() => {
    if (!aberto) return;
    const lista = passos.filter((p) => alvoVisivel(p.alvo));
    if (lista.length === 0) {
      aoFechar(null);
      return;
    }
    setVisiveis(lista);
    setIndice(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const passo = aberto ? visiveis[indice] : undefined;

  const medir = useCallback(() => {
    if (!passo) return;
    const el = alvoVisivel(passo.alvo);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top - FOLGA, left: r.left - FOLGA, width: r.width + FOLGA * 2, height: r.height + FOLGA * 2 });
  }, [passo]);

  useEffect(() => {
    if (!passo) return;
    alvoVisivel(passo.alvo)?.scrollIntoView({ block: "center", inline: "nearest", behavior: reduzido ? "auto" : "smooth" });
    medir();
    // A rolagem suave termina depois: mede de novo quando ela assenta.
    const t = window.setTimeout(medir, reduzido ? 0 : 400);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    proximoRef.current?.focus();
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [passo, medir, reduzido]);

  useFocusTrap(balaoRef, { ativo: !!passo });

  const ultimo = indice === visiveis.length - 1;
  const avancar = () => (ultimo ? aoFechar("concluido") : setIndice((i) => i + 1));
  const voltar = () => setIndice((i) => Math.max(0, i - 1));

  if (!passo) return null;

  // Balão abaixo do alvo se couber; senão acima; sempre dentro da tela.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const largura = Math.min(LARGURA_BALAO, vw - 32);
  const alturaEstimada = 220;
  const abaixo = !rect || rect.top + rect.height + 12 + alturaEstimada <= vh;
  const top = !rect ? vh / 2 - alturaEstimada / 2 : abaixo ? rect.top + rect.height + 12 : Math.max(16, rect.top - 12 - alturaEstimada);
  const left = Math.min(Math.max(16, rect ? rect.left : vw / 2 - largura / 2), vw - largura - 16);
  const transicao = reduzido ? undefined : "top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease";

  return (
    <Portal>
      {/* Bloqueia cliques na página: o tour é guiado, não um tooltip. */}
      <div className="fixed inset-0 z-overlay" aria-hidden="true" data-testid="tour-fundo" />
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-overlay rounded-container border-2 border-accent"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, boxShadow: "0 0 0 9999px var(--color-scrim)", transition: transicao }}
        />
      )}
      <div
        ref={balaoRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${base}-titulo`}
        aria-describedby={`${base}-texto`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            aoFechar("pulado");
          } else if (e.key === "ArrowRight") avancar();
          else if (e.key === "ArrowLeft") voltar();
        }}
        className="fixed z-modal flex flex-col gap-3 rounded-container border border-default bg-raised p-5 shadow-modal"
        style={{ top, left, width: largura, transition: transicao }}
      >
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink" aria-live="polite">
          <Compass size={14} aria-hidden="true" />
          Tour · {indice + 1} de {visiveis.length}
        </p>
        <h2 id={`${base}-titulo`} className="text-lg font-semibold text-fg">
          {passo.titulo}
        </h2>
        <p id={`${base}-texto`} className="text-sm text-fg-muted">
          {passo.texto}
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <Button variant="fantasma" size="sm" onClick={() => aoFechar("pulado")}>
            Pular tour
          </Button>
          <div className="flex gap-2">
            <Button variant="secundario" size="sm" onClick={voltar} disabled={indice === 0}>
              Voltar
            </Button>
            <Button ref={proximoRef} size="sm" onClick={avancar}>
              {ultimo ? "Concluir" : "Próximo"}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** Botão discreto para repetir o tour. */
export function BotaoVerTour({ aoClicar }: { aoClicar(): void }) {
  return (
    <Button variant="fantasma" size="sm" onClick={aoClicar} iconeInicio={<Compass className="h-4 w-4" aria-hidden="true" />}>
      Ver tour
    </Button>
  );
}
