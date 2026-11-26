/**
 * Confirma explicitamente o e-mail de uma solicitação usando token de fragmento.
 * Só consome o token após ação humana e nunca o envia pela query string.
 * Consumido pela rota pública /verify-email.
 */

import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "../../components/ui";
import { useFragmentToken } from "../../hooks/use-fragment-token";
import { PublicApiError } from "../../lib/api/public-http";
import { publicAccessApi } from "../../lib/api/public-access.api";
import "./request-access-page.css";

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/u;

type Result = { kind: "success" | "error"; message: string } | null;

export function VerifyEmailPage() {
  const { token, ready, clearToken } = useFragmentToken();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const sendPending = useRef(false);
  const tokenIsValid = token !== null && TOKEN_FORMAT.test(token);

  async function confirm(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (sendPending.current || !ready || !tokenIsValid || !token) return;

    sendPending.current = true;
    setSending(true);
    setResult(null);
    try {
      await publicAccessApi.verifyEmail({ token });
      clearToken();
      setResult({ kind: "success", message: "E-mail confirmado. Sua solicitação seguirá para análise." });
    } catch (error) {
      if (error instanceof PublicApiError && error.status === 400) {
        clearToken();
        setResult({ kind: "error", message: "Este link é inválido ou expirou. Solicite novas instruções para continuar." });
      } else if (error instanceof PublicApiError && error.status === 0) {
        setResult({ kind: "error", message: "Não foi possível conectar. Tente confirmar novamente." });
      } else {
        setResult({ kind: "error", message: "Não foi possível confirmar agora. Tente novamente." });
      }
    } finally {
      sendPending.current = false;
      setSending(false);
    }
  }

  return (
    <section className="vx-login-panel vx-verify-email-panel" aria-labelledby="verify-email-title">
      <header className="vx-login-heading">
        <p className="vx-login-eyebrow">VULNERA / VERIFICAÇÃO</p>
        <h1 id="verify-email-title" tabIndex={-1}>Confirmar e-mail</h1>
        <p>Confirme o endereço usado na solicitação para que ela siga para análise.</p>
      </header>

      {!ready && <p role="status">Preparando confirmação…</p>}

      {ready && !tokenIsValid && !result && (
        <Alert tom="atencao" titulo="Link indisponível">
          Este link é inválido ou expirou. Solicite novas instruções para continuar.
        </Alert>
      )}

      {result && (
        <Alert
          tom={result.kind === "success" ? "sucesso" : "perigo"}
          titulo={result.kind === "success" ? "E-mail confirmado" : "Não foi possível confirmar"}
          className="vx-verify-email-feedback"
        >
          {result.message}
        </Alert>
      )}

      {ready && tokenIsValid && result?.kind !== "success" && (
        <form onSubmit={confirm} className="vx-login-form" aria-labelledby="verify-email-title">
          <p className="vx-verify-email-hint">O link será validado somente quando você confirmar.</p>
          <Button type="submit" carregando={sending} larguraTotal className="vx-login-submit">
            Confirmar e-mail
          </Button>
        </form>
      )}

      {ready && (!tokenIsValid || result?.kind === "error") && (
        <p className="vx-login-register vx-verify-email-resend">
          <Link to="/request-access">Solicitar novas instruções</Link>
        </p>
      )}
    </section>
  );
}
