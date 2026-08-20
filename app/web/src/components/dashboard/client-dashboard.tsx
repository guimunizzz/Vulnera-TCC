/**
 * client-dashboard.tsx
 *
 * Visão do CLIENT: KPIs de findings da própria company + distribuição por
 * severidade + os 5 mais recentes. Um único GET /vulnerabilities já vem
 * escopado pelo backend pra company do usuário (RN16) — nada de agregação
 * extra no servidor, o dashboard só resume o que a API já filtrou.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../../lib/api/vulnerabilities.api";
import { companiesApi } from "../../lib/api/companies.api";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { SeverityBadge } from "../ui/badge";
import { StatusBadge } from "../ui/badge";
import { LinkButton } from "../ui/button";
import { KpiCard } from "./kpi-card";
import { SeverityDonut } from "./severity-donut";

export function ClientDashboard() {
  const { data: findings, isLoading } = useQuery({
    queryKey: ["vulnerabilities", "all"],
    queryFn: vulnerabilitiesApi.list,
  });
  const { data: company } = useQuery({
    queryKey: ["companies", "me"],
    queryFn: companiesApi.me,
  });

  const stats = useMemo(() => {
    const list = findings ?? [];
    const total = list.length;
    const remediated = list.filter((f) => f.status === "FIXED" || f.status === "CLOSED").length;
    const criticalOpen = list.filter((f) => f.severityFinal === "CRITICAL" && f.status !== "CLOSED").length;
    const bySeverity = list.reduce<Record<string, number>>((acc, f) => {
      acc[f.severityFinal] = (acc[f.severityFinal] ?? 0) + 1;
      return acc;
    }, {});
    const recent = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    return { total, remediated, criticalOpen, bySeverity, recent };
  }, [findings]);

  if (isLoading) return <p className="text-fg-muted">Carregando...</p>;

  const remediatedPct = stats.total > 0 ? Math.round((stats.remediated / stats.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total de findings" value={stats.total} />
        <KpiCard label="Remediados" value={`${remediatedPct}%`} />
        <KpiCard label="Críticos em aberto" value={stats.criticalOpen} accentClassName={stats.criticalOpen > 0 ? "text-severity-critical-ink" : undefined} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por severidade</CardTitle>
        </CardHeader>
        <SeverityDonut bySeverity={stats.bySeverity} />
      </Card>

      {company && (
        <div>
          <LinkButton to={`/companies/${company.id}/maturity`} variant="secundario">
            Ver avaliação de maturidade
          </LinkButton>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Findings mais recentes</CardTitle>
        </CardHeader>
        {stats.recent.length === 0 && <p className="text-sm text-fg-muted">Nenhum finding registrado ainda.</p>}
        <ul className="flex flex-col gap-2">
          {stats.recent.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-control bg-canvas px-3 py-2">
              <Link to={`/findings/${f.id}`} className="truncate text-sm text-fg hover:text-accent-ink hover:underline">
                {f.title}
              </Link>
              <div className="flex shrink-0 gap-2">
                <SeverityBadge severidade={f.severityFinal} />
                <StatusBadge status={f.status} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
