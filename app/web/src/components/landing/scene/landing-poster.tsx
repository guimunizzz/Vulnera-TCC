/**
 * components/landing/scene/landing-poster.tsx
 *
 * O QUE FAZ
 * Pôster ASCII estático da narrativa: um bloco de texto monoespaçado por ato,
 * com a mesma regra de células do shader (`estadoDaCelula`). A troca de ato é
 * um crossfade de opacidade — nada se desloca.
 *
 * POR QUE EXISTE
 * É o que aparece quando a cena WebGL não roda: movimento reduzido, tela
 * estreita, navegador sem WebGL2, falha ao baixar o chunk ou contexto perdido.
 * Também fica pintado enquanto a cena carrega. Decorativo: `aria-hidden`.
 * Só o ato atual (e o anterior, durante a troca) fica no DOM.
 *
 * QUEM USA
 * `landing-scene.tsx`.
 */

import { memo, useEffect, useMemo, useState } from "react";
import { DURACAO } from "../../../motion/tokens";
import { CELULA_LANDING_PX, OPACIDADE_CENA, RAIO_DO_GRUPO_PX } from "./config";
import { estadoDaCelula, type Medidas, type Tom } from "./layout";

/** Proporção de uma célula da JetBrains Mono com a entrelinha do pôster. */
const ALTURA_POR_LARGURA = 1.75;
/** Duração do crossfade — a mesma `--duration-slow` do CSS (`.vx-poster-*`). */
const DURACAO_TROCA_MS = DURACAO.slow * 1000;

const COR: Record<Tom, string> = {
  base: "var(--vx-accent)",
  neon: "var(--vx-cyan)",
  resolvido: "oklch(var(--color-success))",
  1: "oklch(var(--color-severity-low))",
  2: "oklch(var(--color-severity-medium))",
  3: "oklch(var(--color-severity-high))",
  4: "oklch(var(--color-severity-critical))",
};

const comAlfa = (cor: string, alfa: number) => `color-mix(in srgb, ${cor} ${Math.round(alfa * 100)}%, transparent)`;

function medir(): Medidas {
  const largura = typeof window === "undefined" ? 1440 : window.innerWidth;
  const altura = typeof window === "undefined" ? 900 : window.innerHeight;
  const alturaCelula = CELULA_LANDING_PX * ALTURA_POR_LARGURA;
  return {
    colunas: Math.ceil(largura / CELULA_LANDING_PX),
    linhas: Math.ceil(altura / alturaCelula),
    larguraCelula: CELULA_LANDING_PX,
    alturaCelula,
    raioDoGrupoPx: RAIO_DO_GRUPO_PX,
  };
}

const Ato = memo(function Ato({ ato, medidas, saindo }: { ato: number; medidas: Medidas; saindo: boolean }) {
  const linhas = useMemo(() => Array.from({ length: medidas.linhas }, (_, y) => (
    Array.from({ length: medidas.colunas }, (_, x) => estadoDaCelula(x, y, ato, medidas))
  )), [ato, medidas]);

  return (
    <pre
      className={`vx-poster-ato absolute inset-0 m-0 overflow-hidden ${saindo ? "vx-poster-saindo" : "vx-poster-entrando"}`}
      data-poster-ato={ato}
      style={{
        fontSize: medidas.larguraCelula / 0.6,
        lineHeight: `${medidas.alturaCelula}px`,
        color: comAlfa(COR.base, OPACIDADE_CENA.saudavel),
      }}
    >
      {linhas.map((celulas, y) => (
        <div key={y}>
          {celulas.map((c, x) => (c === null ? " " : c.destaque || c.tom !== "base"
            ? <span key={x} data-tom={c.tom} style={{ color: comAlfa(COR[c.tom], c.destaque ? OPACIDADE_CENA.destaque : OPACIDADE_CENA.saudavel) }}>{c.glifo}</span>
            : c.glifo))}
        </div>
      ))}
    </pre>
  );
});

export function LandingPoster({ ato, oculto }: { ato: number; oculto: boolean }) {
  const [medidas, setMedidas] = useState(medir);
  const [anterior, setAnterior] = useState<number | null>(null);
  const [atual, setAtual] = useState(ato);

  useEffect(() => {
    let quadro = 0;
    const aoRedimensionar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => setMedidas(medir()));
    };
    window.addEventListener("resize", aoRedimensionar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", aoRedimensionar);
    };
  }, []);

  // Crossfade: o ato anterior fica no DOM só durante a troca.
  useEffect(() => {
    if (ato === atual) return;
    setAnterior(atual);
    setAtual(ato);
  }, [ato, atual]);

  // A remoção tem efeito próprio: no efeito acima, a reexecução causada pela
  // troca de `atual` cancelaria o temporizador e a camada antiga ficaria.
  useEffect(() => {
    if (anterior === null) return;
    const id = window.setTimeout(() => setAnterior(null), DURACAO_TROCA_MS);
    return () => window.clearTimeout(id);
  }, [anterior]);

  return (
    <div
      aria-hidden="true"
      data-landing-poster="true"
      data-ato-atual={atual}
      className="vx-poster absolute inset-0 overflow-hidden font-mono"
      style={{ opacity: oculto ? 0 : 1 }}
    >
      {anterior !== null && <Ato key={`saindo-${anterior}`} ato={anterior} medidas={medidas} saindo />}
      <Ato key={`ato-${atual}`} ato={atual} medidas={medidas} saindo={false} />
    </div>
  );
}
