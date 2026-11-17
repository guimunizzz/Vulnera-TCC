/**
 * dashboard-header.tsx
 *
 * O QUE FAZ
 * Cabeçalho compacto de `/dashboard`, igual para os três papéis: rótulo do
 * escopo, saudação real, uma linha de contexto com os críticos em aberto e
 * o atalho para a triagem.
 *
 * POR QUE EXISTE
 * Substitui o hero grande (Fase 5 do refactor web-motion-3d, proposta em
 * `output/ui-redesign-preview/`): a primeira dobra passa a dizer o que pede
 * atenção em vez de um slogan. O número vem de `useFindingsResumo`, a mesma
 * consulta que os dashboards por papel já fazem — o cache do TanStack Query
 * evita uma segunda chamada.
 *
 * QUEM USA
 * `pages/dashboard-page.tsx`.
 */

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { LinkButton } from "../ui/button";
import { STATUS_ABERTOS, useFindingsResumo } from "../../hooks/use-findings";
import { useMotion } from "../../motion/use-motion";
import type { UserRole } from "../../types/auth.types";

const ESCOPO: Record<UserRole, string> = {
  ADMIN: "Visão geral da plataforma",
  CLIENT: "Visão geral da empresa",
  PENTESTER: "Sua operação",
};

/** Recorte da triagem com os mesmos filtros do contador "críticos em aberto". */
export const ROTA_CRITICOS_ABERTOS = `/findings?severity=CRITICAL&status=${STATUS_ABERTOS.join(",")}`;

export function DashboardHeader({ userName, role }: { userName: string; role?: UserRole }) {
  const { item } = useMotion();
  const resumo = useFindingsResumo();
  const criticos = resumo.criticosAbertos;

  return (
    <motion.header
      aria-labelledby="dashboard-heading"
      className="atmosfera-veu flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      variants={item}
      initial="inicial"
      animate="visivel"
    >
      <div className="min-w-0">
        {role && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">{ESCOPO[role]}</p>
        )}
        <h1 id="dashboard-heading" className="mt-2 text-3xl font-semibold tracking-tight text-fg">
          Olá, {userName}
        </h1>
        <p className="mt-2 text-sm text-fg-secondary" aria-live="polite">
          {resumo.carregando ? (
            "Carregando o resumo do seu escopo…"
          ) : criticos > 0 ? (
            <>
              <strong className="font-semibold text-severity-critical-ink" data-numeric>
                {criticos} {criticos === 1 ? "crítico" : "críticos"}
              </strong>{" "}
              aguardando tratamento no seu escopo.
            </>
          ) : (
            "Nenhum finding crítico em aberto no seu escopo."
          )}
        </p>
      </div>

      <LinkButton
        to={criticos > 0 ? ROTA_CRITICOS_ABERTOS : "/findings"}
        variant="secundario"
        className="shrink-0 self-start sm:self-auto"
        iconeInicio={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
      >
        {criticos > 0 ? "Revisar críticos" : "Explorar findings"}
      </LinkButton>
    </motion.header>
  );
}
