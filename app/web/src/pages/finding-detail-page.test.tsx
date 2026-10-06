/**
 * finding-detail-page.test.tsx
 *
 * O QUE FAZ: verifica a recuperação do detalhe após uma leitura que falhou.
 * POR QUE EXISTE: "Tentar novamente" precisa consultar o mesmo finding e
 * manter a pessoa na página em que pediu os dados.
 * QUEM CONSOME: suíte Vitest do frontend e regressão de navegação de findings.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { createQueryClient } from "../lib/query-client";
import { useAuthStore } from "../store/auth.store";
import type { Vulnerability } from "../types/vulnerability.types";
import { FindingDetailPage } from "./finding-detail-page";

const api = vi.hoisted(() => ({ getById: vi.fn() }));
vi.mock("../lib/api/vulnerabilities.api", () => ({ vulnerabilitiesApi: { getById: api.getById } }));

// Estes painéis têm consultas próprias; aqui importa a recuperação do finding.
vi.mock("../components/findings/risk-acceptance-panel", () => ({ RiskAcceptancePanel: () => null }));
vi.mock("../components/findings/how-to-fix-panel", () => ({ HowToFixPanel: () => null }));
vi.mock("../components/findings/evidence-uploader", () => ({ EvidenceUploader: () => null }));
vi.mock("../components/findings/comment-timeline", () => ({ CommentTimeline: () => null }));
vi.mock("../components/findings/audit-trail", () => ({ AuditTrail: () => null }));
vi.mock("../components/findings/override-severity-dialog", () => ({ OverrideSeverityDialog: () => null }));

const clients: QueryClient[] = [];
const finding: Vulnerability = {
  id: "finding-1", title: "Finding recuperado", description: "Descrição do finding recuperado",
  owaspCategory: "A01", cvssVector: null, cvssScore: null,
  severityCalculated: "MEDIUM", severityFinal: "MEDIUM", severityOverrideReason: null,
  impact: null, recommendation: null, status: "OPEN", aiAssisted: false,
  projectId: "project-1", applicationId: "app-1", companyId: "company-1",
  createdBy: "user-1", assignedTo: null,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    accessToken: "token", refreshToken: "refresh",
    user: { id: "user-1", name: "Cliente", email: "client@vulnera.test", role: "CLIENT",
      companyId: "company-1", createdAt: "2026-09-01T00:00:00.000Z" },
  });
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
});

describe("Recuperação do detalhe de finding", () => {
  it("FIND-RETRY-01 — Tentar novamente refaz o GET e permanece no detalhe", async () => {
    const initialError = new AxiosError("Falha inicial", AxiosError.ERR_BAD_RESPONSE, undefined, undefined, {
      status: 404, statusText: "Not Found", data: { error: "VULNERABILITY_NOT_FOUND" },
      headers: {}, config: { headers: new AxiosHeaders() },
    });
    api.getById.mockRejectedValueOnce(initialError).mockResolvedValue(finding);
    const client = createQueryClient();
    clients.push(client);
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/projects", "/findings/finding-1"]} initialIndex={1}>
          <Routes>
            <Route path="/projects" element={<p>Página anterior de projetos</p>} />
            <Route path="/findings/:id" element={<FindingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível abrir este finding");
    expect(api.getById).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("heading", { name: "Finding recuperado" })).toBeInTheDocument();
    expect(api.getById).toHaveBeenCalledTimes(2);
    expect(api.getById).toHaveBeenNthCalledWith(1, "finding-1");
    expect(api.getById).toHaveBeenNthCalledWith(2, "finding-1");
    expect(screen.queryByText("Página anterior de projetos")).not.toBeInTheDocument();
  });
});
