/**
 * O QUE FAZ: reproduz falhas de onboarding e estados de erro sem tocar a API real.
 * POR QUE EXISTE: documenta comportamentos ruins observados no QA da apresentação.
 * QUEM CONSOME: execução Vitest descartável; as asserções caracterizam o defeito atual.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios, { AxiosError, AxiosHeaders } from "axios";
import { apiClient } from "../lib/api/client";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import { OnboardingPage } from "./onboarding-page";
import { ClientDashboard } from "../components/dashboard/client-dashboard";
import { PendingSubscriptionsPage } from "./admin/pending-subscriptions-page";
import { MaturityAssessmentPage } from "./maturity-assessment-page";
import { EvidenceUploader } from "../components/findings/evidence-uploader";
import { FindingEditorPage } from "./finding-editor-page";
import { FindingDetailPage } from "./finding-detail-page";

const api = vi.hoisted(() => ({
  plans: vi.fn(), companyCreate: vi.fn(), companyMe: vi.fn(), companyList: vi.fn(),
  subscriptionRequest: vi.fn(), subscriptionsPending: vi.fn(), findings: vi.fn(),
  catalog: vi.fn(), latest: vi.fn(), evidenceList: vi.fn(), findingGet: vi.fn(), findingUpdate: vi.fn(), projectGet: vi.fn(),
}));
vi.mock("../lib/api/plans.api", () => ({ plansApi: { list: api.plans } }));
vi.mock("../lib/api/companies.api", () => ({ companiesApi: { create: api.companyCreate, me: api.companyMe, list: api.companyList } }));
vi.mock("../lib/api/subscriptions.api", () => ({ subscriptionsApi: { request: api.subscriptionRequest, listPending: api.subscriptionsPending } }));
vi.mock("../lib/api/vulnerabilities.api", () => ({ vulnerabilitiesApi: { search: api.findings, getById: api.findingGet, update: api.findingUpdate } }));
vi.mock("../lib/api/projects.api", () => ({ projectsApi: { getById: api.projectGet } }));
vi.mock("../lib/api/maturity.api", () => ({ maturityApi: { getCatalog: api.catalog, getLatestByCompany: api.latest } }));
vi.mock("../lib/api/evidences.api", () => ({ evidencesApi: { list: api.evidenceList } }));
vi.mock("../components/dashboard/severity-donut", () => ({ SeverityDonut: () => <div>Gráfico</div> }));
vi.mock("../components/maturity/maturity-radar", () => ({ MaturityRadar: () => <div>Radar</div> }));
vi.mock("../hooks/use-company-name", () => ({ useCompanyName: () => "Empresa QA" }));
vi.mock("../components/findings/comment-timeline", () => ({ CommentTimeline: () => null }));
vi.mock("../components/findings/override-severity-dialog", () => ({ OverrideSeverityDialog: () => null }));
vi.mock("../components/findings/risk-acceptance-panel", () => ({ RiskAcceptancePanel: () => null }));
vi.mock("../components/findings/how-to-fix-panel", () => ({ HowToFixPanel: () => null }));
vi.mock("../components/findings/audit-trail", () => ({ AuditTrail: () => null }));

const finding = {
  id: "finding-qa", title: "Finding QA", description: "Descrição QA", owaspCategory: "A01",
  cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", cvssScore: 9.8,
  severityCalculated: "CRITICAL", severityFinal: "CRITICAL", severityOverrideReason: null,
  impact: "Impacto anterior", recommendation: "Recomendação anterior", status: "OPEN", aiAssisted: false,
  projectId: "project-qa", companyId: "company-qa", applicationId: "app-qa", applicationName: "Portal QA",
  createdBy: "user-qa", assignedTo: null, createdAt: "2026-10-15T12:00:00Z", updatedAt: "2026-10-15T12:00:00Z",
};

function montar(element: React.ReactNode, path = "/onboarding", route = path) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<ThemeProvider><QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
    <Routes><Route path={route} element={element} /></Routes>
  </MemoryRouter></QueryClientProvider></ThemeProvider>);
}

async function confirmarOnboarding() {
  fireEvent.change(screen.getByLabelText("Nome da empresa"), { target: { value: "Empresa QA" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(await screen.findByRole("button", { name: /Plano QA/ }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ accessToken: "token", refreshToken: "refresh", user: {
    id: "user-qa", name: "Pessoa QA", email: "qa@example.test", role: "CLIENT",
    companyId: null, companyRole: null, createdAt: "2026-10-15T12:00:00Z",
  } });
  api.plans.mockResolvedValue([{ id: "plan-qa", name: "Plano QA", maxApplications: 3, maxProjects: 3 }]);
  api.companyCreate.mockResolvedValue({ id: "company-qa", name: "Empresa QA" });
  api.companyMe.mockResolvedValue({ id: "company-qa", name: "Empresa QA" });
  api.companyList.mockResolvedValue([]);
  api.subscriptionRequest.mockResolvedValue({ id: "subscription-qa" });
  api.evidenceList.mockResolvedValue([]);
  api.findingGet.mockResolvedValue(finding);
  api.findingUpdate.mockResolvedValue(finding);
  api.projectGet.mockResolvedValue({ id: "project-qa", companyId: "company-qa", name: "Projeto QA" });
});

describe("QA — caracterização de defeitos atuais, sem banco real", () => {
  it("QA-ONB-01 — sucesso do onboarding deixa sessão sem companyId e sem OWNER", async () => {
    montar(<OnboardingPage />);
    await confirmarOnboarding();
    expect(await screen.findByText("Empresa cadastrada!")).toBeInTheDocument();
    expect(api.companyCreate).toHaveBeenCalledOnce();
    expect(api.subscriptionRequest).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user?.companyId).toBeNull();
    expect(useAuthStore.getState().user?.companyRole).toBeNull();
  });

  it("QA-ONB-02 — falha parcial de assinatura faz retry criar empresa novamente e ficar preso", async () => {
    api.companyCreate.mockResolvedValueOnce({ id: "company-qa" }).mockRejectedValue(new Error("USER_ALREADY_HAS_COMPANY"));
    api.subscriptionRequest.mockRejectedValueOnce(new Error("NETWORK"));
    montar(<OnboardingPage />);
    await confirmarOnboarding();
    await screen.findByText("Não foi possível concluir a ação. Tente novamente.");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(api.companyCreate).toHaveBeenCalledTimes(2));
    expect(api.subscriptionRequest).toHaveBeenCalledOnce();
    expect(screen.queryByText("Empresa cadastrada!")).not.toBeInTheDocument();
  });

  it("QA-DASH-01 — erro em findings vira zero e vazio sem aviso no dashboard CLIENT", async () => {
    api.findings.mockRejectedValue(new Error("NETWORK"));
    montar(<ClientDashboard />, "/dashboard");
    expect(await screen.findByText("Nenhum finding registrado ainda.")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tentar novamente/i })).not.toBeInTheDocument();
    expect(api.findings).toHaveBeenCalledTimes(2);
  });

  it("QA-SUB-01 — erro na lista de assinaturas deixa só o cabeçalho sem recuperação", async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "ADMIN" } });
    api.subscriptionsPending.mockRejectedValue(new Error("NETWORK"));
    montar(<PendingSubscriptionsPage />, "/admin/subscriptions");
    await waitFor(() => expect(api.subscriptionsPending).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByText("Carregando...")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Assinaturas pendentes" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhuma assinatura pendente no momento.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tentar novamente/i })).not.toBeInTheDocument();
  });

  it("QA-MAT-01 — erro no assessment é exibido como inexistência de avaliação", async () => {
    api.catalog.mockResolvedValue([]);
    api.latest.mockRejectedValue(new Error("NETWORK"));
    montar(<MaturityAssessmentPage />, "/companies/company-qa/maturity", "/companies/:companyId/maturity");
    expect(await screen.findByText("Nenhuma avaliação de maturidade ainda")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tentar novamente/i })).not.toBeInTheDocument();
  });

  it("QA-EVID-01 — seletor de upload não oferece controle acessível por teclado", async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "PENTESTER" } });
    const { container } = montar(<EvidenceUploader vulnerabilityId="finding-qa" canUpload />, "/findings/finding-qa");
    await screen.findByText("Nenhuma evidência anexada ainda.");
    expect(screen.getByText("Arraste arquivos aqui ou clique para selecionar")).toHaveAttribute("class");
    expect(screen.queryByRole("button", { name: /selecionar|arquivo/i })).not.toBeInTheDocument();
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toHaveClass("hidden");
    const dropZone = screen.getByText("Arraste arquivos aqui ou clique para selecionar");
    expect(dropZone).not.toHaveAttribute("tabindex");
    expect(dropZone.tagName).toBe("DIV");
  });

  it("QA-FIND-01 — apagar Impacto e Recomendação produz PUT que omite as duas alterações", async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "ADMIN" } });
    montar(<FindingEditorPage />, "/findings/finding-qa/edit", "/findings/:id/edit");
    const impact = await screen.findByLabelText("Impacto");
    await waitFor(() => expect(impact).toHaveValue("Impacto anterior"));
    fireEvent.change(impact, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Recomendação"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(api.findingUpdate).toHaveBeenCalledOnce());
    const body = JSON.parse(JSON.stringify(api.findingUpdate.mock.calls[0][1]));
    expect(body).not.toHaveProperty("impact");
    expect(body).not.toHaveProperty("recommendation");
  });

  it("QA-FIND-02 — falha no GET de edição abre formulário vazio editável sem aviso", async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "ADMIN" } });
    api.findingGet.mockRejectedValue(new Error("NETWORK"));
    montar(<FindingEditorPage />, "/findings/finding-qa/edit", "/findings/:id/edit");
    expect(await screen.findByRole("button", { name: "Salvar alterações" })).toBeEnabled();
    expect(screen.getByLabelText("Título")).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tentar novamente/i })).not.toBeInTheDocument();
  });

  it("QA-FIND-03 — CLIENT recebe link de remediação cuja rota lhe é proibida", async () => {
    montar(<FindingDetailPage />, "/findings/finding-qa", "/findings/:id");
    expect(await screen.findByRole("link", { name: "quadro de remediação" })).toHaveAttribute("href", "/remediation");
  });

  it("QA-FIND-04 — PENTESTER recebe breadcrumb de dashboard de aplicação cuja rota lhe é proibida", async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, role: "PENTESTER" } });
    montar(<FindingDetailPage />, "/findings/finding-qa", "/findings/:id");
    expect(await screen.findByRole("link", { name: "Portal QA" })).toHaveAttribute("href", "/applications/app-qa/dashboard");
  });

  it("QA-AUTH-01 — erro de rede no refresh apaga a sessão após access token expirar", async () => {
    const refresh = vi.spyOn(axios, "post").mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
    await expect(apiClient.get("/qa-token-expirado", {
      adapter: async (config) => {
        throw new AxiosError("Expired", "ERR_BAD_REQUEST", config, undefined, {
          status: 401, statusText: "Unauthorized", data: { error: "INVALID_TOKEN" },
          headers: new AxiosHeaders(), config,
        });
      },
    })).rejects.toThrow("Network Error");
    expect(refresh).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    refresh.mockRestore();
  });
});
