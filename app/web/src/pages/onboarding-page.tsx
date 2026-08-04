import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { plansApi } from "../lib/api/plans.api";
import { companiesApi } from "../lib/api/companies.api";
import { subscriptionsApi } from "../lib/api/subscriptions.api";
import { useApiError } from "../hooks/use-api-error";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Alert } from "../components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/cn";

const STEPS = ["Empresa", "Plano", "Confirmação"];

/**
 * Wizard de onboarding pós-cadastro: cria a Company (o usuário vira dono) e
 * já dispara o request de Subscription pro plano escolhido. Só useState —
 * 3 passos não justificam trazer uma lib de wizard.
 */
export function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const navigate = useNavigate();
  const getErrorMessage = useApiError();

  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: plansApi.list });
  const selectedPlan = plans?.find((p) => p.id === planId);

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
    if (!planId) {
      setError("Selecione um plano.");
      return;
    }
    setStep(3);
  }

  async function handleSubmit(): Promise<void> {
    if (!planId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await companiesApi.create({ name, cnpj: cnpj.trim() || undefined, planId });
      await subscriptionsApi.request({ planId });
      setDone(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Empresa cadastrada!</CardTitle>
            <CardDescription>
              Sua assinatura foi solicitada e está aguardando aprovação do time Vulnera.
            </CardDescription>
          </CardHeader>
          <Button onClick={() => navigate("/dashboard")}>Ir para o Dashboard</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configure sua empresa</CardTitle>
          <CardDescription>
            Passo {step} de 3 — {STEPS[step - 1]}
          </CardDescription>
        </CardHeader>

        <div className="mb-6 flex gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className={cn("h-1 flex-1 rounded-full bg-border", index + 1 <= step && "bg-accent")} />
          ))}
        </div>

        {error && <Alert className="mb-4">{error}</Alert>}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-name">Nome da empresa</Label>
              <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
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
            {plans?.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setPlanId(plan.id)}
                className={cn(
                  "rounded-md border border-border p-4 text-left transition-colors hover:border-accent",
                  planId === plan.id && "border-accent bg-accent/10",
                )}
              >
                <p className="font-medium text-foreground">{plan.name}</p>
                <p className="text-sm text-muted">
                  Até {plan.maxApplications} aplicações · {plan.maxProjects} projetos
                </p>
              </button>
            ))}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button onClick={goToConfirmation} className="flex-1">
                Continuar
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-border p-4 text-sm">
              <p>
                <span className="text-muted">Empresa:</span> {name}
              </p>
              {cnpj && (
                <p>
                  <span className="text-muted">CNPJ:</span> {cnpj}
                </p>
              )}
              <p>
                <span className="text-muted">Plano:</span> {selectedPlan?.name}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(2)} disabled={isSubmitting}>
                Voltar
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Enviando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
