/**
 * Ativa convite de MEMBER para uma empresa existente e define a senha da conta.
 * Captura o token team_ do fragmento, remove-o da URL e mantém apenas em memória.
 * Consumido pela rota pública /join-company.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Field, Input } from "../../components/ui";
import { useFragmentToken } from "../../hooks/use-fragment-token";
import { PublicApiError } from "../../lib/api/public-http";
import { companyInvitationsApi } from "../../lib/api/company-invitations.api";

type Phase = "preparing" | "validating" | "unavailable" | "validation-error" | "form" | "success";
const TEAM_TOKEN = /^team_[A-Za-z0-9_-]{43}$/u;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;

function byteLength(value: string): number { return new TextEncoder().encode(value).length; }

export function JoinCompanyPage() {
  const { token, ready, clearToken } = useFragmentToken();
  const [phase, setPhase] = useState<Phase>("preparing");
  const [attempt, setAttempt] = useState(0);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const activated = useRef(false);
  const validationRef = useRef<{ token: string; promise: ReturnType<typeof companyInvitationsApi.validatePublic> } | null>(null);
  const validFormat = token !== null && TEAM_TOKEN.test(token);

  useEffect(() => {
    if (!ready || activated.current) return;
    if (!token || !validFormat) { setPhase("unavailable"); return; }
    let current = true;
    setPhase("validating");
    setMessage(null);
    let pending = validationRef.current;
    if (!pending || pending.token !== token) {
      pending = { token, promise: companyInvitationsApi.validatePublic(token) };
      validationRef.current = pending;
    }
    const request = pending;
    void request.promise.then((result) => {
      if (!current) return;
      if (result.valid) setPhase("form");
      else { clearToken(); setPhase("unavailable"); }
    }).catch(() => {
      if (!current) return;
      setPhase("validation-error");
      setMessage("Não foi possível verificar o convite agora. Tente novamente.");
    }).finally(() => { if (validationRef.current === request) validationRef.current = null; });
    return () => { current = false; };
  }, [ready, token, validFormat, attempt, clearToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !token || phase !== "form") return;
    setMessage(null);
    setPasswordError(null);
    if (password.length < MIN_PASSWORD_LENGTH) { setPasswordError("Use pelo menos 8 caracteres."); return; }
    if (byteLength(password) > MAX_PASSWORD_BYTES) { setPasswordError("Use uma senha com até 72 bytes em UTF-8."); return; }
    if (password !== confirmation) { setMessage("As senhas não coincidem."); return; }
    inFlight.current = true;
    setSubmitting(true);
    try {
      await companyInvitationsApi.activatePublic({ token, password });
      activated.current = true;
      clearToken();
      setPassword("");
      setConfirmation("");
      setPhase("success");
    } catch (error) {
      if (error instanceof PublicApiError && error.status === 400) {
        clearToken();
        setPhase("unavailable");
      } else if (error instanceof PublicApiError && error.status === 429) {
        setMessage("Muitas tentativas recentes. Aguarde um pouco e tente novamente.");
      } else {
        setMessage("Não foi possível ativar a conta agora. Tente novamente.");
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return <section className="vx-login-panel" aria-labelledby="join-company-title">
    <header className="vx-login-heading"><p className="vx-login-eyebrow">VULNERA / EQUIPE</p><h1 id="join-company-title" tabIndex={-1}>Entrar para a equipe</h1><p>Defina uma senha para ativar seu acesso à empresa.</p></header>
    {(phase === "preparing" || phase === "validating") && <p role="status">Validando o convite…</p>}
    {phase === "validation-error" && <div className="space-y-4"><Alert tom="perigo" titulo="Não foi possível validar o convite">{message}</Alert><Button type="button" variant="secundario" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Button></div>}
    {phase === "unavailable" && <div className="space-y-4"><Alert tom="atencao" titulo="Convite indisponível">Este convite é inválido, expirou, foi revogado ou já foi utilizado. Peça ao responsável da empresa para verificar o acesso.</Alert><Link className="text-sm text-accent-ink underline" to="/login">Ir para o login</Link></div>}
    {phase === "form" && <>
      <p className="mb-4 text-sm text-fg-muted">O convite será validado novamente ao salvar a senha.</p>
      {message && <Alert className="mb-4" tom="perigo">{message}</Alert>}
      <form className="vx-login-form" onSubmit={submit} noValidate>
        <Field rotulo="Senha" obrigatorio dica="Pelo menos 8 caracteres e até 72 bytes em UTF-8." erro={passwordError}>{(attrs) => <Input {...attrs} type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setPasswordError(null); }} />}</Field>
        <Field rotulo="Confirmar senha" obrigatorio>{(attrs) => <Input {...attrs} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />}</Field>
        <Button type="submit" carregando={submitting} larguraTotal>Ativar acesso</Button>
      </form>
    </>}
    {phase === "success" && <div className="space-y-4"><Alert tom="sucesso" titulo="Acesso ativado">Sua senha foi definida. Entre com sua conta para acessar a empresa.</Alert><Link className="text-sm text-accent-ink underline" to="/login">Ir para o login</Link></div>}
  </section>;
}
