/**
 * landing-root.tsx — a landing pública inteira: a cena narrativa no fundo e a
 * sequência de seções por cima.
 *
 * Portado de `vulnera-landing/src/App.jsx` + `src/pages/Landing.jsx` (juntados
 * num arquivo só). Este módulo é carregado via `lazy()` em
 * `pages/landing-page.tsx` — é o que mantém `gsap` e todas as seções FORA do
 * bundle principal do app; `three` fica num chunk ainda mais adiante, o da
 * cena (`scene/landing-scene-canvas.tsx`).
 *
 * Refactor web-motion-3d (Fase 4): saíram a intro 3D de 6 s (não respeitava
 * movimento reduzido), as partículas genéricas do hero e o cursor customizado.
 * No lugar, uma cena ASCII única conta a história da página — roteiro em
 * `docs/LANDING_NARRATIVA.md`.
 */

import { useRef } from "react";
import Nav from "./nav";
import { ScrollProgress } from "./ui";
import { useRecalculoDoScroll } from "./motion/use-landing-motion";
import { LandingScene } from "./scene/landing-scene";
import Hero from "./sections/hero";
import Problem from "./sections/problem";
import HowItWorks from "./sections/how-it-works";
import Features from "./sections/features";
import Comparison from "./sections/comparison";
import Demo from "./sections/demo";
import Maturity from "./sections/maturity";
import Pricing from "./sections/pricing";
import FAQ from "./sections/faq";
import Team from "./sections/team";
import FinalCTA from "./sections/final-cta";

export default function LandingRoot() {
  const raiz = useRef<HTMLDivElement>(null);
  // Fontes e mudanças de altura (FAQ, demo) desalinhariam os ScrollTriggers.
  useRecalculoDoScroll(raiz);

  return (
    // O `MotionConfig` que respeita o movimento reduzido (sistema OU menu de
    // acessibilidade) fica na raiz do app (main.tsx).
    <>
      <LandingScene />
      {/* Conteúdo acima da cena fixa (z-0). */}
      <div ref={raiz} className="relative z-[1] font-sans text-[var(--vx-text)]">
        <ScrollProgress />
        <Nav />
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Comparison />
        <Demo />
        <Maturity />
        <Pricing />
        <FAQ />
        <Team />
        <FinalCTA />
      </div>
    </>
  );
}
