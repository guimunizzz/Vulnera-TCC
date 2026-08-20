/**
 * login-page.tsx
 *
 * O QUE MUDOU NA FASE 6.5
 * - `Label` solto → `Field`, que amarra rótulo, dica e erro por `useId`.
 * - Erro de credencial vira `Alert role="alert"` — antes era um parágrafo que
 *   um leitor de tela não anunciava ao aparecer.
 * - Botão com estado `carregando` de verdade (mantém a largura, anuncia
 *   `aria-busy`) em vez de trocar o texto para "Entrando…".
 * - `autoComplete` nos dois campos: sem eles o gerenciador de senhas do
 *   navegador não preenche, o que é atrito real numa demo.
 */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../lib/api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import { useApiError } from "../../hooks/use-api-error";
import { Alert, Button, Card, Field, Input } from "../../components/ui";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col gap-2 text-center">
          <span className="text-2xl font-bold tracking-tight text-accent-ink">Vulnera</span>
          <p className="text-sm text-fg-muted">Gestão de análises de segurança</p>
        </div>

        <Card>
          <form onSubmit={enviar} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold text-fg">Entrar</h1>
              <p className="text-sm text-fg-muted">Acesse sua conta.</p>
            </div>

            {erro && (
              <Alert tom="perigo" titulo="Não foi possível entrar">
                {erro}
              </Alert>
            )}

            <Field rotulo="E-mail" obrigatorio>
              {(attrs) => (
                <Input
                  {...attrs}
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Field>

            <Field rotulo="Senha" obrigatorio>
              {(attrs) => (
                <Input
                  {...attrs}
                  type="password"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              )}
            </Field>

            <Button type="submit" carregando={enviando} larguraTotal>
              Entrar
            </Button>

            <p className="text-center text-sm text-fg-muted">
              Não tem conta?{" "}
              <Link to="/register" className="rounded-control text-accent-ink hover:underline">
                Cadastre-se
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
