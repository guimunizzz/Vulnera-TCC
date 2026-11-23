/**
 * dashboard-header.tsx
 *
 * O QUE FAZ
 * Cabeçalho compacto de `/dashboard`, igual para os três papéis: rótulo do
 * escopo, saudação real, uma linha de contexto com os críticos em aberto e
 * o atalho para a triagem. Também publica o risco do escopo para a atmosfera
 * (nebulosa) e abre o modo apresentação (o conteúdo em tela cheia, com a
 * atmosfera imersiva).
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

import { ArrowRight, Maximize2, Minimize2 } from "lucide-react";
import { motion } from "motion/react";
import { Button, LinkButton } from "../ui/button";
import { STATUS_ABERTOS, useFindingsResumo } from "../../hooks/use-findings";
import { useMotion } from "../../motion/use-motion";
import type { UserRole } from "../../types/auth.types";
import { useApresentacao } from "../../features/atmosfera-3d/apresentacao";
import { riscoDoDashboard, usePublicarRisco } from "../../features/atmosfera-3d/risco";

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
  const apresentacao = useApresentacao();
  // A nebulosa esquenta com a severidade do escopo (dado que esta tela já carregou).
  usePublicarRisco(resumo.carregando ? undefined : riscoDoDashboard(resumo));

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

      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
        {apresentacao.disponivel && (
          <Button
            variant="fantasma"
            aria-pressed={apresentacao.ativa}
            onClick={apresentacao.alternar}
            iconeInicio={apresentacao.ativa ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          >
            {apresentacao.ativa ? "Sair da apresentação" : "Apresentar"}
          </Button>
        )}
        <LinkButton
          to={criticos > 0 ? ROTA_CRITICOS_ABERTOS : "/findings"}
          variant="secundario"
          iconeInicio={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
        >
          {criticos > 0 ? "Revisar críticos" : "Explorar findings"}
        </LinkButton>
      </div>
    </motion.header>
  );
}
