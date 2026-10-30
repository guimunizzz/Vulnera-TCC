/**
 * gsap-setup.test.ts
 *
 *   MOT-01  os plugins do GSAP são registrados uma única vez, por gsap.ts, não
 *           importa quantas seções o importem (antes, maturity.tsx dependia de
 *           how-it-works.tsx ter sido importado primeiro)
 */

import { describe, expect, it, vi } from "vitest";

const registro = vi.hoisted(() => ({ registerPlugin: vi.fn() }));

vi.mock("gsap", () => ({ default: { registerPlugin: registro.registerPlugin } }));
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { nome: "ScrollTrigger" } }));
vi.mock("@gsap/react", () => ({ useGSAP: { nome: "useGSAP" } }));

describe("Setup do GSAP", () => {
  it("MOT-01 — registra ScrollTrigger e useGSAP uma vez só", async () => {
    // Ordem invertida de propósito: Maturidade antes de Como funciona.
    await import("../sections/maturity");
    await import("../sections/how-it-works");
    await import("../sections/final-cta");
    await import("./gsap");

    expect(registro.registerPlugin).toHaveBeenCalledTimes(1);
    expect(registro.registerPlugin).toHaveBeenCalledWith({ nome: "ScrollTrigger" }, { nome: "useGSAP" });
    // Importa as seções inteiras: com o cache frio e workers em paralelo, a
    // transformação passa dos 5 s padrão (mesmo prazo de landing-page.test).
  }, 20_000);
});
