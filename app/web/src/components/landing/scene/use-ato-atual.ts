/**
 * components/landing/scene/use-ato-atual.ts
 *
 * O QUE FAZ
 * Diz em qual ato da narrativa a página está: um ScrollTrigger por seção
 * marcada com `data-ato`, que troca o ato quando o topo dela passa do meio da
 * tela (o mesmo ponto em que a cena WebGL alcança o ato).
 *
 * POR QUE EXISTE
 * O pôster estático (fallback) não lê o scroll contínuo: ele só precisa saber
 * o ato, e um `setState` por troca de ato — não por quadro — é barato. O
 * contexto do `useGSAP` mata os gatilhos no unmount.
 *
 * QUEM USA
 * `landing-scene.tsx`.
 */

import { useState } from "react";
import { ScrollTrigger, useGSAP } from "../motion/gsap";

export function useAtoAtual(): number {
  const [ato, setAto] = useState(0);

  useGSAP(() => {
    document.querySelectorAll<HTMLElement>("section[data-ato]").forEach((secao) => {
      const indice = Number(secao.dataset.ato);
      if (!indice) return;
      ScrollTrigger.create({
        trigger: secao,
        start: "top center",
        onEnter: () => setAto(indice),
        onLeaveBack: () => setAto(indice - 1),
      });
    });
  });

  return ato;
}
