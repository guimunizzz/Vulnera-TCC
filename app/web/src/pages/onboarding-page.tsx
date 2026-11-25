import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { plansApi } from "../lib/api/plans.api";
import { companiesApi } from "../lib/api/companies.api";
import { subscriptionsApi } from "../lib/api/subscriptions.api";
import { usersApi } from "../lib/api/users.api";
import { getApiErrorCode, useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import type { User } from "../types/auth.types";
import type { Company } from "../types/company.types";
import type { Subscription } from "../types/subscription.types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/card";
import { Alert } from "../components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/cn";
import { useMotion } from "../motion/use-motion";
import "../components/layout/operations-backdrop.css";

const STEPS = ["Empresa", "Plano", "Confirmação"];
type OnboardingAccess = "checking" | "allowed" | "denied" | "error";

function canUseLegacyOnboarding(user: User | null): boolean {
  if (user?.role !== "CLIENT") return false;
  if (user.companyId) return user.companyRole === "OWNER";
  return user.legacyOnboardingAllowed === true;
}

function needsAuthoritativeProfile(user: User | null): boolean {
  if (user?.role !== "CLIENT") return false;
  if (user.companyId) return user.companyRole == null;
  return user.legacyOnboardingAllowed === undefined;
}

async function findExistingCompany(): Promise<Company | null> {
  try {
    return await companiesApi.me();
  } catch (err) {
    if (getApiErrorCode(err) === "USER_HAS_NO_COMPANY") return null;
    throw err;
  }
}

/**
 * Wizard de onboarding pós-cadastro: cria a Company (o usuário vira dono) e
 * solicita a Subscription após atualizar o perfil. Retoma a empresa que já
 * foi salva para que uma falha parcial não reinicie o cadastro (QA-02/03).
 */
export function OnboardingPage() {
  const { troca } = useMotion();
  const user = useAuthStore((state) => state.user);
  const shouldResolveProfile = needsAuthoritativeProfile(user);
  const [access, setAccess] = useState<OnboardingAccess>(() => {
    if (canUseLegacyOnboarding(user)) return "allowed";
    return shouldResolveProfile ? "checking" : "denied";
  });
  const [profileRetry, setProfileRetry] = useState(0);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);
  const [pendingSubscription, setPendingSubscription] = useState<Subscription | null>(null);
  const [isCheckingCompany, setIsCheckingCompany] = useState(true);
  const [isCompanyReady, setIsCompanyReady] = useState(false);
  const sessionUser = useRef(useAuthStore.getState().user);
  const operationVersion = useRef(0);
  const profileRequest = useRef<{ user: User; promise: Promise<User> } | null>(null);

  const navigate = useNavigate();
  const getErrorMessage = useApiError();

  useEffect(() => {
    if (canUseLegacyOnboarding(user)) {
      setAccess("allowed");
      return;
    }
    if (!needsAuthoritativeProfile(user) || !user) {
      setAccess("denied");
      return;
    }

    let current = true;
    setAccess("checking");
    let pending = profileRequest.current;
    if (!pending || pending.user !== user) {
      pending = { user, promise: usersApi.me() };
      profileRequest.current = pending;
    }
    const request = pending;
    void request.promise
      .then((profile) => {
        if (!current || useAuthStore.getState().user !== user) return;
        if (!useAuthStore.getState().updateUser(profile, user)) return;
        sessionUser.current = profile;
        setAccess(canUseLegacyOnboarding(profile) ? "allowed" : "denied");
      })
      .catch(() => {
        if (current && useAuthStore.getState().user === user) setAccess("error");
      })
      .finally(() => {
        if (profileRequest.current === request) profileRequest.current = null;
      });

    return () => { current = false; };
  }, [user, profileRetry]);

  const isCurrentSession = useCallback(() => sessionUser.current !== null && useAuthStore.getState().user === sessionUser.current, []);

  const syncProfile = useCallback(async (companyId: string, isActive: () => boolean): Promise<boolean> => {
    const profile = await usersApi.me();
    if (!isActive() || !sessionUser.current) return false;
    if (profile.companyId !== companyId) throw new Error("USER_COMPANY_NOT_READY");
    if (!useAuthStore.getState().updateUser(profile, sessionUser.current)) return false;
    sessionUser.current = profile;
    return true;
  }, []);

  const restoreCompany = useCallback(async (): Promise<void> => {
    if (!isCurrentSession()) return;
    const version = ++operationVersion.current;
    const isActive = () => version === operationVersion.current && isCurrentSession();
    setIsCheckingCompany(true);
    setError(null);
    try {
      const existing = await findExistingCompany();
      if (!isActive()) return;
      setCompany(existing);
      if (existing) {
        setPlanId(existing.planId);
        setStep(2);
        if (!await syncProfile(existing.id, isActive)) return;

        const status = await subscriptionsApi.onboardingStatus();
        if (!isActive()) return;
        if (status.status === "ACTIVE") {
          navigate("/dashboard", { replace: true });
          return;
        }
        if (status.status === "PENDING_APPROVAL" && status.subscription) {
          setPendingSubscription(status.subscription);
          setPlanId(status.subscription.planId);
          setDone(true);
          return;
        }
      }
      setIsCompanyReady(true);
    } catch (err) {
      if (isActive()) setError(getErrorMessage(err));
    } finally {
      if (isActive()) setIsCheckingCompany(false);
    }
  }, [getErrorMessage, isCurrentSession, navigate, syncProfile]);

  useEffect(() => {
    if (access !== "allowed") return;
    void restoreCompany();
    return () => { operationVersion.current += 1; };
  }, [access, restoreCompany]);

  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: plansApi.list, enabled: access === "allowed" });
  const eligiblePlans = plans?.filter((plan) => plan.isActive) ?? [];
  const selectedPlan = eligiblePlans.find((p) => p.id === planId);

  function goToPlan(): void {
    setError(null);
    if (!name.trim()) {
      setError("Informe o nome da empresa.");
      return;
    }
    setStep(2);
  }

  function goToConfirmation(): void {
    setError(null);
    if (!planId || !selectedPlan) {
      setError("Selecione um plano disponível.");
      return;
    }
    setStep(3);
  }

  async function handleSubmit(): Promise<void> {
    if (access !== "allowed" || !planId || isSubmitting || !isCompanyReady || !isCurrentSession()) return;
    const version = operationVersion.current;
    const isActive = () => version === operationVersion.current && isCurrentSession();
    setError(null);
    setIsSubmitting(true);
    let subscriptionRequestStarted = false;
    try {
      let savedCompany = company;
      if (!savedCompany) {
        // Outra aba ou uma resposta perdida pode já ter concluído o POST.
        // Em caso de dúvida, a próxima tentativa sempre consulta antes de criar.
        savedCompany = await findExistingCompany();
        if (!isActive()) return;
        if (savedCompany) {
          setCompany(savedCompany);
          await syncProfile(savedCompany.id, isActive);
          if (isActive()) setError("Sua empresa já está cadastrada. Confira os dados e confirme a solicitação de assinatura.");
          return;
        }
        try {
          savedCompany = await companiesApi.create({ name, cnpj: cnpj.trim() || undefined, planId });
        } catch (createError) {
          if (!isActive()) return;
          savedCompany = await findExistingCompany();
          if (!isActive()) return;
          if (!savedCompany) throw createError;
          setCompany(savedCompany);
          await syncProfile(savedCompany.id, isActive);
          if (isActive()) setError("Sua empresa já está cadastrada. Confira os dados e confirme a solicitação de assinatura.");
          return;
        }
        if (!isActive()) return;
        setCompany(savedCompany);
      }
      if (!await syncProfile(savedCompany.id, isActive)) return;
      subscriptionRequestStarted = true;
      const subscription = await subscriptionsApi.request({ planId });
      if (!isActive()) return;
      setPendingSubscription(subscription);
      setDone(true);
    } catch (err) {
      if (!isActive()) return;
      if (subscriptionRequestStarted) {
        try {
          const status = await subscriptionsApi.onboardingStatus();
          if (!isActive()) return;
          if (status.status === "ACTIVE") {
            navigate("/dashboard", { replace: true });
            return;
          }
          if (status.status === "PENDING_APPROVAL" && status.subscription) {
            setPendingSubscription(status.subscription);
            setPlanId(status.subscription.planId);
            setDone(true);
            return;
          }
        } catch {
          // Mantém o erro da operação original; o próximo retry continua idempotente no servidor.
        }
      }
      if (isActive()) setError(getErrorMessage(err));
    } finally {
      if (isActive()) setIsSubmitting(false);
    }
  }

  if (access === "checking") {
    return (
      <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4">
        <div aria-hidden="true" className="operations-backdrop pointer-events-none absolute inset-0" />
        <Card className="relative w-full max-w-md text-center">
          <p role="status" className="text-sm text-fg-muted">Verificando se sua conta pode retomar o cadastro…</p>
        </Card>
      </div>
    );
  }

  if (access === "error") {
    return (
      <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4">
        <div aria-hidden="true" className="operations-backdrop pointer-events-none absolute inset-0" />
        <Card className="relative w-full max-w-md space-y-4 text-center">
          <Alert tom="perigo">Não foi possível verificar o acesso ao cadastro. Sua sessão continua ativa.</Alert>
          <Button variant="secundario" onClick={() => setProfileRetry((attempt) => attempt + 1)}>
            Tentar novamente
          </Button>
        </Card>
      </div>
    );
  }

  if (access === "denied") return <Navigate to="/dashboard" replace />;

  if (done) {
    return (
      <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4">
        <div aria-hidden="true" className="operations-backdrop pointer-events-none absolute inset-0" />
        <Card className="relative w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Empresa cadastrada!</CardTitle>
            <CardDescription>
              {pendingSubscription?.status === "ACTIVE"
                ? "Sua assinatura está ativa."
                : `A solicitação do plano ${selectedPlan?.name ?? "selecionado"} está aguardando aprovação do time Vulnera.`}
            </CardDescription>
          </CardHeader>
          <Button onClick={() => navigate("/dashboard")}>Ir para o Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-canvas px-4 py-8">
      <div aria-hidden="true" className="operations-backdrop pointer-events-none absolute inset-0" />
      <Card className="relative w-full max-w-md">
        <CardHeader>
          <div>
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-accent-ink">Configuração inicial</p>
            <CardTitle>Configure sua empresa</CardTitle>
            <CardDescription>Passo {step} de 3 — {STEPS[step - 1]}</CardDescription>
          </div>
        </CardHeader>

        <div className="mb-6 flex gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className={cn("h-1 flex-1 rounded-full bg-raised", index + 1 <= step && "bg-accent")} />
          ))}
        </div>

        {error && <Alert tom="perigo" className="mb-4">{error}</Alert>}

        {!isCompanyReady ? (
          <div className="flex flex-col gap-4">
            {isCheckingCompany ? (
              <p role="status" className="text-sm text-fg-muted">Verificando seu cadastro...</p>
            ) : (
              <Button variant="secundario" onClick={() => void restoreCompany()}>Tentar novamente</Button>
            )}
          </div>
        ) : <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} variants={troca} initial="inicial" animate="visivel" exit="saindo">

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-name">Nome da empresa</Label>
              <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="company-cnpj">CNPJ (opcional)</Label>
              <Input
                id="company-cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
              />
            </div>
            <Button onClick={goToPlan}>Continuar</Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            {eligiblePlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setPlanId(plan.id)}
                className={cn(
                  "rounded-control border border-subtle p-4 text-left transition-colors hover:border-accent",
                  planId === plan.id && "border-accent bg-accent/10",
                )}
              >
                <p className="font-medium text-fg">{plan.name}</p>
                <p className="text-sm text-fg-muted">
                  Até {plan.maxApplications} aplicações · {plan.maxProjects} projetos
                </p>
              </button>
            ))}
            <div className="flex gap-2">
              {!company && <Button variant="secundario" onClick={() => setStep(1)}>
                Voltar
              </Button>}
              <Button onClick={goToConfirmation} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-control border border-subtle p-4 text-sm">
              <p>
                <span className="text-fg-muted">Empresa:</span> {company?.name ?? name}
              </p>
              {(company ? company.cnpj : cnpj) && (
                <p>
                  <span className="text-fg-muted">CNPJ:</span> {company ? company.cnpj : cnpj}
                </p>
              )}
              <p>
                <span className="text-fg-muted">Plano:</span> {selectedPlan?.name}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secundario" onClick={() => setStep(2)} disabled={isSubmitting}>
                Voltar
              </Button>
              <Button onClick={handleSubmit} carregando={isSubmitting} className="flex-1">
                Confirmar
              </Button>
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>}
      </Card>
    </div>
  );
}
