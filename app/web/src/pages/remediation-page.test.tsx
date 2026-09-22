/**
 * Prova o carregamento sob demanda dos responsáveis do quadro.
 * Existe para garantir que cada cartão não faça uma chamada ao montar a
 * página; o endpoint por finding só é consultado quando seu menu é aberto.
 * Consumidor: AssigneeMenu em remediation-page.tsx.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FindingListItem } from "../types/vulnerability.types";
import { AssigneeMenu } from "./remediation-page";
import { vulnerabilitiesApi } from "../lib/api/vulnerabilities.api";

vi.mock("../lib/api/vulnerabilities.api", () => ({
  vulnerabilitiesApi: {
    assignees: vi.fn(),
  },
}));

const assignees = vi.mocked(vulnerabilitiesApi.assignees);

const finding: FindingListItem = {
  id: "finding-1",
  title: "SQL Injection",
  severityFinal: "HIGH",
  severityCalculated: "HIGH",
  cvssScore: 8.2,
  status: "OPEN",
  owaspCategory: "A03",
  createdAt: new Date().toISOString(),
  projectId: "project-1",
  projectName: "Projeto",
  applicationId: "application-1",
  applicationName: "Aplicação",
  companyId: "company-1",
  companyName: "Empresa",
  slaState: "ON_TRACK",
  slaDueAt: null,
  slaRemainingMs: null,
  vrsScore: null,
  vrsBand: null,
  hasActiveRiskAcceptance: false,
  assignedTo: null,
  assigneeName: null,
};

function renderMenu() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AssigneeMenu finding={finding} usuarioAtual={null} onAssign={vi.fn()} />
    </QueryClientProvider>,
  );
}

afterEach(() => assignees.mockReset());

describe("AssigneeMenu", () => {
  it("não busca candidatos ao montar e busca uma vez ao abrir", async () => {
    assignees.mockResolvedValue([{ id: "user-1", name: "Ana" }]);
    const user = userEvent.setup();
    renderMenu();

    expect(assignees).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Atribuir" }));
    await screen.findByRole("menuitem", { name: "Atribuir a Ana" });
    await waitFor(() => expect(assignees).toHaveBeenCalledTimes(1));
  });
});
