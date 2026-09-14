/**
 * problem.tsx — o problema que a Vulnera resolve, com o mockup da "planilha
 * caótica" ao lado.
 *
 * Portado de `vulnera-landing/src/components/sections/Problem.jsx`.
 */

import { useMemo } from "react";
import { X } from "lucide-react";
import { Reveal, GlitchHeading } from "../ui";

const PAINS = [
  "Findings espalhados em planilhas que ninguém atualiza",
  "Evidências (prints, logs) perdidas em pastas soltas, sem contexto",
  "Comunicação cliente-analista perdida em e-mails",
  "Zero trilha de auditoria de quem mudou o quê",
];

// Células fixas "em alerta" da planilha caótica (índices de um grid 4x6)
const ALERT_CELLS = new Set<number>([1, 5, 8, 14, 19, 22]);

export default function Problem() {
  const cells = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  return (
    <section className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-16 md:grid-cols-5">
        {/* Coluna esquerda (60%) */}
        <div className="md:col-span-3">
          <Reveal>
            <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">
              {"// O PROBLEMA"}
            </p>
            <GlitchHeading className="mt-4 text-3xl font-bold leading-tight text-[var(--vx-text)] md:text-[3rem]">
              Consultorias de segurança ainda operam em 2003.
            </GlitchHeading>
          </Reveal>

          <ul className="mt-10 space-y-5">
            {PAINS.map((pain, i) => (
              <Reveal
                key={pain}
                as="li"
                delay={i * 100}
                className="flex items-start gap-3 font-mono text-sm text-[var(--vx-text)] md:text-base"
              >
                <span
                  className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border border-[rgba(var(--vx-danger-rgb),0.4)] text-[var(--vx-danger)]"
                  aria-hidden="true"
                >
                  <X size={11} strokeWidth={3} />
                </span>
                <span>{pain}</span>
              </Reveal>
            ))}
          </ul>
        </div>

        {/* Coluna direita (40%) — planilha caótica */}
        <Reveal className="md:col-span-2" delay={200}>
          <div
            className="rounded-[6px] border border-[rgba(var(--vx-danger-rgb),0.25)] bg-[var(--vx-bg-2)] p-4"
            aria-hidden="true"
          >
            <div className="mb-3 flex items-center justify-between font-mono text-[10px] text-[var(--vx-text-2)]">
              <span>findings_FINAL_v7 (2).xlsx</span>
              <span className="text-[var(--vx-danger)]">não salvo*</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {cells.map((i) => (
                <div
                  key={i}
                  className={`h-10 rounded-[3px] border border-[rgba(var(--vx-neutral-rgb),0.12)] ${
                    ALERT_CELLS.has(i) ? "vx-cell-alert" : "bg-[rgba(var(--vx-neutral-rgb),0.05)]"
                  }`}
                  style={ALERT_CELLS.has(i) ? { animationDelay: `${(i % 5) * 250}ms` } : undefined}
                />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
