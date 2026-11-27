/**
 * O que faz: testa a fila comercial legada reutilizada pela central administrativa.
 * Por que existe: garante decisões comerciais explícitas e acesso exclusivo de ADMIN.
 * Quem consome: Vitest focal do frontend, sem API ou dados reais.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PendingSubscriptionsPage } from "./pending-subscriptions-page";
import { subscriptionsApi } from "../../lib/api/subscriptions.api";
import { companiesApi } from "../../lib/api/companies.api";
import { plansApi } from "../../lib/api/plans.api";
import { useAuthStore } from "../../store/auth.store";
import type { Subscription } from "../../types/subscription.types";
import type { User } from "../../types/auth.types";

vi.mock("../../lib/api/subscriptions.api", () => ({ subscriptionsApi: { listPending: vi.fn(), approve: vi.fn(), reject: vi.fn() } }));
vi.mock("../../lib/api/companies.api", () => ({ companiesApi: { list: vi.fn() } }));
vi.mock("../../lib/api/plans.api", () => ({ plansApi: { list: vi.fn() } }));

const subscription: Subscription = { id: "legacy-sub", companyId: "legacy-company", planId: "plan-1", status: "PENDING_APPROVAL", startDate: null, endDate: null, approvedBy: null, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z" };
const api = vi.mocked(subscriptionsApi);

function renderPage(role: User["role"] = "ADMIN", companyRole: string | null = null) {
  useAuthStore.setState({ user: { id: "admin", name: "Admin", email: "admin@example.test", role, companyId: null, companyRole, createdAt: "2026-01-01" } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><PendingSubscriptionsPage /></QueryClientProvider>);
}

beforeEach(() => {
  api.listPending.mockResolvedValue([subscription]);
  vi.mocked(companiesApi.list).mockResolvedValue([{ id: subscription.companyId, name: "Empresa legada" }] as Awaited<ReturnType<typeof companiesApi.list>>);
  vi.mocked(plansApi.list).mockResolvedValue([{ id: subscription.planId, name: "Plano legado" }] as Awaited<ReturnType<typeof plansApi.list>>);
});
afterEach(() => { vi.clearAllMocks(); useAuthStore.setState({ user: null }); });

describe("PendingSubscriptionsPage na central", () => {
  it("mostra empresa e plano de solicitações legadas sem aprovar automaticamente", async () => {
    renderPage();
    expect(await screen.findByText("Empresa legada")).toBeInTheDocument();
    expect(await screen.findByText("Plano legado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Solicitações comerciais" })).toBeInTheDocument();
    expect(api.approve).not.toHaveBeenCalled();
    expect(api.reject).not.toHaveBeenCalled();
  });

  it.each(["approve", "reject"] as const)("preserva a decisão comercial %s com confirmação única", async (action) => {
    let complete!: (value: Subscription) => void;
    api[action].mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    renderPage();
    await screen.findByText("Empresa legada");
    await userEvent.click(screen.getByRole("button", { name: action === "approve" ? "Aprovar" : "Recusar" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Confirmar" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    expect(api[action]).toHaveBeenCalledExactlyOnceWith(subscription.id);
    expect(api[action === "approve" ? "reject" : "approve"]).not.toHaveBeenCalled();
    complete({ ...subscription, status: action === "approve" ? "ACTIVE" : "REJECTED" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it.each([["CLIENT", "OWNER"], ["CLIENT", "MEMBER"], ["PENTESTER", null]] as const)("nega dados e ações a %s/%s", (role, companyRole) => {
    renderPage(role, companyRole);
    expect(screen.getByText("Acesso restrito a administradores.")).toBeInTheDocument();
    expect(api.listPending).not.toHaveBeenCalled();
    expect(companiesApi.list).not.toHaveBeenCalled();
    expect(plansApi.list).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
  });

  it("informa falha da fila e permite tentar novamente", async () => {
    api.listPending.mockRejectedValueOnce(new Error("indisponível")).mockResolvedValueOnce([]);
    renderPage();
    expect(await screen.findByText("Não foi possível carregar as solicitações comerciais.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma assinatura pendente no momento.")).toBeInTheDocument();
    expect(api.listPending).toHaveBeenCalledTimes(2);
  });
});
