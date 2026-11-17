/**
 * faq.tsx — acordeão de perguntas frequentes.
 *
 * Portado de `vulnera-landing/src/components/sections/FAQ.jsx`.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Reveal, TituloDecodificado } from "../ui";
import { InteractiveLabel } from "../../ui/interactive-label";
import { DURACAO } from "../../../motion/tokens";
import { DURACAO_MOTION_LANDING, EASE_MOTION_LANDING } from "../motion/tokens";

interface QA {
  q: string;
  a: string;
}

// Respostas conferidas no código em 2026-11-15. Saíram as perguntas sobre
// troca de plano e fidelidade: não existe fluxo de upgrade/downgrade nem
// cobrança no produto (pagamento real está fora do MVP).
const QUESTIONS: QA[] = [
  {
    q: "O scanner ataca a minha aplicação?",
    a: "Não. No modo real, o OWASP ZAP só navega pelas páginas (Spider) e analisa as respostas (análise passiva). Não faz ataque ativo, não envia formulários e não faz login. Existe também um modo simulado, que demonstra o fluxo sem acessar o alvo.",
  },
  {
    q: "Todo alerta do scanner vira vulnerabilidade?",
    a: "Não. O alerta entra numa fila de triagem. Uma pessoa analisa e decide se promove para vulnerabilidade — nada é promovido sozinho.",
  },
  {
    q: "O que acontece se eu atingir o limite do plano?",
    a: "A plataforma não deixa cadastrar uma nova aplicação ou abrir um novo projeto além do limite. O que já existe continua acessível.",
  },
  {
    q: "O serviço de remediação está incluso em todos os planos?",
    a: "Só no Pro e no Enterprise. No Basic, corrigir as vulnerabilidades encontradas fica por conta do seu time.",
  },
  {
    q: "Como eu contrato?",
    a: "Você cria a conta, escolhe um plano e envia a solicitação. Um administrador do Vulnera aprova. Não há pagamento online nesta versão.",
  },
  {
    q: "O Vulnera usa IA?",
    a: "Não nesta versão. A IA foi retirada do escopo do MVP por decisão de projeto: classificação, triagem e correção são feitas por pessoas.",
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
          transition={{ duration: DURACAO.base }}
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
            transition={{ duration: DURACAO_MOTION_LANDING.alternancia, ease: EASE_MOTION_LANDING.alternancia }}
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
    <section className="vx-grid-bg px-6 py-24">
      <div className="vx-superficie mx-auto w-full max-w-2xl">
        <Reveal className="text-center" variante="fade">
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">
            {"// PERGUNTAS FREQUENTES"}
          </p>
          <TituloDecodificado className="mt-4 text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            Antes de começar.
          </TituloDecodificado>
        </Reveal>

        <Reveal ordem={1} className="mt-12">
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
