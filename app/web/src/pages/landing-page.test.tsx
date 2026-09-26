/**
 * landing-page.test.tsx
 *
 * A landing pública é uma tela de apresentação (ADR-026) que carrega `three`,
 * `@react-three/*` e `gsap` — nenhum roda em jsdom. Aqui esses módulos são
 * mockados: o que se testa é a ESTRUTURA da página (navbar, seções, para onde
 * os CTAs levam, integração com o tema do app), não a cena 3D nem as animações
 * de scroll (isso é responsabilidade das libs).
 *
 *   LAND-01  a navbar da landing renderiza (marca "VULNERA")
 *   LAND-02  o CTA principal do hero leva pra /register
 *   LAND-03  as seções-âncora renderizam (como funciona, recursos, planos, time)
 *   LAND-04  o toggle de tema usa o ThemeProvider do app (estampa data-theme)
 *   LAND-05  os CTAs de plano levam pra /register
 *   LAND-06  os links de LinkedIn do time abrem em nova aba com rel seguro
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../design/theme-provider";
import { LandingPage } from "./landing-page";

// A landing inteira entra por um único `lazy()`; a primeira resolução paga a
// transformação de `three` + `gsap` + `motion` + as 11 seções. Fora do orçamento
// de 5s padrão quando a suíte roda inteira e em paralelo.
vi.setConfig({ testTimeout: 20000 });

vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
  useFrame: () => undefined,
}));
vi.mock("@react-three/drei", () => ({
  Points: () => null,
  PointMaterial: () => null,
}));
vi.mock("gsap", () => ({
  default: {
    registerPlugin: () => undefined,
    from: () => undefined,
    to: () => undefined,
    fromTo: () => undefined,
    set: () => undefined,
    utils: { toArray: () => [] },
  },
}));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { create: () => undefined } }));
vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));

beforeEach(() => {
  // Pula a intro 3D (só aparece uma vez por sessão). Se o ambiente não tiver
  // sessionStorage utilizável, instala um mínimo.
  try {
    window.sessionStorage.setItem("vx-intro-seen", "1");
  } catch {
    const mapa = new Map<string, string>();
    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: (k: string) => mapa.get(k) ?? null,
        setItem: (k: string, v: string) => void mapa.set(k, v),
        removeItem: (k: string) => void mapa.delete(k),
        clear: () => mapa.clear(),
        key: () => null,
        length: 0,
      },
      writable: true,
      configurable: true,
    });
    window.sessionStorage.setItem("vx-intro-seen", "1");
  }
  document.documentElement.removeAttribute("data-theme");
  window.history.replaceState(null, "", "/");
});

function renderLanding() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const ESPERA = { timeout: 10000 } as const;

// Aquece o `lazy()` uma vez: transforma e cacheia o grafo da landing antes de
// qualquer asserção com timeout.
beforeAll(async () => {
  await import("../components/landing/landing-root");
});

describe("LandingPage", () => {
  it("LAND-01 — a navbar da landing renderiza", async () => {
    renderLanding();
    // `lazy()` — o conteúdo só entra depois que o chunk resolve.
    const marcas = await screen.findAllByText(/VULNERA/, undefined, ESPERA);
    expect(marcas.length).toBeGreaterThan(0);
  });

  it("LAND-02 — o CTA principal do hero leva pra /register", async () => {
    renderLanding();
    const cta = await screen.findByRole("link", { name: /INICIAR ANÁLISE/ }, ESPERA);
    expect(cta).toHaveAttribute("href", "/register");
  });

  it("LAND-03 — as seções renderizam", async () => {
    renderLanding();
    expect(await screen.findByRole("heading", { name: "Como funciona" }, ESPERA)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Killer features" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Planos que cabem na sua empresa." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O time por trás do Vulnera." })).toBeInTheDocument();
  });

  it("LAND-04 — o toggle de tema estampa data-theme via ThemeProvider", async () => {
    const user = userEvent.setup();
    renderLanding();

    const toggle = await screen.findByRole("button", { name: /tema/ }, ESPERA);
    await user.click(toggle);
    expect(["dark", "light"]).toContain(document.documentElement.getAttribute("data-theme"));

    const antes = document.documentElement.getAttribute("data-theme");
    await user.click(await screen.findByRole("button", { name: /tema/ }));
    expect(document.documentElement.getAttribute("data-theme")).not.toBe(antes);
  });

  it("LAND-05 — os CTAs de plano levam pra /register", async () => {
    renderLanding();
    const pro = await screen.findByRole("link", { name: "Começar com Pro" }, ESPERA);
    expect(pro).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Começar com Basic" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("LAND-06 — os links de LinkedIn do time abrem em nova aba com rel seguro", async () => {
    renderLanding();
    const rafael = await screen.findByRole("link", { name: /Rafael no LinkedIn/ }, ESPERA);
    expect(rafael).toHaveAttribute("target", "_blank");
    expect(rafael).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("LAND-07 — links da navbar levam às seções e o menu Produto continua utilizável", async () => {
    const user = userEvent.setup();
    renderLanding();
    const nav = await screen.findByRole("navigation", { name: "Navegação principal" }, ESPERA);

    await user.click(within(nav).getByRole("link", { name: "Planos" }));
    expect(window.location.hash).toBe("#planos");
    expect(document.getElementById("planos")?.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });

    await user.click(within(nav).getByRole("button", { name: "Produto" }));
    expect(within(nav).getByRole("button", { name: "Produto" })).toHaveAttribute("aria-expanded", "true");
    await user.click(within(nav).getByRole("link", { name: "Recursos" }));
    expect(window.location.hash).toBe("#recursos");
    expect(document.getElementById("recursos")?.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(within(nav).getByRole("button", { name: "Produto" })).toHaveAttribute("aria-expanded", "false");
  });
});
