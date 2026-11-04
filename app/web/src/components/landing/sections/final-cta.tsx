/**
 * final-cta.tsx — chamada final + rodapé da landing.
 *
 * Portado de `vulnera-landing/src/components/sections/FinalCTA.jsx`.
 * O CTA agora navega pra /register (react-router).
 *
 * Uma biblioteca só: o título entra com GSAP preso à rolagem; o hover e o
 * toque do botão são CSS (`.vx-cta-escala` em landing.css).
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { GlitchHeading } from "../ui";
import { InteractiveLabel } from "../../ui/interactive-label";
import { gsap } from "../motion/gsap";
import { useMovimentoLanding } from "../motion/use-landing-motion";
import { DESLOCAMENTO_LANDING, EASE_LANDING } from "../motion/tokens";

// Frações do trecho de scroll (seção entrando → centro da seção no centro da
// tela): a opacidade completa em 60% dele; a escala usa o trecho inteiro.
const FIM_DA_OPACIDADE = 0.6;
const TRECHO_COMPLETO = 1;

const FOOTER_LINKS = [
  { label: "Como funciona", href: "#como-funciona" },
  { label: "Demo", href: "#demo" },
  { label: "Planos", href: "#planos" },
  { label: "Equipe", href: "#equipe" },
];

export default function FinalCTA() {
  const ref = useRef<HTMLElement>(null);
  const titulo = useRef<HTMLDivElement>(null);

  // O headline aparece e cresce levemente conforme a seção entra (scrub, sem
  // suavização: segue o scroll como fazia o `useTransform`). Movimento
  // reduzido: só a opacidade acompanha o scroll; a escala sai.
  useMovimentoLanding(ref, ({ reduzido }) => {
    const linha = gsap.timeline({
      defaults: { ease: EASE_LANDING.linear },
      scrollTrigger: { trigger: ref.current, start: "top bottom", end: "center center", scrub: true },
    });
    linha.fromTo(titulo.current, { opacity: 0 }, { opacity: 1, duration: FIM_DA_OPACIDADE }, 0);
    if (!reduzido) {
      linha.fromTo(titulo.current, { scale: DESLOCAMENTO_LANDING.escalaChamadaFinal }, { scale: 1, duration: TRECHO_COMPLETO }, 0);
    } else {
      // Tween vazio do trecho inteiro: a opacidade termina no mesmo ponto do
      // scroll que termina com escala.
      linha.to({}, { duration: TRECHO_COMPLETO }, 0);
    }
  });

  return (
    <>
      <section
        ref={ref}
        className="vx-grid-bg flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center"
      >
        <div ref={titulo} className="vx-superficie">
          <GlitchHeading
            as="h2"
            className="text-4xl font-bold leading-tight text-[var(--vx-text)] sm:text-[3.75rem] md:text-[4.5rem]"
          >
            Pronto pra dormir tranquilo?
          </GlitchHeading>
          <p className="mt-6 text-lg text-[var(--vx-text-2)]">
            Comece sua primeira análise em menos de 3 minutos.
          </p>
          <Link
            to="/register"
            className="vx-cta-escala mt-12 inline-block rounded-[6px] bg-[var(--vx-accent)] px-12 py-4 font-mono text-base font-bold tracking-wider text-[var(--vx-on-accent)] hover:shadow-[0_0_44px_rgba(var(--vx-accent-rgb),0.8)]"
            style={{ boxShadow: "0 0 20px rgba(var(--vx-accent-rgb),0.45)" }}
          >
            <InteractiveLabel>ORGANIZAR MINHA PRIMEIRA ANÁLISE →</InteractiveLabel>
          </Link>
        </div>
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
                    <InteractiveLabel effect="glitch">{link.label}</InteractiveLabel>
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
