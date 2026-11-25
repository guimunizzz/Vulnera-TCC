/** Protege redirects legados e a leitura autoritativa de /users/me em sessões antigas. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { authApi } from "../../lib/api/auth.api";
import { usersApi } from "../../lib/api/users.api";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { useAuthStore } from "../../store/auth.store";
import type { AuthResponse, User } from "../../types/auth.types";
import { LoginPage } from "./login-page";

vi.mock("../../lib/api/auth.api", () => ({ authApi: { login: vi.fn() } }));
vi.mock("../../lib/api/users.api", () => ({ usersApi: { me: vi.fn() } }));
vi.mock("../../lib/api/subscriptions.api", () => ({ subscriptionsApi: { onboardingStatus: vi.fn() } }));
vi.mock("../dashboard-page", () => ({ DashboardPage: () => null }));
const baseUser = (legacyOnboardingAllowed?: boolean): User => ({
  id: "legacy-owner", name: "Pessoa", email: "pessoa@example.test", role: "CLIENT", companyId: null,
  createdAt: "2026-01-01", ...(legacyOnboardingAllowed === undefined ? {} : { legacyOnboardingAllowed }),
});
const auth = (user: User): AuthResponse => ({ accessToken: "access", refreshToken: "refresh", user });
function LocationProbe() { return <output data-testid="path">{useLocation().pathname}</output>; }
function renderLogin() { render(<MemoryRouter initialEntries={["/login"]}><LoginPage /><LocationProbe /></MemoryRouter>); }
async function submitLogin() {
  await userEvent.type(screen.getByLabelText(/^E-mail/), "pessoa@example.test");
  await userEvent.type(screen.getByLabelText(/^Senha/), "password");
  fireEvent.submit(screen.getByRole("form", { name: "Entrar" }));
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearAuth();
  vi.mocked(authApi.login).mockResolvedValue(auth(baseUser(true)));
  vi.mocked(subscriptionsApi.onboardingStatus).mockResolvedValue({ status: "PENDING_APPROVAL", subscription: null } as never);
});
afterEach(() => { vi.restoreAllMocks(); useAuthStore.getState().clearAuth(); });

describe("LoginPage legacy onboarding routing", () => {
  it("manda CLIENT sem empresa ao onboarding somente quando o backend permite", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce(auth(baseUser(true)));
    renderLogin();
    await submitLogin();
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/onboarding"));
    expect(usersApi.me).not.toHaveBeenCalled();
  });

  it("não envia CLIENT novo sem empresa ao onboarding", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce(auth(baseUser(false)));
    renderLogin();
    await submitLogin();
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/dashboard"));
    expect(subscriptionsApi.onboardingStatus).not.toHaveBeenCalled();
  });

  it("consulta /users/me para sessão antiga sem flag antes de decidir", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce(auth(baseUser()));
    vi.mocked(usersApi.me).mockResolvedValueOnce({ ...baseUser(true), legacyOnboardingAllowed: true });
    renderLogin();
    await submitLogin();
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/onboarding"));
    expect(usersApi.me).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user?.legacyOnboardingAllowed).toBe(true);
  });

  it("preserva a sessão e oferece retry se o perfil legado não carregar", async () => {
    vi.mocked(authApi.login).mockResolvedValueOnce(auth(baseUser()));
    vi.mocked(usersApi.me).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ...baseUser(), legacyOnboardingAllowed: true });
    renderLogin();
    await submitLogin();
    expect(await screen.findByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe("access");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/onboarding"));
  });
});
