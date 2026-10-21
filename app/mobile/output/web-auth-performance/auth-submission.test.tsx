/**
 * Protege os envios de login e cadastro contra chamadas duplicadas.
 * Exercita as páginas com API simulada e store real para preservar foco,
 * mensagens de erro, nova tentativa e destino da autenticação na suíte web.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./login-page";
import { RegisterPage } from "./register-page";
import { authApi } from "../../lib/api/auth.api";
import { useAuthStore } from "../../store/auth.store";
import type { AuthResponse } from "../../types/auth.types";

vi.mock("../../lib/api/auth.api", () => ({
  authApi: { login: vi.fn(), register: vi.fn() },
}));

const sessao: AuthResponse = {
  accessToken: "access-auth-test",
  refreshToken: "refresh-auth-test",
  user: {
    id: "auth-user",
    name: "Rafael",
    email: "rafael@example.test",
    role: "CLIENT",
    companyId: null,
    createdAt: "2026-10-15T12:00:00.000Z",
  },
};

const fluxos = [
  {
    nome: "login",
    rota: "/login",
    titulo: "Entrar",
    botao: "Entrar na plataforma",
    api: "login",
    destino: "Destino dashboard",
    tituloErro: "Não foi possível entrar",
    codigoErro: "INVALID_CREDENTIALS",
    mensagemErro: "E-mail ou senha incorretos.",
    payload: { email: sessao.user.email, password: "Senha123!" },
  },
  {
    nome: "cadastro",
    rota: "/register",
    titulo: "Criar conta",
    botao: "Criar conta",
    api: "register",
    destino: "Destino onboarding",
    tituloErro: "Não foi possível criar a conta",
    codigoErro: "EMAIL_ALREADY_EXISTS",
    mensagemErro: "Este e-mail já está cadastrado.",
    payload: { name: sessao.user.name, email: sessao.user.email, password: "Senha123!" },
  },
] as const;

function promessaPendente<T>() {
  let resolver!: (value: T) => void;
  let rejeitar!: (reason: unknown) => void;
  const promessa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promessa, resolver, rejeitar };
}

function renderFormulario(rota: string): void {
  render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<h1>Destino dashboard</h1>} />
        <Route path="/onboarding" element={<h1>Destino onboarding</h1>} />
      </Routes>
    </MemoryRouter>,
  );

  if (rota === "/register") {
    fireEvent.change(screen.getByLabelText(/^Nome/), { target: { value: sessao.user.name } });
    fireEvent.change(screen.getByLabelText(/^Confirmar senha/), { target: { value: "Senha123!" } });
  }
  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: sessao.user.email } });
  fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: "Senha123!" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearAuth();
});

afterEach(() => useAuthStore.getState().clearAuth());

describe.each(fluxos)("Envio de $nome", (fluxo) => {
  it("envia uma vez enquanto aguarda, mantém foco e preserva a sessão e o destino", async () => {
    const pendente = promessaPendente<AuthResponse>();
    const enviar = vi.mocked(authApi[fluxo.api]);
    enviar.mockReturnValueOnce(pendente.promessa);
    renderFormulario(fluxo.rota);
    const formulario = screen.getByRole("form", { name: fluxo.titulo });
    const botao = screen.getByRole("button", { name: fluxo.botao });
    botao.focus();

    // Dois eventos no mesmo lote também cobrem a janela anterior ao render
    // do estado ocupado; a trava precisa valer desde o primeiro envio.
    act(() => {
      fireEvent.submit(formulario);
      fireEvent.submit(formulario);
    });
    fireEvent.click(botao);
    fireEvent.submit(formulario);

    expect(enviar).toHaveBeenCalledTimes(1);
    expect(enviar).toHaveBeenCalledWith(fluxo.payload);
    expect(botao).toHaveAttribute("aria-busy", "true");
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).not.toBeDisabled();
    expect(botao).toHaveFocus();

    await act(async () => {
      pendente.resolver(sessao);
      await pendente.promessa;
    });

    expect(await screen.findByRole("heading", { name: fluxo.destino })).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject(sessao);
  });

  it("anuncia a falha e libera uma nova tentativa sem perder os dados", async () => {
    const pendente = promessaPendente<AuthResponse>();
    const enviar = vi.mocked(authApi[fluxo.api]);
    enviar.mockReturnValueOnce(pendente.promessa).mockResolvedValueOnce(sessao);
    renderFormulario(fluxo.rota);
    const formulario = screen.getByRole("form", { name: fluxo.titulo });
    const botao = screen.getByRole("button", { name: fluxo.botao });
    fireEvent.submit(formulario);

    await act(async () => {
      pendente.rejeitar({ isAxiosError: true, response: { data: { code: fluxo.codigoErro } } });
    });

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent(fluxo.tituloErro);
    expect(alerta).toHaveTextContent(fluxo.mensagemErro);
    expect(botao).not.toHaveAttribute("aria-busy");
    expect(botao).not.toHaveAttribute("aria-disabled");
    expect(screen.getByLabelText(/^E-mail/)).toHaveValue(sessao.user.email);
    expect(screen.getByLabelText(/^Senha/)).toHaveValue("Senha123!");
    expect(useAuthStore.getState().accessToken).toBeNull();

    fireEvent.submit(formulario);

    expect(enviar).toHaveBeenCalledTimes(2);
    expect(enviar).toHaveBeenLastCalledWith(fluxo.payload);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: fluxo.destino })).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject(sessao);
  });
});

it("mantém a validação de confirmação de senha antes de enviar o cadastro", async () => {
  vi.mocked(authApi.register).mockResolvedValueOnce(sessao);
  renderFormulario("/register");
  const confirmacao = screen.getByLabelText(/^Confirmar senha/);
  fireEvent.change(confirmacao, { target: { value: "OutraSenha123!" } });

  fireEvent.submit(screen.getByRole("form", { name: "Criar conta" }));

  expect(authApi.register).not.toHaveBeenCalled();
  expect(confirmacao).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("alert")).toHaveTextContent("As senhas não coincidem.");
  expect(screen.getByRole("button", { name: "Criar conta" })).not.toHaveAttribute("aria-busy");

  fireEvent.change(confirmacao, { target: { value: "Senha123!" } });
  fireEvent.submit(screen.getByRole("form", { name: "Criar conta" }));

  expect(authApi.register).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole("heading", { name: "Destino onboarding" })).toBeInTheDocument();
});
