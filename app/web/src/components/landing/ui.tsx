/**
 * ui.tsx — primitivas visuais compartilhadas pelas seções da landing.
 *
 * Portado de `vulnera-landing/src/components/ui.jsx`. `framer-motion` virou
 * `motion/react` (mesma API para o que usamos aqui); o resto é só tipagem.
 */

import { useRef, type ElementType, type ReactNode } from "react";
import { motion } from "motion/react";
import { gsap } from "./motion/gsap";
import { useMovimentoLanding } from "./motion/use-landing-motion";
import {
  DESLOCAMENTO_MOTION_LANDING,
  DURACAO_MOTION_LANDING,
  EASE_LANDING,
  EASE_MOTION_LANDING,
  ESCALONAMENTO_MOTION_LANDING,
  SCRUB_LANDING,
} from "./motion/tokens";

type RevealTag = "div" | "li" | "span" | "section" | "p";

interface RevealProps {
  children: ReactNode;
  /** Posição na sequência: o atraso é `ordem × ESCALONAMENTO_MOTION_LANDING.revelacao`. */
  ordem?: number;
  className?: string;
  as?: RevealTag;
}

/**
 * Reveal — fade-in + slide-up quando o elemento entra na viewport
 * (`whileInView`, dispara uma vez).
 */
export function Reveal({ children, ordem = 0, className = "", as = "div" }: RevealProps) {
  const Comp = (motion[as] ?? motion.div) as typeof motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: DESLOCAMENTO_MOTION_LANDING.revelacao }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: DURACAO_MOTION_LANDING.entrada,
        ease: EASE_MOTION_LANDING.saida,
        delay: ordem * ESCALONAMENTO_MOTION_LANDING.revelacao,
      }}
    >
      {children}
    </Comp>
  );
}

interface GlitchHeadingProps {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

/**
 * GlitchHeading — heading com efeito glitch RGB em hover (3 camadas: base,
 * magenta -2px, ciano +2px). Ver `.vx-glitch` em landing.css.
 */
export function GlitchHeading({ children, className = "", as: Tag = "h2" }: GlitchHeadingProps) {
  return (
    <Tag className={`vx-glitch ${className}`}>
      <span className="vx-glitch-base relative z-10 inline-block">{children}</span>
      <span className="vx-glitch-layer vx-glitch-r" aria-hidden="true">
        {children}
      </span>
      <span className="vx-glitch-layer vx-glitch-c" aria-hidden="true">
        {children}
      </span>
    </Tag>
  );
}

/**
 * ScrollProgress — barra neon no topo que acompanha a rolagem da página.
 *
 * Efeito guiado por scroll, então é GSAP (ScrollTrigger com scrub), não
 * Motion. O scrub curto substitui a spring que existia antes. Sob movimento
 * reduzido a barra continua — ela informa a posição, como uma barra de
 * rolagem —, mas colada ao scroll, sem a suavização que a faz "deslizar".
 */
export function ScrollProgress() {
  const barra = useRef<HTMLDivElement>(null);

  useMovimentoLanding(barra, ({ reduzido }) => {
    gsap.fromTo(
      barra.current,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: EASE_LANDING.linear,
        scrollTrigger: { start: 0, end: "max", scrub: reduzido ? true : SCRUB_LANDING.barra },
      },
    );
  });

  return (
    <div
      ref={barra}
      className="fixed left-0 right-0 top-0 z-[45] h-[2px] origin-left bg-[var(--vx-accent)]"
      style={{ transform: "scaleX(0)", boxShadow: "0 0 8px rgba(var(--vx-accent-rgb),0.8)" }}
      aria-hidden="true"
    />
  );
}
