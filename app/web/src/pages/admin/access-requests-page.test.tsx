/**
 * O que faz: cobre estados e ações essenciais da fila administrativa.
 * Por que existe: protege permissões por papel e transições sensíveis da interface.
 * Quem consome: Vitest focal da página de solicitações de acesso.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { companiesApi } from "../../lib/api/companies.api";
import { plansApi } from "../../lib/api/plans.api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccessRequestsPage } from "./access-requests-page";
import { useAuthStore } from "../../store/auth.store";
import { adminAccessRequestsApi } from "../../lib/api/admin-access-requests.api";
import type { AdminAccessRequest, AdminAccessRequestDetail } from "../../types/admin-access-requests.types";
vi.mock("../../lib/api/admin-access-requests.api", () => ({ adminAccessRequestsApi: {
  list: vi.fn(), get: vi.fn(), events: vi.fn(), approve: vi.fn(), reject: vi.fn(), resendInvitation: vi.fn(),
} }));
vi.mock("../../lib/api/subscriptions.api", () => ({ subscriptionsApi: { listPending: vi.fn(), approve: vi.fn(), reject: vi.fn() } }));
vi.mock("../../lib/api/companies.api", () => ({ companiesApi: { list: vi.fn() } }));
vi.mock("../../lib/api/plans.api", () => ({ plansApi: { list: vi.fn() } }));
const api = vi.mocked(adminAccessRequestsApi);
const record: AdminAccessRequest = { id: "request-001", name: "Ana Silva", email: "ana@example.com", companyName: "Empresa A", phone: null, status: "PENDING_REVIEW", expiresAt: "2026-12-01T00:00:00.000Z", emailVerifiedAt: "2026-11-01T00:00:00.000Z", reviewedAt: null, reviewedById: null, rejectionReason: null, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", enrollment: null, enrollmentEligibility: "LEGACY" };
const detail: AdminAccessRequestDetail = { ...record, invitation: null, enrollmentEligibility: "LEGACY" };
function renderPage(role: "ADMIN" | "CLIENT" | "PENTESTER" = "ADMIN", entry = "/admin/access-requests", companyRole: "OWNER" | "MEMBER" | null = null) {
  useAuthStore.setState({ user: { id: "u1", name: "Admin", email: "admin@example.com", role, companyId: null, companyRole, createdAt: "2026-01-01" } });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[entry]}><AccessRequestsPage /></MemoryRouter></QueryClientProvider>);
}
async function openDetail(name = "Ana Silva") {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(name) }, { timeout: 5000 }));
  const panel = await screen.findByRole("region", { name: "Detalhes da solicitação" }, { timeout: 5000 });
  await waitFor(() => expect(api.get).toHaveBeenCalled(), { timeout: 5000 });
  return panel;
}
afterEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: null }); });
describe("AccessRequestsPage", () => {
  it.each([[0, "solicitações"], [1, "solicitação"], [2, "solicitações"]] as const)("VUL-QA-01 — flexiona total de %i na central", async (count, label) => {
    api.list.mockResolvedValue({ items: [], total: count, page: 1, pageSize: 20 });
    renderPage();
    expect(await screen.findByText(`${count} ${label}`)).toBeInTheDocument();
  });

  it.each([
    [0, "aplicações", "projetos"], [1, "aplicação", "projeto"], [2, "aplicações", "projetos"],
  ] as const)("VUL-QA-01 — flexiona limites de %i nos detalhes administrativos", async (count, applications, projects) => {
    const enrollment = { companyCnpj: null, planId: "plan-1", planName: "Essencial", planPrice: "99.00", planMaxApplications: count, planMaxProjects: count, planIncludesRemediation: false };
    api.list.mockResolvedValue({ items: [record], total: 1, page: 1, pageSize: 20 });
    api.get.mockResolvedValue({ ...detail, enrollment });
    api.events.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();
    const panel = await openDetail();
    expect(await within(panel).findByText(`${count} ${applications} · ${count} ${projects} · sem remediação`)).toBeInTheDocument();
  });

  it("navega pelo teclado entre seções e só carrega o domínio ativo", async () => {
    api.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    vi.mocked(subscriptionsApi.listPending).mockResolvedValue([]);
    vi.mocked(companiesApi.list).mockResolvedValue([]);
    vi.mocked(plansApi.list).mockResolvedValue([]);
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Central de solicitações" })).toBeInTheDocument();
    const enrollmentLink = screen.getByRole("link", { name: "Adesões empresariais" });
    const commercialLink = screen.getByRole("link", { name: "Solicitações comerciais" });
    expect(enrollmentLink).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(1));
    expect(subscriptionsApi.listPending).not.toHaveBeenCalled();
    expect(companiesApi.list).not.toHaveBeenCalled();
    expect(plansApi.list).not.toHaveBeenCalled();
    enrollmentLink.focus();
    await userEvent.tab();
    expect(commercialLink).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("region", { name: "Solicitações comerciais" })).toBeInTheDocument();
    expect(commercialLink).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("region", { name: "Adesões empresariais" })).not.toBeInTheDocument();
    expect(await screen.findByText("Nenhuma assinatura pendente no momento.")).toBeInTheDocument();
    expect(subscriptionsApi.listPending).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it("abre link comercial direto sem buscar adesões", async () => {
    vi.mocked(subscriptionsApi.listPending).mockResolvedValue([]);
    vi.mocked(companiesApi.list).mockResolvedValue([]);
    vi.mocked(plansApi.list).mockResolvedValue([]);
    renderPage("ADMIN", "/admin/access-requests?section=commercial");
    expect(await screen.findByText("Nenhuma assinatura pendente no momento.")).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.get).not.toHaveBeenCalled();
    expect(api.events).not.toHaveBeenCalled();
  });

  it("aprova adesão unificada uma vez sem iniciar aprovação comercial", async () => {
    const enrollment = { companyCnpj: "12345678000199", planId: "plan-1", planName: "Essencial", planPrice: "99.00", planMaxApplications: 3, planMaxProjects: 2, planIncludesRemediation: false };
    const unified = { ...record, enrollment, enrollmentEligibility: "ELIGIBLE" as const };
    api.list.mockResolvedValue({ items: [unified], total: 1, page: 1, pageSize: 20 });
    api.get.mockResolvedValueOnce({ ...unified, invitation: null }).mockResolvedValue({ ...unified, status: "APPROVED", invitation: null });
    api.events.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    api.approve.mockResolvedValue({ request: { ...unified, status: "APPROVED" }, invitationDelivery: "SENT" });
    renderPage();
    await openDetail();
    expect(await screen.findByText("Essencial · R$ 99,00", { exact: false })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/assinatura inicial não exige outra aprovação/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledExactlyOnceWith("request-001"));
    expect(subscriptionsApi.approve).not.toHaveBeenCalled();
    expect(subscriptionsApi.listPending).not.toHaveBeenCalled();
  });
  it("lista no filtro padrão, abre detalhe e busca histórico paginado", async () => {
    api.list.mockResolvedValue({ items: [record], total: 21, page: 1, pageSize: 20 });
    api.get.mockResolvedValue(detail);
    api.events.mockResolvedValue({ items: [{ id: "e1", eventType: "REQUEST_CREATED", actorId: null, fromStatus: null, toStatus: "PENDING_REVIEW", reason: null, createdAt: record.createdAt }], total: 21, page: 1, pageSize: 20 });
    renderPage();
    const detailPanel = await openDetail();
    expect(await within(detailPanel).findByText("ana@example.com")).toBeInTheDocument();
    expect(await screen.findByText("REQUEST_CREATED")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith({ page: 1, pageSize: 20, status: "PENDING_REVIEW" });
    expect(api.events).toHaveBeenCalledWith("request-001", { page: 1, pageSize: 20 });
  });
  it.each([
    ["CLIENT", "OWNER"], ["CLIENT", "MEMBER"], ["PENTESTER", null],
  ] as const)("nega UI e queries a %s/%s nas duas seções", async (role, companyRole) => {
    const first = renderPage(role, "/admin/access-requests", companyRole);
    expect(screen.getByText("Acesso restrito a administradores.")).toBeInTheDocument();
    first.unmount();
    renderPage(role, "/admin/access-requests?section=commercial", companyRole);
    expect(await screen.findByText("Acesso restrito a administradores.")).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled();
    expect(subscriptionsApi.listPending).not.toHaveBeenCalled();
    expect(companiesApi.list).not.toHaveBeenCalled(); expect(plansApi.list).not.toHaveBeenCalled();
    expect(api.approve).not.toHaveBeenCalled(); expect(api.reject).not.toHaveBeenCalled(); expect(api.resendInvitation).not.toHaveBeenCalled();
  });
  it("confirma aprovação e trata falha de entrega como aprovado com opção de reenvio", async () => {
    const approved = { ...record, status: "APPROVED" as const };
    api.list.mockResolvedValue({ items: [record], total: 1, page: 1, pageSize: 20 });
    api.get.mockResolvedValueOnce(detail).mockResolvedValue({ ...detail, status: "APPROVED" });
    api.events.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    api.approve.mockResolvedValue({ request: approved, invitationDelivery: "DELIVERY_FAILED" });
    api.resendInvitation.mockResolvedValue({ request: approved, invitationDelivery: "SENT" });
    renderPage();
    await openDetail();
    await screen.findByText("E-mail verificado");
    await userEvent.click(screen.getByRole("button", { name: "Aprovar" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(api.approve).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/solicitação foi aprovada, mas o convite não foi enviado/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Reenviar convite" })).toBeInTheDocument();
  });
  it("rejeita com motivo opcional e impede envio duplo", async () => {
    api.list.mockResolvedValue({ items: [record], total: 1, page: 1, pageSize: 20 }); api.get.mockResolvedValue(detail);
    api.events.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    let resolveReject!: (value: { request: AdminAccessRequest }) => void;
    api.reject.mockReturnValue(new Promise((resolve) => { resolveReject = resolve; }));
    renderPage();
    await openDetail(); await screen.findByText("E-mail verificado");
    await userEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Motivo (opcional)"), { target: { value: "Cadastro duplicado" } });
    const confirm = within(dialog).getByRole("button", { name: "Confirmar" });
    await userEvent.click(confirm); await userEvent.click(confirm);
    await waitFor(() => expect(api.reject).toHaveBeenCalledTimes(1));
    expect(api.reject).toHaveBeenCalledWith("request-001", { reason: "Cadastro duplicado" });
    resolveReject({ request: { ...record, status: "REJECTED" } });
  });
  it("desabilita decisões antes da verificação de e-mail", async () => {
    api.list.mockResolvedValue({ items: [record], total: 1, page: 1, pageSize: 20 }); api.get.mockResolvedValue({ ...detail, emailVerifiedAt: null });
    api.events.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }); renderPage();
    await openDetail();
    expect(await screen.findByText("Ainda não")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aprovar" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Rejeitar" })).toHaveAttribute("aria-disabled", "true");
  });
  it("mostra adesão incompatível e exige motivo para rejeitar aprovação anterior", async () => {
    const incompatible: AdminAccessRequestDetail = {
      ...record,
      status: "APPROVED",
      enrollment: { companyCnpj: "12345678000199", planId: "plan-1", planName: "Essencial", planPrice: "99.00", planMaxApplications: 3, planMaxProjects: 2, planIncludesRemediation: false },
      enrollmentEligibility: "COMPANY_CNPJ_CONFLICT",
      invitation: null,
    };
    api.list.mockResolvedValue({ items: [incompatible], total: 1, page: 1, pageSize: 20 });
    api.get.mockResolvedValue(incompatible);
    api.events.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    api.reject.mockResolvedValue({ request: { ...incompatible, status: "REJECTED" } });
    renderPage();
    const detailPanel = await openDetail();
    expect(await within(detailPanel).findByText("CNPJ já cadastrado")).toBeInTheDocument();
    expect(within(detailPanel).getByText("12345678000199")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rejeitar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/Motivo obrigatório/)).toBeRequired();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(api.reject).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Motivo obrigatório/), { target: { value: "CNPJ já pertence a outra empresa." } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(api.reject).toHaveBeenCalledWith("request-001", { reason: "CNPJ já pertence a outra empresa." }));
  });
});
