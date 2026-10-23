/**
 * components/landing/motion/gsap.ts
 *
 * O QUE FAZ
 * Registra `ScrollTrigger` e `useGSAP` no GSAP uma única vez e reexporta os
 * três. É a ÚNICA porta de entrada do GSAP no projeto.
 *
 * POR QUE EXISTE
 * Cada seção registrava os plugins por conta própria — e `maturity.tsx` só
 * funcionava porque `how-it-works.tsx` era importado antes. Concentrar o
 * registro aqui elimina essa dependência de ordem. O ESLint
 * (`no-restricted-imports`) impede importar `gsap` fora desta pasta.
 *
 * Divisão das bibliotecas (decisão do refactor web-motion-3d): GSAP cuida de
 * timelines e efeitos guiados por scroll nas páginas públicas; Motion cuida do
 * estado de componentes (entrada/saída, hover, overlays), nunca de scroll.
 *
 * QUEM USA
 * As seções da landing, via `use-landing-motion.ts` ou diretamente.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };
