/**
 * hero.tsx — primeira dobra: nome, tagline e os dois CTAs.
 *
 * Portado de `vulnera-landing/src/components/sections/Hero.jsx`.
 * "INICIAR ANÁLISE" agora navega pra /register (react-router); "VER DEMO"
 * continua âncora interna. A cena 3D (`AmbientParticles`) já está isolada num
 * chunk à parte porque toda a landing é `lazy()` na rota (ver landing-page.tsx).
 */

import { Link } from "react-router-dom";
import { motion, type Variants } from "motion/react";
import { ChevronDown } from "lucide-react";
import { GlitchHeading } from "../ui";
import AmbientParticles from "../ambient-particles";

const MotionLink = motion.create(Link);

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export default function Hero() {
  return (
    <section
      className="vx-grid-bg-strong relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6"
      style={{
        backgroundColor: "var(--vx-bg)",
        backgroundImage:
          "radial-gradient(ellipse at center, rgba(var(--vx-bg-2-rgb),0.9) 0%, var(--vx-bg) 70%)",
      }}
    >
      <AmbientParticles
        count={typeof window !== "undefined" && window.innerWidth < 768 ? 180 : 400}
      />

      <motion.div
        className="relative z-[10] text-center"
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
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-[6px] bg-[var(--vx-accent)] px-8 py-3 font-mono text-sm font-bold tracking-wider text-[var(--vx-on-accent)] transition-shadow duration-[300ms] hover:shadow-[0_0_30px_rgba(var(--vx-accent-rgb),0.7)]"
            style={{ boxShadow: "0 0 16px rgba(var(--vx-accent-rgb),0.4)" }}
          >
            INICIAR ANÁLISE →
          </MotionLink>
          <motion.a
            href="#demo"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-[6px] border border-[var(--vx-cyan)] px-8 py-3 font-mono text-sm font-bold tracking-wider text-[var(--vx-cyan)] transition-all duration-[300ms] hover:bg-[rgba(var(--vx-cyan-rgb),0.08)] hover:shadow-[0_0_20px_rgba(var(--vx-cyan-rgb),0.4)]"
          >
            VER DEMO
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
