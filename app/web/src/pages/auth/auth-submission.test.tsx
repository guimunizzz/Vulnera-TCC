/**
 * Protege o envio de login contra chamadas duplicadas e valida o destino por
 * papel/empresa. O cadastro web foi substituído pelo pedido controlado de acesso.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./login-page";
import { authApi } from "../../lib/api/auth.api";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { useAuthStore } from "../../store/auth.store";
import type { AuthResponse } from "../../types/auth.types";

vi.mock("../../lib/api/auth.api", () => ({
  authApi: { login: vi.fn() },
}));

vi.mock("../../lib/api/subscriptions.api", () => ({
  subscriptionsApi: { onboardingStatus: vi.fn() },
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

const payload = { email: sessao.user.email, password: "Senha123!" };

function promessaPendente<T>() {
  let resolver!: (value: T) => void;
  let rejeitar!: (reason: unknown) => void;
  const promessa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rejeitar = reject;
  });
  return { promessa, resolver, rejeitar };
}

function renderFormulario(): void {
  render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<h1>Destino dashboard</h1>} />
        <Route path="/onboarding" element={<h1>Destino onboarding</h1>} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText(/^E-mail/), { target: { value: sessao.user.email } });
  fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: "Senha123!" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearAuth();
  vi.mocked(subscriptionsApi.onboardingStatus).mockResolvedValue({ status: "NEEDS_ONBOARDING", subscription: null });
});

afterEach(() => useAuthStore.getState().clearAuth());

describe("Envio de login", () => {
  it("envia uma vez enquanto aguarda, mantém foco e encaminha CLIENT sem empresa ao onboarding", async () => {
    const pendente = promessaPendente<AuthResponse>();
    vi.mocked(authApi.login).mockReturnValueOnce(pendente.promessa);
    renderFormulario();
    const formulario = screen.getByRole("form", { name: "Entrar" });
    const botao = screen.getByRole("button", { name: "Entrar na plataforma" });
    botao.focus();

    act(() => {
      fireEvent.submit(formulario);
      fireEvent.submit(formulario);
    });
    fireEvent.click(botao);
    fireEvent.submit(formulario);

    expect(authApi.login).toHaveBeenCalledTimes(1);
    expect(authApi.login).toHaveBeenCalledWith(payload);
    expect(botao).toHaveAttribute("aria-busy", "true");
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).not.toBeDisabled();
    expect(botao).toHaveFocus();

    await act(async () => {
      pendente.resolver(sessao);
      await pendente.promessa;
    });

    expect(await screen.findByRole("heading", { name: "Destino onboarding" })).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject(sessao);
    expect(subscriptionsApi.onboardingStatus).not.toHaveBeenCalled();
  });

  it.each([
    { nome: "CLIENT com empresa", sessao: { ...sessao, user: { ...sessao.user, companyId: "company-1" } }, destino: "Destino dashboard" },
    { nome: "CLIENT MEMBER com empresa", sessao: { ...sessao, user: { ...sessao.user, companyId: "company-1", companyRole: "MEMBER" } }, destino: "Destino dashboard" },
    { nome: "ADMIN sem empresa", sessao: { ...sessao, user: { ...sessao.user, role: "ADMIN" as const } }, destino: "Destino dashboard" },
    { nome: "PENTESTER sem empresa", sessao: { ...sessao, user: { ...sessao.user, role: "PENTESTER" as const } }, destino: "Destino dashboard" },
  ])("encaminha $nome ao dashboard", async ({ sessao: sessaoEsperada, destino }) => {
    vi.mocked(authApi.login).mockResolvedValueOnce(sessaoEsperada);
    renderFormulario();

    fireEvent.submit(screen.getByRole("form", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: destino })).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject(sessaoEsperada);
    expect(subscriptionsApi.onboardingStatus).not.toHaveBeenCalled();
  });

  it.each([
    { nome: "sem pedido", status: { status: "NEEDS_ONBOARDING" as const, subscription: null }, destino: "Destino onboarding" },
    { nome: "com pedido pendente", status: { status: "PENDING_APPROVAL" as const, subscription: null }, destino: "Destino onboarding" },
    { nome: "com assinatura ativa", status: { status: "ACTIVE" as const, subscription: null }, destino: "Destino dashboard" },
  ])("retoma OWNER CLIENT com empresa $nome no destino correto", async ({ status, destino }) => {
    const ownerSession: AuthResponse = {
      ...sessao,
      user: { ...sessao.user, companyId: "company-owner", companyRole: "OWNER" },
    };
    vi.mocked(authApi.login).mockResolvedValueOnce(ownerSession);
    vi.mocked(subscriptionsApi.onboardingStatus).mockResolvedValueOnce(status);
    renderFormulario();

    fireEvent.submit(screen.getByRole("form", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: destino })).toBeInTheDocument();
    expect(subscriptionsApi.onboardingStatus).toHaveBeenCalledOnce();
    expect(useAuthStore.getState()).toMatchObject(ownerSession);
  });

  it("encaminha OWNER CLIENT ao onboarding se a leitura de status falha, mantendo a sessão", async () => {
    const ownerSession: AuthResponse = {
      ...sessao,
      user: { ...sessao.user, companyId: "company-owner", companyRole: "OWNER" },
    };
    vi.mocked(authApi.login).mockResolvedValueOnce(ownerSession);
    vi.mocked(subscriptionsApi.onboardingStatus).mockRejectedValueOnce(new Error("NETWORK"));
    renderFormulario();

    fireEvent.submit(screen.getByRole("form", { name: "Entrar" }));

    expect(await screen.findByRole("heading", { name: "Destino onboarding" })).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject(ownerSession);
  });

  it("anuncia a falha e libera nova tentativa sem perder os dados", async () => {
    const pendente = promessaPendente<AuthResponse>();
    vi.mocked(authApi.login).mockReturnValueOnce(pendente.promessa).mockResolvedValueOnce(sessao);
    renderFormulario();
    const formulario = screen.getByRole("form", { name: "Entrar" });
    const botao = screen.getByRole("button", { name: "Entrar na plataforma" });
    fireEvent.submit(formulario);

    await act(async () => {
      pendente.rejeitar({ isAxiosError: true, response: { data: { code: "INVALID_CREDENTIALS" } } });
    });

    const alerta = await screen.findByRole("alert");
    expect(alerta).toHaveTextContent("Não foi possível entrar");
    expect(alerta).toHaveTextContent("E-mail ou senha incorretos.");
    expect(botao).not.toHaveAttribute("aria-busy");
    expect(botao).not.toHaveAttribute("aria-disabled");
    expect(screen.getByLabelText(/^E-mail/)).toHaveValue(sessao.user.email);
    expect(screen.getByLabelText(/^Senha/)).toHaveValue("Senha123!");
    expect(useAuthStore.getState().accessToken).toBeNull();

    fireEvent.submit(formulario);

    expect(authApi.login).toHaveBeenCalledTimes(2);
    expect(authApi.login).toHaveBeenLastCalledWith(payload);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Destino onboarding" })).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject(sessao);
  });
});
