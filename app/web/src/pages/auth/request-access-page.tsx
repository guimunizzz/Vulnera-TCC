/**
 * Solicitação pública unificada em quatro etapas e reenvio neutro de verificação.
 * O Turnstile só é solicitado na revisão, imediatamente antes do POST.
 * Consumido pela rota pública /request-access.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Alert, Button, Field, Input } from "../../components/ui";
import { TurnstileChallenge, type TurnstileChallengeHandle } from "../../components/auth/turnstile-challenge";
import { PublicApiError } from "../../lib/api/public-http";
import { publicAccessApi } from "../../lib/api/public-access.api";
import { plansApi } from "../../lib/api/plans.api";
import type { Plan } from "../../types/plan.types";
import "./request-access-page.css";

const NEUTRAL_MESSAGE = "Se os dados informados permitirem, você receberá as instruções por e-mail.";
const GENERIC_ERROR = "Não foi possível concluir agora. Confira os dados e tente novamente.";
const MAX_COOLDOWN_SECONDS = 60 * 60;
type Mode = "request" | "resend";
type Feedback = { kind: "success" | "error"; message: string };
const STEPS = ["Responsável", "Empresa", "Plano", "Revisão"];

function priceLabel(price: number): string {
  return price <= 0 ? "Sob consulta" : price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + "/mês";
}

export function RequestAccessPage() {
  const [mode, setMode] = useState<Mode>("request");
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [planId, setPlanId] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const sendPending = useRef(false);
  const challengeRef = useRef<TurnstileChallengeHandle>(null);
  const plansQuery = useQuery({ queryKey: ["plans"], queryFn: plansApi.list });
  const plans = (plansQuery.data ?? []).filter((plan) => plan.isActive);
  const selectedPlan = plans.find((plan) => plan.id === planId);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => setCooldownSeconds((remaining) => Math.max(remaining - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  function move(next: number) {
    setFeedback(null);
    setCaptchaToken(null);
    challengeRef.current?.reset();
    setStep(next);
  }

  function continueStep() {
    setFeedback(null);
    if (step === 1 && (!name.trim() || !email.trim() || !/^\S+@\S+\.\S+$/u.test(email.trim()))) {
      setFeedback({ kind: "error", message: "Informe nome e um e-mail válido para continuar." });
      return;
    }
    if (step === 2 && !companyName.trim()) {
      setFeedback({ kind: "error", message: "Informe o nome da empresa para continuar." });
      return;
    }
    if (step === 3 && !selectedPlan) {
      setFeedback({ kind: "error", message: "Selecione um plano disponível para continuar." });
      return;
    }
    if (step < 4) move(step + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sendPending.current || cooldownSeconds > 0) return;
    if (mode === "request" && step < 4) {
      continueStep();
      return;
    }
    if (!captchaToken) {
      setFeedback({ kind: "error", message: "Conclua a verificação de segurança antes de enviar." });
      return;
    }
    sendPending.current = true;
    setSending(true);
    setFeedback(null);
    const token = captchaToken;
    setCaptchaToken(null);
    try {
      if (mode === "request") {
        await publicAccessApi.request({
          name: name.trim(), email: email.trim(), companyName: companyName.trim(), planId,
          ...(companyCnpj.trim() ? { companyCnpj: companyCnpj.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}), captchaToken: token,
        });
      } else {
        await publicAccessApi.resendVerification({ email: email.trim(), captchaToken: token });
      }
      setFeedback({ kind: "success", message: NEUTRAL_MESSAGE });
    } catch (error) {
      if (error instanceof PublicApiError && error.status === 429) {
        const seconds = Math.max(1, Math.min(Math.ceil(error.retryAfterSeconds ?? 30), MAX_COOLDOWN_SECONDS));
        setCooldownSeconds(seconds);
        setFeedback({ kind: "error", message: "Muitas tentativas. Aguarde antes de tentar novamente." });
      } else if (error instanceof PublicApiError && error.status === 0) {
        setFeedback({ kind: "error", message: "Não foi possível conectar. Verifique sua conexão e tente novamente." });
      } else {
        setFeedback({ kind: "error", message: GENERIC_ERROR });
      }
    } finally {
      challengeRef.current?.reset();
      setCaptchaToken(null);
      sendPending.current = false;
      setSending(false);
    }
  }

  function toggleMode(): void {
    setMode((current) => current === "request" ? "resend" : "request");
    setFeedback(null);
    setCaptchaToken(null);
    challengeRef.current?.reset();
  }

  const coolingDown = cooldownSeconds > 0;
  return (
    <section className="vx-login-panel vx-request-access-panel" aria-labelledby="request-access-title">
      <header className="vx-login-heading">
        <p className="vx-login-eyebrow">VULNERA / ACESSO</p>
        <h1 id="request-access-title" tabIndex={-1}>{mode === "request" ? "Solicitar acesso" : "Reenviar verificação"}</h1>
        <p>{mode === "request" ? "Informe seus dados para iniciar uma solicitação de acesso à Vulnera." : "Se os dados informados permitirem, enviaremos novas instruções por e-mail."}</p>
      </header>

      {feedback && <Alert tom={feedback.kind === "success" ? "sucesso" : "perigo"} titulo={feedback.kind === "success" ? "Solicitação recebida" : "Não foi possível continuar"} className="vx-request-access-feedback">{feedback.message}</Alert>}

      {mode === "request" && <nav aria-label="Etapas da solicitação" className="mb-5 flex gap-2">
        {STEPS.map((label, index) => <div key={label} className="flex-1 text-center text-xs" aria-current={step === index + 1 ? "step" : undefined}>
          <span className={`mx-auto mb-1 block h-1 rounded-full ${step >= index + 1 ? "bg-accent" : "bg-raised"}`} />
          <span className={step === index + 1 ? "font-semibold text-fg" : "text-fg-muted"}>{index + 1}. {label}</span>
        </div>)}
      </nav>}

      <form onSubmit={submit} className="vx-login-form" aria-labelledby="request-access-title" noValidate>
        {mode === "resend" && <Field rotulo="E-mail" obrigatorio className="vx-login-field">{(attrs) => <Input {...attrs} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="vx-login-input" />}</Field>}
        {mode === "request" && step === 1 && <>
          <Field rotulo="Nome do responsável" obrigatorio className="vx-login-field">{(attrs) => <Input {...attrs} name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="vx-login-input" />}</Field>
          <Field rotulo="E-mail" obrigatorio className="vx-login-field">{(attrs) => <Input {...attrs} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="vx-login-input" />}</Field>
          <Field rotulo="Telefone (opcional)" className="vx-login-field">{(attrs) => <Input {...attrs} name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="vx-login-input" />}</Field>
        </>}
        {mode === "request" && step === 2 && <>
          <Field rotulo="Empresa" obrigatorio className="vx-login-field">{(attrs) => <Input {...attrs} name="companyName" autoComplete="organization" value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="vx-login-input" />}</Field>
          <Field rotulo="CNPJ (opcional)" className="vx-login-field" dica="Pode ser informado depois, se preferir.">{(attrs) => <Input {...attrs} name="companyCnpj" inputMode="numeric" autoComplete="off" placeholder="00.000.000/0000-00" value={companyCnpj} onChange={(event) => setCompanyCnpj(event.target.value)} className="vx-login-input" />}</Field>
        </>}
        {mode === "request" && step === 3 && <div className="flex flex-col gap-3" aria-label="Planos disponíveis">
          {plansQuery.isLoading && <p role="status">Carregando planos…</p>}
          {plansQuery.isError && <div><p role="alert">Não foi possível carregar os planos.</p><Button type="button" variant="secundario" onClick={() => void plansQuery.refetch()}>Tentar novamente</Button></div>}
          {!plansQuery.isLoading && !plansQuery.isError && plans.length === 0 && <p>Nenhum plano está disponível neste momento. Tente novamente mais tarde.</p>}
          {plans.map((plan: Plan) => <label key={plan.id} className={`cursor-pointer rounded-control border p-4 transition-colors ${planId === plan.id ? "border-accent bg-accent/10" : "border-subtle hover:border-accent"}`}>
            <span className="flex items-start gap-3"><input type="radio" name="planId" value={plan.id} checked={planId === plan.id} onChange={() => setPlanId(plan.id)} className="mt-1 accent-accent" /><span><strong className="block text-fg">{plan.name}</strong><span className="block text-sm text-fg-muted">{priceLabel(plan.price)} · até {plan.maxApplications} aplicações · {plan.maxProjects} projetos{plan.includesRemediation ? " · remediação incluída" : ""}</span></span></span>
          </label>)}
        </div>}
        {mode === "request" && step === 4 && <>
          <dl className="grid gap-3 rounded-control border border-subtle p-4 text-sm">
            <div><dt className="text-fg-muted">Responsável</dt><dd className="text-fg">{name} · {email}{phone.trim() ? ` · ${phone.trim()}` : ""}</dd></div>
            <div><dt className="text-fg-muted">Empresa</dt><dd className="text-fg">{companyName}{companyCnpj.trim() ? ` · CNPJ ${companyCnpj.trim()}` : ""}</dd></div>
            <div><dt className="text-fg-muted">Plano</dt><dd className="text-fg">{selectedPlan?.name} · {selectedPlan ? priceLabel(selectedPlan.price) : ""}</dd></div>
          </dl>
          <p className="text-sm text-fg-muted">Após o envio, confirme seu e-mail. A equipe Vulnera analisará a solicitação antes de ativar a conta.</p>
          <div className="vx-request-access-captcha"><span className="vx-request-access-captcha-label">Verificação de segurança</span><TurnstileChallenge ref={challengeRef} onTokenChange={setCaptchaToken} /></div>
        </>}

        {mode === "request" && <div className="flex gap-2">
          {step > 1 && <Button type="button" variant="secundario" disabled={sending} onClick={() => move(step - 1)} iconeInicio={<ArrowLeft size={18} />}>Voltar</Button>}
          {step < 4 ? <Button type="button" disabled={step === 3 && (plansQuery.isLoading || plans.length === 0)} larguraTotal iconeFim={<ArrowRight size={18} />} onClick={continueStep}>Continuar</Button> : <Button type="submit" carregando={sending} disabled={!captchaToken || coolingDown} larguraTotal iconeFim={<ArrowRight size={18} />}>{coolingDown ? "Aguarde para tentar novamente" : "Enviar solicitação"}</Button>}
        </div>}
        {mode === "resend" && <>
          <div className="vx-request-access-captcha"><span className="vx-request-access-captcha-label">Verificação de segurança</span><TurnstileChallenge ref={challengeRef} onTokenChange={setCaptchaToken} /></div>
          <Button type="submit" carregando={sending} disabled={!captchaToken || coolingDown} larguraTotal className="vx-login-submit">{coolingDown ? "Aguarde para tentar novamente" : "Reenviar instruções"}</Button>
        </>}
      </form>

      <p className="vx-login-register vx-request-access-switch">{mode === "request" ? "Já enviou seus dados? " : "Ainda não solicitou acesso? "}<button type="button" onClick={toggleMode} disabled={sending}>{mode === "request" ? "Reenviar verificação" : "Solicitar acesso"}</button></p>
    </section>
  );
}
