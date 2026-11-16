/**
 * acumulacao.test.ts
 *
 * O QUE FAZ
 * Contrato da camada de acumulação (`criarAcumulacao`): dois alvos em ping-pong
 * que guardam a tinta de um quadro para o seguinte, com o esmaecer e a cena
 * desenhados no alvo de escrita e o renderer devolvido ao alvo em que estava.
 *
 * POR QUE EXISTE
 * É o rastro da pintura da landing (ADR-054). Um erro aqui não quebra a página,
 * mas a tinta fica fantasma (alvo não limpo), some (autoClear ligado no meio do
 * desenho) ou o renderer da cena principal volta no alvo errado.
 *
 * COMO
 * `three` roda de verdade em jsdom (alvos e cenas não tocam WebGL). O renderer
 * é falso: espiona `setRenderTarget`, `render` e `clear` e guarda em que alvo
 * cada chamada aconteceu.
 *
 *   ACU-01  pintar desenha duas vezes no mesmo alvo e devolve o alvo original
 *           e o autoClear ao valor de antes
 *   ACU-02  ping-pong: a textura lida é a do alvo recém-escrito e alterna entre
 *           exatamente duas
 *   ACU-03  durante o desenho o autoClear está desligado
 *   ACU-04  redimensionar seguido de pintar limpa os dois alvos antes; o quadro
 *           seguinte não limpa de novo
 *   ACU-05  limpar apaga os dois alvos e devolve o alvo anterior
 *   ACU-06  descartar não lança e libera alvos, material e geometria
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { criarAcumulacao } from "./acumulacao";

const ALVO_INICIAL = { marcador: "alvo-inicial" } as unknown as THREE.WebGLRenderTarget;

interface Estado {
  /** Alvo atual do renderer falso. */
  atual: THREE.WebGLRenderTarget | null;
  /** Objeto desenhado em cada chamada de `render`. */
  objetosDoRender: unknown[];
  /** Alvo de cada chamada de `render`. */
  alvosDoRender: (THREE.WebGLRenderTarget | null)[];
  /** Valor do autoClear em cada chamada de `render`. */
  autoClearNoRender: boolean[];
  /** Alvo de cada chamada de `clear`. */
  alvosLimpos: (THREE.WebGLRenderTarget | null)[];
}

function estadoInicial(): Estado {
  return { atual: ALVO_INICIAL, objetosDoRender: [], alvosDoRender: [], autoClearNoRender: [], alvosLimpos: [] };
}

function criarRendererFalso(estado: Estado) {
  const renderer = {
    autoClear: true,
    getRenderTarget: vi.fn(() => estado.atual),
    setRenderTarget: vi.fn((alvo: THREE.WebGLRenderTarget | null) => { estado.atual = alvo; }),
    render: vi.fn((objeto: unknown) => {
      estado.objetosDoRender.push(objeto);
      estado.alvosDoRender.push(estado.atual);
      estado.autoClearNoRender.push(renderer.autoClear);
    }),
    clear: vi.fn(() => { estado.alvosLimpos.push(estado.atual); }),
  };
  return renderer;
}

const comoRenderer = (r: ReturnType<typeof criarRendererFalso>) => r as unknown as THREE.WebGLRenderer;

const cena = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("criarAcumulacao", () => {
  let estado: Estado;
  let renderer: ReturnType<typeof criarRendererFalso>;

  beforeEach(() => {
    estado = estadoInicial();
    renderer = criarRendererFalso(estado);
  });

  it("ACU-01 — pintar desenha duas vezes no mesmo alvo e devolve o alvo e o autoClear", () => {
    const acumulacao = criarAcumulacao();
    acumulacao.pintar(comoRenderer(renderer), cena, camera, 0.9);

    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(estado.objetosDoRender[1]).toBe(cena);
    expect(estado.alvosDoRender[0]).not.toBe(ALVO_INICIAL);
    expect(estado.alvosDoRender[1]).toBe(estado.alvosDoRender[0]);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(ALVO_INICIAL);
    expect(renderer.autoClear).toBe(true);
  });

  it("ACU-02 — ping-pong: a textura lida é a do alvo recém-escrito, e alterna entre duas", () => {
    const acumulacao = criarAcumulacao();
    const escritos: THREE.WebGLRenderTarget[] = [];
    const lidos: THREE.Texture[] = [];
    for (let quadro = 0; quadro < 4; quadro += 1) {
      acumulacao.pintar(comoRenderer(renderer), cena, camera, 0.9);
      const escrito = estado.alvosDoRender[estado.alvosDoRender.length - 1] as THREE.WebGLRenderTarget;
      escritos.push(escrito);
      lidos.push(acumulacao.uniforme.value);
      expect(acumulacao.uniforme.value).toBe(escrito.texture);
    }
    expect(escritos[0]).not.toBe(escritos[1]);
    expect(escritos[2]).toBe(escritos[0]);
    expect(escritos[3]).toBe(escritos[1]);
    expect(new Set(lidos).size).toBe(2);
  });

  it("ACU-03 — durante o desenho o autoClear está desligado e volta ao valor de antes", () => {
    const acumulacao = criarAcumulacao();
    renderer.autoClear = true;
    acumulacao.pintar(comoRenderer(renderer), cena, camera, 0.9);
    expect(estado.autoClearNoRender).toEqual([false, false]);
    expect(renderer.autoClear).toBe(true);

    renderer.autoClear = false;
    acumulacao.pintar(comoRenderer(renderer), cena, camera, 0.9);
    expect(estado.autoClearNoRender.slice(2)).toEqual([false, false]);
    expect(renderer.autoClear).toBe(false);
  });

  it("ACU-04 — redimensionar seguido de pintar limpa os dois alvos antes de desenhar", () => {
    const acumulacao = criarAcumulacao();
    acumulacao.pintar(comoRenderer(renderer), cena, camera, 0.9);
    renderer.clear.mockClear();

    acumulacao.redimensionar(200, 100);
    acumulacao.pintar(comoRenderer(renderer), cena, camera, 0.9);
    expect(renderer.clear).toHaveBeenCalledTimes(2);
    expect(new Set(estado.alvosLimpos).size).toBe(2);

    acumulacao.pintar(comoRenderer(renderer), cena, camera, 0.9);
    expect(renderer.clear).toHaveBeenCalledTimes(2);
  });

  it("ACU-05 — limpar apaga os dois alvos, devolve o alvo anterior e deixa o próximo quadro sem nova limpeza", () => {
    const acumulacao = criarAcumulacao();
    acumulacao.limpar(comoRenderer(renderer));

    expect(renderer.clear).toHaveBeenCalledTimes(2);
    expect(new Set(estado.alvosLimpos).size).toBe(2);
    expect(estado.alvosLimpos).not.toContain(ALVO_INICIAL);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(ALVO_INICIAL);

    acumulacao.pintar(comoRenderer(renderer), cena, camera, 0.9);
    expect(renderer.clear).toHaveBeenCalledTimes(2);
  });

  it("ACU-06 — descartar não lança e libera alvos, material e geometria", () => {
    const acumulacao = criarAcumulacao();
    const alvos = vi.spyOn(THREE.WebGLRenderTarget.prototype, "dispose");
    const material = vi.spyOn(THREE.ShaderMaterial.prototype, "dispose");
    const geometria = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");

    expect(() => acumulacao.descartar()).not.toThrow();
    expect(alvos).toHaveBeenCalledTimes(2);
    expect(material).toHaveBeenCalledTimes(1);
    expect(geometria).toHaveBeenCalledTimes(1);
  });
});
