/**
 * pings.test.ts
 *
 * Ping de scanner das cenas (clique no fundo → anel de radar):
 *   PING-01  clique no fundo grava o ping em px do buffer (Y de baixo para
 *            cima), avisa quem pediu com o mesmo ponto, e o anel fica vivo só
 *            pela duração
 *   PING-02  clique em alvo interativo, botão direito ou por teclado não
 *            dispara ping
 *   PING-03  clique fora do canvas não dispara ping
 *   PING-04  o sétimo ping substitui o mais antigo (anel de MAX_PINGS)
 *   PING-05  parar() remove o listener
 *   PING-06  a conta do anel: nada antes de a frente chegar, pico quando ela
 *            passa, eco que some atrás dela, nada depois da duração; perde
 *            força com a distância e com o tempo
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { criarPings, MAX_PINGS, PING, pingEm, type Pings } from "./pings";

let ativos: Pings[] = [];
let tempo = 0;

function montar(dpr = 2) {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, right: 900, bottom: 650, width: 800, height: 600, x: 100, y: 50, toJSON: () => ({}) });
  document.body.append(canvas);
  const aoPingar = vi.fn();
  const pings = criarPings({ canvas, tempoAtual: () => tempo, dpr: () => dpr, aoPingar });
  ativos.push(pings);
  return { pings, aoPingar };
}

function clicar(x: number, y: number, init: MouseEventInit = {}, alvo: EventTarget = document.body) {
  alvo.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y, detail: 1, button: 0, ...init }));
}

afterEach(() => {
  ativos.forEach((p) => p.parar());
  ativos = [];
  tempo = 0;
  document.body.replaceChildren();
});

describe("criarPings", () => {
  it("PING-01 — grava o ping em px do buffer, avisa com o mesmo ponto e dura PING.duracao", () => {
    const { pings, aoPingar } = montar(2);
    tempo = 10;
    clicar(300, 150);
    const dados = pings.uniformes.uPings.value;
    expect([dados[0], dados[1], dados[2]]).toEqual([400, 1000, 10]);
    expect(pings.uniformes.uDpr.value).toBe(2);
    expect(aoPingar).toHaveBeenCalledTimes(1);
    expect(aoPingar).toHaveBeenCalledWith(400, 1000, 10);
    expect(pings.ativo(10 + PING.duracao / 2)).toBe(true);
    expect(pings.ativo(10 + PING.duracao + 0.01)).toBe(false);
  });

  it("PING-02 — alvo interativo, botão direito e teclado não disparam ping", () => {
    const { pings, aoPingar } = montar();
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

    expect(aoPingar).not.toHaveBeenCalled();
    expect(pings.ativo(0)).toBe(false);
  });

  it("PING-03 — clique fora do canvas não dispara ping", () => {
    const { aoPingar } = montar();
    clicar(50, 20);
    expect(aoPingar).not.toHaveBeenCalled();
  });

  it("PING-04 — o ping além de MAX_PINGS substitui o mais antigo", () => {
    const { pings } = montar(1);
    for (let i = 0; i <= MAX_PINGS; i += 1) {
      tempo = i;
      clicar(200 + i, 100);
    }
    const dados = pings.uniformes.uPings.value;
    // A posição 0 foi reescrita pelo sétimo ping (instante 6).
    expect(dados[2]).toBe(MAX_PINGS);
    expect(dados[0]).toBe(100 + MAX_PINGS);
  });

  it("PING-05 — parar() remove o listener", () => {
    const { pings, aoPingar } = montar();
    pings.parar();
    clicar(300, 150);
    expect(aoPingar).not.toHaveBeenCalled();
  });
});

describe("pingEm", () => {
  it("PING-06 — a frente chega, passa e deixa um eco que some", () => {
    const distancia = 300;
    const chegada = distancia / PING.velocidadePx;
    // Antes de a frente chegar: nem anel nem eco.
    const antes = pingEm(distancia, chegada - 0.3);
    expect(antes.anel).toBeLessThan(0.001);
    expect(antes.rastro).toBe(0);
    // Na passagem: o anel está no pico, e o eco acabou de nascer.
    const passando = pingEm(distancia, chegada);
    expect(passando.anel).toBeGreaterThan(0.25);
    expect(passando.rastro).toBeCloseTo(passando.anel, 6);
    // Depois: o anel foi embora e o eco vai sumindo.
    const depois = pingEm(distancia, chegada + 0.3);
    const bemDepois = pingEm(distancia, chegada + 0.9);
    expect(depois.anel).toBeLessThan(0.001);
    expect(depois.rastro).toBeGreaterThan(bemDepois.rastro);
    expect(bemDepois.rastro).toBeGreaterThan(0);
    // Fora da vida do ping não sobra nada.
    expect(pingEm(distancia, PING.duracao + 0.01)).toEqual({ anel: 0, rastro: 0 });
    expect(pingEm(distancia, -0.1)).toEqual({ anel: 0, rastro: 0 });
    // Mais longe (logo, mais tarde), o anel chega mais fraco.
    const longe = pingEm(700, 700 / PING.velocidadePx);
    expect(longe.anel).toBeLessThan(passando.anel);
    // Nunca passa de 1: o teto de opacidade da cena não muda com o ping.
    for (let d = 0; d <= 900; d += 30) {
      for (let t = 0; t <= PING.duracao; t += 0.05) {
        const { anel, rastro } = pingEm(d, t);
        expect(anel).toBeLessThanOrEqual(1);
        expect(rastro).toBeLessThanOrEqual(1);
      }
    }
  });
});
