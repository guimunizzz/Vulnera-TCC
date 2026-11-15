/**
 * threat-intel-page.test.tsx — página da Threat Intel (ADR-053) com a API
 * mockada: resumo, "Afeta você" (KEV, pré-existente, versão não confirmada),
 * permissões vindas da API, inventário com sugestões e o link seguro.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../design/theme-provider";
import { ThreatIntelPage } from "./threat-intel-page";
import { useAuthStore } from "../store/auth.store";
import type { AtivoTI, CasamentoTI, PermissoesThreatIntel, ResumoTI } from "../types/threat-intel.types";

const api = vi.hoisted(() => ({
  companies: vi.fn(),
  overview: vi.fn(),
  assets: vi.fn(),
  addAsset: vi.fn(),
  removeAsset: vi.fn(),
  confirmAsset: vi.fn(),
  dismissAsset: vi.fn(),
  confirmAll: vi.fn(),
  searchProducts: vi.fn(),
  matches: vi.fn(),
  triage: vi.fn(),
  promotionDraft: vi.fn(),
  promote: vi.fn(),
  feed: vi.fn(),
  syncStatus: vi.fn(),
  syncNow: vi.fn(),
}));
vi.mock("../lib/api/threat-intel.api", () => ({ threatIntelApi: api, notificationsApi: {} }));

const TODAS: PermissoesThreatIntel = { editarInventario: true, triar: true, promover: true, sincronizar: true };

function resumo(permissoes: PermissoesThreatIntel = TODAS): ResumoTI {
  return {
    companyId: "c1",
    permissoes,
    inventario: { confirmados: 2, sugeridos: 1, descartados: 0 },
    casamentos: { porTriagem: { NEW: 2 }, kevAbertos: 1, criticosAbertos: 2, novosSemana: 1 },
    ultimaExecucao: null,
    sincronizando: false,
  };
}

function casamento(over: Partial<CasamentoTI> & { id: string }): CasamentoTI {
  return {
    advisory: {
      id: "CVE-2021-23337",
      aliases: ["GHSA-35jh-r3h4-6jhm"],
      source: "OSV",
      title: "Command Injection in lodash",
      description: "Texto <script>alert(1)</script> da fonte",
      cvssScore: 7.2,
      cvssVersion: "3.1",
      cvssVector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H",
      severity: "HIGH",
      cweId: "77",
      publishedAt: "2021-05-06T16:05:51Z",
      references: ["https://nvd.nist.gov/vuln/detail/CVE-2021-23337", "javascript:alert(1)"],
      kev: false,
      kevAddedAt: null,
      kevDueDate: null,
      kevRansomware: false,
      epssScore: 0.2,
      epssPercentile: 0.96,
    },
    asset: { id: "a1", displayName: "lodash 4.17.15 (npm)", kind: "PACKAGE", version: "4.17.15" },
    versionConfirmed: true,
    preexisting: true,
    fixedVersion: "4.17.21",
    triageStatus: "NEW",
    triageNote: null,
    triagedByName: null,
    triagedAt: null,
    createdAt: "2026-11-15T00:00:00Z",
    promotedVulnerability: null,
    ...over,
  };
}

const ATIVOS: AtivoTI[] = [
  {
    id: "a1", kind: "PACKAGE", ecosystem: "npm", packageName: "lodash", cpePart: null, cpeVendor: null, cpeProduct: null, version: "4.17.15",
    displayName: "lodash 4.17.15 (npm)", status: "CONFIRMED", source: "SBOM", sourceRef: "imp", confirmedAt: "2026-11-15T00:00:00Z",
    lastSyncedAt: "2026-11-15T00:00:00Z", createdAt: "2026-11-15T00:00:00Z", casamentos: 5,
  },
  {
    id: "a2", kind: "PRODUCT", ecosystem: null, packageName: null, cpePart: "a", cpeVendor: "f5", cpeProduct: "nginx", version: "1.27.5",
    displayName: "f5 nginx 1.27.5", status: "SUGGESTED", source: "FINGERPRINT", sourceRef: "scan", confirmedAt: null,
    lastSyncedAt: null, createdAt: "2026-11-15T00:00:00Z", casamentos: 0,
  },
];

function renderPage(url = "/threat-intel?empresa=c1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/threat-intel" element={<ThreatIntelPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: { id: "u", name: "Admin", email: "a@a", role: "ADMIN" } as never });
  api.companies.mockResolvedValue([{ id: "c1", name: "TechNova" }, { id: "c2", name: "Outra" }]);
  api.overview.mockResolvedValue(resumo());
  api.matches.mockResolvedValue([
    casamento({ id: "m1" }),
    casamento({
      id: "m2",
      preexisting: false,
      versionConfirmed: false,
      advisory: { ...casamento({ id: "x" }).advisory, id: "CVE-2026-0001", kev: true, kevAddedAt: "2026-11-14T00:00:00Z", severity: "CRITICAL", cvssScore: 9.8 },
    }),
  ]);
  api.assets.mockResolvedValue(ATIVOS);
  api.triage.mockResolvedValue(casamento({ id: "m1", triageStatus: "FALSE_POSITIVE" }));
});

describe("Threat Intel", () => {
  it("mostra o resumo e as CVEs com KEV, pré-existente e versão não confirmada", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "CVEs que afetam o que você usa" })).toBeInTheDocument();
    const kev = (await screen.findByText("CVE-2026-0001")).closest("tr")!;
    expect(within(kev).getByText("KEV")).toBeInTheDocument();
    expect(within(kev).getByText("versão não confirmada")).toBeInTheDocument();
    const antiga = screen.getByText("CVE-2021-23337").closest("tr")!;
    expect(within(antiga).getByText("já existia ao mapear")).toBeInTheDocument();
    expect(within(antiga).getByText("4.17.21")).toBeInTheDocument();
    expect(api.matches).toHaveBeenCalledWith("c1", { triage: "NEW,CONFIRMED", kev: false });
  });

  it("detalhes: texto da fonte nunca vira HTML, link só http(s), e a triagem usa a rota da Threat Intel", async () => {
    renderPage();
    const linha = (await screen.findByText("CVE-2021-23337")).closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: "Detalhes" }));
    expect(screen.getByText("Texto <script>alert(1)</script> da fonte")).toBeInTheDocument();
    expect(screen.getByText("javascript:alert(1)").tagName).toBe("DD");
    expect(screen.queryByRole("link", { name: /javascript:/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Falso-positivo" }));
    await waitFor(() => expect(api.triage).toHaveBeenCalledWith("m1", "FALSE_POSITIVE", null));
    expect(screen.getByRole("button", { name: "Promover para vulnerabilidade" })).toBeInTheDocument();
  });

  it("sem permissão (CLIENT MEMBER): sem triagem, sem promover e sem editar inventário", async () => {
    useAuthStore.setState({ user: { id: "u", name: "Membro", email: "m@a", role: "CLIENT" } as never });
    api.overview.mockResolvedValue(resumo({ editarInventario: false, triar: false, promover: false, sincronizar: false }));
    renderPage("/threat-intel?empresa=c1");
    const linha = (await screen.findByText("CVE-2021-23337")).closest("tr")!;
    fireEvent.click(within(linha).getByRole("button", { name: "Detalhes" }));
    expect(screen.queryByRole("button", { name: "Falso-positivo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Promover para vulnerabilidade" })).not.toBeInTheDocument();
    // CLIENT não escolhe empresa.
    expect(screen.queryByRole("combobox", { name: /Empresa/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Inventário/ }));
    expect(await screen.findByText("lodash 4.17.15 (npm)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Adicionar tecnologia/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar f5 nginx/ })).not.toBeInTheDocument();
  });

  it("inventário: sugestão do fingerprint pode ser confirmada; vem de notificação com a CVE aberta", async () => {
    api.confirmAsset.mockResolvedValue({ ...ATIVOS[1], status: "CONFIRMED" });
    renderPage("/threat-intel?empresa=c1&aba=inventario");
    expect(await screen.findByText("Sugestões (1)")).toBeInTheDocument();
    expect(screen.getByText("Fingerprint DAST")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar f5 nginx 1.27.5" }));
    await waitFor(() => expect(api.confirmAsset).toHaveBeenCalledWith("a2"));
  });

  it("link de notificação abre a CVE apontada", async () => {
    renderPage("/threat-intel?empresa=c1&aba=afeta&match=m2");
    const linha = (await screen.findByText("CVE-2026-0001")).closest("tr")!;
    expect(within(linha).getByRole("button", { name: "Detalhes" })).toHaveAttribute("aria-expanded", "true");
  });
});
