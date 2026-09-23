/** Login centralizado, com identidade visual e animações restritas a esta rota. */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { authApi } from "../../lib/api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import { useApiError } from "../../hooks/use-api-error";
import { Alert, Button, Field, Input } from "../../components/ui";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const mensagemDeErro = useApiError();

  async function enviar(event: FormEvent): Promise<void> {
    event.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const auth = await authApi.login({ email, password: senha });
      setAuth(auth);
      navigate("/dashboard");
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="vx-login-panel" aria-labelledby="login-title">
      <span className="vx-login-panel-tab" aria-hidden="true">VULNERA / ACESSO</span>
      <span className="vx-login-panel-corner" aria-hidden="true" />
      <div className="vx-login-heading">
        <p className="vx-login-eyebrow"><span aria-hidden="true">//</span> BEM-VINDO DE VOLTA</p>
        <h1 id="login-title" tabIndex={-1}>Entrar<span className="vx-login-title-mark" aria-hidden="true">_</span></h1>
        <p>Acesse sua conta e continue suas análises.</p>
      </div>

      <form onSubmit={enviar} className="vx-login-form" aria-labelledby="login-title">
        {erro && (
          <Alert tom="perigo" titulo="Não foi possível entrar">
            {erro}
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
          Entrar na plataforma
        </Button>
      </form>

      <p className="vx-login-register">
        Primeira vez por aqui? <Link to="/register">Criar uma conta <ArrowRight size={14} aria-hidden="true" /></Link>
      </p>
    </section>
  );
}
