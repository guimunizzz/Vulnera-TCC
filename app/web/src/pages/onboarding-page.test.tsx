/**
 * O QUE FAZ: testa a conclusão e a retomada do cadastro de empresa e assinatura.
 * POR QUE EXISTE: falhas entre os dois pedidos não podem recriar a empresa nem
 * deixar as permissões OWNER desatualizadas após o cadastro (QA-02 e QA-03).
 * QUEM CONSOME: suíte Vitest do frontend, sem API ou dados reais.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "../store/auth.store";
import type { User } from "../types/auth.types";
import type { Company } from "../types/company.types";
import { OnboardingPage } from "./onboarding-page";
import { instalarMatchMedia } from "../test/setup";

const api = vi.hoisted(() => ({ plans: vi.fn(), createCompany: vi.fn(), companyMe: vi.fn(), userMe: vi.fn(), request: vi.fn() }));
vi.mock("../lib/api/plans.api", () => ({ plansApi: { list: api.plans } }));
vi.mock("../lib/api/companies.api", () => ({ companiesApi: { create: api.createCompany, me: api.companyMe } }));
vi.mock("../lib/api/users.api", () => ({ usersApi: { me: api.userMe } }));
vi.mock("../lib/api/subscriptions.api", () => ({ subscriptionsApi: { request: api.request } }));

const USER: User = {
  id: "user-qa", name: "Pessoa QA", email: "qa@example.test", role: "CLIENT",
  companyId: null, companyRole: null, createdAt: "2026-10-15T12:00:00Z",
};
const COMPANY: Company = {
  id: "company-qa", name: "Empresa QA salva", cnpj: "12345678000199", planId: "plan-qa",
  createdAt: "2026-10-15T12:00:00Z", updatedAt: "2026-10-15T12:00:00Z",
};
const OWNER: User = { ...USER, companyId: COMPANY.id, companyRole: "OWNER" };

function apiError(code: string) {
  return Object.assign(new Error(code), { isAxiosError: true, response: { status: 404, data: { error: code } } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><OnboardingPage /></MemoryRouter></QueryClientProvider>);
}

async function confirmNewCompany() {
  fireEvent.change(await screen.findByLabelText("Nome da empresa"), { target: { value: "Empresa digitada" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(await screen.findByRole("button", { name: /Plano QA/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  instalarMatchMedia(["prefers-reduced-motion"]);
  useAuthStore.getState().setAuth({ accessToken: "token", refreshToken: "refresh", user: { ...USER } });
  api.plans.mockResolvedValue([{ id: "plan-qa", name: "Plano QA", maxApplications: 3, maxProjects: 3 }]);
  api.companyMe.mockRejectedValue(apiError("USER_HAS_NO_COMPANY"));
  api.createCompany.mockImplementation(async () => {
    api.companyMe.mockResolvedValue(COMPANY);
    return COMPANY;
  });
  api.userMe.mockResolvedValue(OWNER);
  api.request.mockResolvedValue({ id: "subscription-qa" });
});

afterEach(() => useAuthStore.getState().clearAuth());

describe("Onboarding — QA-02 e QA-03", () => {
  it("atualiza o perfil autoritativo antes de solicitar assinatura e concluir, preservando tokens", async () => {
    const profile = deferred<User>();
    api.userMe.mockReturnValue(profile.promise);
    renderPage();
    await confirmNewCompany();
    await waitFor(() => expect(api.userMe).toHaveBeenCalledOnce());
    expect(api.request).not.toHaveBeenCalled();
    expect(screen.queryByText("Empresa cadastrada!")).not.toBeInTheDocument();
    act(() => useAuthStore.getState().setTokens("rotated-access", "rotated-refresh"));
    await act(async () => profile.resolve(OWNER));
    expect(await screen.findByText("Empresa cadastrada!")).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({ user: OWNER, accessToken: "rotated-access", refreshToken: "rotated-refresh" });
    expect(api.createCompany).toHaveBeenCalledOnce();
    expect(api.request).toHaveBeenCalledOnce();
  });

  it("retoma somente assinatura quando a empresa foi salva e o pedido falha", async () => {
    api.request.mockRejectedValueOnce(new Error("NETWORK"));
    renderPage();
    await confirmNewCompany();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível concluir a ação.");
    expect(screen.getByText(COMPANY.name)).toBeInTheDocument();
    expect(screen.queryByText("Empresa digitada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Empresa cadastrada!")).toBeInTheDocument();
    expect(api.createCompany).toHaveBeenCalledOnce();
    expect(api.request).toHaveBeenCalledTimes(2);
  });

  it("retoma a atualização de perfil após falha, sem repetir empresa nem antecipar sucesso", async () => {
    api.userMe.mockRejectedValueOnce(new Error("NETWORK"));
    renderPage();
    await confirmNewCompany();
    await screen.findByRole("alert");
    expect(api.request).not.toHaveBeenCalled();
    expect(screen.queryByText("Empresa cadastrada!")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Empresa cadastrada!")).toBeInTheDocument();
    expect(api.userMe).toHaveBeenCalledTimes(2);
    expect(api.createCompany).toHaveBeenCalledOnce();
    expect(api.request).toHaveBeenCalledOnce();
  });

  it("descobre empresa já salva ao reabrir, exibe os dados reais e impede voltar ao cadastro", async () => {
    api.companyMe.mockResolvedValue(COMPANY);
    renderPage();
    await screen.findByRole("button", { name: /Plano QA/ });
    expect(screen.queryByLabelText("Nome da empresa")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
    expect(useAuthStore.getState().user).toEqual(OWNER);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText(COMPANY.name)).toBeInTheDocument();
    expect(screen.getByText(COMPANY.cnpj!)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Empresa cadastrada!")).toBeInTheDocument();
    expect(api.createCompany).not.toHaveBeenCalled();
    expect(api.request).toHaveBeenCalledOnce();
  });

  it("reconcilia a empresa quando a resposta do POST se perde e pede nova confirmação", async () => {
    api.createCompany.mockImplementationOnce(async () => {
      api.companyMe.mockResolvedValue(COMPANY);
      throw new Error("Resposta perdida");
    });
    renderPage();
    await confirmNewCompany();
    expect(await screen.findByText(COMPANY.name)).toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
    expect(screen.queryByText("Empresa cadastrada!")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("Empresa cadastrada!")).toBeInTheDocument();
    expect(api.createCompany).toHaveBeenCalledOnce();
    expect(api.request).toHaveBeenCalledOnce();
  });

  it("bloqueia criação enquanto não consegue verificar se já existe empresa e oferece recuperação", async () => {
    api.companyMe.mockRejectedValueOnce(new Error("NETWORK"));
    renderPage();
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("Nome da empresa")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByLabelText("Nome da empresa")).toBeInTheDocument();
    expect(api.createCompany).not.toHaveBeenCalled();
  });

  it("não aplica perfil nem solicita assinatura para outra sessão após resposta tardia", async () => {
    const profile = deferred<User>();
    api.userMe.mockReturnValue(profile.promise);
    renderPage();
    await confirmNewCompany();
    await waitFor(() => expect(api.userMe).toHaveBeenCalledOnce());
    const other = { ...USER, id: "other-user", companyId: "other-company", companyRole: "MEMBER" };
    act(() => useAuthStore.getState().setAuth({ user: other, accessToken: "other-access", refreshToken: "other-refresh" }));
    await act(async () => profile.resolve(OWNER));
    expect(useAuthStore.getState()).toMatchObject({ user: other, accessToken: "other-access", refreshToken: "other-refresh" });
    expect(api.request).not.toHaveBeenCalled();
    expect(screen.queryByText("Empresa cadastrada!")).not.toBeInTheDocument();
  });
});
