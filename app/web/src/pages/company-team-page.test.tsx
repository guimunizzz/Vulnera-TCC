/** Valida ownership visual, gestão segura de convites e eventos da equipe. */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyInvitationsApi } from "../lib/api/company-invitations.api";
import { useAuthStore } from "../store/auth.store";
import { CompanyTeamPage } from "./company-team-page";

vi.mock("../lib/api/company-invitations.api", () => ({ companyInvitationsApi: {
  readTeam: vi.fn(), listMembers: vi.fn(), list: vi.fn(), history: vi.fn(), create: vi.fn(), resend: vi.fn(), revoke: vi.fn(), deactivateMember: vi.fn(),
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
  api.readTeam.mockResolvedValue({ company: { id: "company-a", name: "Empresa Alpha" },
    members: members.map(({ id, name, companyRole }) => ({ id, name, companyRole })) });
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

  it("MEMBER consulta empresa, integrantes e responsável sem controles nem dados administrativos", async () => {
    useAuthStore.setState({ user: { id: "member", name: "Membro", email: "m@example.test", role: "CLIENT", companyId: "company-a", companyRole: "MEMBER", createdAt: "2026-01-01" } });
    renderPage();
    expect(await screen.findByText("Empresa Alpha")).toBeInTheDocument();
    expect(screen.getByText("Ana Owner")).toBeInTheDocument();
    expect(screen.getByText("Bea Membro")).toBeInTheDocument();
    expect(screen.getByText("Responsável")).toBeInTheDocument();
    expect(screen.getByText(/Acesso somente para consulta/)).toBeInTheDocument();
    expect(screen.queryByText("ana@example.test")).not.toBeInTheDocument();
    expect(screen.queryByText("bea@example.test")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Convites|Histórico de eventos|Convidar membro/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enviar convite|Reenviar|Revogar|Desativar/ })).not.toBeInTheDocument();
    expect(api.readTeam).toHaveBeenCalledTimes(1);
    expect(api.listMembers).not.toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.history).not.toHaveBeenCalled();
  });

  it.each([
    { role: "ADMIN" as const, companyId: "company-a", companyRole: "OWNER" },
    { role: "PENTESTER" as const, companyId: "company-a", companyRole: "MEMBER" },
    { role: "CLIENT" as const, companyId: null, companyRole: "MEMBER" },
    { role: "CLIENT" as const, companyId: "company-a", companyRole: null },
  ])("não consulta a API para identidade fora da equipe: %j", async scope => {
    useAuthStore.setState({ user: { id: "outsider", name: "Fictício", email: "f@example.test", createdAt: "2026-01-01", ...scope } });
    renderPage();
    expect(screen.getByText("A consulta da equipe está disponível somente para integrantes de uma empresa.")).toBeInTheDocument();
    expect(api.readTeam).not.toHaveBeenCalled();
    expect(api.listMembers).not.toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
    expect(api.history).not.toHaveBeenCalled();
  });

  it("mostra erro recuperável e estado vazio ao MEMBER", async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, companyRole: "MEMBER" } });
    api.readTeam.mockRejectedValueOnce(new Error("fixture-unavailable"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar a equipe.");
    api.readTeam.mockResolvedValueOnce({ company: { id: "company-a", name: "Empresa Alpha" }, members: [] });
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhum integrante ativo.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("troca OWNER Alpha por MEMBER Beta sem reutilizar dados, formulário ou consultas administrativas", async () => {
    renderPage();
    await screen.findByText("Ana Owner");
    await userEvent.type(screen.getByRole("textbox", { name: /Nome/ }), "Rascunho Alpha");
    const calls = { members: api.listMembers.mock.calls.length, invitations: api.list.mock.calls.length, history: api.history.mock.calls.length };
    let completeBeta!: (value: Awaited<ReturnType<typeof companyInvitationsApi.readTeam>>) => void;
    api.readTeam.mockReturnValueOnce(new Promise(resolve => { completeBeta = resolve; }));
    act(() => useAuthStore.setState({ user: { id: "beta-member", name: "Membro Beta", email: "beta@example.test", role: "CLIENT", companyId: "company-b", companyRole: "MEMBER", createdAt: "2026-01-01" }, sessionVersion: useAuthStore.getState().sessionVersion + 1 }));
    expect(screen.queryByText("Ana Owner")).not.toBeInTheDocument();
    expect(screen.queryByText("Empresa Alpha")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Rascunho Alpha")).not.toBeInTheDocument();
    await act(async () => completeBeta({ company: { id: "company-b", name: "Empresa Beta" }, members: [{ id: "beta-owner", name: "Responsável Beta", companyRole: "OWNER" }] }));
    expect(await screen.findByText("Empresa Beta")).toBeInTheDocument();
    expect(screen.getByText("Responsável Beta")).toBeInTheDocument();
    expect(screen.queryByText("Ana Owner")).not.toBeInTheDocument();
    expect(api.listMembers).toHaveBeenCalledTimes(calls.members);
    expect(api.list).toHaveBeenCalledTimes(calls.invitations);
    expect(api.history).toHaveBeenCalledTimes(calls.history);
  });

  it("descarta conclusão atrasada da leitura de Alpha após iniciar sessão Beta", async () => {
    let completeAlpha!: (value: Awaited<ReturnType<typeof companyInvitationsApi.readTeam>>) => void;
    api.readTeam.mockReturnValueOnce(new Promise(resolve => { completeAlpha = resolve; }));
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, companyRole: "MEMBER" } });
    renderPage();
    api.readTeam.mockResolvedValueOnce({ company: { id: "company-b", name: "Empresa Beta" }, members: [{ id: "beta-member", name: "Membro Beta", companyRole: "MEMBER" }] });
    act(() => useAuthStore.setState({ user: { id: "beta-member", name: "Membro Beta", email: "beta@example.test", role: "CLIENT", companyId: "company-b", companyRole: "MEMBER", createdAt: "2026-01-01" }, sessionVersion: useAuthStore.getState().sessionVersion + 1 }));
    await screen.findByText("Empresa Beta");
    await act(async () => completeAlpha({ company: { id: "company-a", name: "Empresa Alpha" }, members: [{ id: "alpha-member", name: "Membro Alpha", companyRole: "MEMBER" }] }));
    expect(screen.queryByText("Empresa Alpha")).not.toBeInTheDocument();
    expect(screen.queryByText("Membro Alpha")).not.toBeInTheDocument();
    expect(screen.getByText("Membro Beta")).toBeInTheDocument();
  });
});
