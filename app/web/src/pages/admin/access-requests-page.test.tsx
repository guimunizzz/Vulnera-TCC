/**
 * O que faz: cobre estados e ações essenciais da fila administrativa.
 * Por que existe: protege permissões por papel e transições sensíveis da interface.
 * Quem consome: Vitest focal da página de solicitações de acesso.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AccessRequestsPage } from "./access-requests-page";
import { useAuthStore } from "../../store/auth.store";
import { adminAccessRequestsApi } from "../../lib/api/admin-access-requests.api";
import type { AdminAccessRequest, AdminAccessRequestDetail } from "../../types/admin-access-requests.types";
vi.mock("../../lib/api/admin-access-requests.api", () => ({ adminAccessRequestsApi: {
  list: vi.fn(), get: vi.fn(), events: vi.fn(), approve: vi.fn(), reject: vi.fn(), resendInvitation: vi.fn(),
} }));
const api = vi.mocked(adminAccessRequestsApi);
const record: AdminAccessRequest = { id: "request-001", name: "Ana Silva", email: "ana@example.com", companyName: "Empresa A", phone: null, status: "PENDING_REVIEW", expiresAt: "2026-12-01T00:00:00.000Z", emailVerifiedAt: "2026-11-01T00:00:00.000Z", reviewedAt: null, reviewedById: null, rejectionReason: null, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z", enrollment: null, enrollmentEligibility: "LEGACY" };
const detail: AdminAccessRequestDetail = { ...record, invitation: null, enrollmentEligibility: "LEGACY" };
function renderPage(role: "ADMIN" | "CLIENT" | "PENTESTER" = "ADMIN") {
  useAuthStore.setState({ user: { id: "u1", name: "Admin", email: "admin@example.com", role, companyId: null, createdAt: "2026-01-01" } });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><AccessRequestsPage /></QueryClientProvider>);
}
async function openDetail(name = "Ana Silva") {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(name) }, { timeout: 5000 }));
  const panel = await screen.findByRole("region", { name: "Detalhes da solicitação" }, { timeout: 5000 });
  await waitFor(() => expect(api.get).toHaveBeenCalled(), { timeout: 5000 });
  return panel;
}
afterEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: null }); });
describe("AccessRequestsPage", () => {
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
  it.each(["CLIENT", "PENTESTER"] as const)("nega UI e queries a %s", async (role) => {
    renderPage(role);
    expect(await screen.findByText("Acesso restrito a administradores.")).toBeInTheDocument();
    expect(api.list).not.toHaveBeenCalled(); expect(api.get).not.toHaveBeenCalled();
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
