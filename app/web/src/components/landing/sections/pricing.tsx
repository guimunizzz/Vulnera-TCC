/**
 * pricing.tsx — os três planos.
 *
 * Portado de `vulnera-landing/src/components/sections/Pricing.jsx`.
 *
 * TODO(landing): o conteúdo dos planos está fixo aqui (decisão de escopo desta
 * branch). Quando for ligar na API, trocar `PLANS` por `plansApi.list()` +
 * `useQuery(["plans"])` — a mesma queryKey de `plans-page.tsx` — e formatar
 * preço/limites a partir do `Plan`.
 */

import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Reveal, GlitchHeading } from "../ui";
import { InteractiveLabel } from "../../ui/interactive-label";

const MotionLink = motion.create(Link);

interface Plan {
  name: string;
  price: string;
  features: string[];
  cta: string;
  highlight: boolean;
  cyan: boolean;
}

const PLANS: Plan[] = [
  {
    name: "BASIC",
    price: "R$ 499/mês",
    features: ["2 aplicações", "1 projeto simultâneo", "Suporte por e-mail", "Relatórios PDF"],
    cta: "Começar com Basic",
    highlight: false,
    cyan: false,
  },
  {
    name: "PRO",
    price: "R$ 1.499/mês",
    features: [
      "5 aplicações",
      "3 projetos simultâneos",
      "Serviço de remediação incluso",
      "Sugestões por IA",
      "Relatórios PDF",
      "Suporte prioritário",
    ],
    cta: "Começar com Pro",
    highlight: true,
    cyan: false,
  },
  {
    name: "ENTERPRISE",
    price: "Sob consulta",
    features: ["Aplicações ilimitadas", "Projetos ilimitados", "SLA dedicado", "Tudo do Pro"],
    cta: "Falar com vendas",
    highlight: false,
    cyan: true,
  },
];

export default function Pricing() {
  return (
    <section id="planos" className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24">
      <div className="mx-auto w-full max-w-6xl">
        <Reveal className="text-center">
          <GlitchHeading className="text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            Planos que cabem na sua empresa.
          </GlitchHeading>
          <p className="mt-4 text-[var(--vx-text-2)]">Comece pelo Basic, escale quando precisar.</p>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 items-stretch gap-8 md:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 150} className="flex">
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`relative flex w-full flex-col rounded-[6px] bg-[var(--vx-bg-2)] p-8 transition-shadow duration-[300ms] ${
                  plan.highlight
                    ? "border-2 border-[var(--vx-accent)] shadow-[0_0_36px_rgba(var(--vx-accent-rgb),0.25)] md:scale-105"
                    : plan.cyan
                      ? "border border-[var(--vx-cyan)] hover:shadow-[0_0_20px_rgba(var(--vx-cyan-rgb),0.2)]"
                      : "border border-[rgba(var(--vx-neutral-rgb),0.25)] hover:border-[rgba(var(--vx-accent-rgb),0.4)]"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-[6px] bg-[var(--vx-accent)] px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-[var(--vx-on-accent)]">
                    MAIS POPULAR
                  </span>
                )}

                <h3 className="font-mono text-xl font-bold tracking-widest text-[var(--vx-text)]">
                  {plan.name}
                </h3>
                <p className="mt-3 text-3xl font-bold text-[var(--vx-text)]">{plan.price}</p>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[var(--vx-text-2)]">
                      <span className="text-[var(--vx-accent)]" aria-hidden="true">
                        ▸
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <MotionLink
                  to="/register"
                  whileTap={{ scale: 0.97 }}
                  className={`mt-10 rounded-[6px] px-6 py-3 text-center font-mono text-sm font-bold tracking-wide transition-all duration-[300ms] ${
                    plan.highlight
                      ? "bg-[var(--vx-accent)] text-[var(--vx-on-accent)] hover:shadow-[0_0_24px_rgba(var(--vx-accent-rgb),0.6)]"
                      : plan.cyan
                        ? "border border-[var(--vx-cyan)] text-[var(--vx-cyan)] hover:bg-[rgba(var(--vx-cyan-rgb),0.08)]"
                        : "border border-[rgba(var(--vx-neutral-rgb),0.4)] text-[var(--vx-text)] hover:border-[var(--vx-accent)] hover:text-[var(--vx-accent)]"
                  }`}
                >
                  <InteractiveLabel>{plan.cta}</InteractiveLabel>
                </MotionLink>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
