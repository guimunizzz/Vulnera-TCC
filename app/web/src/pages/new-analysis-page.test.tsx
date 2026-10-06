/**
 * new-analysis-page.test.tsx
 *
 * O QUE FAZ: verifica o fluxo de criação de Project pela interface.
 * POR QUE EXISTE: pré-seleção, elegibilidade, cache e envio precisam permanecer coerentes.
 * QUEM CONSOME: suíte funcional Vitest do frontend.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "../design/theme-provider";
import { projectsApi } from "../lib/api/projects.api";
import type { Application } from "../types/application.types";
import type { Project } from "../types/project.types";
import { NewAnalysisPage } from "./new-analysis-page";

const api = vi.hoisted(() => ({
  applications: vi.fn(),
  projects: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock("../lib/api/applications.api", () => ({
  applicationsApi: { list: api.applications },
}));
vi.mock("../lib/api/projects.api", () => ({
  projectsApi: { list: api.projects, create: api.createProject },
}));

const APPLICATIONS: Application[] = [
  {
    id: "app-1",
    name: "Portal do Cliente",
    url: "https://portal.vulnera.test",
    techStack: null,
    description: null,
    companyId: "company-1",
    isActive: true,
    criticality: "HIGH",
    environment: "PROD",
    internetFacing: true,
    dataSensitivity: "CONFIDENTIAL",
    businessOwner: null,
    technicalOwner: null,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
  },
  {
    id: "app-2",
    name: "Painel interno",
    url: "https://interno.vulnera.test",
    techStack: null,
    description: null,
    companyId: "company-2",
    isActive: true,
    criticality: "MEDIUM",
    environment: "HOMOL",
    internetFacing: false,
    dataSensitivity: "INTERNAL",
    businessOwner: null,
    technicalOwner: null,
    createdAt: "2026-09-02T12:00:00.000Z",
    updatedAt: "2026-09-02T12:00:00.000Z",
  },
];

function project(
  id: string,
  name: string,
  applicationId: string,
  status: Project["status"] = "PENDING",
): Project {
  return {
    id,
    name,
    description: null,
    applicationId,
    companyId: applicationId === "app-2" ? "company-2" : "company-1",
    analysisType: "DAST",
    analysisLevel: "BASIC",
    hasRemediation: false,
    scopeIn: null,
    scopeOut: null,
    notes: null,
    status,
    requestedAt: "2026-09-03T12:00:00.000Z",
    startedAt: null,
    closedAt: null,
    updatedAt: "2026-09-03T12:00:00.000Z",
  };
}

function apiError(code: string): Error & {
  isAxiosError: true;
  response: { data: { error: string } };
} {
  return Object.assign(new Error(code), {
    isAxiosError: true as const,
    response: { data: { error: code } },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type InitialEntry = string | { pathname: string; search?: string; state?: unknown };

function CachedProjectsPage() {
  const { data } = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list });
  return (
    <main>
      <h2>Lista de projetos</h2>
      {data?.map((item) => <p key={item.id}>{item.name}</p>)}
    </main>
  );
}

function TestRoutes() {
  const queryClient = useQueryClient();
  return (
    <>
      <Routes>
        <Route path="/new-analysis" element={<NewAnalysisPage />} />
        <Route path="/projects" element={<CachedProjectsPage />} />
        <Route path="/projects/:id" element={<h2>Detalhe do projeto criado</h2>} />
        <Route path="/applications" element={<h2>Lista de aplicações</h2>} />
        <Route path="/away" element={<h2>Página abandonada</h2>} />
      </Routes>
      <nav aria-label="Rotas de teste">
        <Link to="/projects">Abrir lista de projetos</Link>
        <Link to="/new-analysis">Reabrir wizard</Link>
        <Link
          to="/new-analysis?applicationId=app-2"
          onClick={() => queryClient.setQueryData(["projects"], [project("project-race", "Projeto concorrente", "app-1")])}
        >
          Trocar pré-seleção
        </Link>
        <Link to="/away">Abandonar wizard</Link>
      </nav>
    </>
  );
}

function renderWizard(
  initialEntry: InitialEntry = "/new-analysis",
  prepareCache?: (client: QueryClient) => void,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
  });
  prepareCache?.(queryClient);
  const view = render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <TestRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { ...view, queryClient };
}

function continueStep(): void {
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

async function selectApplication(name = "Portal do Cliente"): Promise<void> {
  fireEvent.click(await screen.findByRole("radio", { name: new RegExp(name) }));
}

async function advanceToStep(step: 1 | 2 | 3 | 4, applicationName = "Portal do Cliente"): Promise<void> {
  if (step === 1) return;
  await selectApplication(applicationName);
  continueStep();
  await screen.findByRole("radio", { name: /^DAST\b/ });
  if (step === 2) return;
  continueStep();
  await screen.findByRole("textbox", { name: "Nome do projeto" });
  if (step === 3) return;
  continueStep();
  await screen.findByRole("checkbox", { name: "Incluir serviço de remediação" });
}

beforeEach(() => {
  api.applications.mockReset();
  api.projects.mockReset();
  api.createProject.mockReset();
  api.applications.mockResolvedValue(APPLICATIONS);
  api.projects.mockResolvedValue([]);
  api.createProject.mockResolvedValue(project("project-new", "Novo projeto", "app-1"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("NewAnalysisPage", () => {
  it("mantém estado de carregamento até receber aplicações e projetos", async () => {
    const pendingApplications = deferred<Application[]>();
    const pendingProjects = deferred<Project[]>();
    api.applications.mockReturnValueOnce(pendingApplications.promise);
    api.projects.mockReturnValueOnce(pendingProjects.promise);
    renderWizard();

    expect(screen.getByText("Carregando aplicações e projetos…")).toBeInTheDocument();
    expect(screen.queryByText("Nenhuma aplicação cadastrada ainda.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();

    await act(async () => {
      pendingApplications.resolve(APPLICATIONS);
      await pendingApplications.promise;
    });
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();

    await act(async () => {
      pendingProjects.resolve([]);
      await pendingProjects.promise;
    });
    expect(await screen.findByRole("radio", { name: /Portal do Cliente/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
  });

  it.each(["applications", "projects"] as const)(
    "distingue erro de carregamento de lista vazia e permite tentar novamente (%s)",
    async (failingQuery) => {
      if (failingQuery === "applications") {
        api.applications.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(APPLICATIONS);
      } else {
        api.projects.mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
      }

      renderWizard();

      expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível");
      expect(screen.queryByText("Nenhuma aplicação cadastrada ainda.")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
      expect(await screen.findByRole("radio", { name: /Portal do Cliente/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
    },
  );

  it("explica quando ainda não existe nenhuma aplicação e oferece o cadastro", async () => {
    api.applications.mockResolvedValue([]);
    renderWizard();

    expect(await screen.findByText("Nenhuma aplicação cadastrada ainda.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cadastrar uma aplicação" })).toHaveAttribute("href", "/applications");
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("mantém aplicações ocupadas visíveis, inclusive com projeto concluído", async () => {
    api.projects.mockResolvedValue([
      project("project-done", "Projeto concluído", "app-1", "COMPLETED"),
      project("project-review", "Projeto em revisão", "app-2", "IN_REVIEW"),
    ]);
    renderWizard();

    expect(await screen.findByText(/Todas as aplicações ativas já possuem projeto/)).toBeInTheDocument();
    expect(screen.getByText("Portal do Cliente")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir projeto Projeto concluído" })).toHaveAttribute(
      "href",
      "/projects/project-done",
    );
    expect(screen.queryByRole("radio", { name: /Portal do Cliente/ })).not.toBeInTheDocument();
  });

  it("valida a aplicação pré-selecionada pela URL depois de carregar as duas listas", async () => {
    api.projects.mockResolvedValue([project("project-existing", "Projeto existente", "app-1")]);
    renderWizard("/new-analysis?applicationId=app-2");

    expect(await screen.findByRole("radio", { name: /Painel interno/ })).toBeChecked();
    expect(screen.getByText("Esta aplicação já possui um projeto.")).toBeInTheDocument();
  });

  it.each([
    {
      label: "ocupada",
      applications: APPLICATIONS,
      projects: [project("project-existing", "Projeto existente", "app-1")],
      message: "Esta aplicação já possui um projeto.",
    },
    {
      label: "inativa",
      applications: [{ ...APPLICATIONS[0], isActive: false }, APPLICATIONS[1]],
      projects: [],
      message: "Esta aplicação está inativa",
    },
  ])("rejeita pré-seleção $label e mantém orientação", async ({ applications, projects, message }) => {
    api.applications.mockResolvedValue(applications);
    api.projects.mockResolvedValue(projects);
    renderWizard("/new-analysis?applicationId=app-1");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("radio", { name: /Painel interno/ })).not.toBeChecked();
  });

  it("limpa e explica uma aplicação pré-selecionada inválida", async () => {
    renderWizard("/new-analysis?applicationId=app-removida");

    expect(await screen.findByRole("alert")).toHaveTextContent("Esta aplicação não está mais disponível");
    expect(screen.getByRole("radio", { name: /Portal do Cliente/ })).not.toBeChecked();
  });

  it("valida a nova query string e não deixa a elegibilidade antiga apagar a pré-seleção", async () => {
    renderWizard("/new-analysis?applicationId=app-1");
    expect(await screen.findByRole("radio", { name: /Portal do Cliente/ })).toBeChecked();

    fireEvent.click(screen.getByRole("link", { name: "Trocar pré-seleção" }));

    expect(await screen.findByRole("radio", { name: /Painel interno/ })).toBeChecked();
    expect(screen.getByText("Esta aplicação já possui um projeto.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("mantém sugestão até edição, revisa os campos e envia payload real após trim", async () => {
    const created = project("project-new", "Meu projeto", "app-2");
    api.createProject.mockResolvedValue(created);
    renderWizard();

    await selectApplication("Portal do Cliente");
    continueStep();
    fireEvent.click(await screen.findByRole("radio", { name: /Combinada/ }));
    continueStep();

    const projectName = await screen.findByRole("textbox", { name: "Nome do projeto" });
    expect(projectName).toHaveValue("Análise Combinada — Portal do Cliente");

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(await screen.findByRole("radio", { name: /^SAST\b/ }));
    continueStep();
    expect(await screen.findByRole("textbox", { name: "Nome do projeto" })).toHaveValue("Análise SAST — Portal do Cliente");

    fireEvent.change(screen.getByRole("textbox", { name: "Nome do projeto" }), {
      target: { value: "  Meu projeto  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await screen.findByRole("radio", { name: /^SAST\b/ });
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(await screen.findByRole("radio", { name: /Painel interno/ }));
    continueStep();
    fireEvent.click(await screen.findByRole("radio", { name: /^DAST\b/ }));
    continueStep();

    expect(await screen.findByRole("textbox", { name: "Nome do projeto" })).toHaveValue("  Meu projeto  ");
    fireEvent.click(screen.getByRole("radio", { name: "Avançado" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Escopo (dentro)" }), { target: { value: "  /login  " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Fora de escopo" }), {
      target: { value: "serviços de terceiros" },
    });
    continueStep();
    fireEvent.click(await screen.findByRole("checkbox", { name: "Incluir serviço de remediação" }));

    expect(screen.getByText("Meu projeto")).toBeInTheDocument();
    expect(screen.getByText("Painel interno")).toBeInTheDocument();
    expect(screen.getByText("Avançado")).toBeInTheDocument();
    expect(screen.getByText("/login")).toBeInTheDocument();
    expect(screen.getByText("serviços de terceiros")).toBeInTheDocument();
    expect(screen.getByText("Sim")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Criar projeto" }));
    await waitFor(() => {
      expect(api.createProject).toHaveBeenCalledWith({
        applicationId: "app-2",
        name: "Meu projeto",
        analysisType: "DAST",
        analysisLevel: "ADVANCED",
        scopeIn: "/login",
        scopeOut: "serviços de terceiros",
        hasRemediation: true,
      });
    });
    expect(api.createProject.mock.calls[0][0]).not.toHaveProperty("companyId");
    expect(await screen.findByRole("heading", { name: "Detalhe do projeto criado" })).toBeInTheDocument();
  });

  it("rejeita nome vazio após trim, associa o erro ao campo e não envia", async () => {
    renderWizard();
    await advanceToStep(3);

    fireEvent.change(screen.getByRole("textbox", { name: "Nome do projeto" }), { target: { value: "   " } });
    continueStep();

    const name = screen.getByRole("textbox", { name: "Nome do projeto" });
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAttribute("aria-describedby", "project-name-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um nome para o projeto.");
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("limita a sugestão de nome ao tamanho aceito pelo schema", async () => {
    const longApplication = { ...APPLICATIONS[0], name: "A".repeat(220) };
    api.applications.mockResolvedValue([longApplication]);
    renderWizard();
    await advanceToStep(3, longApplication.name);

    const name = screen.getByRole("textbox", { name: "Nome do projeto" });
    expect(name).toHaveAttribute("maxLength", "191");
    expect((name as HTMLInputElement).value).toHaveLength(191);
  });

  it.each([1, 2, 3, 4] as const)("permite cancelar no passo %i sem criar dados parciais", async (step) => {
    renderWizard({ pathname: "/new-analysis", state: { returnTo: "/applications" } });
    await advanceToStep(step);

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("heading", { name: "Lista de aplicações" })).toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Reabrir wizard" }));
    expect(await screen.findByRole("radio", { name: /Portal do Cliente/ })).not.toBeChecked();
    expect(screen.queryByRole("textbox", { name: "Nome do projeto" })).not.toBeInTheDocument();
  });

  it("usa fallback interno se returnTo não estiver permitido", async () => {
    renderWizard({ pathname: "/new-analysis", state: { returnTo: "https://site-inseguro.test" } });

    fireEvent.click(await screen.findByRole("button", { name: "Cancelar" }));
    expect(await screen.findByRole("heading", { name: "Lista de projetos" })).toBeInTheDocument();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it.each(["APPLICATION_ALREADY_HAS_PROJECT", "APPLICATION_NOT_FOUND"] as const)(
    "%s atualiza elegibilidade, orienta nova seleção e preserva os outros campos",
    async (code) => {
      const conflictProject = project("project-conflict", "Projeto concorrente", "app-1");
      api.projects
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(code === "APPLICATION_ALREADY_HAS_PROJECT" ? [conflictProject] : []);
      api.applications
        .mockResolvedValueOnce(APPLICATIONS)
        .mockResolvedValueOnce(code === "APPLICATION_NOT_FOUND" ? [APPLICATIONS[1]] : APPLICATIONS);
      api.createProject.mockRejectedValueOnce(apiError(code));
      renderWizard();
      await selectApplication("Portal do Cliente");
      continueStep();
      fireEvent.click(await screen.findByRole("radio", { name: /^SAST\b/ }));
      continueStep();
      await screen.findByRole("textbox", { name: "Nome do projeto" });

      fireEvent.change(screen.getByRole("textbox", { name: "Nome do projeto" }), {
        target: { value: "Nome preservado" },
      });
      fireEvent.click(screen.getByRole("radio", { name: "Avançado" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Escopo (dentro)" }), { target: { value: "/admin" } });
      fireEvent.change(screen.getByRole("textbox", { name: "Fora de escopo" }), { target: { value: "Terceiros" } });
      continueStep();
      fireEvent.click(await screen.findByRole("checkbox", { name: "Incluir serviço de remediação" }));
      fireEvent.click(screen.getByRole("button", { name: "Criar projeto" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Atualizamos as opções; selecione outra aplicação.");
      expect(await screen.findByRole("radio", { name: /Painel interno/ })).toBeEnabled();
      if (code === "APPLICATION_ALREADY_HAS_PROJECT") {
        expect(screen.getByRole("link", { name: "Abrir projeto Projeto concorrente" })).toBeInTheDocument();
      } else {
        expect(screen.queryByRole("radio", { name: /Portal do Cliente/ })).not.toBeInTheDocument();
      }

      fireEvent.click(await screen.findByRole("radio", { name: /Painel interno/ }));
      continueStep();
      expect(await screen.findByRole("radio", { name: /^SAST\b/ })).toBeChecked();
      continueStep();
      expect(await screen.findByRole("textbox", { name: "Nome do projeto" })).toHaveValue("Nome preservado");
      expect(screen.getByRole("radio", { name: "Avançado" })).toBeChecked();
      expect(screen.getByRole("textbox", { name: "Escopo (dentro)" })).toHaveValue("/admin");
      expect(screen.getByRole("textbox", { name: "Fora de escopo" })).toHaveValue("Terceiros");
      continueStep();
      expect(await screen.findByRole("checkbox", { name: "Incluir serviço de remediação" })).toBeChecked();
    },
  );

  it.each([2, 3, 4] as const)("bloqueia avanço no passo %i quando a revalidação falha", async (step) => {
    api.projects.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline"));
    const { queryClient } = renderWizard();
    await advanceToStep(step);

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível confirmar quais aplicações já possuem projeto.");
    const forwardButton = screen.getByRole("button", { name: step === 4 ? "Criar projeto" : "Continuar" });
    expect(forwardButton).toBeDisabled();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it("trata INVALID_NAME do servidor como erro do campo e foca a entrada", async () => {
    api.createProject.mockRejectedValueOnce(apiError("INVALID_NAME"));
    renderWizard();
    await advanceToStep(4);

    fireEvent.click(screen.getByRole("button", { name: "Criar projeto" }));

    const name = await screen.findByRole("textbox", { name: "Nome do projeto" });
    await waitFor(() => expect(name).toHaveAttribute("aria-invalid", "true"));
    await waitFor(() => expect(name).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent("Informe um nome válido para o projeto.");
  });

  it.each([
    ["NO_ACTIVE_SUBSCRIPTION", "A empresa da aplicação não tem uma assinatura ativa."],
    ["PROJECT_LIMIT_REACHED", "A empresa da aplicação atingiu o limite de projetos simultâneos do plano."],
    ["REMEDIATION_NOT_INCLUDED", "O plano da empresa da aplicação não inclui remediação."],
    ["APPLICATION_INACTIVE", "Esta aplicação está inativa e não pode receber um novo projeto."],
  ] as const)("traduz o erro de negócio %s para o contexto do projeto", async (code, message) => {
    api.createProject.mockRejectedValueOnce(apiError(code));
    renderWizard();
    await advanceToStep(4);

    fireEvent.click(screen.getByRole("button", { name: "Criar projeto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("button", { name: "Criar projeto" })).toBeEnabled();
  });

  it("impede dois POSTs no mesmo tick e desabilita navegação durante a criação", async () => {
    const pendingCreate = deferred<Project>();
    api.createProject.mockReturnValue(pendingCreate.promise);
    renderWizard();
    await advanceToStep(4);

    const createButton = screen.getByRole("button", { name: "Criar projeto" });
    fireEvent.click(createButton);
    fireEvent.click(createButton);

    await waitFor(() => expect(api.createProject).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Criando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    await act(async () => {
      pendingCreate.resolve(project("project-new", "Projeto único", "app-1"));
      await pendingCreate.promise;
    });
    expect(await screen.findByRole("heading", { name: "Detalhe do projeto criado" })).toBeInTheDocument();
  });

  it("não navega tarde após desmontagem, mas mantém o projeto persistido no cache", async () => {
    const pendingCreate = deferred<Project>();
    api.createProject.mockReturnValue(pendingCreate.promise);
    const { queryClient } = renderWizard();
    await advanceToStep(4);
    fireEvent.click(screen.getByRole("button", { name: "Criar projeto" }));
    await waitFor(() => expect(api.createProject).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("link", { name: "Abandonar wizard" }));
    expect(await screen.findByRole("heading", { name: "Página abandonada" })).toBeInTheDocument();
    await act(async () => {
      pendingCreate.resolve(project("project-late", "Projeto persistido", "app-1"));
      await pendingCreate.promise;
    });

    expect(screen.getByRole("heading", { name: "Página abandonada" })).toBeInTheDocument();
    expect(queryClient.getQueryData<Project[]>(["projects"])?.map((item) => item.id)).toContain("project-late");
  });

  it("atualiza cache previamente preenchido e mostra o projeto ao voltar à lista", async () => {
    const existingProject = project("project-old", "Projeto anterior", "app-1");
    const createdProject = project("project-new", "Projeto novo", "app-2");
    api.projects.mockResolvedValue([existingProject, createdProject]);
    api.createProject.mockResolvedValue(createdProject);
    renderWizard("/new-analysis", (client) => {
      client.setQueryData(["projects"], [existingProject]);
      client.setQueryData(["applications"], APPLICATIONS);
    });

    await advanceToStep(4, "Painel interno");
    fireEvent.click(screen.getByRole("button", { name: "Criar projeto" }));
    expect(await screen.findByRole("heading", { name: "Detalhe do projeto criado" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Abrir lista de projetos" }));
    expect(await screen.findByText("Projeto anterior")).toBeInTheDocument();
    expect(await screen.findByText("Projeto novo")).toBeInTheDocument();
    await waitFor(() => expect(api.projects).toHaveBeenCalled());
  });

  it("mantém o sucesso do POST quando o refetch da lista falha", async () => {
    const createdProject = project("project-new", "Projeto persistido", "app-1");
    api.projects.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline"));
    api.createProject.mockResolvedValue(createdProject);
    const { queryClient } = renderWizard();
    await advanceToStep(4);

    fireEvent.click(screen.getByRole("button", { name: "Criar projeto" }));

    expect(await screen.findByRole("heading", { name: "Detalhe do projeto criado" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(queryClient.getQueryData<Project[]>(["projects"])?.map((item) => item.id)).toContain("project-new");
  });
});
