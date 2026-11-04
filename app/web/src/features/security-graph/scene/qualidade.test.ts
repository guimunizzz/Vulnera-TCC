import { describe, expect, it } from "vitest";
import { proximoNivel, QUADRO_LENTO_MS } from "./qualidade";

describe("proximoNivel", () => {
  it("mantém a qualidade enquanto os quadros estão rápidos", () => {
    expect(proximoNivel(16.7, 0)).toBe(0);
    expect(proximoNivel(QUADRO_LENTO_MS, 0)).toBe(0);
  });

  it("desce um nível por janela lenta e para no mínimo", () => {
    expect(proximoNivel(40, 0)).toBe(1);
    expect(proximoNivel(40, 1)).toBe(2);
    expect(proximoNivel(40, 2)).toBe(2);
  });

  it("nunca sobe de volta, mesmo com quadros rápidos", () => {
    expect(proximoNivel(10, 2)).toBe(2);
  });
});
