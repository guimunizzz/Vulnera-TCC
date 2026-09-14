/**
 * final-cta.tsx — chamada final + rodapé da landing.
 *
 * Portado de `vulnera-landing/src/components/sections/FinalCTA.jsx`.
 * O CTA agora navega pra /register (react-router).
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "motion/react";
import { GlitchHeading } from "../ui";

const MotionLink = motion.create(Link);

const FOOTER_LINKS = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Demo", href: "#demo" },
  { label: "Planos", href: "#planos" },
  { label: "Equipe", href: "#equipe" },
];

export default function FinalCTA() {
  const ref = useRef<HTMLElement>(null);

  // Parallax sutil: o headline cresce levemente conforme a seção entra
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0, 1]);

  return (
    <>
      <section
        ref={ref}
        className="vx-grid-bg flex min-h-screen flex-col items-center justify-center bg-[var(--vx-bg)] px-6 py-24 text-center"
      >
        <motion.div style={{ scale, opacity }}>
          <GlitchHeading
            as="h2"
            className="text-4xl font-bold leading-tight text-[var(--vx-text)] sm:text-[3.75rem] md:text-[4.5rem]"
          >
            Pronto pra dormir tranquilo?
          </GlitchHeading>
          <p className="mt-6 text-lg text-[var(--vx-text-2)]">
            Comece sua primeira análise em menos de 3 minutos.
          </p>
          <MotionLink
            to="/register"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            className="mt-12 inline-block rounded-[6px] bg-[var(--vx-accent)] px-12 py-4 font-mono text-base font-bold tracking-wider text-[var(--vx-on-accent)] transition-shadow duration-[300ms] hover:shadow-[0_0_44px_rgba(var(--vx-accent-rgb),0.8)]"
            style={{ boxShadow: "0 0 20px rgba(var(--vx-accent-rgb),0.45)" }}
          >
            ORGANIZAR MINHA PRIMEIRA ANÁLISE →
          </MotionLink>
        </motion.div>
      </section>

      <footer className="border-t border-[rgba(var(--vx-accent-rgb),0.15)] bg-[var(--vx-bg-3)] px-6 py-14">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <p className="font-mono text-lg font-bold tracking-widest text-[var(--vx-text)]">
              VULNERA SECURITY
            </p>
            <p className="mt-2 font-mono text-sm text-[var(--vx-text-2)]">
              O invasor só precisa de uma brecha. Você precisa achar todas.
            </p>
          </div>

          <nav aria-label="Links do rodapé">
            <ul className="space-y-2 text-sm text-[var(--vx-text-2)]">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="transition-colors hover:text-[var(--vx-accent)]">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <p className="text-sm leading-relaxed text-[var(--vx-text-2)]">
            TCC 2026 · Vulnera Security é um produto fictício desenvolvido como Trabalho de Conclusão
            de Curso Técnico em Desenvolvimento de Sistemas.
          </p>
        </div>

        <p className="mt-12 text-center font-mono text-xs text-[var(--vx-text-2)]">
          © 2026 Vulnera Security — todos os direitos reservados
        </p>
      </footer>
    </>
  );
}
