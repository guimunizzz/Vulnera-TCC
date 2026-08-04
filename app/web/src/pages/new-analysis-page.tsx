import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { applicationsApi } from "../lib/api/applications.api";
import { projectsApi } from "../lib/api/projects.api";
import { useApiError } from "../hooks/use-api-error";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/cn";
import type { AnalysisLevel, AnalysisType } from "../types/project.types";

const STEPS = ["Aplicação", "Tipo", "Nível e escopo", "Remediação"];

const ANALYSIS_TYPES: Array<{ value: AnalysisType; label: string; description: string }> = [
  { value: "DAST", label: "DAST", description: "Análise dinâmica — testa a aplicação em execução." },
  { value: "SAST", label: "SAST", description: "Análise estática — revisa o código-fonte." },
  { value: "COMBO", label: "Combinada", description: "SAST + DAST no mesmo projeto." },
  { value: "MATURITY", label: "Maturidade", description: "Avaliação do ambiente de segurança do cliente." },
];

const ANALYSIS_LEVELS: Array<{ value: AnalysisLevel; label: string }> = [
  { value: "BASIC", label: "Básico" },
  { value: "INTERMEDIATE", label: "Intermediário" },
  { value: "ADVANCED", label: "Avançado" },
];

/**
 * Wizard de nova análise: escolher aplicação → tipo → nível/escopo → flag de
 * remediação → cria Project em PENDING. Só useState, 4 passos fixos.
 *
 * Nota: o tipo de análise usa o domínio real do schema (SAST/DAST/MATURITY/
 * COMBO) — o texto "PENTEST/DAST/SAST" do prompt de produto diverge do que
 * está implementado em analysisType; seguimos o schema (fonte de verdade).
 */
export function NewAnalysisPage() {
  const [searchParams] = useSearchParams();
  const preselectedApplicationId = searchParams.get("applicationId");

  const [step, setStep] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(preselectedApplicationId);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("DAST");
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>("BASIC");
  const [scopeIn, setScopeIn] = useState("");
  const [scopeOut, setScopeOut] = useState("");
  const [hasRemediation, setHasRemediation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const getErrorMessage = useApiError();
  const { data: applications } = useQuery({ queryKey: ["applications"], queryFn: applicationsApi.list });
  const selectedApplication = applications?.find((a) => a.id === applicationId);
  const selectedType = ANALYSIS_TYPES.find((t) => t.value === analysisType);

  function goToType(): void {
    setError(null);
    if (!applicationId) {
      setError("Selecione uma aplicação.");
      return;
    }
    setStep(2);
  }

  async function handleSubmit(): Promise<void> {
    if (!applicationId || !selectedApplication) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const project = await projectsApi.create({
        applicationId,
        name: `Análise ${selectedType?.label ?? analysisType} — ${selectedApplication.name}`,
        analysisType,
        analysisLevel,
        scopeIn: scopeIn.trim() || undefined,
        scopeOut: scopeOut.trim() || undefined,
        hasRemediation,
      });
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Nova análise</CardTitle>
          <CardDescription>
            Passo {step} de {STEPS.length} — {STEPS[step - 1]}
          </CardDescription>
        </CardHeader>

        <div className="mb-6 flex gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className={cn("h-1 flex-1 rounded-full bg-border", index + 1 <= step && "bg-accent")} />
          ))}
        </div>

        {error && <Alert className="mb-4">{error}</Alert>}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            {!applications?.length && <p className="text-sm text-muted">Nenhuma aplicação cadastrada ainda.</p>}
            {applications?.map((application) => (
              <button
                key={application.id}
                type="button"
                onClick={() => setApplicationId(application.id)}
                className={cn(
                  "rounded-md border border-border p-4 text-left transition-colors hover:border-accent",
                  applicationId === application.id && "border-accent bg-accent/10",
                )}
              >
                <p className="font-medium text-foreground">{application.name}</p>
                {application.url && <p className="text-sm text-muted">{application.url}</p>}
              </button>
            ))}
            <Button onClick={goToType} className="mt-2">
              Continuar
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            {ANALYSIS_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setAnalysisType(type.value)}
                className={cn(
                  "rounded-md border border-border p-4 text-left transition-colors hover:border-accent",
                  analysisType === type.value && "border-accent bg-accent/10",
                )}
              >
                <p className="font-medium text-foreground">{type.label}</p>
                <p className="text-sm text-muted">{type.description}</p>
              </button>
            ))}
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Nível</span>
              <div className="flex gap-2">
                {ANALYSIS_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => setAnalysisLevel(level.value)}
                    className={cn(
                      "flex-1 rounded-md border border-border py-2 text-sm transition-colors hover:border-accent",
                      analysisLevel === level.value && "border-accent bg-accent/10 text-foreground",
                    )}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="scope-in">
                Escopo (dentro)
              </label>
              <textarea
                id="scope-in"
                rows={2}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                placeholder="Ex: /login, /checkout, API pública"
                value={scopeIn}
                onChange={(e) => setScopeIn(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="scope-out">
                Fora de escopo
              </label>
              <textarea
                id="scope-out"
                rows={2}
                className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                placeholder="Ex: infraestrutura de terceiros"
                value={scopeOut}
                onChange={(e) => setScopeOut(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Voltar
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-2 rounded-md border border-border p-4 text-sm">
              <input
                type="checkbox"
                checked={hasRemediation}
                onChange={(e) => setHasRemediation(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-foreground">Incluir serviço de remediação</span>
            </label>

            <div className="rounded-md border border-border p-4 text-sm">
              <p>
                <span className="text-muted">Aplicação:</span> {selectedApplication?.name}
              </p>
              <p>
                <span className="text-muted">Tipo:</span> {selectedType?.label}
              </p>
              <p>
                <span className="text-muted">Nível:</span>{" "}
                {ANALYSIS_LEVELS.find((l) => l.value === analysisLevel)?.label}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(3)} disabled={isSubmitting}>
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Criando..." : "Criar projeto"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
