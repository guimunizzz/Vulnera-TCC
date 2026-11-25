/**
 * Formulário público de solicitação e reenvio de verificação de acesso.
 * Mantém resposta e erros neutros para não revelar se um endereço já existe.
 * Consumido pela rota pública /request-access.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Alert, Button, Field, Input } from "../../components/ui";
import { TurnstileChallenge, type TurnstileChallengeHandle } from "../../components/auth/turnstile-challenge";
import { PublicApiError } from "../../lib/api/public-http";
import { publicAccessApi } from "../../lib/api/public-access.api";
import "./request-access-page.css";

const NEUTRAL_MESSAGE = "Se os dados informados permitirem, você receberá as instruções por e-mail.";
const GENERIC_ERROR = "Não foi possível concluir agora. Confira os dados e tente novamente.";
const NETWORK_ERROR = "Não foi possível conectar. Verifique sua conexão e tente novamente.";
const RATE_LIMITED_ERROR = "Muitas tentativas. Aguarde antes de tentar novamente.";
const MAX_COOLDOWN_SECONDS = 60 * 60;

type Mode = "request" | "resend";
type Feedback = { kind: "success" | "error"; message: string };

export function RequestAccessPage() {
  const [mode, setMode] = useState<Mode>("request");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const sendPending = useRef(false);
  const challengeRef = useRef<TurnstileChallengeHandle>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((remaining) => Math.max(remaining - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sendPending.current || cooldownSeconds > 0) return;
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
          name,
          email,
          companyName,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          captchaToken: token,
        });
      } else {
        await publicAccessApi.resendVerification({ email, captchaToken: token });
      }
      setFeedback({ kind: "success", message: NEUTRAL_MESSAGE });
    } catch (error) {
      if (error instanceof PublicApiError && error.status === 429) {
        const seconds = error.retryAfterSeconds ?? 30;
        setCooldownSeconds(Math.max(1, Math.min(Math.ceil(seconds), MAX_COOLDOWN_SECONDS)));
        setFeedback({ kind: "error", message: RATE_LIMITED_ERROR });
      } else if (error instanceof PublicApiError && error.status === 0) {
        setFeedback({ kind: "error", message: NETWORK_ERROR });
      } else {
        // Códigos de validação diferentes usam a mesma resposta sem PII.
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
  const title = mode === "request" ? "Solicitar acesso" : "Reenviar verificação";

  return (
    <section className="vx-login-panel vx-request-access-panel" aria-labelledby="request-access-title">
      <header className="vx-login-heading">
        <p className="vx-login-eyebrow">VULNERA / ACESSO</p>
        <h1 id="request-access-title" tabIndex={-1}>{title}</h1>
        <p>
          {mode === "request"
            ? "Informe seus dados para iniciar uma solicitação de acesso."
            : "Se os dados informados permitirem, enviaremos novas instruções por e-mail."}
        </p>
      </header>

      {feedback && (
        <Alert
          tom={feedback.kind === "success" ? "sucesso" : "perigo"}
          titulo={feedback.kind === "success" ? "Solicitação recebida" : "Não foi possível continuar"}
          className="vx-request-access-feedback"
        >
          {feedback.message}
        </Alert>
      )}

      <form onSubmit={submit} className="vx-login-form" aria-labelledby="request-access-title">
        {mode === "request" && (
          <>
            <Field rotulo="Nome" obrigatorio className="vx-login-field">
              {(attrs) => (
                <Input {...attrs} name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="vx-login-input" />
              )}
            </Field>
            <Field rotulo="Empresa" obrigatorio className="vx-login-field">
              {(attrs) => (
                <Input {...attrs} name="companyName" autoComplete="organization" value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="vx-login-input" />
              )}
            </Field>
          </>
        )}

        <Field rotulo="E-mail" obrigatorio className="vx-login-field">
          {(attrs) => (
            <Input {...attrs} name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="vx-login-input" />
          )}
        </Field>

        {mode === "request" && (
          <Field rotulo="Telefone (opcional)" className="vx-login-field">
            {(attrs) => (
              <Input {...attrs} name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="vx-login-input" />
            )}
          </Field>
        )}

        <div className="vx-request-access-captcha">
          <span className="vx-request-access-captcha-label">Verificação de segurança</span>
          <TurnstileChallenge ref={challengeRef} onTokenChange={setCaptchaToken} />
        </div>

        <Button
          type="submit"
          carregando={sending}
          disabled={!captchaToken || coolingDown}
          larguraTotal
          className="vx-login-submit"
          iconeFim={<ArrowRight size={18} />}
        >
          {coolingDown ? "Aguarde para tentar novamente" : mode === "request" ? "Enviar solicitação" : "Reenviar instruções"}
        </Button>
      </form>

      <p className="vx-login-register vx-request-access-switch">
        {mode === "request" ? "Já enviou seus dados? " : "Ainda não solicitou acesso? "}
        <button type="button" onClick={toggleMode} disabled={sending}>
          {mode === "request" ? "Reenviar verificação" : "Solicitar acesso"}
        </button>
      </p>
    </section>
  );
}
