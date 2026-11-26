/**
 * comparison.tsx — tabela "Vulnera x do jeito antigo".
 *
 * Portado de `vulnera-landing/src/components/sections/Comparison.jsx`.
 */

import { Check, X } from "lucide-react";
import { Reveal, TituloDecodificado } from "../ui";
import { InteractiveLabel } from "../../ui/interactive-label";

// Cada linha da coluna VULNERA foi conferida no código em 2026-11-15. Saíram
// "em até 1 dia útil" (não há prazo no produto) e "fluxo de revalidação" (a
// máquina de status tem 4 estados, sem revalidação — ADR-021).
const ROWS = [
  { aspect: "Pedido de um projeto", vulnera: "Solicitado e aprovado na plataforma", old: "Proposta trocada por e-mail" },
  { aspect: "Escopo do teste", vulnera: "Dentro e fora do escopo, no projeto", old: "Combinado em várias reuniões" },
  { aspect: "Evidências", vulnera: "Anexadas a cada finding", old: "Prints soltos em pastas" },
  {
    aspect: "Origem dos achados",
    vulnera: "Pentest, DAST, SAST e SCA na mesma tela",
    old: "Um relatório por ferramenta",
  },
  {
    aspect: "Auditoria",
    vulnera: "Toda mudança de severidade registrada",
    old: "Sem rastro de quem alterou o quê",
  },
  {
    aspect: "Prazo de correção",
    vulnera: "SLA por severidade, com reabertura registrada",
    old: "Sem prazo e sem histórico",
  },
  {
    aspect: "Relatório final",
    vulnera: "PDF executivo e técnico, mais planilha Excel",
    old: "Documento estático",
  },
];

export default function Comparison() {
  return (
    <section className="vx-grid-bg flex min-h-screen items-center px-6 py-24">
      <div className="vx-superficie mx-auto w-full max-w-4xl">
        <Reveal className="text-center" variante="fade">
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">{"// DIFERENCIAIS"}</p>
          <TituloDecodificado className="mt-4 text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            Chega de operar como em 2003.
          </TituloDecodificado>
          <p className="mx-auto mt-4 max-w-xl text-[var(--vx-text-2)]">
            O mesmo processo que sua consultoria já faz — só que rastreável, auditável e sem planilha
            perdida.
          </p>
        </Reveal>

        <Reveal ordem={1} className="mt-16" variante="mascara">
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

        <Reveal ordem={2} className="mt-12 text-center">
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
