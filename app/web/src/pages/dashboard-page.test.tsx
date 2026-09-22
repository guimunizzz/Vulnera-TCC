/**
 * dashboard-page.test.tsx
 *
 * O QUE FAZ
 * Protege o roteamento dos três papéis e o contrato de degradação do hero
 * compartilhado do dashboard.
 *
 * POR QUE EXISTE
 * O redesign visual não pode trocar o conteúdo de um papel, expor o canvas à
 * acessibilidade nem depender de WebGL quando há movimento reduzido.
 *
 * QUEM CONSOME
 * A suíte Vitest do frontend (`npm test`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../design/theme-provider";
import { useAuthStore } from "../store/auth.store";
import type { UserRole } from "../types/auth.types";
import { DashboardPage } from "./dashboard-page";

const preferenciaMovimento = vi.hoisted(() => ({ reduzido: false }));

vi.mock("../motion/use-motion", async () => {
  const original = await vi.importActual<typeof import("../motion/use-motion")>("../motion/use-motion");
  return {
    ...original,
    useMotion: () => ({ ...original.useMotion(), reduzido: preferenciaMovimento.reduzido }),
  };
});

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
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
  vi.restoreAllMocks();
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

    expect(screen.getByTestId("dashboard-hero-fallback")).toBeInTheDocument();
    expect(document.querySelector("canvas[data-dashboard-ambient='true']")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
  });

  it("DASH-VIS-06 — viewport móvel mantém a atmosfera CSS sem montar canvas", () => {
    simularViewportMovel();
    renderDashboard("CLIENT");

    expect(screen.getByTestId("dashboard-hero-fallback")).toBeInTheDocument();
    expect(document.querySelector("canvas[data-dashboard-ambient='true']")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
  });

  it("DASH-VIS-07 — canvas único sobrevive a rerender e remount sem duplicação", async () => {
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

  it("DASH-VIS-08 — mantém o fallback quando WebGL2 não está disponível", async () => {
    // jsdom não expõe WebGL2: este é o caminho normal de degradação da cena.
    expect("WebGL2RenderingContext" in window).toBe(false);
    renderDashboard("ADMIN");

    expect(screen.getByTestId("dashboard-hero-fallback")).toBeInTheDocument();
    await waitFor(() => {
      const canvas = document.querySelector("canvas[data-dashboard-ambient='true']");
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute("data-ready", "false");
    });
  });

  it("DASH-VIS-09 — compartilha a mesma abertura visual entre os três papéis", () => {
    const roles: UserRole[] = ["ADMIN", "CLIENT", "PENTESTER"];

    for (const role of roles) {
      const view = renderDashboard(role);

      expect(screen.getByRole("heading", { name: "Olá, Rafael" })).toBeInTheDocument();
      expect(screen.getByText("Bem-vindo à Vulnera. Esta é a sua área de trabalho.")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-hero-fallback")).toBeInTheDocument();

      view.unmount();
    }
  });
});
