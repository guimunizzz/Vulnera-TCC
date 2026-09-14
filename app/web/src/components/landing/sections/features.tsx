/**
 * features.tsx — grade de "killer features" + modal de prévia do relatório.
 *
 * Portado de `vulnera-landing/src/components/sections/Features.jsx`.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Calculator, FileBarChart, Smartphone, Sparkles, X, type LucideIcon } from "lucide-react";
import { Reveal, GlitchHeading } from "../ui";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  tag: string;
  preview?: boolean;
}

const FEATURES: Feature[] = [
  {
    icon: Calculator,
    title: "CVSS Automático",
    desc: "Cole o vetor CVSS, severidade calcula sozinha. Override manual com justificativa fica auditado.",
    tag: "CVSS v3.1",
  },
  {
    icon: FileBarChart,
    title: "Relatório PDF",
    desc: "Gerado direto no seu navegador — os dados da vulnerabilidade nunca passam por um servidor pra virar PDF. Executivo de 3 páginas, técnico de 20+.",
    tag: "PDF",
    preview: true,
  },
  {
    icon: Smartphone,
    title: "Mobile App",
    desc: "Cliente acompanha da palma da mão: push de findings críticos por categoria e leitura de relatório, direto do app.",
    tag: "EXPO",
  },
  {
    icon: Sparkles,
    title: "IA para Findings",
    desc: "Sugestão de descrição, categoria OWASP e recomendação a partir do título do finding. Você sempre revisa e aprova antes de salvar.",
    tag: "IA",
  },
];

const PREVIEW_ROWS = [
  { label: "Críticas", pct: "11%", color: "var(--vx-danger)" },
  { label: "Altas", pct: "18%", color: "var(--vx-orange)" },
  { label: "Médias", pct: "29%", color: "var(--vx-yellow)" },
  { label: "Baixas", pct: "42%", color: "var(--vx-cyan)" },
];

function ReportPreviewModal({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Exemplo de relatório executivo"
      className="fixed inset-0 z-[50] flex items-center justify-center bg-[rgba(0,0,0,0.7)] px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.3)] bg-[var(--vx-bg-2)] p-8 shadow-[0_0_50px_rgba(var(--vx-accent-rgb),0.15)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 text-[var(--vx-text-2)] transition-colors hover:text-[var(--vx-accent)]"
        >
          <X size={18} />
        </button>

        <p className="font-mono text-[10px] tracking-widest text-[var(--vx-accent)]">
          {"// PRÉVIA — RELATÓRIO EXECUTIVO"}
        </p>
        <h3 className="mt-3 text-xl font-bold text-[var(--vx-text)]">Vulnera Security</h3>
        <p className="mt-1 font-mono text-xs text-[var(--vx-text-2)]">
          TechNova Solutions · gerado em 22/08/2026
        </p>

        <div className="mt-6 space-y-2">
          {PREVIEW_ROWS.map((row) => (
            <div key={row.label} className="flex items-center gap-3 text-xs">
              <span className="w-[56px] shrink-0 text-[var(--vx-text-2)]">{row.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(var(--vx-neutral-rgb),0.15)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: row.pct, backgroundColor: row.color }}
                />
              </div>
              <span className="w-[36px] shrink-0 text-right font-mono text-[var(--vx-text)]">
                {row.pct}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm leading-relaxed text-[var(--vx-text-2)]">
          Resumo de risco, score de maturidade e recomendações priorizadas — pronto pra ser enviado ao
          cliente sem edição manual.
        </p>

        <p className="mt-6 font-mono text-[10px] tracking-wide text-[var(--vx-text-3)]">
          Prévia ilustrativa — o relatório real é gerado a partir dos findings do seu projeto.
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function Features() {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <section id="recursos" className="vx-grid-bg flex min-h-screen items-center bg-[var(--vx-bg)] px-6 py-24">
      <div className="mx-auto w-full max-w-5xl">
        <Reveal className="text-center">
          <GlitchHeading className="text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            Killer features
          </GlitchHeading>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={i * 120}>
                <div className="group relative flex h-full flex-col rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.15)] bg-[var(--vx-bg-2)] p-8 transition-all duration-[300ms] hover:-translate-y-[2px] hover:border-[rgba(var(--vx-accent-rgb),0.5)] hover:shadow-[0_0_28px_rgba(var(--vx-accent-rgb),0.18)]">
                  <Icon
                    size={40}
                    className="text-[var(--vx-accent)]"
                    style={{ filter: "drop-shadow(0 0 8px rgba(var(--vx-accent-rgb),0.4))" }}
                    aria-hidden="true"
                  />
                  <h3 className="mt-6 text-xl font-bold text-[var(--vx-text)]">{feature.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--vx-text-2)]">
                    {feature.desc}
                  </p>
                  <div className="mt-6 flex items-end justify-between">
                    {feature.preview ? (
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="font-mono text-xs tracking-wide text-[var(--vx-cyan)] underline-offset-2 transition-colors hover:text-[var(--vx-accent)] hover:underline"
                      >
                        Ver exemplo ↗
                      </button>
                    ) : (
                      <span />
                    )}
                    <p className="font-mono text-xs tracking-widest text-[var(--vx-cyan)]">{feature.tag}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {previewOpen && <ReportPreviewModal onClose={() => setPreviewOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}
