/** Login centralizado, com identidade visual e animações restritas a esta rota. */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { authApi } from "../../lib/api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import { useApiError } from "../../hooks/use-api-error";
import { Alert, Button, Field, Input } from "../../components/ui";
import "./login-page.css";

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
    <main className="vx-login">
      <div className="vx-login-background" aria-hidden="true">
        <svg className="vx-login-circuit" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
          <g className="vx-login-tracks">
            <path d="M0 170 H180 L340 330 H480 M0 730 H180 L340 570 H480" />
            <path d="M1440 170 H1260 L1100 330 H960 M1440 730 H1260 L1100 570 H960" />
            <path d="M120 0 V210 L270 360 V540 L120 690 V900" />
            <path d="M1320 0 V210 L1170 360 V540 L1320 690 V900" />
            <path d="M0 450 H360 M1080 450 H1440" />
            <circle cx="360" cy="450" r="4" />
            <circle cx="1080" cy="450" r="4" />
          </g>
          <g className="vx-login-signals">
            <path pathLength="100" d="M0 170 H180 L340 330 H480" />
            <path pathLength="100" d="M1440 730 H1260 L1100 570 H960" />
            <path pathLength="100" d="M1320 0 V210 L1170 360 V540 L1320 690 V900" />
          </g>
        </svg>
      </div>

      <header className="vx-login-header">
        <Link to="/" className="vx-login-brand" aria-label="Vulnera — página inicial">
          VULNERA<span className="vx-login-cursor" aria-hidden="true" />
        </Link>
        <Link to="/" className="vx-login-back">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar ao site
        </Link>
      </header>

      <div className="vx-login-stage">
        <section className="vx-login-panel" aria-labelledby="login-title">
          <div className="vx-login-heading">
            <p className="vx-login-eyebrow">BEM-VINDO DE VOLTA</p>
            <h1 id="login-title">Entrar</h1>
            <p>Suas análises. Seu próximo passo.</p>
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
                  placeholder="voce@empresa.com"
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
                  placeholder="Sua senha"
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
            Primeira vez por aqui? <Link to="/register">Criar uma conta</Link>
          </p>
        </section>
      </div>

      <footer className="vx-login-footer">Vulnera Security <span aria-hidden="true">/</span> Gestão de vulnerabilidades</footer>
    </main>
  );
}
