/**
 * new-analysis-page.tsx
 *
 * O QUE FAZ: conduz a criação de um Project em quatro etapas.
 * POR QUE EXISTE: Projetos e Aplicações compartilham o mesmo fluxo de criação.
 * QUEM CONSOME: rotas autenticadas de ADMIN e CLIENT em `/new-analysis`.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { applicationsApi } from "../lib/api/applications.api";
import { projectsApi } from "../lib/api/projects.api";
import { getApiErrorCode, useApiError } from "../hooks/use-api-error";
import { Button } from "../components/ui/button";
import { Alert } from "../components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/cn";
import type { Application } from "../types/application.types";
import type { AnalysisLevel, AnalysisType, Project } from "../types/project.types";
import { useMotion } from "../motion/use-motion";

const STEPS = ["Aplicação", "Tipo", "Nome, nível e escopo", "Remediação"];
const PROJECTS_QUERY_KEY = ["projects"] as const;
const APPLICATIONS_QUERY_KEY = ["applications"] as const;
const MAX_PROJECT_NAME_LENGTH = 191;
const EMPTY_APPLICATIONS: Application[] = [];
const EMPTY_PROJECTS: Project[] = [];

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

type ReturnTo = "/projects" | "/applications";

type ApplicationIssue = {
  message: string;
  project?: Project;
};

function getApplicationIssue(
  applicationId: string,
  applications: Application[],
  projects: Project[],
): ApplicationIssue | null {
  const application = applications.find((item) => item.id === applicationId);
  if (!application) {
    return { message: "Esta aplicação não está mais disponível. Escolha outra aplicação." };
  }

  const project = projects.find((item) => item.applicationId === applicationId);
  if (project) {
    return {
      message: "Esta aplicação já possui um projeto. Escolha outra aplicação ou abra o projeto existente.",
      project,
    };
  }

  if (!application.isActive) {
    return { message: "Esta aplicação está inativa e não pode receber um novo projeto." };
  }

  return null;
}

function getReturnPath(state: unknown): ReturnTo {
  if (!state || typeof state !== "object" || !("returnTo" in state)) return "/projects";
  const returnTo = (state as { returnTo?: unknown }).returnTo;
  return returnTo === "/projects" || returnTo === "/applications" ? returnTo : "/projects";
}

function defaultProjectName(analysisType: AnalysisType, application?: Application): string {
  const label = ANALYSIS_TYPES.find((item) => item.value === analysisType)?.label ?? analysisType;
  const suggestion = application ? `Análise ${label} — ${application.name}` : `Análise ${label}`;
  return Array.from(suggestion).slice(0, MAX_PROJECT_NAME_LENGTH).join("");
}

export function NewAnalysisPage() {
  const { troca } = useMotion();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const preselectedApplicationId = searchParams.get("applicationId");
  const returnPath = getReturnPath(location.state);

  const [step, setStep] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(preselectedApplicationId);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("DAST");
  const [analysisLevel, setAnalysisLevel] = useState<AnalysisLevel>("BASIC");
  const [scopeIn, setScopeIn] = useState("");
  const [scopeOut, setScopeOut] = useState("");
  const [hasRemediation, setHasRemediation] = useState(false);
  const [customName, setCustomName] = useState("");
  const [hasCustomName, setHasCustomName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isMounted = useRef(false);
  const isSubmittingRef = useRef(false);
  const didCreateProject = useRef(false);
  const lastPreselectedApplicationId = useRef(preselectedApplicationId);
  const stepHeadingRef = useRef<HTMLSpanElement>(null);
  const queryAlertRef = useRef<HTMLDivElement>(null);
  const errorAlertRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const applicationsQuery = useQuery({
    queryKey: APPLICATIONS_QUERY_KEY,
    queryFn: applicationsApi.list,
  });
  const projectsQuery = useQuery({
    queryKey: PROJECTS_QUERY_KEY,
    queryFn: projectsApi.list,
  });

  const applications = applicationsQuery.data ?? EMPTY_APPLICATIONS;
  const projects = projectsQuery.data ?? EMPTY_PROJECTS;
  const eligibilityError = applicationsQuery.isError || projectsQuery.isError;
  const eligibilityLoading = applicationsQuery.isLoading || projectsQuery.isLoading;
  const eligibilityRefreshing = applicationsQuery.isFetching || projectsQuery.isFetching;
  const eligibilityReady =
    !eligibilityLoading &&
    !eligibilityError &&
    !eligibilityRefreshing &&
    Array.isArray(applicationsQuery.data) &&
    Array.isArray(projectsQuery.data);

  const projectsByApplication = new Map<string, Project>();
  for (const project of projects) {
    if (!projectsByApplication.has(project.applicationId)) {
      projectsByApplication.set(project.applicationId, project);
    }
  }

  const eligibleApplications = applications.filter(
    (application) => application.isActive && !projectsByApplication.has(application.id),
  );
  const selectedApplication = applications.find((application) => application.id === applicationId);
  const selectedType = ANALYSIS_TYPES.find((item) => item.value === analysisType);
  const suggestedName = defaultProjectName(analysisType, selectedApplication);
  const projectName = hasCustomName ? customName : suggestedName;

  const queryErrorMessage = eligibilityError
    ? applicationsQuery.isError && projectsQuery.isError
      ? "Não foi possível carregar as aplicações nem confirmar quais já possuem projeto."
      : applicationsQuery.isError
        ? "Não foi possível carregar as aplicações."
        : "Não foi possível confirmar quais aplicações já possuem projeto."
    : null;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (queryErrorMessage) queryAlertRef.current?.focus();
    else if (error) errorAlertRef.current?.focus();
  }, [error, queryErrorMessage]);

  useEffect(() => {
    if (nameError && step === 3) nameInputRef.current?.focus();
  }, [nameError, step]);

  // O link de Aplicações pode trocar a pré-seleção sem desmontar esta rota.
  // Validamos o novo id no mesmo efeito para não rejeitar o id anterior por engano.
  useEffect(() => {
    const searchChanged = lastPreselectedApplicationId.current !== preselectedApplicationId;
    const candidateId = searchChanged ? preselectedApplicationId : applicationId;

    if (searchChanged) {
      lastPreselectedApplicationId.current = preselectedApplicationId;
      setApplicationId(preselectedApplicationId);
      setStep(1);
      setError(null);
      setNameError(null);
    }

    if (!eligibilityReady || !candidateId || didCreateProject.current) return;
    const issue = getApplicationIssue(candidateId, applications, projects);
    if (!issue) return;

    setApplicationId(null);
    setStep(1);
    setError(issue.message);
  }, [applicationId, applications, eligibilityReady, preselectedApplicationId, projects]);

  function validateApplicationSelection(): Application | null {
    if (!eligibilityReady) {
      setError("Aguarde a confirmação das aplicações disponíveis antes de continuar.");
      return null;
    }

    if (!applicationId) {
      setError("Selecione uma aplicação.");
      return null;
    }

    const issue = getApplicationIssue(applicationId, applications, projects);
    if (issue) {
      setApplicationId(null);
      setStep(1);
      setError(issue.message);
      return null;
    }

    return applications.find((application) => application.id === applicationId) ?? null;
  }

  function goToType(): void {
    setError(null);
    setNameError(null);
    if (!validateApplicationSelection()) return;
    setStep(2);
  }

  function goToDetails(): void {
    setError(null);
    if (!validateApplicationSelection()) return;
    setStep(3);
  }

  function goToReview(): void {
    setError(null);
    if (!validateApplicationSelection()) return;
    if (!projectName.trim()) {
      setNameError("Informe um nome para o projeto.");
      return;
    }
    setNameError(null);
    setStep(4);
  }

  function cancel(): void {
    if (isSubmittingRef.current) return;
    navigate(returnPath);
  }

  function refreshEligibility(): void {
    void Promise.allSettled([applicationsQuery.refetch(), projectsQuery.refetch()]);
  }

  function invalidateProjectList(): void {
    void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }).catch(() => undefined);
  }

  function invalidateEligibilityLists(): void {
    void queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY }).catch(() => undefined);
  }

  async function handleSubmit(): Promise<void> {
    // A ref trava o handler antes que React aplique o próximo render.
    if (isSubmittingRef.current) return;

    setError(null);
    setNameError(null);
    const application = validateApplicationSelection();
    if (!application) return;

    const name = projectName.trim();
    if (!name) {
      setStep(3);
      setNameError("Informe um nome para o projeto.");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const project = await projectsApi.create({
        applicationId: application.id,
        name,
        analysisType,
        analysisLevel,
        scopeIn: scopeIn.trim() || undefined,
        scopeOut: scopeOut.trim() || undefined,
        hasRemediation,
      });

      didCreateProject.current = true;
      queryClient.setQueryData<Project[]>(PROJECTS_QUERY_KEY, (current) => {
        const previous = current ?? [];
        return [project, ...previous.filter((item) => item.id !== project.id)];
      });
      // O POST já persistiu. Falha de refetch não deve parecer falha de criação.
      invalidateProjectList();
      if (isMounted.current) navigate(`/projects/${project.id}`);
    } catch (submitError) {
      const code = getApiErrorCode(submitError);

      if (code === "APPLICATION_ALREADY_HAS_PROJECT" || code === "APPLICATION_NOT_FOUND") {
        invalidateEligibilityLists();
        if (!isMounted.current) return;

        setApplicationId(null);
        setStep(1);
        setError(
          code === "APPLICATION_ALREADY_HAS_PROJECT"
            ? "Esta aplicação já recebeu um projeto. Atualizamos as opções; selecione outra aplicação."
            : "A aplicação selecionada não está mais disponível. Atualizamos as opções; selecione outra aplicação.",
        );
        return;
      }

      if (!isMounted.current) return;

      if (code === "INVALID_NAME") {
        setStep(3);
        setNameError("Informe um nome válido para o projeto.");
        return;
      }

      const message =
        code === "NO_ACTIVE_SUBSCRIPTION"
          ? "A empresa da aplicação não tem uma assinatura ativa."
          : getErrorMessage(submitError);
      setError(message);
    } finally {
      isSubmittingRef.current = false;
      if (isMounted.current) setIsSubmitting(false);
    }
  }

  const isNextDisabled = !eligibilityReady || isSubmitting;

  return (
    <div className="mx-auto max-w-2xl">
      <header data-ops-hero="project" className="mb-4">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">Início da avaliação</p>
        <h1 className="text-2xl font-bold text-fg">Nova análise</h1>
        <p className="mt-2 text-sm text-fg-secondary">Defina o alvo, a abordagem e o escopo antes de criar o projeto.</p>
      </header>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              <span
                ref={stepHeadingRef}
                tabIndex={-1}
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {STEPS[step - 1]}
              </span>
            </CardTitle>
            <CardDescription>Passo {step} de {STEPS.length}</CardDescription>
          </div>
        </CardHeader>

        <ol aria-label="Etapas do projeto" className="sr-only">
          {STEPS.map((label, index) => (
            <li key={label} aria-current={index + 1 === step ? "step" : undefined}>
              Passo {index + 1}: {label}
            </li>
          ))}
        </ol>
        <div aria-hidden="true" className="mb-2 flex gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className={cn("h-1 flex-1 rounded-full bg-raised", index + 1 <= step && "bg-accent")} />
          ))}
        </div>
        <p role="status" aria-live="polite" className="mb-6 text-xs text-fg-muted">
          Passo {step} de {STEPS.length}: {STEPS[step - 1]}
        </p>

        {queryErrorMessage && (
          <div ref={queryAlertRef} tabIndex={-1} className="mb-4">
            <Alert tom="perigo">
              <p>{queryErrorMessage}</p>
              <Button variant="secundario" size="sm" onClick={refreshEligibility} className="mt-3">
                Tentar novamente
              </Button>
            </Alert>
          </div>
        )}

        {!queryErrorMessage && eligibilityRefreshing && (
          <p role="status" aria-live="polite" aria-busy="true" className="mb-4 text-sm text-fg-muted">
            {eligibilityLoading ? "Carregando aplicações e projetos…" : "Atualizando a disponibilidade das aplicações…"}
          </p>
        )}

        {error && (
          <div ref={errorAlertRef} tabIndex={-1} className="mb-4">
            <Alert tom="perigo">{error}</Alert>
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            variants={troca}
            initial="inicial"
            animate="visivel"
            exit="saindo"
            onAnimationComplete={(definition) => {
              if (definition !== "visivel") return;
              if (nameError) {
                nameInputRef.current?.focus();
                return;
              }
              if (!error && !queryErrorMessage) stepHeadingRef.current?.focus();
            }}
          >
            {step === 1 && (
              <div className="flex flex-col gap-3">
                {eligibilityReady && applications.length === 0 && (
                  <div className="rounded-control border border-subtle p-4 text-sm text-fg-secondary">
                    <p>Nenhuma aplicação cadastrada ainda.</p>
                    <Link className="mt-2 inline-block text-accent-ink underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" to="/applications">
                      Cadastrar uma aplicação
                    </Link>
                  </div>
                )}

                {eligibilityReady && applications.length > 0 && eligibleApplications.length === 0 && (
                  <p className="rounded-control border border-subtle p-4 text-sm text-fg-secondary">
                    {applications.some((application) => application.isActive)
                      ? "Todas as aplicações ativas já possuem projeto. Consulte os projetos existentes ou cadastre outra aplicação."
                      : "Não há aplicações ativas disponíveis para um novo projeto."}
                  </p>
                )}

                {eligibilityReady && applications.length > 0 && (
                  <fieldset disabled={isSubmitting} className="flex flex-col gap-3">
                    <legend className="mb-2 text-sm font-medium text-fg">Selecione uma aplicação</legend>
                    {applications.map((application) => {
                      const existingProject = projectsByApplication.get(application.id);
                      const unavailable = !application.isActive || Boolean(existingProject);

                      if (unavailable) {
                        return (
                          <div key={application.id} className="min-w-0 break-all rounded-control border border-subtle bg-inset p-4 text-left opacity-80">
                            <p className="font-medium text-fg">{application.name}</p>
                            {application.url && <p className="text-sm text-fg-muted">{application.url}</p>}
                            {!application.isActive && <p className="mt-2 text-sm text-fg-muted">Aplicação inativa.</p>}
                            {existingProject && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                                <span>Esta aplicação já possui um projeto.</span>
                                <Link
                                  className="min-w-0 break-all text-accent-ink underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                                  to={`/projects/${existingProject.id}`}
                                >
                                  Abrir projeto {existingProject.name}
                                </Link>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <label
                          key={application.id}
                          htmlFor={`application-${application.id}`}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-control border border-subtle p-4 text-left transition-colors hover:border-accent",
                            applicationId === application.id && "border-accent bg-accent/10",
                          )}
                        >
                          <input
                            id={`application-${application.id}`}
                            type="radio"
                            name="applicationId"
                            value={application.id}
                            checked={applicationId === application.id}
                            aria-labelledby={`application-name-${application.id}`}
                            aria-describedby={application.url ? `application-url-${application.id}` : undefined}
                            onChange={() => {
                              setApplicationId(application.id);
                              setError(null);
                            }}
                            className="mt-1 h-4 w-4 accent-accent"
                          />
                          <span className="min-w-0 flex-1">
                            <span id={`application-name-${application.id}`} className="block break-all font-medium text-fg">
                              {application.name}
                            </span>
                            {application.url && (
                              <span id={`application-url-${application.id}`} className="block break-all text-sm text-fg-muted">
                                {application.url}
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}

                <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button variant="secundario" onClick={cancel} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={goToType}
                    disabled={isNextDisabled || eligibleApplications.length === 0}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-3">
                <fieldset disabled={isSubmitting} className="flex flex-col gap-3">
                  <legend className="mb-2 text-sm font-medium text-fg">Tipo de análise</legend>
                  {ANALYSIS_TYPES.map((type) => (
                    <label
                      key={type.value}
                      htmlFor={`analysis-type-${type.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-control border border-subtle p-4 text-left transition-colors hover:border-accent",
                        analysisType === type.value && "border-accent bg-accent/10",
                      )}
                    >
                      <input
                        id={`analysis-type-${type.value}`}
                        type="radio"
                        name="analysisType"
                        value={type.value}
                        checked={analysisType === type.value}
                        aria-labelledby={`analysis-type-label-${type.value}`}
                        aria-describedby={`analysis-type-description-${type.value}`}
                        onChange={() => setAnalysisType(type.value)}
                        className="mt-1 h-4 w-4 accent-accent"
                      />
                      <span>
                        <span id={`analysis-type-label-${type.value}`} className="block font-medium text-fg">
                          {type.label}
                        </span>
                        <span id={`analysis-type-description-${type.value}`} className="block text-sm text-fg-muted">
                          {type.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="secundario" onClick={() => setStep(1)} disabled={isSubmitting}>
                    Voltar
                  </Button>
                  <Button onClick={goToDetails} disabled={isNextDisabled} className="flex-1">
                    Continuar
                  </Button>
                  <Button variant="secundario" onClick={cancel} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-fg" htmlFor="project-name">
                    Nome do projeto
                  </label>
                  <input
                    ref={nameInputRef}
                    id="project-name"
                    name="name"
                    type="text"
                    required
                    maxLength={191}
                    value={projectName}
                    aria-invalid={Boolean(nameError)}
                    aria-describedby={nameError ? "project-name-error" : undefined}
                    onChange={(event) => {
                      setHasCustomName(true);
                      setCustomName(event.target.value);
                      setNameError(null);
                    }}
                    className="rounded-control border border-subtle bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                  {nameError && (
                    <p id="project-name-error" role="alert" className="text-sm text-danger-ink">
                      {nameError}
                    </p>
                  )}
                </div>

                <fieldset disabled={isSubmitting} className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium text-fg">Nível</legend>
                  <div className="flex flex-wrap gap-2">
                    {ANALYSIS_LEVELS.map((level) => (
                      <label
                        key={level.value}
                        htmlFor={`analysis-level-${level.value}`}
                        className={cn(
                          "flex flex-1 cursor-pointer items-center gap-2 rounded-control border border-subtle px-3 py-2 text-sm transition-colors hover:border-accent",
                          analysisLevel === level.value && "border-accent bg-accent/10 text-fg",
                        )}
                      >
                        <input
                          id={`analysis-level-${level.value}`}
                          type="radio"
                          name="analysisLevel"
                          value={level.value}
                          checked={analysisLevel === level.value}
                          onChange={() => setAnalysisLevel(level.value)}
                          className="h-4 w-4 accent-accent"
                        />
                        {level.label}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-fg" htmlFor="scope-in">
                    Escopo (dentro)
                  </label>
                  <textarea
                    id="scope-in"
                    rows={2}
                    className="rounded-control border border-subtle bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    placeholder="Ex: /login, /checkout, API pública"
                    value={scopeIn}
                    onChange={(event) => setScopeIn(event.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-fg" htmlFor="scope-out">
                    Fora de escopo
                  </label>
                  <textarea
                    id="scope-out"
                    rows={2}
                    className="rounded-control border border-subtle bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    placeholder="Ex: infraestrutura de terceiros"
                    value={scopeOut}
                    onChange={(event) => setScopeOut(event.target.value)}
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="secundario" onClick={() => setStep(2)} disabled={isSubmitting}>
                    Voltar
                  </Button>
                  <Button onClick={goToReview} disabled={isNextDisabled} className="flex-1">
                    Continuar
                  </Button>
                  <Button variant="secundario" onClick={cancel} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="flex flex-col gap-4">
                <label className="flex items-center gap-2 rounded-control border border-subtle p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={hasRemediation}
                    disabled={isSubmitting}
                    onChange={(event) => setHasRemediation(event.target.checked)}
                    className="h-4 w-4 accent-accent"
                  />
                  <span className="text-fg">Incluir serviço de remediação</span>
                </label>

                <dl className="grid min-w-0 gap-2 rounded-control border border-subtle p-4 text-sm">
                  <div className="min-w-0">
                    <dt className="inline text-fg-muted">Nome:</dt>{" "}
                    <dd className="inline break-all text-fg">{projectName.trim()}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline text-fg-muted">Aplicação:</dt>{" "}
                    <dd className="inline break-all text-fg">{selectedApplication?.name}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline text-fg-muted">Tipo:</dt>{" "}
                    <dd className="inline text-fg">{selectedType?.label}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline text-fg-muted">Nível:</dt>{" "}
                    <dd className="inline text-fg">
                      {ANALYSIS_LEVELS.find((level) => level.value === analysisLevel)?.label}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline text-fg-muted">Escopo (dentro):</dt>{" "}
                    <dd className="inline break-all whitespace-pre-wrap text-fg">{scopeIn.trim() || "Não informado"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline text-fg-muted">Fora de escopo:</dt>{" "}
                    <dd className="inline break-all whitespace-pre-wrap text-fg">{scopeOut.trim() || "Não informado"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="inline text-fg-muted">Remediação:</dt>{" "}
                    <dd className="inline text-fg">{hasRemediation ? "Sim" : "Não"}</dd>
                  </div>
                </dl>

                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button variant="secundario" onClick={() => setStep(3)} disabled={isSubmitting}>
                    Voltar
                  </Button>
                  <Button onClick={handleSubmit} disabled={isNextDisabled} className="flex-1">
                    {isSubmitting ? "Criando…" : "Criar projeto"}
                  </Button>
                  <Button variant="secundario" onClick={cancel} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
}
