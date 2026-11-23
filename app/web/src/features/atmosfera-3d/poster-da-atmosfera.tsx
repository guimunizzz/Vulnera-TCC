/**
 * features/atmosfera-3d/poster-da-atmosfera.tsx
 *
 * O pôster (quadro parado em canvas 2D) de uma atmosfera, do tamanho da
 * camada. Redesenha só quando muda o tamanho (com folga de 200 ms), o tema
 * ou o risco publicado (arredondado a 0,1: o pôster não precisa de mais).
 * Chunk lazy próprio, sem three.
 */

import { useEffect, useRef, useState } from "react";
import { RISCO_NEUTRO } from "./config";
import { desenharPoster, lerCoresDoPoster } from "./posteres";
import { useAtmosferaStore } from "./risco";
import type { Linguagem } from "./rotas";
import { useTemaDoDocumento } from "./use-tema-do-documento";

const MAX_DPR_POSTER = 1.5;

function PosterDaAtmosfera({ linguagem, aoPronta }: { linguagem: Linguagem; aoPronta: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tema = useTemaDoDocumento();
  const risco = Math.round((useAtmosferaStore((s) => s.risco) ?? RISCO_NEUTRO) * 10) / 10;
  const [tamanho, setTamanho] = useState<{ largura: number; altura: number } | null>(null);
  const avisar = useRef(aoPronta);
  avisar.current = aoPronta;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let espera = 0;
    const medir = () => setTamanho({ largura: canvas.clientWidth, altura: canvas.clientHeight });
    const observador = new ResizeObserver(() => {
      window.clearTimeout(espera);
      espera = window.setTimeout(medir, 200);
    });
    observador.observe(canvas);
    medir();
    return () => {
      window.clearTimeout(espera);
      observador.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tamanho || tamanho.largura === 0 || tamanho.altura === 0) return;
    let vivo = true;
    void desenharPoster(canvas, linguagem, {
      ...tamanho,
      dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR_POSTER),
      cores: lerCoresDoPoster(canvas),
      risco,
    }).then(() => {
      if (vivo) avisar.current();
    });
    return () => {
      vivo = false;
    };
  }, [linguagem, tamanho, tema, risco]);

  return <canvas ref={canvasRef} aria-hidden="true" data-poster={linguagem} className="absolute inset-0 h-full w-full" />;
}

export default PosterDaAtmosfera;
