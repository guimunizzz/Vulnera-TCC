/**
 * posteres.test.ts — as peças puras dos pôsteres em canvas 2D.
 *   APO-01  marching squares: um nível que corta a célula vira um segmento
 *           nas bordas certas; nível fora da faixa, nenhum
 *   APO-02  a projeção põe o alvo da câmera no centro e descarta o que está atrás
 *   APO-03  ruído e semente são determinísticos (o pôster não muda sozinho)
 */

import { describe, expect, it } from "vitest";
import { criarProjecao, fbm2, ruido2, segmentosDeNivel, sementeAleatoria } from "./posteres";

describe("pôsteres", () => {
  it("APO-01 — marching squares de uma célula", () => {
    // Rampa da esquerda (0) para a direita (2): o nível 1 corta no meio, vertical.
    const [segmento, ...resto] = segmentosDeNivel(0, 2, 2, 0, 1);
    expect(resto).toHaveLength(0);
    expect(segmento).toEqual([[0.5, 0], [0.5, 1]]);
    expect(segmentosDeNivel(0, 2, 2, 0, 5)).toHaveLength(0);
    // Sela (cantos alternados): dois segmentos.
    expect(segmentosDeNivel(0, 2, 0, 2, 1)).toHaveLength(2);
  });

  it("APO-02 — projeção como a PerspectiveCamera", () => {
    const projetar = criarProjecao([0, 0, 10], [0, 0, 0], 50, 800, 600);
    const centro = projetar([0, 0, 0])!;
    expect(centro[0]).toBeCloseTo(400);
    expect(centro[1]).toBeCloseTo(300);
    expect(centro[2]).toBeCloseTo(10);
    // Acima do alvo sobe na tela (y menor); à direita vai para a direita.
    expect(projetar([0, 1, 0])![1]).toBeLessThan(300);
    expect(projetar([1, 0, 0])![0]).toBeGreaterThan(400);
    expect(projetar([0, 0, 20])).toBeNull();
  });

  it("APO-03 — determinístico", () => {
    const a = sementeAleatoria(7);
    const b = sementeAleatoria(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(ruido2(1.3, -4.2)).toBe(ruido2(1.3, -4.2));
    for (let i = 0; i < 50; i++) {
      const v = fbm2(i * 0.37, i * -0.21);
      expect(Math.abs(v)).toBeLessThanOrEqual(1);
    }
  });
});
