/**
 * Finaliza a ativação pública de um convite e define a senha da nova conta.
 * Mantém o token apenas em memória e não cria sessão após o sucesso.
 * Consumida pela futura rota `/activate-account` dentro do AuthLayout.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useFragmentToken } from "../../hooks/use-fragment-token";
import { accountActivationApi } from "../../lib/api/account-activation.api";
import { PublicApiError } from "../../lib/api/public-http";
import { Alert, Button, Field, Input } from "../../components/ui";
import "./activate-account-page.css";

type Phase = "preparing" | "validating" | "unavailable" | "validation-error" | "form" | "success";
type RateLimitStage = "validation" | "activation" | null;

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

export function ActivateAccountPage() {
  const { token, ready, clearToken } = useFragmentToken();
  const [phase, setPhase] = useState<Phase>("preparing");
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationSubmitted, setConfirmationSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(null);
  const [rateLimitStage, setRateLimitStage] = useState<RateLimitStage>(null);
  const validationRequestRef = useRef<{
    token: string;
    promise: ReturnType<typeof accountActivationApi.validate>;
  } | null>(null);
  const submitPendingRef = useRef(false);
  const activatedRef = useRef(false);
  const mountedRef = useRef(false);

  const confirmationError = confirmationSubmitted && confirmation !== password
    ? confirmation.length === 0 ? "Confirme sua senha." : "As senhas não coincidem."
    : confirmation.length > 0 && confirmation !== password
      ? "As senhas não coincidem."
      : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // O cache de promessa evita uma segunda validação no ciclo setup/cleanup do StrictMode.
  useEffect(() => {
    if (!ready || activatedRef.current) return;
    if (!token) {
      setPhase("unavailable");
      return;
    }

    let current = true;
    setPhase("validating");
    setValidationMessage(null);
    setRetryAfterSeconds(null);
    setRateLimitStage(null);

    let request = validationRequestRef.current;
    if (!request || request.token !== token) {
      const promise = accountActivationApi.validate({ token });
      request = { token, promise };
      validationRequestRef.current = request;
    }

    const activeRequest = request;
    void activeRequest.promise
      .then((result) => {
        if (!current) return;
        if (result?.valid === true) {
          setPhase("form");
          return;
        }
        if (result?.valid === false) {
          clearToken();
          setPhase("unavailable");
          return;
        }
        throw new Error("INVALID_RESPONSE");
      })
      .catch((error: unknown) => {
        if (!current) return;
        if (error instanceof PublicApiError && error.status === 400 && error.code === "INVALID_ACTIVATION_TOKEN") {
          clearToken();
          setPhase("unavailable");
          return;
        }
        setPhase("validation-error");
        if (error instanceof PublicApiError && error.status === 429) {
          setRateLimitStage("validation");
          setRetryAfterSeconds(Math.max(1, error.retryAfterSeconds ?? 1));
          setValidationMessage("O serviço limitou as tentativas. Aguarde antes de validar novamente.");
          return;
        }
        setValidationMessage("Não foi possível verificar o convite agora. Tente novamente.");
      })
      .finally(() => {
        if (validationRequestRef.current === activeRequest) validationRequestRef.current = null;
      });

    return () => {
      current = false;
    };
  }, [ready, token, validationAttempt, clearToken]);

  useEffect(() => {
    if (retryAfterSeconds === null) return;
    if (retryAfterSeconds <= 0) {
      if (rateLimitStage === "validation") {
        setValidationMessage("O período de espera terminou. Você pode validar o convite novamente.");
      }
      if (rateLimitStage === "activation") {
        setActivationError("O período de espera terminou. Você pode tentar ativar a conta novamente.");
      }
      setRetryAfterSeconds(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      setRetryAfterSeconds((seconds) => seconds === null ? null : Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearTimeout(timeout);
  }, [retryAfterSeconds, rateLimitStage]);

  function retryValidation(): void {
    if (retryAfterSeconds !== null || !token) return;
    setValidationMessage(null);
    setPhase("validating");
    setValidationAttempt((attempt) => attempt + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitPendingRef.current || retryAfterSeconds !== null) return;
    if (!token || phase !== "form") return;

    setActivationError(null);
    setRateLimitStage(null);
    setPasswordError(null);
    setConfirmationSubmitted(true);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError("Use pelo menos 8 caracteres.");
      return;
    }
    if (utf8ByteLength(password) > MAX_PASSWORD_BYTES) {
      setPasswordError("Use uma senha com até 72 bytes em UTF-8.");
      return;
    }
    if (confirmation !== password) return;

    submitPendingRef.current = true;
    setSubmitting(true);
    try {
      await accountActivationApi.activate({ token, password });
      activatedRef.current = true;
      if (!mountedRef.current) return;
      clearToken();
      setPhase("success");
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      if (error instanceof PublicApiError && error.status === 400 && error.code === "INVALID_ACTIVATION_TOKEN") {
        clearToken();
        setPhase("unavailable");
        return;
      }
      if (error instanceof PublicApiError && error.status === 429) {
        setRateLimitStage("activation");
        setRetryAfterSeconds(Math.max(1, error.retryAfterSeconds ?? 1));
        setActivationError("O serviço limitou as tentativas recentes. Aguarde antes de enviar novamente.");
        return;
      }
      if (error instanceof PublicApiError && error.code === "WEAK_PASSWORD") {
        setPasswordError("Use pelo menos 8 caracteres.");
        return;
      }
      if (error instanceof PublicApiError && error.code === "INVALID_PASSWORD") {
        setPasswordError("Confira os limites de tamanho da senha.");
        return;
      }
      setActivationError("Não foi possível ativar a conta agora. Tente novamente.");
    } finally {
      submitPendingRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  return (
    <section className="vx-login-panel vx-activate-panel" aria-labelledby="activate-account-title">
      <span className="vx-login-panel-tab" aria-hidden="true">VULNERA / ATIVAÇÃO</span>
      <span className="vx-login-panel-corner" aria-hidden="true" />
      <h1 id="activate-account-title" className="sr-only" tabIndex={-1}>Ativar conta</h1>

      {phase === "preparing" || phase === "validating" ? (
        <p className="vx-activate-status" role="status">Validando o convite...</p>
      ) : null}

      {phase === "unavailable" ? (
        <div className="vx-activate-state">
          <Alert tom="perigo" titulo="Convite indisponível">
            Este convite é inválido, expirado ou já foi utilizado.
          </Alert>
          <p className="vx-activate-login-link"><Link to="/login">Ir para o login</Link></p>
        </div>
      ) : null}

      {phase === "validation-error" ? (
        <div className="vx-activate-state">
          <Alert tom={rateLimitStage === "validation" ? "atencao" : "perigo"} titulo="Não foi possível validar o convite">
            {validationMessage ?? "Não foi possível verificar o convite agora. Tente novamente."}
            {retryAfterSeconds !== null && (
              <span className="vx-activate-countdown"> Tente novamente em {retryAfterSeconds}s.</span>
            )}
          </Alert>
          <Button type="button" variant="secundario" larguraTotal onClick={retryValidation} disabled={retryAfterSeconds !== null}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {phase === "form" ? (
        <>
          <p className="vx-activate-intro">
            Crie uma senha para concluir a ativação. O convite será validado novamente ao enviar.
          </p>
          {activationError && (
            <Alert tom={rateLimitStage === "activation" ? "atencao" : "perigo"} titulo="Não foi possível ativar a conta">
              {activationError}
              {rateLimitStage === "activation" && retryAfterSeconds !== null && (
                <span className="vx-activate-countdown"> Tente novamente em {retryAfterSeconds}s.</span>
              )}
            </Alert>
          )}
          <form className="vx-login-form vx-activate-form" aria-labelledby="activate-account-title" onSubmit={submit} noValidate>
            <Field
              rotulo="Senha nova"
              obrigatorio
              className="vx-login-field"
              dica="Pelo menos 8 caracteres e até 72 bytes em UTF-8."
              erro={passwordError}
            >
              {(attrs) => (
                <Input
                  {...attrs}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setPasswordError(null);
                  }}
                  prefixo={<LockKeyhole size={18} className="vx-login-input-icon" />}
                  sufixo={(
                    <button
                      type="button"
                      className="vx-login-password-toggle"
                      aria-label={showPassword ? "Ocultar senha nova" : "Mostrar senha nova"}
                      aria-pressed={showPassword}
                      aria-controls={attrs.id}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  )}
                  className="vx-login-input vx-login-password-input"
                />
              )}
            </Field>

            <Field
              rotulo="Confirmar senha"
              obrigatorio
              className="vx-login-field"
              erro={confirmationError}
            >
              {(attrs) => (
                <Input
                  {...attrs}
                  name="passwordConfirmation"
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  prefixo={<LockKeyhole size={18} className="vx-login-input-icon" />}
                  sufixo={(
                    <button
                      type="button"
                      className="vx-login-password-toggle"
                      aria-label={showConfirmation ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                      aria-pressed={showConfirmation}
                      aria-controls={attrs.id}
                      onClick={() => setShowConfirmation((visible) => !visible)}
                    >
                      {showConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                    </button>
                  )}
                  className="vx-login-input vx-login-password-input"
                />
              )}
            </Field>

            <Button
              type="submit"
              carregando={submitting}
              disabled={retryAfterSeconds !== null}
              larguraTotal
              className="vx-login-submit"
            >
              Ativar conta
            </Button>
          </form>
        </>
      ) : null}

      {phase === "success" ? (
        <div className="vx-activate-state">
          <Alert tom="sucesso" titulo="Conta ativada">
            Sua senha foi definida. Agora você pode entrar com sua conta.
          </Alert>
          <p className="vx-activate-login-link"><Link to="/login">Ir para o login</Link></p>
        </div>
      ) : null}
    </section>
  );
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
