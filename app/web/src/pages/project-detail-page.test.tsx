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
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import type { Project } from "../types/project.types";
import { ProjectDetailPage } from "./project-detail-page";
import { subscribeAssistantFeedback } from "../lib/assistant-feedback";
import { createQueryClient } from "../lib/query-client";

const api = vi.hoisted(() => ({
  project: vi.fn(), application: vi.fn(), members: vi.fn(), users: vi.fn(),
  addMember: vi.fn(), removeMember: vi.fn(),
  reportData: vi.fn(), reportHistory: vi.fn(), registerReport: vi.fn(), executive: vi.fn(), technical: vi.fn(), download: vi.fn(),
}));
vi.mock("../lib/api/projects.api", () => ({ projectsApi: { getById: api.project } }));
vi.mock("../lib/api/applications.api", () => ({ applicationsApi: { getById: api.application } }));
vi.mock("../lib/api/project-members.api", () => ({
  projectMembersApi: { list: api.members, add: api.addMember, remove: api.removeMember },
}));
vi.mock("../lib/api/users.api", () => ({ usersApi: { list: api.users } }));
vi.mock("../hooks/use-company-name", () => ({ useCompanyName: () => "TechNova" }));
vi.mock("../hooks/use-findings", () => ({ useFindings: () => ({ dados: undefined }) }));
vi.mock("../lib/api/reports.api", () => ({ reportsApi: { getReportData: api.reportData, listByProject: api.reportHistory, create: api.registerReport } }));
vi.mock("../lib/pdf/executive", () => ({ generateExecutivePdf: api.executive }));
vi.mock("../lib/pdf/technical", () => ({ generateTechnicalPdf: api.technical }));
vi.mock("../lib/pdf/base", () => ({ downloadBlob: api.download }));

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

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
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
  api.reportHistory.mockResolvedValue([]);
  api.reportData.mockResolvedValue({});
  api.executive.mockResolvedValue(new Blob(["PDF fictício"], { type: "application/pdf" }));
  api.registerReport.mockResolvedValue({});
});

afterEach(() => useAuthStore.setState({ accessToken: null, refreshToken: null, user: null }));

describe("ProjectDetailPage — nomes dos pentesters", () => {
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

describe("Relatório concluído antes da reação da Vuvu", () => {
  it("espera PDF, download iniciado e registro confirmado antes de sinalizar sucesso", async () => {
    enterAs("ADMIN"); api.project.mockResolvedValue({ ...PROJECT, status: "IN_REVIEW" });
    let complete!: (value: unknown) => void;
    api.registerReport.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    const receive = vi.fn(); const leave = subscribeAssistantFeedback(receive);
    const client = createQueryClient();
    try {
      renderPage(client); await screen.findByText("Rafael Barros");
      fireEvent.click(screen.getByRole("button", { name: "Relatórios" }));
      fireEvent.click(screen.getByRole("button", { name: "Gerar PDF Executivo" }));
      await waitFor(() => expect(api.registerReport).toHaveBeenCalledWith(PROJECT.id, "EXECUTIVE"));
      expect(api.executive).toHaveBeenCalledTimes(1); expect(api.download).toHaveBeenCalledTimes(1);
      expect(receive).not.toHaveBeenCalled();
      await act(async () => complete({}));
      await waitFor(() => expect(receive).toHaveBeenCalledExactlyOnceWith("report-ready"));
    } finally { leave(); client.clear(); }
  });

  it.each(["geração", "registro"])("preserva o erro de %s sem comemorar um sucesso parcial", async (step) => {
    enterAs("ADMIN"); api.project.mockResolvedValue({ ...PROJECT, status: "IN_REVIEW" });
    (step === "geração" ? api.executive : api.registerReport).mockRejectedValue(new Error("Relatório não concluído"));
    const receive = vi.fn(); const leave = subscribeAssistantFeedback(receive);
    const client = createQueryClient();
    try {
      renderPage(client); await screen.findByText("Rafael Barros");
      fireEvent.click(screen.getByRole("button", { name: "Relatórios" }));
      fireEvent.click(screen.getByRole("button", { name: "Gerar PDF Executivo" }));
      await waitFor(() => expect(receive).toHaveBeenCalledExactlyOnceWith("operation-error"));
      expect(receive).not.toHaveBeenCalledWith("report-ready");
      expect(await screen.findByText("Não foi possível concluir a ação. Tente novamente.")).toBeInTheDocument();
      if (step === "geração") { expect(api.download).not.toHaveBeenCalled(); expect(api.registerReport).not.toHaveBeenCalled(); }
    } finally { leave(); client.clear(); }
  });
});
