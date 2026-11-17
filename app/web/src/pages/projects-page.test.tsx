/**
 * projects-page.test.tsx
 *
 * O QUE FAZ: protege os dados reais, estados e links do portfólio.
 * POR QUE EXISTE: o refinamento visual não pode alterar acesso ou inventar métricas.
 * QUEM CONSOME: suíte Vitest do frontend.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import type { Project, ProjectStatus } from "../types/project.types";
import { ProjectsPage } from "./projects-page";

const api = vi.hoisted(() => ({ projects: vi.fn(), applications: vi.fn() }));
vi.mock("../lib/api/projects.api", () => ({ projectsApi: { list: api.projects } }));
vi.mock("../lib/api/applications.api", () => ({ applicationsApi: { list: api.applications } }));
vi.mock("../hooks/use-company-name", () => ({ useCompanyName: () => "TechNova" }));

function project(id: string, status: ProjectStatus): Project {
  return {
    id, name: `Projeto ${id}`, description: null, applicationId: "app-1", companyId: "company-1",
    analysisType: "DAST", analysisLevel: "BASIC", hasRemediation: false,
    scopeIn: null, scopeOut: null, notes: null, status,
    requestedAt: "2026-09-01T12:00:00.000Z", startedAt: null, closedAt: null,
    updatedAt: "2026-09-01T12:00:00.000Z",
  };
}

function enterAs(
  role: "ADMIN" | "CLIENT" | "PENTESTER",
  companyId: string | null = role === "ADMIN" ? null : "company-1",
  companyRole?: string | null,
) {
  useAuthStore.setState({
    accessToken: "token", refreshToken: "refresh",
    user: { id: "user-1", name: "Rafael", email: "rafael@vulnera.test", role,
      companyId, companyRole, createdAt: "2026-01-01T00:00:00.000Z" },
  });
}

function NavigationProbe() {
  const location = useLocation();
  return <output data-testid="navegacao">{JSON.stringify({ pathname: location.pathname, state: location.state })}</output>;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/projects"]}>
          <Routes>
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/new-analysis" element={<NavigationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.projects.mockResolvedValue([project("A", "PENDING"), project("B", "IN_PROGRESS"), project("C", "COMPLETED")]);
  api.applications.mockResolvedValue([{ id: "app-1", name: "Portal TechNova" }]);
});

afterEach(() => {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

describe("ProjectsPage", () => {
  it("PROJ-VIS-01 — mostra distribuição dos estados reais e navegação acessível", async () => {
    enterAs("CLIENT");
    renderPage();

    const table = await screen.findByRole("table");
    expect(screen.getByRole("heading", { name: "Projetos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo projeto" })).toHaveAttribute("href", "/new-analysis");
    expect(screen.getByRole("heading", { name: "Projetos" }).parentElement).toHaveTextContent("Projetos3 projetos");
    const flow = screen.getByRole("region", { name: "Fluxo dos projetos" });
    expect(within(flow).getByRole("button", { name: /Pendentes/ })).toHaveTextContent("Pendentes1");
    expect(within(flow).getByRole("button", { name: /Em andamento/ })).toHaveTextContent("Em andamento1");
    expect(within(flow).getByRole("button", { name: /Em revisão/ })).toHaveTextContent("Em revisão0");
    expect(within(flow).getByRole("button", { name: /Concluídos/ })).toHaveTextContent("Concluídos1");
    expect(within(table).getByRole("link", { name: "Projeto A" })).toHaveAttribute("href", "/projects/A");
    expect(within(table).getAllByText("Portal TechNova")).toHaveLength(3);
  });

  it("PROJ-VIS-02 — PENTESTER não consulta o inventário de aplicações", async () => {
    enterAs("PENTESTER");
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: "Projeto A" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Novo projeto" })).not.toBeInTheDocument();
    expect(api.applications).not.toHaveBeenCalled();
  });

  it.each([
    { role: "ADMIN" as const, companyId: null, companyRole: null },
    { role: "CLIENT" as const, companyId: "company-1", companyRole: "OWNER" },
    { role: "CLIENT" as const, companyId: "company-1", companyRole: "MEMBER" },
  ])("PROJ-VIS-07 — lista preenchida mantém CTA para $role/$companyRole, mesmo sem empresa pessoal do ADMIN", async (actor) => {
    enterAs(actor.role, actor.companyId, actor.companyRole);
    renderPage();

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo projeto" })).toHaveAttribute("href", "/new-analysis");
  });

  it.each([
    ["ADMIN", "Novo projeto", "Quando uma análise for solicitada, você poderá acompanhar o andamento aqui."],
    ["CLIENT", "Novo projeto", "Quando uma análise for solicitada, você poderá acompanhar o andamento aqui."],
    ["PENTESTER", null, "Os projetos atribuídos a você aparecerão aqui para acompanhamento."],
  ] as const)("PROJ-VIS-03 — estado vazio para %s respeita a permissão de criação", async (role, createLabel, description) => {
    enterAs(role);
    api.projects.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nenhum projeto ainda")).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nova análise" })).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link", { name: "Novo projeto" })).toHaveLength(createLabel ? 2 : 0);
  });

  it("PROJ-VIS-04 — CTA continua disponível durante carregamento e erro", async () => {
    enterAs("CLIENT");
    let resolveProjects!: (projects: Project[]) => void;
    api.projects.mockReturnValueOnce(new Promise<Project[]>((resolve) => { resolveProjects = resolve; }));
    const view = renderPage();

    expect(await screen.findByRole("link", { name: "Novo projeto" })).toHaveAttribute("href", "/new-analysis");
    resolveProjects([project("A", "PENDING")]);
    await screen.findByRole("table");
    view.unmount();

    api.projects.mockRejectedValueOnce(new Error("offline"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os projetos");
    expect(screen.getByRole("link", { name: "Novo projeto" })).toHaveAttribute("href", "/new-analysis");
  });

  it("PROJ-VIS-05 — CTA abre o wizard com retorno seguro para Projetos", async () => {
    enterAs("CLIENT");
    renderPage();

    const cta = await screen.findByRole("link", { name: "Novo projeto" });
    fireEvent.click(cta);
    expect(await screen.findByTestId("navegacao")).toHaveTextContent(
      JSON.stringify({ pathname: "/new-analysis", state: { returnTo: "/projects" } }),
    );
  });

  it("PROJ-VIS-06 — erro de rede permite tentar novamente", async () => {
    enterAs("CLIENT");
    api.projects.mockRejectedValueOnce(new Error("offline"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os projetos");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  });

  it("PROJ-VIS-07 — card de estado filtra a tabela localmente e alterna de volta", async () => {
    enterAs("CLIENT");
    renderPage();
    await screen.findByRole("table");
    const flow = screen.getByRole("region", { name: "Fluxo dos projetos" });
    const concluidos = within(flow).getByRole("button", { name: /Concluídos/ });

    fireEvent.click(concluidos);
    expect(concluidos).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Filtrar por status" })).toHaveValue("COMPLETED");
    const linhas = within(screen.getByRole("table")).getAllByRole("link");
    expect(linhas.map((link) => link.textContent)).toEqual(["Projeto C"]);
    expect(screen.getByText(/Mostrando/)).toHaveTextContent("Mostrando 1 de 3 projetos");

    fireEvent.click(concluidos);
    expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(3);
    expect(api.projects).toHaveBeenCalledTimes(1);
  });

  it("PROJ-VIS-08 — busca por aplicação, etapa derivada do status e data por extenso", async () => {
    enterAs("CLIENT");
    renderPage();
    const table = await screen.findByRole("table");

    expect(within(table).getAllByRole("img", { name: /Etapa \d de 4/ }).map((el) => el.getAttribute("aria-label")))
      .toEqual(["Etapa 1 de 4", "Etapa 2 de 4", "Etapa 4 de 4"]);
    expect(within(table).getAllByText(/01 de set\. de 2026/)).toHaveLength(3);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar projeto ou aplicação" }), { target: { value: "nada disso" } });
    expect(screen.getByText("Nenhum projeto com esses filtros")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar projeto ou aplicação" }), { target: { value: "technova" } });
    expect(within(screen.getByRole("table")).getAllByRole("link")).toHaveLength(3);
  });
});
