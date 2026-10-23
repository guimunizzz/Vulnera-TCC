/**
 * three/gate.ts
 *
 * O QUE FAZ
 * Decide se uma cena three.js pode montar: só sem movimento reduzido, a partir
 * de uma largura mínima e com WebGL2 disponível.
 *
 * POR QUE EXISTE
 * A decisão vem ANTES do `lazy()` da cena: quando ela é "não", o chunk de
 * three nem é baixado e o fallback CSS fica sozinho. Por isso este é o único
 * arquivo do kit que NÃO importa `three` — ele roda no bundle principal.
 *
 * QUEM USA
 * `DashboardAtmosphere` (layout autenticado) e, a partir da Fase 4, a cena da
 * landing.
 */

import { useEffect, useState } from "react";
import { useMotion } from "../motion/use-motion";

/** Abaixo disto a cena vira só o fundo CSS (ADR-041). */
export const LARGURA_MINIMA_PADRAO = 768;

/**
 * Feature-detect que NÃO toca o canvas (ADR-026 §4): pedir um contexto aqui e
 * outro no `WebGLRenderer`, com atributos diferentes, faria o segundo pedido
 * ser ignorado pela spec do Canvas.
 */
export function suportaWebGL2(): boolean {
  return typeof window !== "undefined" && "WebGL2RenderingContext" in window;
}

export function useCenaPermitida({ larguraMinima = LARGURA_MINIMA_PADRAO }: { larguraMinima?: number } = {}): boolean {
  const { reduzido } = useMotion();
  const consulta = `(max-width: ${larguraMinima - 1}px)`;
  const [estreita, setEstreita] = useState(() => window.innerWidth < larguraMinima);

  useEffect(() => {
    const media = window.matchMedia(consulta);
    const atualizar = () => setEstreita(media.matches);
    atualizar();
    media.addEventListener("change", atualizar);
    return () => media.removeEventListener("change", atualizar);
  }, [consulta]);

  return !reduzido && !estreita && suportaWebGL2();
}
