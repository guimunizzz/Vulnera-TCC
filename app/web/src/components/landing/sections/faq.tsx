/**
 * faq.tsx — acordeão de perguntas frequentes.
 *
 * Portado de `vulnera-landing/src/components/sections/FAQ.jsx`.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Reveal, GlitchHeading } from "../ui";
import { InteractiveLabel } from "../../ui/interactive-label";

interface QA {
  q: string;
  a: string;
}

const QUESTIONS: QA[] = [
  {
    q: "Posso trocar de plano depois?",
    a: "Sim. O upgrade é imediato e libera os novos limites na hora; o downgrade entra a partir do próximo ciclo.",
  },
  {
    q: "O que acontece se eu passar do limite de aplicações ou projetos?",
    a: "Você recebe um aviso e pode fazer upgrade a qualquer momento. Nada é bloqueado no meio de uma análise em andamento.",
  },
  {
    q: "O serviço de remediação está incluso em todos os planos?",
    a: "Só no Pro e no Enterprise. No Basic, a remediação das vulnerabilidades encontradas fica por conta do seu time.",
  },
  {
    q: "Preciso de contrato de fidelidade?",
    a: "Não. Basic e Pro são mensais, sem fidelidade. O Enterprise tem SLA dedicado combinado direto com o time comercial.",
  },
];

interface FAQItemProps {
  item: QA;
  open: boolean;
  onToggle: () => void;
}

function FAQItem({ item, open, onToggle }: FAQItemProps) {
  return (
    <div className="border-b border-[rgba(var(--vx-accent-rgb),0.15)] py-5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="font-mono text-sm text-[var(--vx-text)] md:text-base"><InteractiveLabel effect="glitch">{item.q}</InteractiveLabel></span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-[var(--vx-accent)]"
          aria-hidden="true"
        >
          <Plus size={18} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--vx-text-2)]">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="vx-grid-bg bg-[var(--vx-bg)] px-6 py-24">
      <div className="mx-auto w-full max-w-2xl">
        <Reveal className="text-center">
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">
            {"// PERGUNTAS FREQUENTES"}
          </p>
          <GlitchHeading className="mt-4 text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            Antes de assinar.
          </GlitchHeading>
        </Reveal>

        <Reveal delay={150} className="mt-12">
          {QUESTIONS.map((item, i) => (
            <FAQItem
              key={item.q}
              item={item}
              open={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
