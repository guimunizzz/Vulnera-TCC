/** Protege captura do token team_, ativação sem sessão e limites da senha. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyInvitationsApi } from "../../lib/api/company-invitations.api";
import { useAuthStore } from "../../store/auth.store";
import { JoinCompanyPage } from "./join-company-page";

vi.mock("../../lib/api/company-invitations.api", () => ({ companyInvitationsApi: { validatePublic: vi.fn(), activatePublic: vi.fn() } }));
const token = `team_${"A".repeat(43)}`;
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearAuth();
  window.history.replaceState({}, "", `/join-company#token=${token}`);
  vi.mocked(companyInvitationsApi.validatePublic).mockResolvedValue({ valid: true });
});
afterEach(() => { window.history.replaceState({}, "", "/join-company"); vi.restoreAllMocks(); });
function renderPage() { render(<MemoryRouter><JoinCompanyPage /></MemoryRouter>); }

describe("JoinCompanyPage", () => {
  it("remove o token do fragmento, valida e ativa convite sem abrir sessão", async () => {
    vi.mocked(companyInvitationsApi.activatePublic).mockResolvedValueOnce(undefined);
    renderPage();
    expect(window.location.hash).toBe("");
    expect(await screen.findByLabelText(/^Senha/)).toBeInTheDocument();
    expect(companyInvitationsApi.validatePublic).toHaveBeenCalledWith(token);
    fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: "senha-segura" } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/), { target: { value: "senha-segura" } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar acesso" }));
    expect(companyInvitationsApi.activatePublic).toHaveBeenCalledWith({ token, password: "senha-segura" });
    await waitFor(() => expect(screen.getByText(/Sua senha foi definida/)).toBeInTheDocument());
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it.each([
    ["curta", "1234567", "Use pelo menos 8 caracteres."],
    ["longa em bytes", "é".repeat(37), "Use uma senha com até 72 bytes em UTF-8."],
  ])("valida senha %s antes da chamada", async (_label, password, error) => {
    renderPage();
    await screen.findByLabelText(/^Senha/);
    fireEvent.change(screen.getByLabelText(/^Senha/), { target: { value: password } });
    fireEvent.change(screen.getByLabelText(/Confirmar senha/), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar acesso" }));
    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(companyInvitationsApi.activatePublic).not.toHaveBeenCalled();
  });

  it("não consulta token com prefixo inválido e informa indisponibilidade", async () => {
    window.history.replaceState({}, "", "/join-company#token=wrong");
    renderPage();
    expect(await screen.findByText(/Este convite é inválido/)).toBeInTheDocument();
    expect(companyInvitationsApi.validatePublic).not.toHaveBeenCalled();
  });
});
