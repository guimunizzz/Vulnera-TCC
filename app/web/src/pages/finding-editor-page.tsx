/**
 * finding-editor-page.tsx
 *
 * Formulário de criação/edição de Vulnerability (finding). O vetor CVSS é
 * calculado EM TEMPO REAL no cliente (lib/cvss.ts espelha cvss.util.ts do
 * backend) — sem round-trip ao servidor a cada tecla; o backend recalcula
 * tudo de novo no create/update, então o preview aqui é só UX, nunca fonte
 * da verdade. Evidências/comentários/transição/override só ficam
 * disponíveis depois que o finding existe (modo edição).
 *
 * Rotas: /projects/:projectId/findings/new (criar) e /findings/:id/edit (editar).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";
import { projectsApi } from "../lib/api/projects.api";
import { useApiError } from "../hooks/use-api-error";
import { useCompanyName } from "../hooks/use-company-name";
import { calculateCvss } from "../lib/cvss";
import { Breadcrumb } from "../components/layout/breadcrumb";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Alert } from "../components/ui/alert";
import { SeverityBadge } from "../components/ui/severity-badge";
import { FindingStatusBadge } from "../components/ui/finding-status-badge";
import { OverrideSeverityDialog } from "../components/findings/override-severity-dialog";
import { EvidenceUploader } from "../components/findings/evidence-uploader";
import { CommentTimeline } from "../components/findings/comment-timeline";
import { OWASP_CATEGORIES, OWASP_LABELS, type VulnerabilityStatus } from "../types/vulnerability.types";

const ALLOWED_TRANSITIONS: Record<VulnerabilityStatus, VulnerabilityStatus[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["FIXED"],
  FIXED: ["CLOSED"],
  CLOSED: [],
};

const TRANSITION_LABELS: Record<VulnerabilityStatus, string> = {
  OPEN: "Reabrir",
  IN_PROGRESS: "Iniciar correção",
  FIXED: "Marcar como corrigido",
  CLOSED: "Fechar finding",
};

export function FindingEditorPage() {
  const { projectId: newProjectId, id } = useParams<{ projectId?: string; id?: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const { data: existing, isLoading } = useQuery({
    queryKey: ["vulnerabilities", id],
    queryFn: () => vulnerabilitiesApi.getById(id!),
    enabled: isEditMode,
  });

  const projectId = isEditMode ? existing?.projectId : newProjectId;
  const { data: project } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: !!projectId,
  });
  const companyName = useCompanyName(project?.companyId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owaspCategory, setOwaspCategory] = useState("");
  const [cvssVector, setCvssVector] = useState("");
  const [impact, setImpact] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // hidrata o form quando o finding existente carrega (modo edição)
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setDescription(existing.description);
    setOwaspCategory(existing.owaspCategory);
    setCvssVector(existing.cvssVector ?? "");
    setImpact(existing.impact ?? "");
    setRecommendation(existing.recommendation ?? "");
  }, [existing]);

  const livePreview = useMemo(() => calculateCvss(cvssVector), [cvssVector]);

  const createMutation = useMutation({
    mutationFn: () =>
      vulnerabilitiesApi.create({
        projectId: projectId!,
        title,
        description,
        owaspCategory,
        cvssVector,
        impact: impact || undefined,
        recommendation: recommendation || undefined,
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      navigate(`/findings/${created.id}`);
    },
    onError: (err: unknown) => setFormError(getErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      vulnerabilitiesApi.update(id!, {
        title,
        description,
        owaspCategory,
        cvssVector,
        impact: impact || undefined,
        recommendation: recommendation || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vulnerabilities", id] });
      setFormError(null);
    },
    onError: (err: unknown) => setFormError(getErrorMessage(err)),
  });

  const transitionMutation = useMutation({
    mutationFn: (toStatus: VulnerabilityStatus) => vulnerabilitiesApi.transition(id!, toStatus),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["vulnerabilities", id] }),
    onError: (err: unknown) => setFormError(getErrorMessage(err)),
  });

  if (isEditMode && isLoading) return <p className="text-muted">Carregando...</p>;

  const transitions = existing ? ALLOWED_TRANSITIONS[existing.status] : [];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: companyName ?? "Empresa" },
          { label: project?.name ?? "Projeto", to: project ? `/projects/${project.id}` : undefined },
          { label: isEditMode ? (existing?.title ?? "Finding") : "Novo finding" },
        ]}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{isEditMode ? "Editar finding" : "Novo finding"}</h1>
          {isEditMode && existing && (
            <div className="mt-2 flex items-center gap-2">
              <FindingStatusBadge status={existing.status} />
              <SeverityBadge severity={existing.severityFinal} />
              {existing.severityFinal !== existing.severityCalculated && (
                <span className="text-xs text-muted">(calculada: {existing.severityCalculated})</span>
              )}
            </div>
          )}
        </div>

        {isEditMode && existing && (
          <div className="flex flex-wrap justify-end gap-2">
            {transitions.map((toStatus) => (
              <Button
                key={toStatus}
                variant="secondary"
                disabled={transitionMutation.isPending}
                onClick={() => transitionMutation.mutate(toStatus)}
              >
                {TRANSITION_LABELS[toStatus]}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => setIsOverrideOpen(true)}>
              Override de severidade
            </Button>
          </div>
        )}
      </div>

      {formError && <Alert className="mt-4">{formError}</Alert>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <form
          className="flex flex-col gap-4 lg:col-span-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            if (isEditMode) updateMutation.mutate();
            else createMutation.mutate();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finding-title">Título</Label>
            <Input id="finding-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finding-owasp">Categoria OWASP Top 10 2021</Label>
            <select
              id="finding-owasp"
              required
              value={owaspCategory}
              onChange={(e) => setOwaspCategory(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground"
            >
              <option value="" disabled>
                Selecione...
              </option>
              {OWASP_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {OWASP_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finding-vector">Vetor CVSS 3.1</Label>
            <Input
              id="finding-vector"
              required
              placeholder="AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
              value={cvssVector}
              onChange={(e) => setCvssVector(e.target.value)}
              className="font-mono"
            />
            <div className="flex items-center gap-2 text-sm">
              {livePreview ? (
                <>
                  <span className="text-foreground">Score: {livePreview.score.toFixed(1)}</span>
                  <SeverityBadge severity={livePreview.severity} />
                </>
              ) : cvssVector ? (
                <span className="text-severity-critical">Vetor incompleto ou inválido</span>
              ) : (
                <span className="text-muted">Preencha o vetor pra ver o cálculo em tempo real</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finding-description">Descrição</Label>
            <Textarea
              id="finding-description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finding-impact">Impacto</Label>
            <Textarea id="finding-impact" rows={3} value={impact} onChange={(e) => setImpact(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="finding-recommendation">Recomendação</Label>
            <Textarea
              id="finding-recommendation"
              rows={3}
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending
                ? "Salvando..."
                : isEditMode
                  ? "Salvar alterações"
                  : "Criar finding"}
            </Button>
          </div>
        </form>

        <div className="flex flex-col gap-6">
          {isEditMode && id ? (
            <>
              <div>
                <h2 className="mb-3 font-semibold text-foreground">Evidências</h2>
                <EvidenceUploader vulnerabilityId={id} canUpload />
              </div>
              <div>
                <h2 className="mb-3 font-semibold text-foreground">Comentários</h2>
                <CommentTimeline vulnerabilityId={id} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              Evidências, comentários e transições de status ficam disponíveis depois de salvar o finding.
            </p>
          )}
        </div>
      </div>

      {isEditMode && id && existing && (
        <OverrideSeverityDialog
          vulnerabilityId={id}
          currentSeverity={existing.severityFinal}
          open={isOverrideOpen}
          onOpenChange={setIsOverrideOpen}
        />
      )}
    </div>
  );
}
