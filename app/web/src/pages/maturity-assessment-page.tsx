/**
 * maturity-assessment-page.tsx
 *
 * Checklist de maturidade (Fase 8, decisão de 2026-08-03 — SIMPLIFICADO):
 * domínios na lateral, perguntas do domínio ativo no centro com seletor 1-5
 * e observação, média por domínio e média geral, botão salvar em lote.
 *
 * RN19 — só ADMIN preenche. CLIENT (própria company) e PENTESTER (atribuído
 * a algum projeto da company) só leem — o backend já barra a escrita com
 * FORBIDDEN, mas a tela evita a viagem ao servidor desabilitando os
 * controles de quem não pode escrever.
 *
 * Rota: /companies/:companyId/maturity
 */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { maturityApi } from "../lib/api/maturity.api";
import { useApiError } from "../hooks/use-api-error";
import { useCompanyName } from "../hooks/use-company-name";
import { useAuthStore } from "../store/auth.store";
import { Breadcrumb } from "../components/ui/navigation";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle } from "../components/ui/card";
import { Textarea } from "../components/ui/textarea";
import { Alert } from "../components/ui/alert";
import { EmptyState } from "../components/ui/empty-state";
import { Badge } from "../components/ui/badge";
import { ScoreSelector } from "../components/maturity/score-selector";
import { MaturityRadar } from "../components/maturity/maturity-radar";
import { MATURITY_LEVEL_LABELS, type ScoreInput } from "../types/maturity.types";
import { cn } from "../lib/cn";

/** Respostas em edição, por controlId — hidratadas do assessment ao carregar. */
type EdicaoRespostas = Record<string, { score: number | null; notes: string }>;

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((sum, v) => sum + v, 0) / valores.length) * 100) / 100;
}

export function MaturityAssessmentPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const canEdit = role === "ADMIN";
  const companyName = useCompanyName(companyId);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const { data: catalog, isLoading: loadingCatalog } = useQuery({
    queryKey: ["maturity", "catalog"],
    queryFn: maturityApi.getCatalog,
  });

  const { data: assessment, isLoading: loadingAssessment } = useQuery({
    queryKey: ["maturity", "latest", companyId],
    queryFn: () => maturityApi.getLatestByCompany(companyId!),
    enabled: !!companyId,
  });

  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [respostas, setRespostas] = useState<EdicaoRespostas>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // domínio ativo padrão = primeiro do catálogo, assim que carrega
  useEffect(() => {
    if (catalog && catalog.length > 0 && !selectedDomainId) {
      setSelectedDomainId(catalog[0].id);
    }
  }, [catalog, selectedDomainId]);

  // hidrata o form com as respostas já salvas (troca de assessment.id = nova avaliação)
  useEffect(() => {
    if (!assessment) return;
    const hydrated: EdicaoRespostas = {};
    for (const s of assessment.scores) {
      hydrated[s.controlId] = { score: s.score, notes: s.notes ?? "" };
    }
    setRespostas(hydrated);
  }, [assessment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const createMutation = useMutation({
    mutationFn: () => maturityApi.createAssessment(companyId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["maturity", "latest", companyId] });
    },
    onError: (err: unknown) => setFormError(getErrorMessage(err)),
  });

  const saveMutation = useMutation({
    mutationFn: (scores: ScoreInput[]) => maturityApi.submitScores(assessment!.id, scores),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["maturity", "latest", companyId] });
      setFormError(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err: unknown) => {
      setSaveSuccess(false);
      setFormError(getErrorMessage(err));
    },
  });

  // média por domínio (viva — reflete o que está em edição, não só o salvo)
  const mediaPorDominio = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const d of catalog ?? []) {
      const scores = d.controls.map((c) => respostas[c.id]?.score).filter((s): s is number => typeof s === "number");
      map.set(d.id, media(scores));
    }
    return map;
  }, [catalog, respostas]);

  const mediaGeral = useMemo(() => {
    const todas = Object.values(respostas)
      .map((r) => r.score)
      .filter((s): s is number => typeof s === "number");
    return media(todas);
  }, [respostas]);

  const radarData = useMemo(
    () => (catalog ?? []).map((d) => ({ domain: d.name, average: mediaPorDominio.get(d.id) ?? 0 })),
    [catalog, mediaPorDominio],
  );

  function handleAnswer(controlId: string, score: number): void {
    setRespostas((prev) => ({ ...prev, [controlId]: { score, notes: prev[controlId]?.notes ?? "" } }));
  }

  function handleNotes(controlId: string, notes: string): void {
    setRespostas((prev) => ({ ...prev, [controlId]: { score: prev[controlId]?.score ?? null, notes } }));
  }

  function handleSave(): void {
    setFormError(null);
    const scores: ScoreInput[] = Object.entries(respostas)
      .filter(([, r]) => typeof r.score === "number")
      .map(([controlId, r]) => ({ controlId, score: r.score!, notes: r.notes || undefined }));

    if (scores.length === 0) {
      setFormError("Responda pelo menos uma pergunta antes de salvar.");
      return;
    }
    saveMutation.mutate(scores);
  }

  if (loadingCatalog || loadingAssessment) return <p className="text-fg-muted">Carregando...</p>;

  const activeDomain = catalog?.find((d) => d.id === selectedDomainId);

  return (
    <div>
      <Breadcrumb itens={[{ rotulo: companyName ?? "Empresa" }, { rotulo: "Maturidade" }]} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">Avaliação de maturidade</h1>
          <p className="mt-1 text-fg-muted">
            Checklist por domínio — resposta em escala 1 (não implementado) a 5 (maduro/consolidado).
          </p>
        </div>
        {assessment && (
          <div className="flex flex-col items-end gap-1">
            <Badge tom="acento">{MATURITY_LEVEL_LABELS[assessment.level]}</Badge>
            <span className="text-xs text-fg-muted">Última avaliação: {new Date(assessment.createdAt).toLocaleDateString("pt-BR")}</span>
          </div>
        )}
      </div>

      {formError && <Alert tom="perigo" className="mt-4">{formError}</Alert>}
      {saveSuccess && (
        <Alert tom="sucesso" className="mt-4">
          Respostas salvas.
        </Alert>
      )}

      {!assessment ? (
        <EmptyState
          className="mt-6"
          titulo="Nenhuma avaliação de maturidade ainda"
          descricao={
            canEdit
              ? "Crie a primeira avaliação para começar a responder o checklist desta empresa."
              : "O administrador ainda não preencheu o checklist de maturidade desta empresa."
          }
          acao={
            canEdit && (
              <Button onClick={() => createMutation.mutate()} carregando={createMutation.isPending}>
                Criar avaliação
              </Button>
            )
          }
        />
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
          {/* lateral: domínios */}
          <nav aria-label="Domínios de maturidade" className="flex flex-col gap-1">
            {catalog?.map((d) => {
              const avg = mediaPorDominio.get(d.id);
              const selecionado = d.id === selectedDomainId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDomainId(d.id)}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-sm transition-colors duration-fast",
                    selecionado ? "bg-accent-surface text-accent-ink font-medium" : "text-fg hover:bg-hovered",
                  )}
                >
                  <span>{d.name}</span>
                  <span className="font-mono text-xs text-fg-muted" data-numeric>
                    {avg != null ? avg.toFixed(1) : "—"}
                  </span>
                </button>
              );
            })}

            <div className="mt-4 rounded-control bg-canvas px-3 py-2">
              <p className="text-xs text-fg-muted">Média geral</p>
              <p className="text-lg font-bold text-fg" data-numeric>
                {mediaGeral != null ? mediaGeral.toFixed(2) : "—"}
              </p>
            </div>
          </nav>

          {/* centro: perguntas do domínio ativo */}
          <div className="flex flex-col gap-6">
            {activeDomain && (
              <Card titulo={activeDomain.name} descricao={activeDomain.description ?? undefined}>
                <div className="flex flex-col gap-6">
                  {activeDomain.controls.map((control) => {
                    const resposta = respostas[control.id];
                    return (
                      <div key={control.id} className="flex flex-col gap-2 border-b border-subtle pb-5 last:border-0 last:pb-0">
                        <p className="text-sm font-medium text-fg">{control.name}</p>
                        {control.description && <p className="text-xs text-fg-muted">{control.description}</p>}
                        <ScoreSelector
                          rotulo={control.name}
                          value={resposta?.score ?? null}
                          onChange={(score) => handleAnswer(control.id, score)}
                          somenteLeitura={!canEdit}
                        />
                        <Textarea
                          placeholder="Observação (opcional)"
                          rows={2}
                          value={resposta?.notes ?? ""}
                          onChange={(e) => handleNotes(control.id, e.target.value)}
                          disabled={!canEdit}
                          className="mt-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {canEdit && (
              <div className="flex justify-end">
                <Button onClick={handleSave} carregando={saveMutation.isPending}>
                  Salvar respostas
                </Button>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Radar de maturidade</CardTitle>
              </CardHeader>
              <MaturityRadar data={radarData} />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
