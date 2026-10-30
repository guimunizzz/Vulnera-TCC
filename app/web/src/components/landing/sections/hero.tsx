/**
 * hero.tsx — primeira dobra: nome, tagline e os dois CTAs.
 *
 * Portado de `vulnera-landing/src/components/sections/Hero.jsx`.
 * "INICIAR ANÁLISE" agora navega pra /register (react-router); "VER DEMO"
 * continua âncora interna. O fundo 3D é a cena narrativa única da landing
 * (`../scene/`), fixa atrás de todas as seções; este é o ato 0, "Funciona".
 */

import { Link } from "react-router-dom";
import { motion, type Variants } from "motion/react";
import { ChevronDown } from "lucide-react";
import { GlitchHeading } from "../ui";
import { InteractiveLabel } from "../../ui/interactive-label";
import {
  DESLOCAMENTO_LANDING,
  DURACAO_MOTION_LANDING,
  EASE_MOTION_LANDING,
  ESCALA_LANDING,
  ESCALONAMENTO_MOTION_LANDING,
} from "../motion/tokens";

const MotionLink = motion.create(Link);

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: ESCALONAMENTO_MOTION_LANDING.hero, delayChildren: ESCALONAMENTO_MOTION_LANDING.inicioHero } },
};

const item: Variants = {
  hidden: { opacity: 0, y: DESLOCAMENTO_LANDING.entrada },
  show: { opacity: 1, y: 0, transition: { duration: DURACAO_MOTION_LANDING.entrada, ease: EASE_MOTION_LANDING.saida } },
};

export default function Hero() {
  return (
    <section
      data-ato="0"
      className="vx-grid-bg-strong relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
      style={{
        // Transparente nas bordas: a cena fixa atrás aparece em volta do título.
        backgroundImage:
          "radial-gradient(ellipse at center, rgba(var(--vx-bg-2-rgb),0.9) 0%, rgba(var(--vx-bg-2-rgb),0) 70%)",
      }}
    >
      <motion.div
        className="vx-superficie relative z-[10] text-center"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <GlitchHeading
            as="h1"
            className="font-mono text-4xl font-bold tracking-wider text-[var(--vx-text)] sm:text-[3.75rem] md:text-[4.5rem]"
          >
            <span style={{ textShadow: "0 0 28px rgba(var(--vx-accent-rgb),0.35)" }}>
              VULNERA SECURITY
            </span>
          </GlitchHeading>
        </motion.div>

        <motion.p variants={item} className="mt-6 font-mono text-lg text-[var(--vx-text-2)] md:text-xl">
          O invasor só precisa de uma brecha. Você precisa achar todas.
        </motion.p>

        <motion.div
          variants={item}
          className="mx-auto mt-6 h-px w-[200px] bg-[var(--vx-accent)]"
          style={{ boxShadow: "0 0 10px rgba(var(--vx-accent-rgb),0.7)" }}
          aria-hidden="true"
        />

        <motion.div
          variants={item}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <MotionLink
            to="/register"
            whileHover={{ scale: ESCALA_LANDING.hover }}
            whileTap={{ scale: ESCALA_LANDING.toque }}
            className="rounded-[6px] bg-[var(--vx-accent)] px-8 py-3 font-mono text-sm font-bold tracking-wider text-[var(--vx-on-accent)] transition-shadow duration-[300ms] hover:shadow-[0_0_30px_rgba(var(--vx-accent-rgb),0.7)]"
            style={{ boxShadow: "0 0 16px rgba(var(--vx-accent-rgb),0.4)" }}
          >
            <InteractiveLabel>INICIAR ANÁLISE →</InteractiveLabel>
          </MotionLink>
          <motion.a
            href="#demo"
            whileHover={{ scale: ESCALA_LANDING.hover }}
            whileTap={{ scale: ESCALA_LANDING.toque }}
            className="rounded-[6px] border border-[var(--vx-accent-soft)] px-8 py-3 font-mono text-sm font-bold tracking-wider text-[var(--vx-accent-soft)] transition-all duration-[300ms] hover:bg-[rgba(var(--vx-accent-soft-rgb),0.08)] hover:shadow-[0_0_20px_rgba(var(--vx-accent-soft-rgb),0.4)]"
          >
            <InteractiveLabel>VER DEMO</InteractiveLabel>
          </motion.a>
        </motion.div>
      </motion.div>

      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[var(--vx-accent)]"
        aria-hidden="true"
      >
        <ChevronDown size={28} className="vx-bounce" />
      </div>
    </section>
  );
}
