/**
 * dashboard-hero.tsx
 *
 * O QUE FAZ
 * Cabeçalho compartilhado de `/dashboard`: saudação real, mensagem de produto,
 * fallback CSS. A cena lazy é compartilhada pela página via DashboardAtmosphere.
 *
 * POR QUE EXISTE
 * Mantém a atmosfera visual independente dos dashboards por papel e garante
 * que CLIENT, PENTESTER e ADMIN recebam a mesma abertura sem duplicação.
 *
 * QUEM USA
 * `pages/dashboard-page.tsx`.
 */

import { motion } from "motion/react";
import { useMotion } from "../../../motion/use-motion";
import { DashboardHeroFallback } from "./dashboard-hero-fallback";
import "./dashboard-hero.css";

export function DashboardHero({ userName }: { userName: string }) {
  const { item } = useMotion();

  return (
    <motion.section
      aria-labelledby="dashboard-heading"
      className="dashboard-hero-surface relative isolate min-h-[11rem] overflow-hidden rounded-container border border-subtle"
      variants={item}
      initial="inicial"
      animate="visivel"
    >
      <DashboardHeroFallback />

      <div className="relative z-base grid min-h-[11rem] items-center gap-6 px-5 py-6 sm:px-6 md:grid-cols-[minmax(0,1.35fr)_minmax(12rem,0.65fr)] md:px-8">
        <div className="max-w-prose">
          <div className="mb-3 flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-wide text-accent-ink">
            <span aria-hidden="true" className="h-px w-8 bg-accent" />
            Dashboard
          </div>
          <h1 id="dashboard-heading" className="text-3xl font-bold text-fg md:text-4xl">
            Olá, {userName}
          </h1>
          <p className="mt-3 max-w-prose text-sm text-fg-secondary sm:text-base">
            Bem-vindo à Vulnera. Esta é a sua área de trabalho.
          </p>
        </div>

        <p
          aria-hidden="true"
          className="hidden justify-self-end border-l border-accent/35 pl-5 text-right text-lg font-semibold text-fg-secondary sm:block md:text-xl"
        >
          Menos riscos.
          <br />
          <span className="text-accent-ink">Mais segurança.</span>
        </p>
      </div>
    </motion.section>
  );
}
