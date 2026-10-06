/**
 * applications-page.test.tsx
 *
 * O QUE FAZ
 * Protege o inventário e os fluxos de criação de aplicações para ADMIN e CLIENT.
 *
 * POR QUE EXISTE
 * ADMIN escolhe explicitamente a empresa de destino; CLIENT continua usando a
 * própria empresa definida pela API. Os estados do formulário e as respostas
 * assíncronas não podem trocar esse contexto nem apagar uma nova sessão.
 *
 * QUEM CONSOME
 * A suíte Vitest do frontend (`npm test`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import type { Application } from "../types/application.types";
import type { Company } from "../types/company.types";
import { ApplicationsPage } from "./applications-page";

const api = vi.hoisted(() => ({
  applications: vi.fn(),
  createApplication: vi.fn(),
  deleteApplication: vi.fn(),
  companies: vi.fn(),
  subscription: vi.fn(),
  plans: vi.fn(),
}));

vi.mock("../lib/api/applications.api", () => ({
  applicationsApi: {
    list: api.applications,
    create: api.createApplication,
    delete: api.deleteApplication,
  },
}));
vi.mock("../lib/api/companies.api", () => ({ companiesApi: { list: api.companies } }));
vi.mock("../lib/api/subscriptions.api", () => ({ subscriptionsApi: { current: api.subscription } }));
vi.mock("../lib/api/plans.api", () => ({ plansApi: { list: api.plans } }));
vi.mock("../hooks/use-company-name", () => ({ useCompanyName: () => "TechNova" }));

const EMPRESA_A: Company = {
  id: "company-1",
  name: "Empresa A",
  cnpj: null,
  planId: "plan-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const EMPRESA_B: Company = {
  id: "company-2",
  name: "Empresa B",
  cnpj: null,
  planId: "plan-1",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

const EMPRESAS = [EMPRESA_A, EMPRESA_B];

const APLICACOES: Application[] = [
  {
    id: "app-1", name: "Portal do Cliente", url: "https://portal.technova.demo", techStack: null, description: null,
    companyId: "company-1", isActive: true, criticality: "HIGH", environment: "PROD", internetFacing: true,
    dataSensitivity: "CONFIDENTIAL", businessOwner: null, technicalOwner: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "app-2", name: "Painel interno", url: "https://interna.technova.demo", techStack: null, description: null,
    companyId: "company-1", isActive: true, criticality: "MEDIUM", environment: "HOMOL", internetFacing: false,
    dataSensitivity: "INTERNAL", businessOwner: null, technicalOwner: null, createdAt: "2026-01-02T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

function aplicacaoCriada(companyId: string, name = "Nova aplicação"): Application {
  return {
    ...APLICACOES[0],
    id: `app-${name.toLowerCase().replace(/ /g, "-")}`,
    name,
    companyId,
  };
}

function erroDaApi(code: string): Error & { isAxiosError: true; response: { data: { error: string } } } {
  return Object.assign(new Error(code), {
    isAxiosError: true as const,
    response: { data: { error: code } },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolver, rejecter) => {
    resolve = resolver;
    reject = rejecter;
  });
  return { promise, resolve, reject };
}

function entrarComo(role: "ADMIN" | "CLIENT" | "PENTESTER", companyId: string | null = role === "ADMIN" ? null : "company-1"): void {
  useAuthStore.setState({
    accessToken: "token-teste",
    refreshToken: "refresh-teste",
    user: {
      id: "user-1",
      name: "Rafael",
      email: "rafael@vulnera.test",
      role,
      companyId,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  });
}

function NavigationProbe() {
  const location = useLocation();
  return <output data-testid="navegacao">{JSON.stringify({ pathname: location.pathname, search: location.search, state: location.state })}</output>;
}

function renderizarPagina(prepararCache?: (client: QueryClient) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  prepararCache?.(queryClient);
  const view = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/applications"]}>
          <Routes>
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/new-analysis" element={<NavigationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...view, queryClient };
}

function abrirModal(): HTMLElement {
  fireEvent.click(screen.getByRole("button", { name: "Nova aplicação" }));
  return screen.getByRole("dialog");
}

function selecionarEmpresa(companyId: string): void {
  fireEvent.change(screen.getByRole("combobox", { name: "Empresa" }), { target: { value: companyId } });
}

function enviarFormulario(): void {
  const form = screen.getByRole("dialog").querySelector("form");
  if (!form) throw new Error("Formulário de criação não encontrado");
  fireEvent.submit(form);
}

beforeEach(() => {
  api.applications.mockReset();
  api.createApplication.mockReset();
  api.deleteApplication.mockReset();
  api.companies.mockReset();
  api.subscription.mockReset();
  api.plans.mockReset();
  api.applications.mockResolvedValue(APLICACOES);
  api.createApplication.mockResolvedValue(aplicacaoCriada("company-1"));
  api.deleteApplication.mockResolvedValue(undefined);
  api.companies.mockResolvedValue(EMPRESAS);
  api.subscription.mockResolvedValue({ planId: "plan-1" });
  api.plans.mockResolvedValue([{ id: "plan-1", name: "PRO", maxApplications: 5 }]);
});

afterEach(() => {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

describe("ApplicationsPage", () => {
  it("APP-VIS-01 — CLIENT vê inventário e capacidade da própria assinatura", async () => {
    entrarComo("CLIENT");
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aplicações" })).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "[data-numeric]" })).toBeInTheDocument();
    expect(screen.getByText("de 5 vagas no plano PRO")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Capacidade de aplicações do plano" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByText("Painel interno")).toBeInTheDocument();

    expect(api.companies).not.toHaveBeenCalled();
    expect(api.subscription).toHaveBeenCalledTimes(1);
    expect(api.plans).toHaveBeenCalledTimes(1);
  });

  it("APP-VIS-02 — PENTESTER mantém ações de leitura e análise, sem ações de gestão", async () => {
    entrarComo("PENTESTER");
    renderizarPagina();

    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("link", { name: "Painel" })).toHaveLength(2);
    expect(within(table).getAllByRole("link", { name: "Nova análise" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Nova aplicação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Contexto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(api.companies).not.toHaveBeenCalled();
    expect(api.subscription).not.toHaveBeenCalled();
    expect(api.plans).not.toHaveBeenCalled();
  });

  it("APP-VIS-04 — Nova análise preserva aplicação pré-selecionada e origem para cancelar", async () => {
    entrarComo("CLIENT");
    renderizarPagina();

    const links = await screen.findAllByRole("link", { name: "Nova análise" });
    expect(links[0]).toHaveAttribute("href", "/new-analysis?applicationId=app-1");
    fireEvent.click(links[0]);

    expect(await screen.findByTestId("navegacao")).toHaveTextContent(JSON.stringify({
      pathname: "/new-analysis",
      search: "?applicationId=app-1",
      state: { returnTo: "/applications" },
    }));
  });

  it("APP-VIS-03 — falha de carregamento oferece nova tentativa sem simular lista vazia", async () => {
    entrarComo("ADMIN");
    api.applications.mockRejectedValueOnce(new Error("offline"));
    renderizarPagina();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as aplicações");
    expect(screen.queryByText("Nenhuma aplicação encontrada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
  });

  it("ADMIN global não consulta assinatura pessoal nem mostra capacidade de plano em cache", async () => {
    entrarComo("ADMIN");
    renderizarPagina((client) => {
      client.setQueryData(["subscriptions", "current"], { planId: "plan-1" });
      client.setQueryData(["plans"], [{ id: "plan-1", name: "PRO", maxApplications: 5 }]);
    });

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    expect(screen.getByText("2", { selector: "[data-numeric]" })).toBeInTheDocument();
    expect(screen.getByText("alvos registrados")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Capacidade de aplicações do plano" })).not.toBeInTheDocument();
    expect(api.subscription).not.toHaveBeenCalled();
    expect(api.plans).not.toHaveBeenCalled();
  });

  it("ADMIN global escolhe Empresa B, envia o alvo, atualiza a lista e reabre limpo", async () => {
    entrarComo("ADMIN");
    const criada = aplicacaoCriada("company-2", "Aplicação da Empresa B");
    api.createApplication.mockResolvedValue(criada);
    api.applications.mockResolvedValueOnce(APLICACOES).mockResolvedValueOnce([...APLICACOES, criada]);
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    await screen.findByRole("option", { name: "Empresa B" });
    const empresa = screen.getByRole("combobox", { name: "Empresa" });
    expect(empresa).toBeRequired();
    expect(empresa).toHaveValue("");
    expect(screen.getByRole("option", { name: "Empresa B" })).toBeInTheDocument();

    selecionarEmpresa("company-2");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Aplicação da Empresa B" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => expect(api.createApplication).toHaveBeenCalledWith({
      name: "Aplicação da Empresa B",
      url: undefined,
      description: undefined,
      companyId: "company-2",
    }));
    expect(await screen.findByText("Aplicação da Empresa B")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    abrirModal();
    expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveValue("");
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.queryByText("A empresa selecionada não está mais disponível. Atualizamos a lista; escolha outra empresa.")).not.toBeInTheDocument();
  });

  it("ADMIN vinculado à Empresa A também precisa escolher explicitamente a Empresa B", async () => {
    entrarComo("ADMIN", "company-1");
    api.createApplication.mockResolvedValue(aplicacaoCriada("company-2", "Alvo em B"));
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveValue("");
    await screen.findByRole("option", { name: "Empresa B" });
    selecionarEmpresa("company-2");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Alvo em B" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => expect(api.createApplication).toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-2" })));
    expect(api.createApplication).not.toHaveBeenCalledWith(expect.objectContaining({ companyId: "company-1" }));
  });

  it("ADMIN não envia sem seleção mesmo quando o submit é disparado diretamente", async () => {
    entrarComo("ADMIN");
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    await screen.findByRole("option", { name: "Empresa B" });
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Sem empresa" } });
    enviarFormulario();

    expect(await screen.findByText("Selecione a empresa da aplicação.")).toBeInTheDocument();
    expect(api.createApplication).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();
  });

  it("ADMIN vê carregamento e bloqueia criação até receber as empresas", async () => {
    entrarComo("ADMIN");
    const empresasPendentes = deferred<Company[]>();
    api.companies.mockReturnValue(empresasPendentes.promise);
    renderizarPagina();

    abrirModal();
    expect(screen.getByText("Carregando empresas…", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();
    expect(api.createApplication).not.toHaveBeenCalled();

    await act(async () => {
      empresasPendentes.resolve(EMPRESAS);
      await empresasPendentes.promise;
    });
    expect(await screen.findByRole("option", { name: "Empresa B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();
  });

  it("ADMIN distingue erro de rede de lista vazia e permite tentar novamente", async () => {
    entrarComo("ADMIN");
    api.companies.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(EMPRESAS);
    renderizarPagina();

    abrirModal();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar as empresas.");
    expect(screen.queryByText("Nenhuma empresa cadastrada. Cadastre uma empresa antes de criar uma aplicação.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("option", { name: "Empresa B" })).toBeInTheDocument();
    expect(api.companies).toHaveBeenCalledTimes(2);
  });

  it("ADMIN sem empresas recebe orientação específica e não pode criar", async () => {
    entrarComo("ADMIN");
    api.companies.mockResolvedValue([]);
    renderizarPagina();

    abrirModal();
    expect(await screen.findByText("Nenhuma empresa cadastrada. Cadastre uma empresa antes de criar uma aplicação.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled();
    expect(api.createApplication).not.toHaveBeenCalled();
  });

  it("CLIENT cria sem consulta global e omite companyId do payload", async () => {
    entrarComo("CLIENT");
    api.createApplication.mockResolvedValue(aplicacaoCriada("company-1", "Aplicação CLIENT"));
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    expect(screen.queryByRole("combobox", { name: "Empresa" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Aplicação CLIENT" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    await waitFor(() => expect(api.createApplication).toHaveBeenCalledTimes(1));
    expect(api.createApplication.mock.calls[0][0]).not.toHaveProperty("companyId");
    expect(api.companies).not.toHaveBeenCalled();
  });

  it("empresa removida retorna erro, atualiza opções e permite escolher outra", async () => {
    entrarComo("ADMIN");
    api.companies.mockResolvedValueOnce(EMPRESAS).mockResolvedValue([EMPRESA_A]);
    api.createApplication.mockRejectedValueOnce(erroDaApi("COMPANY_NOT_FOUND"))
      .mockResolvedValueOnce(aplicacaoCriada("company-1", "Recuperada em A"));
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    await screen.findByRole("option", { name: "Empresa B" });
    selecionarEmpresa("company-2");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Alvo temporário" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));

    expect(await screen.findByText("A empresa selecionada não está mais disponível. Atualizamos a lista; escolha outra empresa.")).toBeInTheDocument();
    await waitFor(() => expect(api.companies).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("option", { name: "Empresa B" })).not.toBeInTheDocument());
    expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveValue("");
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar" })).toBeDisabled());

    selecionarEmpresa("company-1");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Recuperada em A" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    await waitFor(() => expect(api.createApplication).toHaveBeenCalledTimes(2));
    expect(api.createApplication).toHaveBeenLastCalledWith(expect.objectContaining({ companyId: "company-1" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("mensagens de assinatura e limite distinguem ADMIN da cota do CLIENT", async () => {
    entrarComo("ADMIN");
    api.createApplication
      .mockRejectedValueOnce(erroDaApi("NO_ACTIVE_SUBSCRIPTION"))
      .mockRejectedValueOnce(erroDaApi("PLAN_LIMIT_REACHED"));
    renderizarPagina((client) => {
      client.setQueryData(["subscriptions", "current"], { planId: "plan-1" });
      client.setQueryData(["plans"], [{ id: "plan-1", name: "PRO", maxApplications: 5 }]);
    });

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    await screen.findByRole("option", { name: "Empresa B" });
    selecionarEmpresa("company-2");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Alvo B" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(await screen.findByText("A empresa selecionada não tem uma assinatura ativa, necessária para cadastrar aplicações.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(await screen.findByText("A empresa selecionada atingiu o limite de aplicações do plano ativo.")).toBeInTheDocument();
    expect(screen.queryByText(/Limite de 5 aplicações/)).not.toBeInTheDocument();
    expect(api.subscription).not.toHaveBeenCalled();
    expect(api.plans).not.toHaveBeenCalled();
  });

  it("CLIENT mantém a mensagem da própria assinatura e o limite do próprio plano", async () => {
    entrarComo("CLIENT");
    api.createApplication
      .mockRejectedValueOnce(erroDaApi("NO_ACTIVE_SUBSCRIPTION"))
      .mockRejectedValueOnce(erroDaApi("PLAN_LIMIT_REACHED"));
    renderizarPagina();

    expect(await screen.findByText("de 5 vagas no plano PRO")).toBeInTheDocument();
    abrirModal();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Alvo da própria empresa" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(await screen.findByText("Sua empresa ainda não tem uma assinatura ativa. Aguarde a aprovação do admin.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(await screen.findByText(/Limite de 5 aplicações do plano PRO atingido\./)).toBeInTheDocument();
    expect(api.companies).not.toHaveBeenCalled();
  });

  it.each(["Cancelar", "Escape", "clique fora"] as const)("%s fecha e limpa erros, seleção e campos", async (formaDeFechar) => {
    entrarComo("ADMIN");
    api.createApplication.mockRejectedValueOnce(erroDaApi("NO_ACTIVE_SUBSCRIPTION"));
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    await screen.findByRole("option", { name: "Empresa B" });
    selecionarEmpresa("company-2");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Descartável" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar" }));
    expect(await screen.findByText("A empresa selecionada não tem uma assinatura ativa, necessária para cadastrar aplicações.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Criar" })).toBeEnabled());

    if (formaDeFechar === "Cancelar") {
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    } else if (formaDeFechar === "Escape") {
      fireEvent.keyDown(document, { key: "Escape" });
    } else {
      fireEvent.pointerDown(document.body);
    }
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    abrirModal();
    expect(screen.getByLabelText("Nome")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Empresa" })).toHaveValue("");
    expect(screen.queryByText("A empresa selecionada não tem uma assinatura ativa, necessária para cadastrar aplicações.")).not.toBeInTheDocument();
  });

  it("bloqueia submit duplicado sincrônico enquanto a criação está pendente", async () => {
    entrarComo("ADMIN");
    const criacaoPendente = deferred<Application>();
    api.createApplication.mockReturnValue(criacaoPendente.promise);
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    await screen.findByRole("option", { name: "Empresa B" });
    selecionarEmpresa("company-2");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Envio único" } });
    enviarFormulario();
    enviarFormulario();

    await waitFor(() => expect(api.createApplication).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Criando..." })).toBeDisabled());
    await act(async () => {
      criacaoPendente.resolve(aplicacaoCriada("company-2", "Envio único"));
      await criacaoPendente.promise;
    });
  });

  it("resposta de erro tardia não altera formulário reaberto e atualiza empresas", async () => {
    entrarComo("ADMIN");
    const criacaoPendente = deferred<Application>();
    api.createApplication.mockReturnValue(criacaoPendente.promise);
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    await screen.findByRole("option", { name: "Empresa B" });
    selecionarEmpresa("company-2");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Pedido antigo" } });
    enviarFormulario();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    abrirModal();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Sessão nova" } });

    await act(async () => {
      criacaoPendente.reject(erroDaApi("COMPANY_NOT_FOUND"));
      await criacaoPendente.promise.catch(() => undefined);
    });

    await waitFor(() => expect(api.companies).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Sessão nova");
    expect(screen.queryByText("A empresa selecionada não está mais disponível. Atualizamos a lista; escolha outra empresa.")).not.toBeInTheDocument();
    expect(screen.queryByText("Selecione a empresa da aplicação.")).not.toBeInTheDocument();
  });

  it("sucesso tardio invalida aplicações sem fechar nem limpar formulário reaberto", async () => {
    entrarComo("ADMIN");
    const criadaAntiga = aplicacaoCriada("company-2", "Criada no pedido antigo");
    const criacaoPendente = deferred<Application>();
    api.createApplication.mockReturnValue(criacaoPendente.promise);
    api.applications.mockResolvedValueOnce(APLICACOES).mockResolvedValueOnce([...APLICACOES, criadaAntiga]);
    renderizarPagina();

    expect(await screen.findByText("Portal do Cliente")).toBeInTheDocument();
    abrirModal();
    await screen.findByRole("option", { name: "Empresa B" });
    selecionarEmpresa("company-2");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Pedido antigo" } });
    enviarFormulario();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    abrirModal();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Sessão nova" } });

    await act(async () => {
      criacaoPendente.resolve(criadaAntiga);
      await criacaoPendente.promise;
    });

    expect(await screen.findByText("Criada no pedido antigo")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveValue("Sessão nova");
    expect(screen.queryByText("A empresa selecionada não está mais disponível. Atualizamos a lista; escolha outra empresa.")).not.toBeInTheDocument();
    expect(api.applications).toHaveBeenCalledTimes(2);
  });
});
