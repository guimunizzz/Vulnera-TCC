/**
 * comparison.tsx — tabela "Vulnera x do jeito antigo".
 *
 * Portado de `vulnera-landing/src/components/sections/Comparison.jsx`.
 */

import { Check, X } from "lucide-react";
import { Reveal, GlitchHeading } from "../ui";
import { InteractiveLabel } from "../../ui/interactive-label";

const ROWS = [
  { aspect: "Tempo pra abrir um projeto", vulnera: "Em até 1 dia útil", old: "2-4 semanas de proposta" },
  { aspect: "Escopo do teste", vulnera: "Definido na própria plataforma", old: "Várias calls de alinhamento" },
  { aspect: "Evidências", vulnera: "Anexadas a cada finding", old: "Prints soltos em pastas" },
  {
    aspect: "Auditoria",
    vulnera: "Toda mudança de severidade registrada",
    old: "Zero rastro de quem alterou o quê",
  },
  {
    aspect: "Reteste de correções",
    vulnera: "Fluxo de revalidação incluso",
    old: "Cobrado à parte, sem processo formal",
  },
  {
    aspect: "Relatório final",
    vulnera: "PDF executivo + técnico, no navegador",
    old: "Documento estático",
  },
];

export default function Comparison() {
  return (
    <section className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24">
      <div className="mx-auto w-full max-w-4xl">
        <Reveal className="text-center">
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">{"// DIFERENCIAIS"}</p>
          <GlitchHeading className="mt-4 text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            Chega de operar como em 2003.
          </GlitchHeading>
          <p className="mx-auto mt-4 max-w-xl text-[var(--vx-text-2)]">
            O mesmo processo que sua consultoria já faz — só que rastreável, auditável e sem planilha
            perdida.
          </p>
        </Reveal>

        <Reveal delay={150} className="mt-16">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr] gap-4 border-b border-[rgba(var(--vx-accent-rgb),0.15)] pb-3 font-mono text-xs tracking-widest text-[var(--vx-text-3)] md:grid">
            <span>ASPECTO</span>
            <span className="text-[var(--vx-accent)]">VULNERA</span>
            <span>DO JEITO ANTIGO</span>
          </div>

          {ROWS.map((row) => (
            <div
              key={row.aspect}
              className="grid grid-cols-1 gap-2 border-b border-[rgba(var(--vx-accent-rgb),0.08)] py-4 md:grid-cols-[1.2fr_1fr_1fr] md:items-center md:gap-4"
            >
              <span className="font-bold text-[var(--vx-text)] md:font-regular md:text-sm">
                {row.aspect}
              </span>
              <span className="flex items-center gap-2 text-sm font-bold text-[var(--vx-text)] md:text-base">
                <Check size={16} className="shrink-0 text-[var(--vx-accent)]" aria-hidden="true" />
                {row.vulnera}
              </span>
              <span className="flex items-center gap-2 text-sm text-[var(--vx-text-3)] md:text-base">
                <X size={16} className="shrink-0 text-[var(--vx-text-3)]" aria-hidden="true" />
                {row.old}
              </span>
            </div>
          ))}
        </Reveal>

        <Reveal delay={300} className="mt-12 text-center">
          <a
            href="#planos"
            className="inline-block rounded-[6px] border border-[rgba(var(--vx-neutral-rgb),0.4)] px-8 py-3 font-mono text-sm font-bold tracking-wide text-[var(--vx-text)] transition-all duration-[300ms] hover:border-[var(--vx-accent)] hover:text-[var(--vx-accent)]"
          >
            <InteractiveLabel>Ver planos →</InteractiveLabel>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
