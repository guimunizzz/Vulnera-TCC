/**
 * maturity.tsx — radar de maturidade (SVG) com traçado desenhado via GSAP,
 * score que conta e barras por domínio.
 *
 * Portado de `vulnera-landing/src/components/sections/Maturity.jsx`.
 * Os números aqui são uma amostra ilustrativa, não dado de cliente.
 */

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Reveal, GlitchHeading } from "../ui";

const DOMAINS = [
  { label: "Gestão de Acesso", score: 4 },
  { label: "Gestão de Vulnerabilidades", score: 4 },
  { label: "Segurança de Rede", score: 3 },
  { label: "Conscientização", score: 3 },
  { label: "Backup & Continuidade", score: 2 },
  { label: "Monitoramento e Resposta", score: 2 },
  { label: "Código & Dependências", score: 4 },
];

const MAX_SCORE = 5;
const OVERALL_SCORE = Math.round(
  (DOMAINS.reduce((sum, d) => sum + d.score, 0) / (DOMAINS.length * MAX_SCORE)) * 100,
);
const LEVEL: "BASIC" | "INTERMEDIATE" | "ADVANCED" =
  OVERALL_SCORE < 40 ? "BASIC" : OVERALL_SCORE <= 70 ? "INTERMEDIATE" : "ADVANCED";
// Verde reservado a "sucesso" (postura estável), separado do violeta de
// marca/ação — mesma lógica do design system real do produto.
const LEVEL_COLOR: string = {
  BASIC: "var(--vx-danger)",
  INTERMEDIATE: "var(--vx-orange)",
  ADVANCED: "var(--vx-success)",
}[LEVEL];

const CENTER = 130;
const MAX_R = 95;
const ANGLE_STEP = (2 * Math.PI) / DOMAINS.length;

function point(radius: number, i: number): [number, number] {
  const angle = -Math.PI / 2 + i * ANGLE_STEP;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

function polygonPoints(radius: number): string {
  return DOMAINS.map((_, i) => point(radius, i).join(",")).join(" ");
}

const DATA_PATH =
  DOMAINS.map((d, i) => {
    const [x, y] = point((d.score / MAX_SCORE) * MAX_R, i);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ") + " Z";

export default function Maturity() {
  const scope = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      ScrollTrigger.create({
        trigger: scope.current ?? undefined,
        start: "top 60%",
        once: true,
        onEnter: () => {
          const path = pathRef.current;
          if (path) {
            const length = path.getTotalLength();
            gsap.set(path, { strokeDasharray: length, strokeDashoffset: reduced ? 0 : length });
            gsap.to(path, {
              strokeDashoffset: 0,
              duration: reduced ? 0 : 1.4,
              ease: "power2.out",
            });
            gsap.fromTo(
              path,
              { fillOpacity: 0 },
              {
                fillOpacity: 0.16,
                duration: reduced ? 0 : 1,
                delay: reduced ? 0 : 0.4,
                ease: "power2.out",
              },
            );
          }

          gsap.fromTo(
            ".vx-mat-dot",
            { attr: { r: 0 } },
            {
              attr: { r: 4 },
              duration: reduced ? 0 : 0.4,
              delay: reduced ? 0 : 0.3,
              ease: "back.out(2)",
              stagger: reduced ? 0 : 0.08,
            },
          );

          gsap.to(".vx-mat-bar", {
            width: (_i: number, el: HTMLElement) => el.dataset.w ?? "0%",
            duration: reduced ? 0 : 0.8,
            ease: "power2.out",
            stagger: reduced ? 0 : 0.08,
          });

          const scoreEl = scope.current?.querySelector<HTMLElement>(".vx-mat-score");
          if (scoreEl) {
            gsap.fromTo(
              scoreEl,
              { innerText: 0 },
              {
                innerText: OVERALL_SCORE,
                duration: reduced ? 0 : 1.6,
                ease: "power3.out",
                snap: { innerText: 1 },
              },
            );
          }
        },
      });
    },
    { scope },
  );

  return (
    <section
      id="maturidade"
      ref={scope}
      className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24"
    >
      <div className="mx-auto w-full max-w-5xl">
        <Reveal className="text-center">
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">
            {"// MATURIDADE DE SEGURANÇA"}
          </p>
          <GlitchHeading className="mt-4 text-3xl font-bold leading-tight text-[var(--vx-text)] md:text-4xl">
            Não é só uma lista de findings. É um raio-x da sua postura de segurança.
          </GlitchHeading>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--vx-text-2)]">
            7 domínios avaliados, score consolidado e um nível claro pra mostrar ao cliente onde ele
            está — e pra onde precisa ir.
          </p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          <Reveal delay={150} className="flex flex-col items-center">
            <svg
              viewBox="0 0 260 260"
              className="w-full max-w-[320px]"
              role="img"
              aria-label="Radar de maturidade de segurança"
            >
              {[0.25, 0.5, 0.75, 1].map((f) => (
                <polygon
                  key={f}
                  points={polygonPoints(MAX_R * f)}
                  fill="none"
                  stroke="rgba(var(--vx-accent-rgb),0.12)"
                  strokeWidth="1"
                />
              ))}
              {DOMAINS.map((_, i) => {
                const [x, y] = point(MAX_R, i);
                return (
                  <line
                    key={i}
                    x1={CENTER}
                    y1={CENTER}
                    x2={x}
                    y2={y}
                    stroke="rgba(var(--vx-accent-rgb),0.12)"
                    strokeWidth="1"
                  />
                );
              })}
              <path
                ref={pathRef}
                d={DATA_PATH}
                fill="var(--vx-accent)"
                fillOpacity="0"
                stroke="var(--vx-accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 0 6px rgba(var(--vx-accent-rgb),0.5))" }}
              />
              {DOMAINS.map((d, i) => {
                const [x, y] = point((d.score / MAX_SCORE) * MAX_R, i);
                return (
                  <circle
                    key={d.label}
                    className="vx-mat-dot"
                    cx={x}
                    cy={y}
                    r="0"
                    fill="var(--vx-bg)"
                    stroke="var(--vx-accent)"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>

            <div className="mt-6 text-center">
              <p className="font-mono text-sm text-[var(--vx-text-2)]">Score de maturidade</p>
              <p
                className="mt-1 font-mono text-[3rem] font-bold text-[var(--vx-accent)]"
                style={{ textShadow: "0 0 18px rgba(var(--vx-accent-rgb),0.35)" }}
              >
                <span className="vx-mat-score">0</span>
                <span className="text-2xl text-[var(--vx-text-2)]">/100</span>
              </p>
              <span
                className="mt-3 inline-block rounded-[6px] px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-[var(--vx-on-accent)]"
                style={{ backgroundColor: LEVEL_COLOR }}
              >
                {LEVEL}
              </span>
            </div>
          </Reveal>

          <Reveal delay={250}>
            <ul className="space-y-4">
              {DOMAINS.map((d) => (
                <li key={d.label}>
                  <div className="flex items-center justify-between font-mono text-xs text-[var(--vx-text-2)]">
                    <span>{d.label}</span>
                    <span className="text-[var(--vx-text)]">{d.score}/5</span>
                  </div>
                  <div className="mt-[6px] h-[6px] w-full overflow-hidden rounded-full bg-[rgba(var(--vx-neutral-rgb),0.15)]">
                    <div
                      className="vx-mat-bar h-full rounded-full bg-[var(--vx-accent)]"
                      style={{ width: "0%" }}
                      data-w={`${(d.score / MAX_SCORE) * 100}%`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
