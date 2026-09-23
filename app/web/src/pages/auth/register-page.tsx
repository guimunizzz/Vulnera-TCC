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
import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { authApi } from "../../lib/api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import { useApiError } from "../../hooks/use-api-error";
import { Alert, Button, Field, Input } from "../../components/ui";

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
    <section className="vx-login-panel vx-register-panel" aria-labelledby="register-title">
      <span className="vx-login-panel-tab" aria-hidden="true">VULNERA / CADASTRO</span>
      <span className="vx-login-panel-corner" aria-hidden="true" />
      <div className="vx-login-heading">
        <p className="vx-login-eyebrow"><span aria-hidden="true">//</span> COMECE POR AQUI</p>
        <h1 id="register-title" tabIndex={-1}>Criar conta<span className="vx-login-title-mark" aria-hidden="true">_</span></h1>
        <p>Crie seu acesso. O próximo passo é cadastrar sua empresa.</p>
      </div>
      <form onSubmit={enviar} className="vx-login-form" aria-labelledby="register-title">

        {erro && (
          <Alert tom="perigo" titulo="Não foi possível criar a conta">
            {erro}
          </Alert>
        )}

        <Field rotulo="Nome" obrigatorio className="vx-login-field">
          {(attrs) => <Input {...attrs} name="name" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} className="vx-login-input" prefixo={<UserRound size={18} className="vx-login-input-icon" />} />}
        </Field>

        <Field rotulo="E-mail" obrigatorio className="vx-login-field">
          {(attrs) => (
            <Input {...attrs} name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="vx-login-input" prefixo={<Mail size={18} className="vx-login-input-icon" />} />
          )}
        </Field>

        <Field rotulo="Senha" dica="Mínimo de 8 caracteres." obrigatorio className="vx-login-field">
          {(attrs) => (
            <Input
              {...attrs}
              name="password"
              className="vx-login-input"
              prefixo={<LockKeyhole size={18} className="vx-login-input-icon" />}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          )}
        </Field>

        <Field rotulo="Confirmar senha" erro={erroConfirmacao} obrigatorio className="vx-login-field">
          {(attrs) => (
            <Input
              {...attrs}
              name="password-confirmation"
              className="vx-login-input"
              prefixo={<LockKeyhole size={18} className="vx-login-input-icon" />}
              type="password"
              autoComplete="new-password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
            />
          )}
        </Field>

        <Button type="submit" carregando={enviando} larguraTotal className="vx-login-submit" iconeFim={<ArrowRight size={18} />}>
          Criar conta
        </Button>

      </form>
      <p className="vx-login-register">
        Já tem conta?{" "}
        <Link to="/login">
          Entrar <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </p>
    </section>
  );
}
