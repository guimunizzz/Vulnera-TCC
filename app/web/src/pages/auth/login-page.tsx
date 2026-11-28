/** Login centralizado, com identidade visual e animações restritas a esta rota. */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { authApi } from "../../lib/api/auth.api";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { usersApi } from "../../lib/api/users.api";
import { useAuthStore } from "../../store/auth.store";
import { useApiError } from "../../hooks/use-api-error";
import { Alert, Button, Field, Input } from "../../components/ui";
import { InteractiveLabel } from "../../components/ui/interactive-label";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const envioPendente = useRef(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [profileRecovery, setProfileRecovery] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const mensagemDeErro = useApiError();

  // O dashboard costuma ser o próximo destino; baixa-se durante a digitação.
  // Mesmo módulo do `lazy()` de App.tsx, então o navegador reaproveita o download.
  useEffect(() => {
    const baixar = () => void import("../dashboard-page").catch(() => undefined);
    // Nem todo navegador (nem o jsdom) implementa requestIdleCallback.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(baixar);
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(baixar, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function enviar(event: FormEvent): Promise<void> {
    event.preventDefault();
    // Enter repetido também passa por esta trava antes do próximo render.
    if (envioPendente.current) return;
    setErro(null);
    setProfileRecovery(false);
    envioPendente.current = true;
    setEnviando(true);
    try {
      const auth = await authApi.login({ email, password: senha });
      setAuth(auth);
      await routeAuthenticatedUser(auth.user);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      envioPendente.current = false;
      setEnviando(false);
    }
  }

  async function routeAuthenticatedUser(authUser = useAuthStore.getState().user): Promise<void> {
    if (!authUser) return;
    let user = authUser;
    if (user.role === "CLIENT" && user.companyId === null && user.legacyOnboardingAllowed === undefined) {
      try {
        const profile = await usersApi.me();
        if (!useAuthStore.getState().updateUser(profile, user)) return;
        user = profile;
      } catch {
        setProfileRecovery(true);
        setErro("Sua sessão foi iniciada, mas não foi possível carregar seu perfil. Tente novamente para continuar.");
        return;
      }
    }
    if (user.role === "CLIENT" && user.companyId && user.companyRole === "OWNER") {
      try {
        const status = await subscriptionsApi.onboardingStatus();
        navigate(status.status === "ACTIVE" ? "/dashboard" : "/onboarding");
      } catch {
        navigate("/onboarding");
      }
      return;
    }
    navigate(user.role === "CLIENT" && user.companyId === null && user.legacyOnboardingAllowed === true ? "/onboarding" : "/dashboard");
  }

  return (
    <section className="vx-login-panel" aria-labelledby="login-title">
      <span className="vx-login-panel-tab" aria-hidden="true">VULNERA / ACESSO</span>
      <span className="vx-login-panel-corner" aria-hidden="true" />
      {/* O título mantém o nome acessível e recebe o foco da transição. */}
      <h1 id="login-title" className="sr-only" tabIndex={-1}>Entrar</h1>

      <form onSubmit={enviar} className="vx-login-form" aria-labelledby="login-title">
        {erro && (
          <Alert tom="perigo" titulo="Não foi possível entrar">
            {erro}
            {profileRecovery && <Button className="mt-3" type="button" variant="secundario" onClick={() => void routeAuthenticatedUser()}>Tentar novamente</Button>}
          </Alert>
        )}

        <Field rotulo="E-mail" obrigatorio className="vx-login-field">
          {(attrs) => (
            <Input
              {...attrs}
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              prefixo={<Mail size={18} className="vx-login-input-icon" />}
              className="vx-login-input"
            />
          )}
        </Field>

        <Field rotulo="Senha" obrigatorio className="vx-login-field">
          {(attrs) => (
            <Input
              {...attrs}
              name="password"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              prefixo={<LockKeyhole size={18} className="vx-login-input-icon" />}
              sufixo={
                <button
                  type="button"
                  className="vx-login-password-toggle"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={mostrarSenha}
                  aria-controls={attrs.id}
                  onClick={() => setMostrarSenha((visivel) => !visivel)}
                >
                  {mostrarSenha ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              }
              className="vx-login-input vx-login-password-input"
            />
          )}
        </Field>

        <Button type="submit" carregando={enviando} larguraTotal className="vx-login-submit" iconeFim={<ArrowRight size={18} />}>
          <InteractiveLabel>Entrar na plataforma</InteractiveLabel>
        </Button>
      </form>

      <p className="vx-login-register">
        Precisa de acesso? <Link to="/request-access"><InteractiveLabel effect="glitch">Solicitar acesso</InteractiveLabel> <ArrowRight size={14} aria-hidden="true" /></Link>
      </p>
    </section>
  );
}
