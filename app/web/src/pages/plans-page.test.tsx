/**
 * O que faz: verifica os limites exibidos pelo catálogo público de planos.
 * Por que existe: evita regressão de singular/plural em capacidades zero, um e dois.
 * Quem consome: suíte Vitest do frontend para VUL-QA-01.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { plansApi } from "../lib/api/plans.api";
import { PlansPage } from "./plans-page";

vi.mock("../lib/api/plans.api", () => ({ plansApi: { list: vi.fn() } }));

describe("PlansPage", () => {
  it.each([
    [0, "aplicações", "projetos simultâneos"],
    [1, "aplicação", "projeto simultâneo"],
    [2, "aplicações", "projetos simultâneos"],
  ] as const)("VUL-QA-01 — flexiona capacidades de %i no catálogo", async (count, applications, projects) => {
    vi.mocked(plansApi.list).mockResolvedValue([{
      id: "plan-qa", name: "Plano QA", maxApplications: count, maxProjects: count,
      includesRemediation: false, price: 99, isActive: true, createdAt: "2026-01-01",
    }]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><PlansPage /></MemoryRouter></QueryClientProvider>);
    await screen.findByRole("heading", { name: "Plano QA" });
    const limits = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(limits[0]).toHaveTextContent(`Até ${count} ${applications}`);
    expect(limits[1]).toHaveTextContent(`Até ${count} ${projects}`);
  });
});
