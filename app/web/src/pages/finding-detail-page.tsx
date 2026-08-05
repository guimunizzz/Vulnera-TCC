/**
 * finding-detail-page.tsx
 *
 * Visão de LEITURA do finding — é a tela que o CLIENT usa (read-only: sem
 * upload, sem transição, sem override). ADMIN/PENTESTER também passam por
 * aqui ao clicar num finding na lista; o botão "Editar" só aparece pra eles
 * e leva pro FindingEditorPage (/findings/:id/edit).
 *
 * Se um PENTESTER conseguiu carregar esta página, ele necessariamente é
 * membro do Project — RN17 já bloqueia o GET no backend pra quem não é,
 * então o botão "Editar" pode confiar só em `role !== "CLIENT"` aqui.
 */

import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";
import { projectsApi } from "../lib/api/projects.api";
import { useAuthStore } from "../store/auth.store";
import { useCompanyName } from "../hooks/use-company-name";
import { Breadcrumb } from "../components/layout/breadcrumb";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { SeverityBadge } from "../components/ui/severity-badge";
import { FindingStatusBadge } from "../components/ui/finding-status-badge";
import { EvidenceUploader } from "../components/findings/evidence-uploader";
import { CommentTimeline } from "../components/findings/comment-timeline";
import { OWASP_LABELS, type OwaspCategory } from "../types/vulnerability.types";

export function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);

  const { data: finding, isLoading } = useQuery({
    queryKey: ["vulnerabilities", id],
    queryFn: () => vulnerabilitiesApi.getById(id!),
    enabled: !!id,
  });

  const { data: project } = useQuery({
    queryKey: ["projects", finding?.projectId],
    queryFn: () => projectsApi.getById(finding!.projectId),
    enabled: !!finding?.projectId,
  });
  const companyName = useCompanyName(project?.companyId);

  if (isLoading || !finding) return <p className="text-muted">Carregando...</p>;

  const owaspLabel = OWASP_LABELS[finding.owaspCategory as OwaspCategory] ?? finding.owaspCategory;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: companyName ?? "Empresa" },
          { label: project?.name ?? "Projeto", to: project ? `/projects/${project.id}` : undefined },
          { label: finding.title },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{finding.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FindingStatusBadge status={finding.status} />
            <SeverityBadge severity={finding.severityFinal} />
            {finding.severityFinal !== finding.severityCalculated && (
              <span className="text-xs text-muted">
                (calculada pelo CVSS: {finding.severityCalculated} — override justificado abaixo)
              </span>
            )}
            <span className="text-xs text-muted">{owaspLabel}</span>
          </div>
        </div>

        {role !== "CLIENT" && (
          <Button asChild>
            <Link to={`/findings/${finding.id}/edit`}>Editar</Link>
          </Button>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <h2 className="mb-2 font-semibold text-foreground">Descrição</h2>
            <p className="whitespace-pre-wrap text-sm text-foreground">{finding.description}</p>
          </Card>

          {finding.cvssVector && (
            <Card>
              <h2 className="mb-2 font-semibold text-foreground">CVSS 3.1</h2>
              <p className="font-mono text-sm text-foreground">{finding.cvssVector}</p>
              <p className="mt-1 text-sm text-muted">Score: {finding.cvssScore?.toFixed(1) ?? "—"}</p>
            </Card>
          )}

          {finding.impact && (
            <Card>
              <h2 className="mb-2 font-semibold text-foreground">Impacto</h2>
              <p className="whitespace-pre-wrap text-sm text-foreground">{finding.impact}</p>
            </Card>
          )}

          {finding.recommendation && (
            <Card>
              <h2 className="mb-2 font-semibold text-foreground">Recomendação</h2>
              <p className="whitespace-pre-wrap text-sm text-foreground">{finding.recommendation}</p>
            </Card>
          )}

          {finding.severityOverrideReason && (
            <Card>
              <h2 className="mb-2 font-semibold text-foreground">Justificativa do override de severidade</h2>
              <p className="whitespace-pre-wrap text-sm text-foreground">{finding.severityOverrideReason}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-3 font-semibold text-foreground">Evidências</h2>
            <EvidenceUploader vulnerabilityId={finding.id} canUpload={false} />
          </div>
          <div>
            <h2 className="mb-3 font-semibold text-foreground">Comentários</h2>
            <CommentTimeline vulnerabilityId={finding.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
