/**
 * features.tsx — o que o Vulnera faz hoje, em três grupos que seguem a
 * narrativa da página (encontrar → organizar → corrigir e provar), mais o
 * modal de prévia do relatório.
 *
 * Só entra aqui o que existe no código (conferido em 2026-11-15). O card "IA
 * para Findings" saiu: IA está fora do MVP (ADR-017). Cada limite conhecido é
 * dito logo abaixo do grupo (`limite`) — a landing não promete mais que o
 * produto.
 *
 * Portado de `vulnera-landing/src/components/sections/Features.jsx`.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Calculator, FileBarChart, FileCode2, Gauge, Layers, Radar, Rss, Share2, Timer, X, type LucideIcon,
} from "lucide-react";
import { Reveal, TituloDecodificado } from "../ui";
import { InteractiveLabel } from "../../ui/interactive-label";
import { DURACAO } from "../../../motion/tokens";
import { DESLOCAMENTO_MOTION_LANDING, EASE_MOTION_LANDING, ESCALA_LANDING } from "../motion/tokens";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  tag: string;
  preview?: boolean;
}

interface Grupo {
  rotulo: string;
  frase: string;
  itens: Feature[];
  /** Limite conhecido de um recurso do grupo, dito sem rodeio. */
  limite?: string;
}

const GRUPOS: Grupo[] = [
  {
    rotulo: "ENCONTRAR",
    frase: "De onde vêm os achados.",
    itens: [
      {
        icon: Radar,
        title: "Scanner DAST com OWASP ZAP",
        desc: "Informe um endereço: o ZAP navega pelas páginas e analisa as respostas. Há também um modo simulado, para demonstrar sem tocar no alvo.",
        tag: "DAST",
      },
      {
        icon: FileCode2,
        title: "Importação SAST e SCA",
        desc: "Envie o relatório do Semgrep, CodeQL, Trivy ou Grype. O Vulnera compara com a importação anterior — o que é novo, o que continua, o que sumiu — e a triagem já feita é herdada.",
        tag: "SARIF · CycloneDX",
      },
      {
        icon: Rss,
        title: "Threat Intel",
        desc: "CVEs recém-publicadas são cruzadas com as tecnologias que você cadastrou. Cada uma traz o EPSS (a chance de ser explorada) e gera uma notificação.",
        tag: "CVE · EPSS",
      },
    ],
    limite: "O scanner só navega (Spider) e faz análise passiva: não ataca, não envia formulários e não faz login. Todo alerta passa por triagem humana antes de virar vulnerabilidade.",
  },
  {
    rotulo: "ORGANIZAR",
    frase: "Tudo no mesmo lugar, na mesma régua.",
    itens: [
      {
        icon: Layers,
        title: "Visão unificada por aplicação",
        desc: "Pentest manual, scanner e análise de código na mesma tela. Se algo marcado como corrigido reaparece numa importação, vira “Correção não confirmada”.",
        tag: "DAST + SAST + SCA",
      },
      {
        icon: Share2,
        title: "Exposure Graph",
        desc: "O caminho da exposição, desenhado: Internet → alvo → endpoint → achados. Dá para ver por onde alguém de fora chegaria.",
        tag: "GRAFO",
      },
      {
        icon: Calculator,
        title: "CVSS com override auditado",
        desc: "Cole o vetor e a severidade é calculada. Para mudar na mão é preciso justificar, e a troca fica na trilha de auditoria.",
        tag: "CVSS v3.1",
      },
    ],
  },
  {
    rotulo: "CORRIGIR E PROVAR",
    frase: "Do prazo ao relatório.",
    itens: [
      {
        icon: Timer,
        title: "Remediação com prazo",
        desc: "Cada achado ganha um prazo (SLA) conforme a severidade. O painel separa o que está em dia, o que vence logo e o que estourou.",
        tag: "SLA",
      },
      {
        icon: FileBarChart,
        title: "Relatório PDF e planilha Excel",
        desc: "O PDF é montado no seu navegador. A planilha Excel dos achados é gerada no servidor.",
        tag: "PDF · XLSX",
        preview: true,
      },
      {
        icon: Gauge,
        title: "Maturidade de segurança",
        desc: "Um questionário por domínio vira um score e um radar: mostra onde a empresa está e por onde começar.",
        tag: "7 DOMÍNIOS",
      },
    ],
  },
];

/** Recursos menores, numa linha só: existem, mas não pedem um card. */
const TAMBEM = [
  "Menu de acessibilidade: fonte maior, alto contraste e menos animação",
  "App mobile para o cliente, com aviso de finding crítico",
  "Trilha de auditoria de quem mudou o quê",
];

const PREVIEW_ROWS = [
  { label: "Críticas", pct: "11%", color: "var(--vx-danger)" },
  { label: "Altas", pct: "18%", color: "var(--vx-orange)" },
  { label: "Médias", pct: "29%", color: "var(--vx-yellow)" },
  { label: "Baixas", pct: "42%", color: "var(--vx-accent-soft)" },
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
        initial={{ opacity: 0, y: DESLOCAMENTO_MOTION_LANDING.overlay, scale: ESCALA_LANDING.overlay }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: DESLOCAMENTO_MOTION_LANDING.overlay, scale: ESCALA_LANDING.overlay }}
        transition={{ duration: DURACAO.base, ease: EASE_MOTION_LANDING.saida }}
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
          Resumo de risco por severidade e a lista dos achados do projeto, num PDF montado no navegador.
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
    <section id="recursos" data-ato="3" className="vx-grid-bg flex min-h-screen items-center px-6 py-24">
      <div className="vx-superficie mx-auto w-full max-w-5xl">
        <Reveal className="text-center" variante="fade">
          <p className="font-mono text-sm tracking-widest text-[var(--vx-accent)]">{"// RECURSOS"}</p>
          <TituloDecodificado className="mt-4 text-3xl font-bold text-[var(--vx-text)] md:text-4xl">
            O que o Vulnera faz hoje
          </TituloDecodificado>
          <p className="mx-auto mt-4 max-w-xl text-[var(--vx-text-2)]">
            Nada de promessa: tudo abaixo já funciona na plataforma. Onde há limite, ele está escrito.
          </p>
        </Reveal>

        {GRUPOS.map((grupo) => (
          <div key={grupo.rotulo} className="mt-16">
            <Reveal variante="fade" className="flex items-baseline gap-4">
              <h3 className="shrink-0 font-mono text-sm font-bold tracking-widest text-[var(--vx-accent)]">
                {grupo.rotulo}
              </h3>
              <span className="h-px flex-1 bg-[rgba(var(--vx-accent-rgb),0.2)]" aria-hidden="true" />
              <p className="shrink-0 text-sm text-[var(--vx-text-3)]">{grupo.frase}</p>
            </Reveal>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {grupo.itens.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <Reveal key={feature.title} ordem={i} className="flex">
                    <div className="group relative flex w-full flex-col rounded-[6px] border border-[rgba(var(--vx-accent-rgb),0.15)] bg-[var(--vx-bg-2)] p-6 transition-all duration-[300ms] hover:-translate-y-[2px] hover:border-[rgba(var(--vx-accent-rgb),0.5)] hover:shadow-[0_0_28px_rgba(var(--vx-accent-rgb),0.18)]">
                      <div className="flex items-start justify-between gap-4">
                        <Icon
                          size={28}
                          className="shrink-0 text-[var(--vx-accent)]"
                          style={{ filter: "drop-shadow(0 0 8px rgba(var(--vx-accent-rgb),0.4))" }}
                          aria-hidden="true"
                        />
                        <p className="text-right font-mono text-xs tracking-widest text-[var(--vx-accent-soft)]">
                          {feature.tag}
                        </p>
                      </div>
                      <h4 className="mt-6 text-lg font-bold leading-snug text-[var(--vx-text)]">{feature.title}</h4>
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-[var(--vx-text-2)]">{feature.desc}</p>
                      {feature.preview && (
                        <button
                          type="button"
                          onClick={() => setPreviewOpen(true)}
                          className="mt-4 self-start font-mono text-xs tracking-wide text-[var(--vx-accent-soft)] underline-offset-2 transition-colors hover:text-[var(--vx-accent)] hover:underline"
                        >
                          <InteractiveLabel effect="glitch">Ver exemplo ↗</InteractiveLabel>
                        </button>
                      )}
                    </div>
                  </Reveal>
                );
              })}
            </div>

            {grupo.limite && (
              <Reveal variante="fade">
                <p className="mt-4 border-l-2 border-[rgba(var(--vx-accent-rgb),0.4)] pl-4 text-sm leading-relaxed text-[var(--vx-text-2)]">
                  <span className="font-mono text-xs tracking-widest text-[var(--vx-accent-soft)]">LIMITE DO DAST · </span>
                  {grupo.limite}
                </p>
              </Reveal>
            )}
          </div>
        ))}

        <Reveal variante="fade" className="mt-12">
          <ul className="flex flex-col gap-3 border-t border-[rgba(var(--vx-accent-rgb),0.15)] pt-6 text-sm text-[var(--vx-text-2)] md:flex-row md:gap-8">
            {TAMBEM.map((item) => (
              <li key={item} className="flex flex-1 items-start gap-2">
                <span className="text-[var(--vx-accent)]" aria-hidden="true">▸</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <AnimatePresence>
        {previewOpen && <ReportPreviewModal onClose={() => setPreviewOpen(false)} />}
      </AnimatePresence>
    </section>
  );
}
