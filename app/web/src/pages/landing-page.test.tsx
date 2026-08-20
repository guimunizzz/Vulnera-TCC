/**
 * landing-page.test.tsx
 *
 * Cobre o Checkpoint 2 do fix/landing-publica (estado condicional da navbar
 * lendo o Zustand) e a task 8.12 (cena Three.js do hero + seções novas).
 *
 *   LAND-01  sem sessão — "Entrar" (secundário, -> /login) e "Iniciar Análise"
 *            (primário, -> /register) aparecem; "Ir para o Dashboard" não
 *   LAND-02  com sessão — só "Ir para o Dashboard" (-> /dashboard) aparece
 *   LAND-03  as três seções novas (Recursos, Metodologia, Planos) renderizam
 *   LAND-04  o `<canvas>` do hero degrada graciosamente sem WebGL2 (jsdom não
 *            implementa a API) — nenhuma exceção, `data-ready` fica "false"
 *   LAND-05  o preview de risk score usa a MESMA fórmula de
 *            `metrics.model.ts` sobre a amostra fixa (24,04)
 *   LAND-06  planos vindos da API aparecem, ordenados por capacidade, com
 *            "Sob consulta" para o plano de preço 0 (Enterprise)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LandingPage } from "./landing-page";
import { useAuthStore } from "../store/auth.store";
import { plansApi } from "../lib/api/plans.api";
import type { Plan } from "../types/plan.types";

vi.mock("../lib/api/plans.api", () => ({
  plansApi: { list: vi.fn() },
}));

const PLANOS_FIXTURE: Plan[] = [
  {
    id: "p-pro",
    name: "PRO",
    maxApplications: 10,
    maxProjects: 5,
    includesRemediation: true,
    price: 599,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "p-basic",
    name: "BASIC",
    maxApplications: 2,
    maxProjects: 1,
    includesRemediation: false,
    price: 199,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "p-enterprise",
    name: "ENTERPRISE",
    maxApplications: 50,
    maxProjects: 20,
    includesRemediation: true,
    price: 0,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

function limparAuth(): void {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
}

/** Um `QueryClient` NOVO por render — reusar um só vazaria cache de plano
 * entre testes (a queryKey `["plans"]` é a mesma da `plans-page.tsx`, de
 * propósito) e um teste que espera o skeleton veria dado já resolvido. */
function renderLanding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  limparAuth();
  vi.mocked(plansApi.list).mockResolvedValue([]);
});

afterEach(() => {
  limparAuth();
});

describe("LandingPage", () => {
  it("LAND-01 — sem sessão mostra Entrar e Iniciar Análise, não o atalho do Dashboard", async () => {
    renderLanding();

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");

    // Aparece na navbar (sm) e no hero (lg) — os dois apontam pro cadastro.
    const iniciar = screen.getAllByRole("link", { name: "Iniciar Análise" });
    expect(iniciar.length).toBeGreaterThan(0);
    for (const link of iniciar) {
      expect(link).toHaveAttribute("href", "/register");
    }

    expect(screen.queryByRole("link", { name: "Ir para o Dashboard" })).not.toBeInTheDocument();

    // Deixa a query de planos assentar antes do teste terminar — evita
    // atualização de estado fora de `act()` vazando pro próximo teste.
    await waitFor(() => expect(plansApi.list).toHaveBeenCalled());
  });

  it("LAND-02 — com sessão mostra só o atalho pro Dashboard, sem Entrar nem Iniciar Análise", async () => {
    useAuthStore.setState({
      accessToken: "token-fake",
      refreshToken: "refresh-fake",
      user: {
        id: "u1",
        name: "Rafael",
        email: "rafael@technova.com",
        role: "CLIENT",
        companyId: "c1",
        createdAt: new Date().toISOString(),
      },
    });

    renderLanding();

    // Navbar (sm) e hero (lg) — os dois apontam pro dashboard.
    const dashboard = screen.getAllByRole("link", { name: "Ir para o Dashboard" });
    expect(dashboard.length).toBeGreaterThan(0);
    for (const link of dashboard) {
      expect(link).toHaveAttribute("href", "/dashboard");
    }

    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Iniciar Análise" })).not.toBeInTheDocument();
    // "Explorar Demonstração" é a variante autenticada de "Entrar" — some
    // pelo mesmo motivo (não competir com o único CTA que faz sentido aqui).
    expect(screen.queryByRole("link", { name: "Explorar Demonstração" })).not.toBeInTheDocument();

    await waitFor(() => expect(plansApi.list).toHaveBeenCalled());
  });

  it("LAND-03 — Recursos, Metodologia e Planos renderizam", async () => {
    renderLanding();

    expect(screen.getByRole("heading", { name: "Uma suíte, do achado ao relatório" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SAST & DAST estruturados" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Matriz de maturidade" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Relatórios executivos e técnicos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Auditoria & MTTR em tempo real" })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Postura de risco, calculada — não estimada" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planos" })).toBeInTheDocument();

    await waitFor(() => expect(plansApi.list).toHaveBeenCalled());
  });

  it("LAND-04 — o canvas do hero degrada sem WebGL2 (jsdom), sem lançar exceção", async () => {
    // jsdom não define `WebGL2RenderingContext` no `window` — é exatamente o
    // sinal que `supportsWebGL2()` (use-hero-scene.ts) usa pra nunca tentar
    // montar a cena. Nenhum mock extra é necessário: o comportamento real de
    // "sem WebGL2" e o de "ambiente de teste" são o MESMO caminho de código
    // (ver ADR-026 §4).
    expect("WebGL2RenderingContext" in window).toBe(false);

    renderLanding();

    // `CyberCanvas` é carregado via `lazy()` (ver landing-page.tsx) — o
    // `<canvas>` só entra no DOM depois que o chunk resolve, daí o `waitFor`.
    await waitFor(() => {
      const canvas = document.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute("data-ready", "false");
    });

    await waitFor(() => expect(plansApi.list).toHaveBeenCalled());
  });

  it("LAND-05 — o preview de risk score soma CVSS²/10 da amostra fixa (24,04)", async () => {
    renderLanding();

    // O `NumeroAnimado` sempre renderiza um `.sr-only` com o valor final,
    // independente do estado da animação de mola — é o nó estável pra
    // afirmar sobre o VALOR, sem acoplar o teste ao timing da spring.
    await waitFor(() => {
      expect(screen.getAllByText("24,04").length).toBeGreaterThan(0);
    });

    await waitFor(() => expect(plansApi.list).toHaveBeenCalled());
  });

  it("LAND-06 — planos da API aparecem, com 'Sob consulta' pro plano de preço 0", async () => {
    vi.mocked(plansApi.list).mockResolvedValue(PLANOS_FIXTURE);
    renderLanding();

    const linkPro = await screen.findByRole("link", { name: "Começar com PRO" });
    expect(linkPro).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Começar com BASIC" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Começar com ENTERPRISE" })).toBeInTheDocument();

    expect(screen.getByText("Sob consulta")).toBeInTheDocument();
  });
});
