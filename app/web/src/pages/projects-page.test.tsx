/**
 * projects-page.test.tsx
 *
 * O QUE FAZ: protege os dados reais, estados e links do portfólio.
 * POR QUE EXISTE: o refinamento visual não pode alterar acesso ou inventar métricas.
 * QUEM CONSOME: suíte Vitest do frontend.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

function enterAs(role: "CLIENT" | "PENTESTER") {
  useAuthStore.setState({
    accessToken: "token", refreshToken: "refresh",
    user: { id: "user-1", name: "Rafael", email: "rafael@vulnera.test", role,
      companyId: "company-1", createdAt: "2026-01-01T00:00:00.000Z" },
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter><ProjectsPage /></MemoryRouter>
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
    expect(screen.getByText("3", { selector: ".projects-hero-stat [data-numeric]" })).toBeInTheDocument();
    const flow = screen.getByRole("region", { name: "Fluxo dos projetos" });
    expect(within(flow).getByText("Pendentes").parentElement).toHaveTextContent("Pendentes1");
    expect(within(flow).getByText("Em andamento").parentElement).toHaveTextContent("Em andamento1");
    expect(within(flow).getByText("Em revisão").parentElement).toHaveTextContent("Em revisão0");
    expect(within(flow).getByText("Concluídos").parentElement).toHaveTextContent("Concluídos1");
    expect(within(table).getByRole("link", { name: "Projeto A" })).toHaveAttribute("href", "/projects/A");
    expect(within(table).getAllByText("Portal TechNova")).toHaveLength(3);
  });

  it("PROJ-VIS-02 — PENTESTER não consulta o inventário de aplicações", async () => {
    enterAs("PENTESTER");
    renderPage();

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("link", { name: "Projeto A" })).toBeInTheDocument();
    expect(api.applications).not.toHaveBeenCalled();
  });

  it("PROJ-VIS-03 — estado vazio orienta a próxima ação", async () => {
    enterAs("CLIENT");
    api.projects.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Nenhum projeto ainda")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova análise" })).toHaveAttribute("href", "/new-analysis");
  });

  it("PROJ-VIS-04 — erro de rede permite tentar novamente", async () => {
    enterAs("CLIENT");
    api.projects.mockRejectedValueOnce(new Error("offline"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar os projetos");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  });
});
