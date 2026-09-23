/**
 * Garante que o finding só troca de coluna depois de a API confirmar a mudança.
 * Consumido pelo Vitest; cobre a sincronização do quadro sem tocar no banco.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { projectsApi } from "../lib/api/projects.api";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";
import type { FindingListItem, VulnerabilityStatus } from "../types/vulnerability.types";
import { RemediationPage } from "./remediation-page";

vi.mock("../lib/api/projects.api", () => ({ projectsApi: { list: vi.fn() } }));
vi.mock("../lib/api/vulnerabilities.api", () => ({
  vulnerabilitiesApi: { search: vi.fn(), transition: vi.fn(), assign: vi.fn(), assigneeCandidates: vi.fn(), assignees: vi.fn() },
}));

const finding: FindingListItem = {
  id: "finding-1", title: "SQL Injection", severityFinal: "HIGH", severityCalculated: "HIGH",
  cvssScore: 8.2, status: "OPEN", owaspCategory: "A03", createdAt: "2026-09-01T00:00:00.000Z",
  projectId: "project-1", projectName: "Pentest Web", applicationId: "app-1", applicationName: "Portal",
  companyId: "company-1", companyName: "TechNova", slaState: "ON_TRACK", slaDueAt: null,
  slaRemainingMs: null, vrsScore: null, vrsBand: null, hasActiveRiskAcceptance: false,
  assignedTo: null, assigneeName: null,
};

describe("RemediationPage — mudança confirmada", () => {
  it("mantém o card na origem enquanto a mutation aguarda e o exibe uma vez no destino", async () => {
    let status: VulnerabilityStatus = "OPEN";
    let confirmar!: (value: Awaited<ReturnType<typeof vulnerabilitiesApi.transition>>) => void;
    vi.mocked(projectsApi.list).mockResolvedValue([]);
    vi.mocked(vulnerabilitiesApi.assigneeCandidates).mockResolvedValue([]);
    vi.mocked(vulnerabilitiesApi.search).mockImplementation(async () => ({
      data: [{ ...finding, status }],
      pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      facets: { severity: {}, status: {}, owasp: {}, company: {} },
    }));
    vi.mocked(vulnerabilitiesApi.transition).mockImplementation(() => new Promise((resolve) => { confirmar = resolve; }));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(<QueryClientProvider client={queryClient}><MemoryRouter><RemediationPage /></MemoryRouter></QueryClientProvider>);

    const origem = await screen.findByRole("region", { name: "Aberto: 1 finding(s)" });
    expect(within(origem).getByRole("link", { name: "SQL Injection" })).toBeInTheDocument();
    await user.click(within(origem).getByRole("button", { name: "Mover para…" }));
    await user.click(await screen.findByRole("menuitem", { name: "Iniciar correção" }));
    expect(vulnerabilitiesApi.transition).toHaveBeenCalledWith("finding-1", "IN_PROGRESS");
    expect(within(origem).getByRole("link", { name: "SQL Injection" })).toBeInTheDocument();

    status = "IN_PROGRESS";
    confirmar({} as Awaited<ReturnType<typeof vulnerabilitiesApi.transition>>);
    const destino = await screen.findByRole("region", { name: "Em andamento: 1 finding(s)" });
    await waitFor(() => expect(within(destino).getByRole("link", { name: "SQL Injection" })).toBeInTheDocument());
    expect(screen.getAllByRole("link", { name: "SQL Injection" })).toHaveLength(1);
  });
});
