/**
 * register-page.tsx
 *
 * O QUE MUDOU NA FASE 6.5
 * - `Field` no lugar de `Label` solto (rótulo, dica e erro amarrados por id).
 * - A divergência de senha vira erro DO CAMPO, com `aria-invalid` e
 *   `role="alert"`, em vez de um alerta genérico no topo do formulário — quem
 *   usa leitor de tela agora sabe QUAL campo está errado.
 * - `autoComplete="new-password"` nos dois campos de senha: é o que faz o
 *   navegador oferecer uma senha forte em vez de preencher a antiga.
 */

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../lib/api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import { useApiError } from "../../hooks/use-api-error";
import { Alert, Button, Card, Field, Input } from "../../components/ui";

export function RegisterPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const mensagemDeErro = useApiError();

  // Só reclama depois que a pessoa digitou algo na confirmação — validar em
  // branco marcaria o campo de vermelho antes de ela ter chance de errar.
  const erroConfirmacao = confirmacao.length > 0 && confirmacao !== senha ? "As senhas não coincidem." : null;

  async function enviar(event: FormEvent): Promise<void> {
    event.preventDefault();
    setErro(null);
    if (erroConfirmacao) return;

    setEnviando(true);
    try {
      const auth = await authApi.register({ name: nome, email, password: senha });
      setAuth(auth);
      navigate("/onboarding");
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
              <h1 className="text-lg font-semibold text-fg">Criar conta</h1>
              <p className="text-sm text-fg-muted">O próximo passo é cadastrar sua empresa.</p>
            </div>

            {erro && (
              <Alert tom="perigo" titulo="Não foi possível criar a conta">
                {erro}
              </Alert>
            )}

            <Field rotulo="Nome" obrigatorio>
              {(attrs) => <Input {...attrs} autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />}
            </Field>

            <Field rotulo="E-mail" obrigatorio>
              {(attrs) => (
                <Input {...attrs} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>

            <Field rotulo="Senha" dica="Mínimo de 8 caracteres." obrigatorio>
              {(attrs) => (
                <Input
                  {...attrs}
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                />
              )}
            </Field>

            <Field rotulo="Confirmar senha" erro={erroConfirmacao} obrigatorio>
              {(attrs) => (
                <Input
                  {...attrs}
                  type="password"
                  autoComplete="new-password"
                  value={confirmacao}
                  onChange={(e) => setConfirmacao(e.target.value)}
                />
              )}
            </Field>

            <Button type="submit" carregando={enviando} larguraTotal>
              Criar conta
            </Button>

            <p className="text-center text-sm text-fg-muted">
              Já tem conta?{" "}
              <Link to="/login" className="rounded-control text-accent-ink hover:underline">
                Entrar
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
