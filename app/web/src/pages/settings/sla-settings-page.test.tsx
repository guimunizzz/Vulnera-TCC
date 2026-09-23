/**
 * Protege a diferença entre salvar e reaplicar a política e os controles por perfil.
 * Consumido pelo Vitest; as chamadas de API são simuladas para não alterar dados.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companiesApi } from "../../lib/api/companies.api";
import { slaPolicyApi } from "../../lib/api/sla-policy.api";
import { useAuthStore } from "../../store/auth.store";
import type { User } from "../../types/auth.types";
import type { SlaPolicy } from "../../types/sla-policy.types";
import { SlaSettingsPage } from "./sla-settings-page";

vi.mock("../../lib/api/companies.api", () => ({ companiesApi: { list: vi.fn(), me: vi.fn() } }));
vi.mock("../../lib/api/sla-policy.api", () => ({ slaPolicyApi: { get: vi.fn(), history: vi.fn(), upsert: vi.fn(), apply: vi.fn() } }));

const politica: SlaPolicy = {
  id: "policy-1", companyId: "company-1", name: "Padrão", criticalDays: 2, highDays: 7,
  mediumDays: 30, lowDays: 90, isActive: true, isDefault: false,
  createdBy: "admin-1", createdAt: "2026-09-01T00:00:00.000Z",
};

function autenticar(role: User["role"], companyRole?: string) {
  useAuthStore.setState({ user: {
    id: "admin-1", name: "Pessoa", email: "pessoa@vulnera.local", role,
    companyId: role === "ADMIN" ? null : "company-1", companyRole,
    createdAt: "2026-09-01T00:00:00.000Z",
  } });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><MemoryRouter><SlaSettingsPage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.mocked(companiesApi.list).mockResolvedValue([{ id: "company-1", name: "TechNova" } as Awaited<ReturnType<typeof companiesApi.list>>[number]]);
  vi.mocked(companiesApi.me).mockResolvedValue({ id: "company-1", name: "TechNova" } as Awaited<ReturnType<typeof companiesApi.me>>);
  vi.mocked(slaPolicyApi.get).mockResolvedValue(politica);
  vi.mocked(slaPolicyApi.history).mockResolvedValue([politica]);
  vi.mocked(slaPolicyApi.upsert).mockResolvedValue(politica);
  vi.mocked(slaPolicyApi.apply).mockResolvedValue({ recalculated: 3, policyId: politica.id });
});
afterEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null });
});

describe("SlaSettingsPage — política e permissões", () => {
  it("ADMIN salva sem reaplicar e pode executar a ação separada", async () => {
    autenticar("ADMIN");
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("spinbutton", { name: "Alta (dias)" })).toHaveValue(7);
    expect(screen.getByRole("button", { name: "Empresa" })).toBeInTheDocument();

    await user.clear(screen.getByRole("spinbutton", { name: "Alta (dias)" }));
    await user.type(screen.getByRole("spinbutton", { name: "Alta (dias)" }), "8");
    await user.click(screen.getByRole("button", { name: "Salvar política" }));
    await waitFor(() => expect(slaPolicyApi.upsert).toHaveBeenCalledWith("company-1", expect.objectContaining({ highDays: 8 })));
    expect(slaPolicyApi.apply).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reaplicar aos findings abertos" }));
    await waitFor(() => expect(slaPolicyApi.apply).toHaveBeenCalledWith("company-1"));
  });

  it("ADMIN troca a empresa consultada sem alterar a política anterior", async () => {
    vi.mocked(companiesApi.list).mockResolvedValue([
      { id: "company-1", name: "TechNova" },
      { id: "company-2", name: "Outra Empresa" },
    ] as Awaited<ReturnType<typeof companiesApi.list>>);
    autenticar("ADMIN");
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole("spinbutton", { name: "Crítica (dias)" })).toHaveValue(2);

    await user.click(screen.getByRole("button", { name: "Empresa" }));
    await user.click(await screen.findByRole("option", { name: "Outra Empresa" }));

    await waitFor(() => expect(slaPolicyApi.get).toHaveBeenCalledWith("company-2"));
    expect(slaPolicyApi.upsert).not.toHaveBeenCalled();
    expect(slaPolicyApi.apply).not.toHaveBeenCalled();
  });

  it("CLIENT OWNER edita somente a política da própria empresa", async () => {
    autenticar("CLIENT", "OWNER");
    renderPage();
    expect(await screen.findByRole("spinbutton", { name: "Crítica (dias)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Salvar política" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reaplicar aos findings abertos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Empresa" })).not.toBeInTheDocument();
  });

  it("CLIENT MEMBER consulta os dias e o histórico sem ações de escrita", async () => {
    autenticar("CLIENT", "MEMBER");
    renderPage();
    expect(await screen.findByRole("spinbutton", { name: "Crítica (dias)" })).toBeDisabled();
    expect(screen.getByRole("table", { name: "Versões da política de SLA desta empresa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Salvar política" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reaplicar aos findings abertos" })).not.toBeInTheDocument();
  });
});
