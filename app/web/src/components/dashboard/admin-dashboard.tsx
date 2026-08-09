/**
 * admin-dashboard.tsx
 *
 * Visão do ADMIN: saúde comercial (empresas ativas, assinaturas pendentes)
 * + saúde de segurança (críticos em aberto globais) + quem mais usa a
 * plataforma (top companies por volume de findings). "Empresas ativas" é
 * derivado de Subscription.status === ACTIVE (Company não tem campo
 * isActive — ver schema.prisma) via GET /subscriptions/active (Fase 6).
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "../../lib/api/companies.api";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { vulnerabilitiesApi } from "../../lib/api/vulnerabilities.api";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { LinkButton } from "../ui/button";
import { Alert } from "../ui/alert";
import { KpiCard } from "./kpi-card";

const TOP_COMPANIES_LIMIT = 5;

export function AdminDashboard() {
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
  const { data: findings, isLoading: loadingFindings } = useQuery({
    queryKey: ["vulnerabilities", "all"],
    queryFn: vulnerabilitiesApi.list, // ADMIN — vem tudo, de todas as companies
  });

  const stats = useMemo(() => {
    const list = findings ?? [];
    const criticalOpenGlobal = list.filter((f) => f.severityFinal === "CRITICAL" && f.status !== "CLOSED").length;

    const countByCompany = list.reduce<Record<string, number>>((acc, f) => {
      acc[f.companyId] = (acc[f.companyId] ?? 0) + 1;
      return acc;
    }, {});
    const topCompanies = Object.entries(countByCompany)
      .map(([companyId, count]) => ({
        companyId,
        count,
        name: companies?.find((c) => c.id === companyId)?.name ?? companyId,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_COMPANIES_LIMIT);

    return { criticalOpenGlobal, topCompanies };
  }, [findings, companies]);

  if (loadingCompanies || loadingActive || loadingPending || loadingFindings) {
    return <p className="text-fg-muted">Carregando...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Empresas ativas" value={activeSubs?.length ?? 0} />
        <KpiCard label="Assinaturas pendentes" value={pendingSubs?.length ?? 0} />
        <KpiCard
          label="Críticos em aberto (global)"
          value={stats.criticalOpenGlobal}
          accentClassName={stats.criticalOpenGlobal > 0 ? "text-severity-critical-ink" : undefined}
        />
      </div>

      {(pendingSubs?.length ?? 0) > 0 && (
        <Alert>
          {pendingSubs!.length} assinatura{pendingSubs!.length > 1 ? "s" : ""} aguardando aprovação.{" "}
          <Link to="/admin/subscriptions" className="underline">
            Revisar agora
          </Link>
          .
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Top empresas por volume de findings</CardTitle>
        </CardHeader>
        {stats.topCompanies.length === 0 && <p className="text-sm text-fg-muted">Nenhum finding registrado ainda.</p>}
        <ul className="flex flex-col gap-2">
          {stats.topCompanies.map((c) => (
            <li key={c.companyId} className="flex items-center justify-between rounded-control bg-canvas px-3 py-2 text-sm">
              <span className="text-fg">{c.name}</span>
              <span className="text-fg-muted">{c.count} finding{c.count > 1 ? "s" : ""}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div>
        <LinkButton to="/admin/subscriptions"  variant="secundario">Ver assinaturas pendentes</LinkButton>
      </div>
    </div>
  );
}
