/**
 * demo.tsx — mockup do dashboard da "TechNova", com KPIs que contam, barras que
 * sobem e linhas de findings que deslizam (GSAP ScrollTrigger).
 *
 * Portado de `vulnera-landing/src/components/sections/Demo.jsx`.
 */

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Reveal, GlitchHeading } from "../ui";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const KPIS = [
  { label: "Findings abertos", value: 28 },
  { label: "Críticos", value: 3 },
  { label: "Aplicações", value: 12 },
];

const BARS: string[] = [
  ...Array<string>(3).fill("var(--vx-danger)"),
  ...Array<string>(5).fill("var(--vx-orange)"),
  ...Array<string>(8).fill("var(--vx-yellow)"),
  ...Array<string>(12).fill("var(--vx-cyan)"),
];

const FINDINGS = [
  { sev: "CRÍTICA", color: "var(--vx-danger)", title: "SQL Injection em /api/v1/orders" },
  { sev: "ALTA", color: "var(--vx-orange)", title: "JWT sem expiração no painel admin" },
  { sev: "MÉDIA", color: "var(--vx-yellow)", title: "CORS permissivo em api.technova.com" },
  { sev: "BAIXA", color: "var(--vx-cyan)", title: "Header X-Frame-Options ausente" },
];

const NAV_ITEMS = ["Dashboard", "Aplicações", "Projetos", "Maturidade", "Configurações"];

const DASHBOARD_TABS = ["Postura atual", "Evolução", "Insights", "Comparativo"];

export default function Demo() {
  const scope = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      ScrollTrigger.create({
        trigger: scope.current ?? undefined,
        start: "top 60%",
        once: true,
        onEnter: () => {
          // KPIs contam do 0 ao valor final (snap inteiro, ease-out)
          gsap.utils.toArray<HTMLElement>(".vx-kpi-value").forEach((el) => {
            gsap.fromTo(
              el,
              { innerText: 0 },
              {
                innerText: Number(el.dataset.value),
                duration: reduced ? 0 : 1.5,
                ease: "power3.out",
                snap: { innerText: 1 },
              },
            );
          });

          // Barras do gráfico sobem em cascata
          gsap.to(".vx-bar", {
            height: (_i: number, el: HTMLElement) => el.dataset.h ?? "0%",
            duration: reduced ? 0 : 0.7,
            ease: "power2.out",
            stagger: reduced ? 0 : 0.03,
          });

          // Linhas de findings deslizam
          gsap.from(".vx-finding-row", {
            opacity: 0,
            x: -12,
            duration: reduced ? 0 : 0.4,
            ease: "power2.out",
            stagger: reduced ? 0 : 0.1,
          });
        },
      });
    },
    { scope },
  );

  return (
    <section
      id="demo"
      ref={scope}
      className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24"
    >
      <div className="mx-auto w-full max-w-4xl text-center">
        <Reveal>
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">{"// VEJA EM AÇÃO"}</p>
          <GlitchHeading className="mt-4 text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            A plataforma da TechNova Solutions, de perto.
          </GlitchHeading>
        </Reveal>

        <Reveal delay={150}>
          <div
            className="mx-auto mt-10 flex max-w-[900px] flex-wrap justify-center gap-2"
            aria-hidden="true"
          >
            {DASHBOARD_TABS.map((tab, i) => (
              <span
                key={tab}
                className={`rounded-full border px-4 py-[6px] font-mono text-[11px] tracking-wide ${
                  i === 0
                    ? "border-[var(--vx-accent)] bg-[rgba(var(--vx-accent-rgb),0.1)] text-[var(--vx-accent)]"
                    : "border-[rgba(var(--vx-neutral-rgb),0.25)] text-[var(--vx-text-2)]"
                }`}
              >
                {tab}
              </span>
            ))}
          </div>
        </Reveal>

        <Reveal delay={200}>
          <div
            className="vx-breathe relative mx-auto mt-14 w-full max-w-[900px] overflow-hidden rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.3)] bg-[var(--vx-bg-2)] text-left shadow-[0_0_40px_rgba(var(--vx-accent-rgb),0.12)]"
            style={{ aspectRatio: "16 / 9" }}
            aria-hidden="true"
          >
            {/* Pixels de atividade */}
            <div className="absolute right-3 top-3 flex gap-1">
              <span className="vx-blink h-[4px] w-[4px] bg-[var(--vx-accent)]" />
              <span
                className="vx-blink h-[4px] w-[4px] bg-[var(--vx-cyan)]"
                style={{ animationDelay: "400ms" }}
              />
              <span
                className="vx-blink h-[4px] w-[4px] bg-[var(--vx-danger)]"
                style={{ animationDelay: "800ms" }}
              />
            </div>

            {/* Header fake */}
            <div className="flex items-center justify-between border-b border-[rgba(var(--vx-accent-rgb),0.15)] px-4 py-2">
              <span className="font-mono text-xs font-bold tracking-widest text-[var(--vx-accent)]">
                VULNERA
              </span>
              <div className="hidden gap-4 font-mono text-[10px] text-[var(--vx-text-2)] sm:flex">
                <span>TechNova Solutions</span>
                <span className="text-[var(--vx-cyan)]">analista@vulnera.sec</span>
              </div>
            </div>

            <div className="flex h-full">
              {/* Sidebar fake */}
              <div className="hidden w-[144px] shrink-0 border-r border-[rgba(var(--vx-accent-rgb),0.15)] p-3 sm:block">
                <ul className="space-y-2 font-mono text-[10px]">
                  {NAV_ITEMS.map((item, i) => (
                    <li
                      key={item}
                      className={`rounded-[6px] px-2 py-1 ${
                        i === 0
                          ? "bg-[rgba(var(--vx-accent-rgb),0.12)] text-[var(--vx-accent)]"
                          : "text-[var(--vx-text-2)]"
                      }`}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Área principal */}
              <div className="flex-1 p-4">
                <div className="grid grid-cols-3 gap-3">
                  {KPIS.map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.15)] bg-[var(--vx-bg)] p-3"
                    >
                      <p
                        className="vx-kpi-value font-mono text-xl font-bold text-[var(--vx-accent)] md:text-2xl"
                        data-value={kpi.value}
                      >
                        0
                      </p>
                      <p className="mt-1 text-[10px] text-[var(--vx-text-2)]">{kpi.label}</p>
                    </div>
                  ))}
                </div>

                {/* Gráfico fake de severidade */}
                <div className="mt-4 flex h-20 items-end gap-[3px]">
                  {BARS.map((color, i) => (
                    <div
                      key={i}
                      className="vx-bar flex-1 rounded-t-[3px]"
                      data-h={`${30 + ((i * 13) % 60)}%`}
                      style={{ backgroundColor: color, height: "4%", opacity: 0.85 }}
                    />
                  ))}
                </div>

                {/* Lista de findings */}
                <ul className="mt-4 space-y-2">
                  {FINDINGS.map((finding) => (
                    <li
                      key={finding.title}
                      className="vx-finding-row flex items-center gap-3 rounded-[6px] border border-[rgba(var(--vx-neutral-rgb),0.12)] bg-[var(--vx-bg)] px-3 py-[6px]"
                    >
                      <span
                        className="rounded-[6px] px-[6px] py-[2px] font-mono text-[8px] font-bold text-[var(--vx-on-accent)]"
                        style={{ backgroundColor: finding.color }}
                      >
                        {finding.sev}
                      </span>
                      <span className="truncate font-mono text-[10px] text-[var(--vx-text)]">
                        {finding.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
