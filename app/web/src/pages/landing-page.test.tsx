/**
 * landing-page.test.tsx
 *
 * A landing pública é uma tela de apresentação (ADR-026) que carrega `gsap` e,
 * por lazy, a cena `three` — nenhum roda em jsdom. Aqui o GSAP é mockado e o
 * hook da cena é trocado por um falso com o mesmo contrato (cria e remove um
 * canvas): o que se testa é a ESTRUTURA da página (navbar, seções, CTAs, tema)
 * e quando a cena monta, não o shader (validado no navegador).
 *
 *   LAND-01  a navbar da landing renderiza (marca "VULNERA")
 *   LAND-02  o CTA principal do hero leva pra /register
 *   LAND-03  as seções-âncora renderizam (como funciona, recursos, planos, time)
 *   LAND-04  o toggle de tema usa o ThemeProvider do app (estampa data-theme)
 *   LAND-05  os CTAs de plano levam pra /register
 *   LAND-06  os links de LinkedIn do time abrem em nova aba com rel seguro
 *   LAND-08  sem WebGL2: pôster estático, nenhum canvas, nenhuma intro
 *   LAND-09  com WebGL2: um canvas da cena (lazy); movimento reduzido: pôster
 *   LAND-10  sair da landing para /login não deixa canvas para trás
 *   LAND-11  com a cena pronta, o pôster (~5 mil spans) sai do DOM depois
 *            do esmaecimento — não re-renderiza durante a rolagem
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { instalarMatchMedia } from "../test/setup";
import { ThemeProvider } from "../design/theme-provider";
import { LandingPage } from "./landing-page";

// A landing inteira entra por um único `lazy()`; a primeira resolução paga a
// transformação de `three` + `gsap` + `motion` + as 11 seções. Fora do orçamento
// de 5s padrão quando a suíte roda inteira e em paralelo.
vi.setConfig({ testTimeout: 20000 });

// Contrato do hook real: cria um canvas no contêiner e o remove no descarte.
vi.mock("../components/landing/scene/use-landing-scene", async () => {
  const { useEffect } = await import("react");
  return {
    useLandingScene: (host: { current: HTMLElement | null }, opcoes: { onReady?: () => void }) => {
      useEffect(() => {
        const canvas = document.createElement("canvas");
        canvas.dataset.landingScene = "true";
        host.current?.append(canvas);
        opcoes.onReady?.();
        return () => canvas.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
    },
  };
});
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
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { create: () => undefined, refresh: () => undefined } }));
vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
  instalarMatchMedia();
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

// Aquece o `lazy()` uma vez: transforma e cacheia o grafo da landing (e o
// chunk da cena) antes de qualquer asserção com timeout.
beforeAll(async () => {
  await import("../components/landing/landing-root");
  await import("../components/landing/scene/landing-scene-canvas");
}, 60000);

const canvasDaCena = () => document.querySelectorAll("canvas[data-landing-scene]");

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

  it("LAND-08 — sem WebGL2: pôster estático, nenhum canvas e nenhuma intro", async () => {
    expect("WebGL2RenderingContext" in window).toBe(false);
    renderLanding();
    await screen.findByRole("heading", { name: "Como funciona" }, ESPERA);
    const camada = document.querySelector("[data-landing-cena]")!;
    expect(camada).toHaveAttribute("data-landing-cena", "poster");
    expect(camada).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelector("[data-landing-poster] pre")).not.toBeNull();
    expect(canvasDaCena()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Pular introdução/ })).not.toBeInTheDocument();
  });

  it("LAND-09 — com WebGL2 monta um canvas; com movimento reduzido, só o pôster", async () => {
    vi.stubGlobal("WebGL2RenderingContext", class {});
    const { unmount } = renderLanding();
    await waitFor(() => expect(canvasDaCena()).toHaveLength(1), ESPERA);
    expect(document.querySelector("[data-landing-cena]")).toHaveAttribute("data-landing-cena", "webgl");
    // LAND-11: a cena (mock) avisa pronta; o pôster esmaece e sai do DOM.
    await waitFor(() => expect(document.querySelector("[data-landing-poster]")).toBeNull(), ESPERA);
    unmount();

    instalarMatchMedia(["prefers-reduced-motion: reduce"]);
    renderLanding();
    await screen.findByRole("heading", { name: "Como funciona" }, ESPERA);
    expect(document.querySelector("[data-landing-cena]")).toHaveAttribute("data-landing-cena", "poster");
    expect(canvasDaCena()).toHaveLength(0);
  });

  it("LAND-10 — sair da landing para /login não deixa canvas para trás", async () => {
    vi.stubGlobal("WebGL2RenderingContext", class {});
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<h1>Tela de login</h1>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    await waitFor(() => expect(canvasDaCena()).toHaveLength(1), ESPERA);
    await user.click(screen.getByRole("link", { name: "Entrar" }));
    expect(await screen.findByRole("heading", { name: "Tela de login" })).toBeInTheDocument();
    expect(document.querySelectorAll("canvas")).toHaveLength(0);
  });
});
