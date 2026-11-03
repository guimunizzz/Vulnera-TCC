/**
 * gotas.test.ts
 *
 * Gota d'água das cenas ASCII (clique no fundo → ondulação):
 *   GOT-01  clique no fundo grava a gota em px do buffer (Y de baixo para cima)
 *           e a onda fica viva só pela duração
 *   GOT-02  clique em alvo interativo, botão direito ou por teclado não gera gota
 *   GOT-03  clique fora do canvas não gera gota
 *   GOT-04  a sétima gota substitui a mais antiga (anel de MAX_GOTAS)
 *   GOT-05  parar() remove o listener
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { criarGotas, GOTA, MAX_GOTAS, type Gotas } from "./gotas";

let ativas: Gotas[] = [];
let tempo = 0;

function montar(dpr = 2) {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, right: 900, bottom: 650, width: 800, height: 600, x: 100, y: 50, toJSON: () => ({}) });
  document.body.append(canvas);
  const aoCair = vi.fn();
  const gotas = criarGotas({ canvas, tempoAtual: () => tempo, dpr: () => dpr, aoCair });
  ativas.push(gotas);
  return { gotas, aoCair };
}

function clicar(x: number, y: number, init: MouseEventInit = {}, alvo: EventTarget = document.body) {
  alvo.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y, detail: 1, button: 0, ...init }));
}

afterEach(() => {
  ativas.forEach((g) => g.parar());
  ativas = [];
  tempo = 0;
  document.body.replaceChildren();
});

describe("criarGotas", () => {
  it("GOT-01 — grava a gota em px do buffer e a onda dura GOTA.duracao", () => {
    const { gotas, aoCair } = montar(2);
    tempo = 10;
    clicar(300, 150);
    const g = gotas.uniformes.uGotas.value;
    expect([g[0], g[1], g[2]]).toEqual([400, 1000, 10]);
    expect(gotas.uniformes.uDpr.value).toBe(2);
    expect(aoCair).toHaveBeenCalledTimes(1);
    expect(gotas.ativa(10 + GOTA.duracao / 2)).toBe(true);
    expect(gotas.ativa(10 + GOTA.duracao + 0.01)).toBe(false);
  });

  it("GOT-02 — alvo interativo, botão direito e teclado não fazem onda", () => {
    const { gotas, aoCair } = montar();
    const botao = document.createElement("button");
    const icone = document.createElement("span");
    botao.append(icone);
    const link = document.createElement("a");
    link.href = "#";
    document.body.append(botao, link);

    clicar(300, 150, {}, icone);
    clicar(300, 150, {}, link);
    clicar(300, 150, { button: 2 });
    clicar(300, 150, { detail: 0 });

    expect(aoCair).not.toHaveBeenCalled();
    expect(gotas.ativa(0)).toBe(false);
  });

  it("GOT-03 — clique fora do canvas não faz onda", () => {
    const { aoCair } = montar();
    clicar(50, 20);
    expect(aoCair).not.toHaveBeenCalled();
  });

  it("GOT-04 — a gota além de MAX_GOTAS substitui a mais antiga", () => {
    const { gotas } = montar(1);
    for (let i = 0; i <= MAX_GOTAS; i += 1) {
      tempo = i;
      clicar(200 + i, 100);
    }
    const g = gotas.uniformes.uGotas.value;
    // Posição 0 foi reescrita pela sétima gota (instante 6).
    expect(g[2]).toBe(MAX_GOTAS);
    expect(g[0]).toBe(100 + MAX_GOTAS);
  });

  it("GOT-05 — parar() remove o listener", () => {
    const { gotas, aoCair } = montar();
    gotas.parar();
    clicar(300, 150);
    expect(aoCair).not.toHaveBeenCalled();
  });
});
