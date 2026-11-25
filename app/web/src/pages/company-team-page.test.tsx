/** Valida ownership visual, gestão segura de convites e eventos da equipe. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyInvitationsApi } from "../lib/api/company-invitations.api";
import { useAuthStore } from "../store/auth.store";
import { CompanyTeamPage } from "./company-team-page";

vi.mock("../lib/api/company-invitations.api", () => ({ companyInvitationsApi: {
  listMembers: vi.fn(), list: vi.fn(), history: vi.fn(), create: vi.fn(), resend: vi.fn(), revoke: vi.fn(), deactivateMember: vi.fn(),
} }));
const api = vi.mocked(companyInvitationsApi);
const members = [
  { id: "owner-id", name: "Ana Owner", email: "ana@example.test", companyRole: "OWNER" as const, createdAt: "2026-01-01T00:00:00Z" },
  { id: "member-id", name: "Bea Membro", email: "bea@example.test", companyRole: "MEMBER" as const, createdAt: "2026-02-01T00:00:00Z" },
];
const pending = { id: "invite-id", name: "Caio", email: "caio@example.test", status: "PENDING" as const, issuedAt: "2026-11-01T00:00:00Z", expiresAt: "2026-11-03T00:00:00Z" };
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: "owner-id", name: "Ana Owner", email: "ana@example.test", role: "CLIENT", companyId: "company-a", companyRole: "OWNER", createdAt: "2026-01-01" } });
  api.listMembers.mockResolvedValue(members);
  api.list.mockResolvedValue([pending]);
  api.history.mockResolvedValue([{ id: "event-1", invitationId: "invite-id", action: "DELIVERY_FAILED", email: "caio@example.test", actorName: "Ana Owner", createdAt: "2026-11-01T00:00:00Z" }]);
});
afterEach(() => { vi.restoreAllMocks(); useAuthStore.setState({ user: null }); });
function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><CompanyTeamPage /></QueryClientProvider>);
}

describe("CompanyTeamPage", () => {
  it("mostra equipe, convites e trilha; OWNER é o único com ação de desativação", async () => {
    renderPage();
    expect(await screen.findByText("Ana Owner")).toBeInTheDocument();
    expect(screen.getByText("Bea Membro")).toBeInTheDocument();
    expect(screen.getByText("Falha no envio do e-mail")).toBeInTheDocument();
    const memberRow = screen.getByRole("row", { name: /Bea Membro/ });
    expect(within(memberRow).getByRole("button", { name: "Desativar" })).toBeInTheDocument();
    const ownerRow = screen.getByRole("row", { name: /Ana Owner/ });
    expect(within(ownerRow).queryByRole("button", { name: "Desativar" })).not.toBeInTheDocument();
    expect(api.history).toHaveBeenCalledTimes(1);
  });

  it("cria convite e informa falha de entrega mantendo o registro", async () => {
    api.create.mockResolvedValueOnce({ invitation: pending, delivery: "DELIVERY_FAILED" });
    renderPage();
    await screen.findByText("Ana Owner");
    await userEvent.type(screen.getByRole("textbox", { name: /Nome/ }), "Caio Novo");
    await userEvent.type(screen.getByRole("textbox", { name: /E-mail/ }), "caio@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
    expect(api.create.mock.calls[0]?.[0]).toEqual({ name: "Caio Novo", email: "caio@example.test" });
    expect(await screen.findByText(/Convite registrado, mas o e-mail não foi entregue/)).toBeInTheDocument();
  });

  it("confirma operações sensíveis e trata conflito com mensagem neutra", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    api.revoke.mockRejectedValueOnce({ response: { status: 409, data: { error: "COMPANY_INVITATION_NOT_AVAILABLE" } } });
    renderPage();
    const invitationRow = await screen.findByRole("row", { name: /Caio/ });
    await userEvent.click(within(invitationRow).getByRole("button", { name: "Revogar" }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(api.revoke).toHaveBeenCalledTimes(1));
    expect(api.revoke.mock.calls[0]?.[0]).toBe("invite-id");
    expect(await screen.findByText("O convite não está disponível para esta ação. A lista foi atualizada.")).toBeInTheDocument();
    expect(screen.queryByText("COMPANY_INVITATION_NOT_AVAILABLE")).not.toBeInTheDocument();
  });

  it("não carrega dados nem mostra controles para MEMBER", async () => {
    useAuthStore.setState({ user: { id: "member", name: "Membro", email: "m@example.test", role: "CLIENT", companyId: "company-a", companyRole: "MEMBER", createdAt: "2026-01-01" } });
    renderPage();
    expect(await screen.findByText("A gestão da equipe está disponível somente para o OWNER da empresa.")).toBeInTheDocument();
    expect(api.listMembers).not.toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
  });
});
