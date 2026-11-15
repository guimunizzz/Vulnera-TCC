/**
 * gate.test.tsx
 *
 * Gate de montagem do kit three.js (Fase 2 do refactor web-motion-3d).
 *   KIT-13  monta com movimento normal, largura suficiente e WebGL2
 *   KIT-14  movimento reduzido não monta
 *   KIT-15  abaixo da largura mínima configurável não monta
 *   KIT-16  sem WebGL2 não monta (o chunk de three nem é pedido)
 *   KIT-17  alto contraste do menu de acessibilidade não monta (texto AAA)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { instalarMatchMedia } from "../test/setup";
import { definirPreferencias, restaurarPreferencias } from "../design/accessibility";

const preferencia = vi.hoisted(() => ({ reduzido: false }));
vi.mock("../motion/use-motion", () => ({ useMotion: () => ({ reduzido: preferencia.reduzido }) }));

import { useCenaPermitida } from "./gate";

function definirLargura(largura: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: largura });
}

beforeEach(() => {
  preferencia.reduzido = false;
  definirLargura(1440);
  instalarMatchMedia();
  vi.stubGlobal("WebGL2RenderingContext", class {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  restaurarPreferencias();
  instalarMatchMedia();
});

describe("useCenaPermitida", () => {
  it("KIT-13 — permite com movimento normal, largura suficiente e WebGL2", () => {
    expect(renderHook(() => useCenaPermitida()).result.current).toBe(true);
  });

  it("KIT-14 — movimento reduzido bloqueia", () => {
    preferencia.reduzido = true;
    expect(renderHook(() => useCenaPermitida()).result.current).toBe(false);
  });

  it("KIT-15 — largura abaixo do mínimo configurado bloqueia", () => {
    definirLargura(900);
    instalarMatchMedia(["max-width: 1023px"]);
    expect(renderHook(() => useCenaPermitida({ larguraMinima: 1024 })).result.current).toBe(false);
    expect(renderHook(() => useCenaPermitida({ larguraMinima: 768 })).result.current).toBe(true);
  });

  it("KIT-16 — sem WebGL2 bloqueia", () => {
    vi.unstubAllGlobals();
    expect("WebGL2RenderingContext" in window).toBe(false);
    expect(renderHook(() => useCenaPermitida()).result.current).toBe(false);
  });

  it("KIT-17 — alto contraste do menu de acessibilidade bloqueia", () => {
    definirPreferencias({ altoContraste: true });
    expect(renderHook(() => useCenaPermitida()).result.current).toBe(false);
  });
});
