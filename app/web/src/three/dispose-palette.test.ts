/**
 * dispose-palette.test.ts
 *
 * Descarte e paleta do kit three.js (Fase 2 do refactor web-motion-3d). Usam
 * objetos three reais — nenhum dos dois toca WebGL.
 *   KIT-09  descartarCena percorre a árvore e libera geometria, material
 *           (inclusive em array) e textura, cada um uma única vez
 *   KIT-10  lerCorDoToken converte "L C H" na cor exibida (mesma conta do
 *           verificador de contraste)
 *   KIT-11  token fora do formato lança (o hook cai no fallback)
 *   KIT-12  observarTema reage a data-theme e para ao desconectar
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { descartarCena } from "./dispose";
import { lerCorDoToken, observarTema, temaAtual } from "./palette";

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

describe("descartarCena", () => {
  it("KIT-09 — libera geometria, materiais e texturas uma vez cada", () => {
    const compartilhada = new THREE.BufferGeometry();
    const textura = new THREE.Texture();
    const comMapa = new THREE.MeshBasicMaterial({ map: textura });
    const uniformeTextura = new THREE.Texture();
    const shader = new THREE.ShaderMaterial({ uniforms: { uAtlas: { value: uniformeTextura } } });
    const linha = new THREE.LineBasicMaterial();
    const cena = new THREE.Scene();
    const grupo = new THREE.Group();
    grupo.add(new THREE.Mesh(compartilhada, [comMapa, shader]));
    grupo.add(new THREE.LineSegments(compartilhada, linha));
    cena.add(grupo);
    const outraCena = new THREE.Scene();
    outraCena.add(new THREE.Points(new THREE.BufferGeometry(), linha));

    const espioes = [compartilhada, textura, comMapa, uniformeTextura, shader, linha].map((o) => vi.spyOn(o, "dispose"));
    descartarCena(cena, outraCena);

    espioes.forEach((espiao) => expect(espiao).toHaveBeenCalledTimes(1));
  });
});

describe("paleta da cena", () => {
  function tokenComValor(valor: string) {
    vi.spyOn(window, "getComputedStyle").mockReturnValue({ getPropertyValue: () => ` ${valor}` } as unknown as CSSStyleDeclaration);
  }

  it("KIT-10 — converte o token OKLCH na cor sRGB exibida", () => {
    // iris-400 do tokens.css; o hex de referência é o do comentário do token.
    tokenComValor("0.706 0.157 292");
    const cor = lerCorDoToken(document.body, "--color-ambient-ink");
    expect(cor.getHexString()).toBe("a38bf9");
  });

  it("KIT-10b — reaproveita a cor de destino em vez de alocar", () => {
    tokenComValor("0.442 0.200 292");
    const destino = new THREE.Color();
    expect(lerCorDoToken(document.body, "--color-ambient-ink", destino)).toBe(destino);
    expect(destino.getHexString()).toBe("5b2bb5");
  });

  it("KIT-11 — token vazio ou fora do formato lança", () => {
    tokenComValor("");
    expect(() => lerCorDoToken(document.body, "--color-ambient-ink")).toThrow(/fora do formato/);
  });

  it("KIT-12 — observarTema avisa na troca de data-theme e para ao desconectar", async () => {
    const aoMudar = vi.fn();
    const parar = observarTema(aoMudar);

    document.documentElement.setAttribute("data-theme", "light");
    await Promise.resolve();
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(temaAtual()).toBe("light");

    parar();
    document.documentElement.setAttribute("data-theme", "dark");
    await Promise.resolve();
    expect(aoMudar).toHaveBeenCalledTimes(1);
    expect(temaAtual()).toBe("dark");
  });
});
