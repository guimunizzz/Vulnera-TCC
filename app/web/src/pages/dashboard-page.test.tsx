/**
 * dashboard-page.test.tsx
 *
 * O QUE FAZ
 * Protege o roteamento dos três papéis, o cabeçalho compacto compartilhado
 * (Fase 5 do refactor web-motion-3d), os atalhos por papel e o contrato de
 * degradação da atmosfera.
 *
 * POR QUE EXISTE
 * O redesign visual não pode trocar o conteúdo de um papel, expor o canvas à
 * acessibilidade nem depender de WebGL quando há movimento reduzido.
 *
 * QUEM CONSOME
 * A suíte Vitest do frontend (`npm test`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import type { UserRole } from "../types/auth.types";
import { DashboardPage } from "./dashboard-page";

const preferenciaMovimento = vi.hoisted(() => ({ reduzido: false }));
const resumo = vi.hoisted(() => ({ criticosAbertos: 0, carregando: false }));

vi.mock("../hooks/use-findings", () => ({
  STATUS_ABERTOS: ["OPEN", "IN_PROGRESS", "FIXED"],
  useFindingsResumo: () => resumo,
}));

vi.mock("../motion/use-motion", async () => {
  const original = await vi.importActual<typeof import("../motion/use-motion")>("../motion/use-motion");
  return {
    ...original,
    useMotion: () => ({ ...original.useMotion(), reduzido: preferenciaMovimento.reduzido }),
  };
});

// O contrato aqui é o da PÁGINA (canvas decorativo, único, gate). A cena em si
// é coberta por use-dashboard-scene.test.tsx e pelos testes de src/three/.
vi.mock("../components/dashboard/hero/use-dashboard-scene", () => ({ useDashboardScene: () => undefined }));

vi.mock("../components/dashboard/admin-dashboard", () => ({
  AdminDashboard: () => <p>Conteúdo ADMIN</p>,
}));
vi.mock("../components/dashboard/client-dashboard", () => ({
  ClientDashboard: () => <p>Conteúdo CLIENT</p>,
}));
vi.mock("../components/dashboard/pentester-dashboard", () => ({
  PentesterDashboard: () => <p>Conteúdo PENTESTER</p>,
}));

function dashboardLayout() {
  return (
    <ThemeProvider>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </ThemeProvider>
  );
}

function renderDashboard(role: UserRole) {
  useAuthStore.setState({
    accessToken: "token-teste",
    refreshToken: "refresh-teste",
    user: {
      id: `user-${role.toLowerCase()}`,
      name: "Rafael",
      email: `${role.toLowerCase()}@vulnera.test`,
      role,
      companyId: role === "ADMIN" ? null : "company-1",
      createdAt: new Date().toISOString(),
    },
  });

  return render(dashboardLayout());
}

function definirLarguraDaJanela(largura: number): void {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: largura,
  });
}

function instalarMatchMedia(resultado: (query: string) => boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: resultado(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList),
  });
}

/** O gate só monta o canvas com WebGL2; o jsdom não o expõe. */
function simularWebGL2(): void {
  vi.stubGlobal("WebGL2RenderingContext", class {});
}

function simularViewportMovel(): void {
  definirLarguraDaJanela(375);
  instalarMatchMedia((query) => query.includes("max-width: 767px"));
}

beforeEach(() => {
  definirLarguraDaJanela(1024);
  instalarMatchMedia(() => false);
});

afterEach(() => {
  preferenciaMovimento.reduzido = false;
  resumo.criticosAbertos = 0;
  resumo.carregando = false;
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  definirLarguraDaJanela(1024);
  instalarMatchMedia(() => false);
});

describe("DashboardPage", () => {
  it("DASH-VIS-01 — continua roteando ADMIN corretamente", () => {
    renderDashboard("ADMIN");

    expect(screen.getByText("Conteúdo ADMIN")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo CLIENT")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
  });

  it("DASH-VIS-02 — continua roteando CLIENT corretamente", () => {
    renderDashboard("CLIENT");

    expect(screen.getByText("Conteúdo CLIENT")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo PENTESTER")).not.toBeInTheDocument();
  });

  it("DASH-VIS-03 — continua roteando PENTESTER corretamente", () => {
    renderDashboard("PENTESTER");

    expect(screen.getByText("Conteúdo PENTESTER")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo ADMIN")).not.toBeInTheDocument();
  });

  it("DASH-VIS-04 — canvas lazy é estritamente decorativo", async () => {
    simularWebGL2();
    renderDashboard("ADMIN");

    await waitFor(() => {
      const canvas = document.querySelector("canvas[data-dashboard-ambient='true']");
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute("aria-hidden", "true");
      expect(canvas).toHaveClass("pointer-events-none");
    });
  });

  it("DASH-VIS-05 — movimento reduzido mantém fallback e não monta canvas", () => {
    preferenciaMovimento.reduzido = true;
    renderDashboard("ADMIN");

    expect(document.querySelector(".dashboard-atmosphere-fallback")).toBeInTheDocument();
    expect(document.querySelector("canvas[data-dashboard-ambient='true']")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
  });

  it("DASH-VIS-06 — viewport móvel mantém a atmosfera CSS sem montar canvas", () => {
    simularViewportMovel();
    renderDashboard("CLIENT");

    expect(document.querySelector(".dashboard-atmosphere-fallback")).toBeInTheDocument();
    expect(document.querySelector("canvas[data-dashboard-ambient='true']")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
  });

  it("DASH-VIS-07 — canvas único sobrevive a rerender e remount sem duplicação", async () => {
    simularWebGL2();
    const view = renderDashboard("ADMIN");

    await waitFor(() => {
      expect(document.querySelectorAll("canvas[data-dashboard-ambient='true']")).toHaveLength(1);
    });

    view.rerender(dashboardLayout());
    expect(document.querySelectorAll("canvas[data-dashboard-ambient='true']")).toHaveLength(1);

    view.unmount();
    expect(document.querySelectorAll("canvas[data-dashboard-ambient='true']")).toHaveLength(0);

    const remount = renderDashboard("ADMIN");
    await waitFor(() => {
      expect(document.querySelectorAll("canvas[data-dashboard-ambient='true']")).toHaveLength(1);
    });
    remount.unmount();
  });

  it("DASH-VIS-08 — sem WebGL2 mantém o fallback e não monta canvas", async () => {
    // jsdom não expõe WebGL2: este é o caminho normal de degradação da cena.
    // Desde o kit (Fase 2), o gate decide antes do lazy: sem WebGL2 o chunk de
    // three nem é pedido, então não existe canvas vazio por cima do fallback.
    expect("WebGL2RenderingContext" in window).toBe(false);
    renderDashboard("ADMIN");

    expect(document.querySelector(".dashboard-atmosphere-fallback")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
    // Dá tempo a um eventual lazy resolver antes de afirmar a ausência.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.querySelector("canvas[data-dashboard-ambient='true']")).not.toBeInTheDocument();
  });

  it("DASH-VIS-09 — compartilha o mesmo cabeçalho entre os três papéis, com o escopo de cada um", () => {
    const escopos: Record<UserRole, string> = {
      ADMIN: "Visão geral da plataforma",
      CLIENT: "Visão geral da empresa",
      PENTESTER: "Sua operação",
    };

    for (const role of Object.keys(escopos) as UserRole[]) {
      const view = renderDashboard(role);

      expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
      expect(screen.getByText(escopos[role])).toBeInTheDocument();
      expect(document.querySelector(".dashboard-atmosphere-fallback")).toBeInTheDocument();

      view.unmount();
    }
  });

  it("DASH-VIS-10 — linha de contexto leva ao recorte dos críticos em aberto", () => {
    resumo.criticosAbertos = 3;
    renderDashboard("ADMIN");

    expect(screen.getByText("3 críticos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Revisar críticos" })).toHaveAttribute(
      "href",
      "/findings?severity=CRITICAL&status=OPEN,IN_PROGRESS,FIXED",
    );
  });

  it("DASH-VIS-11 — sem crítico: mensagem calma e atalho para a triagem geral", () => {
    renderDashboard("CLIENT");

    expect(screen.getByText("Nenhum finding crítico em aberto no seu escopo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar findings" })).toHaveAttribute("href", "/findings");
  });

  it("DASH-VIS-12 — atalhos só para as rotas que o papel pode abrir", () => {
    const atalhos = (role: UserRole) => {
      const view = renderDashboard(role);
      const nav = screen.getByRole("navigation", { name: "Continue seu trabalho" });
      const rotulos = within(nav).getAllByRole("link").map((link) => link.textContent);
      view.unmount();
      return rotulos;
    };

    expect(atalhos("ADMIN")).toEqual(["Aplicações", "Projetos", "Findings"]);
    expect(atalhos("CLIENT")).toEqual(["Aplicações", "Projetos", "Findings"]);
    // /applications é ADMIN/CLIENT; o pentester ganha DAST no lugar.
    expect(atalhos("PENTESTER")).toEqual(["Projetos", "Findings", "DAST"]);
  });
});
