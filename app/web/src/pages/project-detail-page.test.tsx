/**
 * O QUE FAZ: protege a identificação dos pentesters nos detalhes do projeto.
 * POR QUE EXISTE: CLIENT e PENTESTER não consultam o catálogo administrativo;
 * os nomes devem vir dos membros autorizados, sem exibir IDs internos.
 * QUEM CONSOME: suíte Vitest do frontend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { createQueryClient } from "../lib/query-client";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import type { Project } from "../types/project.types";
import { ProjectDetailPage } from "./project-detail-page";

const api = vi.hoisted(() => ({
  project: vi.fn(), application: vi.fn(), members: vi.fn(), users: vi.fn(),
  addMember: vi.fn(), removeMember: vi.fn(),
  findings: vi.fn(), companyName: vi.fn(),
  reports: vi.fn(), reportData: vi.fn(),
}));
vi.mock("../lib/api/projects.api", () => ({ projectsApi: { getById: api.project } }));
vi.mock("../lib/api/applications.api", () => ({ applicationsApi: { getById: api.application } }));
vi.mock("../lib/api/project-members.api", () => ({
  projectMembersApi: { list: api.members, add: api.addMember, remove: api.removeMember },
}));
vi.mock("../lib/api/users.api", () => ({ usersApi: { list: api.users } }));
vi.mock("../lib/api/reports.api", () => ({ reportsApi: { listByProject: api.reports, getReportData: api.reportData } }));
vi.mock("../hooks/use-company-name", () => ({ useCompanyName: api.companyName }));
vi.mock("../hooks/use-findings", () => ({ useFindings: api.findings }));

const PROJECT: Project = {
  id: "project-hash", name: "Avaliação do portal", description: null,
  applicationId: "app-1", companyId: "company-1", analysisType: "DAST",
  analysisLevel: "BASIC", hasRemediation: false, scopeIn: null, scopeOut: null,
  notes: null, status: "PENDING", requestedAt: "2026-10-06T12:00:00Z",
  startedAt: null, closedAt: null, updatedAt: "2026-10-06T12:00:00Z",
};
const MEMBERS = [
  { id: "membership-1", projectId: PROJECT.id, userId: "e7b8c9d0-1234-pentester-1", userName: "Rafael Barros", createdAt: PROJECT.requestedAt },
  { id: "membership-2", projectId: PROJECT.id, userId: "a1c2e3f4-5678-pentester-2", userName: "João Gonçalves da Silva", createdAt: PROJECT.requestedAt },
];

function enterAs(role: "ADMIN" | "CLIENT" | "PENTESTER") {
  useAuthStore.setState({
    accessToken: "token", refreshToken: "refresh",
    user: { id: "actor", name: "Usuário", email: "actor@example.test", role,
      companyId: role === "CLIENT" ? "company-1" : null,
      companyRole: role === "CLIENT" ? "OWNER" : null, createdAt: PROJECT.requestedAt },
  });
}

const clients: QueryClient[] = [];
function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  clients.push(client);
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[`/projects/${PROJECT.id}`]}>
          <Routes><Route path="/projects/:id" element={<ProjectDetailPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  api.project.mockResolvedValue(PROJECT);
  api.application.mockResolvedValue({ id: "app-1", name: "Portal" });
  api.members.mockResolvedValue(MEMBERS);
  api.users.mockResolvedValue([]);
  api.reports.mockResolvedValue([]);
  api.findings.mockReturnValue({ dados: undefined });
  api.companyName.mockReturnValue("TechNova");
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

describe("ProjectDetailPage — nomes dos pentesters", () => {
  it("PROJ-ACCESS-01 — consulta membros e contexto somente após autorizar o projeto", async () => {
    enterAs("ADMIN");
    let authorize!: (project: Project) => void;
    api.project.mockReturnValue(new Promise((resolve) => { authorize = resolve; }));
    renderPage();
    for (const request of [api.application, api.members, api.users]) expect(request).not.toHaveBeenCalled();
    expect(api.reports).not.toHaveBeenCalled();
    expect(api.findings).toHaveBeenLastCalledWith(expect.any(URLSearchParams), false);
    expect(api.companyName).toHaveBeenLastCalledWith(undefined, false);
    await act(async () => authorize(PROJECT));
    await screen.findByRole("heading", { name: PROJECT.name });
    await waitFor(() => expect(api.members).toHaveBeenCalledTimes(1));
    expect(api.findings).toHaveBeenLastCalledWith(expect.any(URLSearchParams), true);
    expect(api.companyName).toHaveBeenLastCalledWith(PROJECT.companyId, true);
  });

  it.each([403, 404])("PROJ-ACCESS-02 — HTTP %s encerra Carregando e não solicita dados dependentes", async (status) => {
    enterAs("ADMIN");
    api.project.mockRejectedValue(new AxiosError("Recusado", AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
      status, statusText: "Error", data: { error: "FORBIDDEN", name: "Projeto de outro tenant" },
      headers: {}, config: { headers: new AxiosHeaders() },
    }));
    renderPage(createQueryClient());
    await screen.findByRole("heading", { name: "Recurso indisponível" });
    expect(screen.getByRole("link", { name: "Voltar para projetos" })).toHaveAttribute("href", "/projects");
    expect(screen.queryByText("Carregando...")).not.toBeInTheDocument();
    expect(screen.queryByText("Projeto de outro tenant")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(api.project).toHaveBeenCalledTimes(1);
    for (const request of [api.application, api.members, api.users]) expect(request).not.toHaveBeenCalled();
    expect(api.reports).not.toHaveBeenCalled();
    expect(api.findings).toHaveBeenLastCalledWith(expect.any(URLSearchParams), false);
  });

  it.each([403, 404])("PROJ-REPORT-01 — HTTP %s no histórico é indisponibilidade, sem apresentar lista vazia", async (status) => {
    enterAs("CLIENT");
    api.project.mockResolvedValue({ ...PROJECT, status: "IN_REVIEW" });
    api.reports.mockRejectedValue(new AxiosError("Recusado", AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
      status, statusText: "Error", data: { error: "FORBIDDEN", title: "Relatório de outro tenant" },
      headers: {}, config: { headers: new AxiosHeaders() },
    }));
    renderPage(createQueryClient());
    await screen.findByRole("heading", { name: PROJECT.name });
    expect(api.reports).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Relatórios" }));
    await screen.findByRole("heading", { name: "Recurso indisponível" });
    expect(screen.queryByText("Nenhum relatório gerado ainda.")).not.toBeInTheDocument();
    expect(screen.queryByText("Relatório de outro tenant")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).not.toBeInTheDocument();
    expect(api.reports).toHaveBeenCalledTimes(1);
    expect(api.reportData).not.toHaveBeenCalled();
  });

  it("PROJ-REPORT-02 — falha operacional permite repetir somente o histórico", async () => {
    enterAs("CLIENT");
    api.project.mockResolvedValue({ ...PROJECT, status: "IN_REVIEW" });
    api.reports.mockRejectedValueOnce(new AxiosError("Network Error", AxiosError.ERR_NETWORK)).mockResolvedValue([]);
    renderPage();
    await screen.findByRole("heading", { name: PROJECT.name });
    fireEvent.click(screen.getByRole("button", { name: "Relatórios" }));
    await screen.findByRole("heading", { name: "Falha de comunicação" });
    expect(screen.queryByText("Nenhum relatório gerado ainda.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Nenhum relatório gerado ainda.");
    expect(api.reports).toHaveBeenCalledTimes(2);
    expect(api.project).toHaveBeenCalledTimes(1);
  });

  it.each(["CLIENT", "PENTESTER", "ADMIN"] as const)(
    "PROJ-MEMBER-01 — %s vê os nomes retornados pelos membros sem depender do catálogo",
    async (role) => {
      enterAs(role);
      renderPage();

      expect(await screen.findByText("Rafael Barros")).toBeInTheDocument();
      expect(screen.getByText("João Gonçalves da Silva")).toBeInTheDocument();
      for (const member of MEMBERS) expect(screen.queryByText(member.userId)).not.toBeInTheDocument();
      expect(api.members).toHaveBeenCalledWith(PROJECT.id);
      expect(api.project).toHaveBeenCalledWith(PROJECT.id);
      if (role !== "ADMIN") {
        expect(api.users).not.toHaveBeenCalled();
        expect(screen.queryByText("Remover")).not.toBeInTheDocument();
      }
    },
  );

  it("PROJ-MEMBER-02 — preserva o estado sem pentesters", async () => {
    enterAs("CLIENT");
    api.members.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Nenhum pentester atribuído ainda.")).toBeInTheDocument();
    expect(api.users).not.toHaveBeenCalled();
  });

  it("PROJ-MEMBER-03 — ADMIN adiciona e remove por ID, com nomes após atualizar a lista", async () => {
    enterAs("ADMIN");
    let members = [MEMBERS[0]];
    api.members.mockImplementation(async () => members);
    api.users.mockResolvedValue(MEMBERS.map((member) => ({ id: member.userId, name: member.userName, role: "PENTESTER" })));
    api.addMember.mockImplementation(async () => { members = [...members, MEMBERS[1]]; return MEMBERS[1]; });
    api.removeMember.mockImplementation(async (_projectId, userId) => { members = members.filter((member) => member.userId !== userId); });
    renderPage();

    await screen.findByText("Rafael Barros");
    const select = await screen.findByRole("combobox");
    await screen.findByRole("option", { name: "João Gonçalves da Silva" });
    fireEvent.change(select, { target: { value: MEMBERS[1].userId } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(api.addMember).toHaveBeenCalledWith(PROJECT.id, MEMBERS[1].userId));
    await screen.findByText("João Gonçalves da Silva", { selector: "span" });
    expect(select).toHaveValue("");
    fireEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]);
    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith(PROJECT.id, MEMBERS[0].userId));
    await waitFor(() => expect(screen.queryByText("Rafael Barros", { selector: "span" })).not.toBeInTheDocument());
    expect(screen.getByText("João Gonçalves da Silva", { selector: "span" })).toBeInTheDocument();
  });
});
