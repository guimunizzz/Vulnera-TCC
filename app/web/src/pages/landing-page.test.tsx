/**
 * landing-page.test.tsx
 *
 * Cobre o Checkpoint 2 do fix/landing-publica: o estado condicional da navbar
 * lendo o Zustand, e a garantia de que "Iniciar Análise"/"Entrar" nunca
 * competem com "Ir para o Dashboard" ao mesmo tempo.
 *
 *   LAND-01  sem sessão — "Entrar" (secundário, -> /login) e "Iniciar Análise"
 *            (primário, -> /register) aparecem; "Ir para o Dashboard" não
 *   LAND-02  com sessão — só "Ir para o Dashboard" (-> /dashboard) aparece
 */

import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LandingPage } from "./landing-page";
import { useAuthStore } from "../store/auth.store";

function limparAuth(): void {
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null });
}

afterEach(limparAuth);

describe("LandingPage", () => {
  it("LAND-01 — sem sessão mostra Entrar e Iniciar Análise, não o atalho do Dashboard", () => {
    limparAuth();
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");

    // Aparece na navbar (sm) e no hero (lg) — os dois apontam pro cadastro.
    const iniciar = screen.getAllByRole("link", { name: "Iniciar Análise" });
    expect(iniciar.length).toBeGreaterThan(0);
    for (const link of iniciar) {
      expect(link).toHaveAttribute("href", "/register");
    }

    expect(screen.queryByRole("link", { name: "Ir para o Dashboard" })).not.toBeInTheDocument();
  });

  it("LAND-02 — com sessão mostra só o atalho pro Dashboard, sem Entrar nem Iniciar Análise", () => {
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

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    // Navbar (sm) e hero (lg) — os dois apontam pro dashboard.
    const dashboard = screen.getAllByRole("link", { name: "Ir para o Dashboard" });
    expect(dashboard.length).toBeGreaterThan(0);
    for (const link of dashboard) {
      expect(link).toHaveAttribute("href", "/dashboard");
    }

    expect(screen.queryByRole("link", { name: "Entrar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Iniciar Análise" })).not.toBeInTheDocument();
  });
});
