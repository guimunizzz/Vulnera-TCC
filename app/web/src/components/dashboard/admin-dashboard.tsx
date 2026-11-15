/**
 * admin-dashboard.tsx
 *
 * Visão do ADMIN: saúde comercial (empresas ativas, assinaturas pendentes)
 * + saúde de segurança (críticos em aberto globais) + quem mais usa a
 * plataforma (top companies por volume de findings). "Empresas ativas" é
 * derivado de Subscription.status === ACTIVE (Company não tem campo
 * isActive — ver schema.prisma) via GET /subscriptions/active (Fase 6).
 *
 * "Top empresas por volume" vem da faceta `company` da busca de findings
 * (FEAT-09), contada por `groupBy` no banco. Antes este componente baixava
 * TODOS os findings de TODAS as empresas para agrupar no navegador — ver o
 * cabeçalho de `use-findings.ts`.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "../../lib/api/companies.api";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { useFindingsResumo } from "../../hooks/use-findings";
import { Check } from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { LinkButton } from "../ui/button";
import { cn } from "../../lib/cn";
import { KpiCard } from "./kpi-card";
import { DashboardCarregando } from "./dashboard-carregando";
import { StaggerItem, StaggerList } from "../../motion/components";
import { useMotion } from "../../motion/use-motion";
import { DURACAO, EASE } from "../../motion/tokens";
import { motion } from "motion/react";

const TOP_COMPANIES_LIMIT = 5;

export function AdminDashboard() {
  const { reduzido } = useMotion();
  const { data: companies, isLoading: loadingCompanies } = useQuery({
    queryKey: ["companies"],
    queryFn: companiesApi.list,
  });
  const { data: activeSubs, isLoading: loadingActive } = useQuery({
    queryKey: ["subscriptions", "active"],
    queryFn: subscriptionsApi.listActive,
  });
  const { data: pendingSubs, isLoading: loadingPending } = useQuery({
    queryKey: ["subscriptions", "pending"],
    queryFn: subscriptionsApi.listPending,
  });
  const resumo = useFindingsResumo();

  const topCompanies = useMemo(
    () =>
      Object.entries(resumo.porEmpresa)
        .map(([companyId, count]) => ({
          companyId,
          count,
          name: companies?.find((c) => c.id === companyId)?.name ?? companyId,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, TOP_COMPANIES_LIMIT),
    [resumo.porEmpresa, companies],
  );

  const maiorVolume = topCompanies[0]?.count ?? 0;

  if (loadingCompanies || loadingActive || loadingPending || resumo.carregando) {
    return <DashboardCarregando rotulo="Carregando dashboard administrativo" />;
  }

  const pendentes = pendingSubs?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <StaggerList className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StaggerItem>
          <KpiCard
            label="Empresas ativas"
            value={activeSubs?.length ?? 0}
            legenda="Com assinatura ativa"
            icon={<CompaniesIcon />}
            tone="accent"
          />
        </StaggerItem>
        <StaggerItem indice={1}>
          <KpiCard
            label="Assinaturas pendentes"
            value={pendentes}
            legenda={pendentes > 0 ? "Aguardando a sua aprovação" : "Nenhuma aprovação aguardando"}
            icon={<PendingIcon />}
            tone={pendentes > 0 ? "warning" : "neutral"}
            accentClassName={pendentes > 0 ? "text-warning-ink" : undefined}
          />
        </StaggerItem>
        <StaggerItem indice={2} className="sm:col-span-2 xl:col-span-1">
          <KpiCard
            label="Críticos em aberto (global)"
            value={resumo.criticosAbertos}
            legenda={resumo.criticosAbertos > 0 ? "Prioridade de tratamento" : "Nada crítico em aberto"}
            icon={<CriticalIcon />}
            tone={resumo.criticosAbertos > 0 ? "critical" : "neutral"}
            accentClassName={resumo.criticosAbertos > 0 ? "text-severity-critical-ink" : undefined}
          />
        </StaggerItem>
      </StaggerList>

      {/* Ranking e fila de aprovações lado a lado (proposta da Fase 5): a
          aprovação deixa de ser um alerta solto mais uma faixa no rodapé. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,1fr)]">
        <Card
          titulo="Empresas por volume de findings"
          descricao="Ranking calculado a partir dos findings visíveis no escopo administrativo."
          acoes={topCompanies.length > 0 ? (
            <Badge tom="neutro" className="whitespace-nowrap">
              {topCompanies.length} {topCompanies.length === 1 ? "empresa" : "empresas"}
            </Badge>
          ) : undefined}
          semPadding
          className="overflow-hidden"
        >
          {topCompanies.length === 0 && (
            <p className="p-5 text-sm text-fg-muted">Nenhum finding registrado ainda.</p>
          )}
          {topCompanies.length > 0 && (
            <StaggerList as="ol" className="mt-4 divide-y divide-subtle border-t border-subtle">
              {topCompanies.map((company, index) => {
                const volumeRelativo = maiorVolume > 0 ? Math.round((company.count / maiorVolume) * 100) : 0;

                return (
                  <StaggerItem
                    as="li"
                    indice={index}
                    key={company.companyId}
                    className="grid gap-3 px-4 py-4 transition-colors duration-fast hover:bg-hovered sm:grid-cols-[2rem_minmax(9rem,1fr)_minmax(10rem,1.4fr)_auto] sm:items-center"
                  >
                    <span className="font-mono text-sm font-semibold text-accent-ink" aria-label={`Posição ${index + 1}`}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 truncate text-sm font-medium text-fg">{company.name}</span>
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-inset"
                        data-volume-relativo={volumeRelativo}
                      >
                        <motion.div
                          className="h-full rounded-full bg-accent"
                          initial={reduzido ? false : { width: 0 }}
                          animate={{ width: `${volumeRelativo}%` }}
                          transition={{ duration: reduzido ? DURACAO.instant : DURACAO.chart, ease: EASE.out }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono text-xs text-fg-muted" data-numeric>
                        {company.count} finding{company.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Link
                      to={`/companies/${company.companyId}/maturity`}
                      className="justify-self-start text-xs font-medium text-accent-ink underline-offset-2 hover:underline sm:justify-self-end"
                    >
                      Maturidade
                    </Link>
                  </StaggerItem>
                );
              })}
            </StaggerList>
          )}
        </Card>

        <Card titulo="Aprovações" descricao="Solicitações de assinatura das empresas.">
          <div className="mt-4 flex items-start gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                pendentes > 0 ? "bg-warning-surface text-warning-ink" : "bg-success-surface text-success-ink",
              )}
            >
              {pendentes > 0 ? <PendingIcon /> : <Check className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-sm font-medium text-fg">
                {pendentes > 0
                  ? `${pendentes} ${pendentes === 1 ? "assinatura aguardando" : "assinaturas aguardando"} aprovação`
                  : "Tudo em dia"}
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                {pendentes > 0
                  ? "Empresas sem aprovação ainda não conseguem cadastrar aplicações."
                  : "Nenhuma aprovação pendente."}
              </p>
            </div>
          </div>
          <LinkButton
            to="/admin/subscriptions"
            variant={pendentes > 0 ? "primario" : "secundario"}
            larguraTotal
            className="mt-5"
          >
            {pendentes > 0 ? "Revisar assinaturas" : "Ver assinaturas"}
          </LinkButton>
        </Card>
      </div>
    </div>
  );
}

function CompaniesIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M2.5 13.5v-10h7v10m-5-7h3m-3 2.5h3m-3 2.5h3m2-4h4v6h-11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.8v3.5l2.2 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CriticalIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M8 1.8 14 13H2L8 1.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 5.5v3.8m0 1.8v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
