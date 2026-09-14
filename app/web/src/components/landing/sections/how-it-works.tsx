/**
 * how-it-works.tsx — os 4 passos, com stagger e linha pontilhada via GSAP
 * ScrollTrigger.
 *
 * Portado de `vulnera-landing/src/components/sections/HowItWorks.jsx`.
 */

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { CreditCard, Globe, Activity, FileText, type LucideIcon } from "lucide-react";
import { Reveal, GlitchHeading } from "../ui";

gsap.registerPlugin(ScrollTrigger, useGSAP);

interface Step {
  num: string;
  title: string;
  icon: LucideIcon;
  desc: string;
}

const STEPS: Step[] = [
  {
    num: "01",
    title: "CONTRATE",
    icon: CreditCard,
    desc: "Cliente solicita um plano, sem burocracia de contrato.",
  },
  {
    num: "02",
    title: "CADASTRE",
    icon: Globe,
    desc: "Suas aplicações entram em um catálogo central.",
  },
  {
    num: "03",
    title: "ACOMPANHE",
    icon: Activity,
    desc: "Findings chegam classificados por severidade (CVSS) assim que são registrados.",
  },
  {
    num: "04",
    title: "RECEBA",
    icon: FileText,
    desc: "Relatório PDF executivo pronto em segundos, direto no seu navegador — sem dado sensível saindo pra fora.",
  },
];

export default function HowItWorks() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) return;

      // Passos aparecem em sequência (stagger 200ms)
      gsap.from(".vx-step", {
        opacity: 0,
        y: 24,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.2,
        scrollTrigger: { trigger: scope.current, start: "top 70%", once: true },
      });

      // Linha pontilhada "desenha" conforme o scroll (scrub)
      gsap.fromTo(
        ".vx-flow-line",
        { scaleX: 0 },
        {
          scaleX: 1,
          transformOrigin: "left center",
          ease: "none",
          scrollTrigger: {
            trigger: scope.current,
            start: "top 75%",
            end: "top 25%",
            scrub: 0.5,
          },
        },
      );
    },
    { scope },
  );

  return (
    <section
      id="como-funciona"
      ref={scope}
      className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24"
    >
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="text-center">
          <GlitchHeading className="text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            Como funciona
          </GlitchHeading>
        </Reveal>

        <div className="relative mt-20 grid grid-cols-1 gap-14 md:grid-cols-4 md:gap-8">
          {/* Linha pontilhada conectando os passos (desenhada via GSAP ScrollTrigger) */}
          <div
            className="vx-flow-line absolute left-[12%] right-[12%] top-[88px] hidden border-t border-dashed border-[rgba(var(--vx-accent-rgb),0.35)] md:block"
            aria-hidden="true"
          />

          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="vx-step relative text-center">
                <Icon size={32} className="mx-auto text-[var(--vx-accent)]" aria-hidden="true" />
                <p
                  className="mt-4 font-mono text-[3rem] font-bold text-[var(--vx-accent)] md:text-[3.75rem]"
                  style={{ textShadow: "0 0 18px rgba(var(--vx-accent-rgb),0.35)" }}
                >
                  {step.num}
                </p>
                <h3 className="mt-4 text-lg font-bold text-[var(--vx-text)]">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-[220px] text-sm text-[var(--vx-text-2)]">{step.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
