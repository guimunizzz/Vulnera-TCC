/**
 * client-dashboard.tsx
 *
 * Visão do CLIENT: KPIs de findings da própria company + distribuição por
 * severidade + os 5 mais recentes. O escopo vem do backend (RN16 — só a
 * company do usuário).
 *
 * Os números vêm CONTADOS do banco, via `useFindingsResumo` (FEAT-09). Antes
 * este componente baixava todos os findings da empresa e fazia
 * `list.filter(...).length` no navegador — ver o cabeçalho de `use-findings.ts`
 * sobre por que isso saiu.
 */

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useFindingsResumo } from "../../hooks/use-findings";
import { companiesApi } from "../../lib/api/companies.api";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { SeverityBadge } from "../ui/badge";
import { StatusBadge } from "../ui/badge";
import { LinkButton } from "../ui/button";
import { KpiCard } from "./kpi-card";
import { SeverityDonut } from "./severity-donut";

export function ClientDashboard() {
  const resumo = useFindingsResumo();
  const { data: company } = useQuery({
    queryKey: ["companies", "me"],
    queryFn: companiesApi.me,
  });

  if (resumo.carregando) return <p className="text-fg-muted">Carregando...</p>;

  const remediados = (resumo.porStatus.FIXED ?? 0) + (resumo.porStatus.CLOSED ?? 0);
  const remediatedPct = resumo.total > 0 ? Math.round((remediados / resumo.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total de findings" value={resumo.total} />
        <KpiCard label="Remediados" value={`${remediatedPct}%`} />
        <KpiCard
          label="Críticos em aberto"
          value={resumo.criticosAbertos}
          accentClassName={resumo.criticosAbertos > 0 ? "text-severity-critical-ink" : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por severidade</CardTitle>
        </CardHeader>
        <SeverityDonut bySeverity={resumo.porSeveridade} />
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
        {resumo.recentes.length === 0 && <p className="text-sm text-fg-muted">Nenhum finding registrado ainda.</p>}
        <ul className="flex flex-col gap-2">
          {resumo.recentes.map((f) => (
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
