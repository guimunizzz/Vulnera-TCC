/**
 * materiais.test.ts
 *
 * Os três materiais dos atos 3–5 (terreno, grafo e pintura) atrás da mesma
 * interface. three roda de verdade no jsdom (montar cena, malha e alvo não
 * precisa de WebGL); o renderer é falso, e verifica-se o que cada material
 * pede a ele.
 *
 *   MAT-01  a URL escolhe o material; valor ausente ou desconhecido cai no
 *           padrão (terreno)
 *   MAT-02  antes da virada nenhum material desenha, e a camada fica inativa
 *   MAT-03  depois da virada cada material desenha no próprio alvo, devolve o
 *           renderer ao alvo em que estava e liga a camada
 *   MAT-04  nas cenas 3D o halo segue o grupo NA TELA: fica dentro do buffer
 *           e carrega o risco que resta no grupo
 *   MAT-05  cura do grupo: baixa nunca, média até a metade, alta e crítica
 *           inteiras, crítica primeiro
 *   MAT-06  aquecer e descartar não lançam (compilação no carregamento e
 *           limpeza no unmount)
 */

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { MATERIAIS_DA_CENA, MATERIAL_PADRAO, lerMaterialDaCena } from "./config";
import { criarMaterialDaCena } from "./materiais";
import { curaDoGrupo, riscoDoGrupo } from "./pintura-logica";

const LARGURA = 1440;
const ALTURA = 900;

function rendererFalso() {
  let alvo: THREE.WebGLRenderTarget | null = null;
  const desenhos: (THREE.WebGLRenderTarget | null)[] = [];
  const renderer = {
    autoClear: true,
    getRenderTarget: () => alvo,
    setRenderTarget: (novo: THREE.WebGLRenderTarget | null) => { alvo = novo; },
    render: vi.fn(() => { desenhos.push(alvo); }),
    clear: vi.fn(),
  };
  return { renderer: renderer as unknown as THREE.WebGLRenderer, desenhos, alvoAtual: () => alvo };
}

function montar(nome: (typeof MATERIAIS_DA_CENA)[number]) {
  const material = criarMaterialDaCena(nome, { uAtlas: { value: null }, uTotalGlifos: { value: 19 } });
  // Tela de 1440 × 900 a DPR 1, com a grade ASCII de 12 × 18 px.
  material.redimensionar(LARGURA, ALTURA, 1, new THREE.Vector2(120, 50), new THREE.Vector2(12, 18));
  return material;
}

describe("Escolha do material pela URL", () => {
  it("MAT-01 — ?cena= escolhe; ausente ou desconhecido cai no padrão", () => {
    expect(MATERIAL_PADRAO).toBe("terreno");
    expect(lerMaterialDaCena("")).toBe(MATERIAL_PADRAO);
    expect(lerMaterialDaCena("?cena=grafo")).toBe("grafo");
    expect(lerMaterialDaCena("?cena=pintura")).toBe("pintura");
    expect(lerMaterialDaCena("?cena=terreno&x=1")).toBe("terreno");
    expect(lerMaterialDaCena("?cena=inexistente")).toBe(MATERIAL_PADRAO);
    expect(lerMaterialDaCena("?outra=grafo")).toBe(MATERIAL_PADRAO);
  });
});

describe.each(MATERIAIS_DA_CENA)("Material %s", (nome) => {
  it("MAT-02 — antes da virada não desenha e a camada fica inativa", () => {
    const material = montar(nome);
    const { renderer, desenhos } = rendererFalso();
    material.desenhar(renderer, 1, 1 / 60, 1.5);
    expect(desenhos).toHaveLength(0);
    expect(material.uniformesDaTela.uTintaAtiva.value).toBe(0);
    expect(material.uniformesDaTela.uVirada.value).toBe(0);
  });

  it("MAT-03 — depois da virada desenha no próprio alvo e devolve o renderer", () => {
    const material = montar(nome);
    const { renderer, desenhos, alvoAtual } = rendererFalso();
    material.desenhar(renderer, 2, 1 / 60, 3.6);
    expect(desenhos.length).toBeGreaterThan(0);
    // Nada foi desenhado direto na tela: tudo vai para um alvo fora dela.
    desenhos.forEach((alvo) => expect(alvo).not.toBeNull());
    expect(alvoAtual()).toBeNull();
    expect(material.uniformesDaTela.uTintaAtiva.value).toBe(1);
    expect(material.uniformesDaTela.uVirada.value).toBe(1);
    expect(material.uniformesDaTela.uTinta.value).toBeInstanceOf(THREE.Texture);
  });

  it("MAT-06 — aquecer e descartar não lançam", () => {
    const material = montar(nome);
    const { renderer, desenhos } = rendererFalso();
    expect(() => material.aquecer(renderer)).not.toThrow();
    expect(desenhos.length).toBeGreaterThan(0);
    // O aquecimento não deixa a camada ligada nem a virada adiantada.
    expect(material.uniformesDaTela.uTintaAtiva.value).toBe(0);
    expect(material.uniformesDaTela.uVirada.value).toBe(0);
    expect(() => material.descartar()).not.toThrow();
  });
});

describe.each(["terreno", "grafo"] as const)("Cena 3D %s", (nome) => {
  it("MAT-04 — o halo fica dentro da tela e carrega o risco do grupo", () => {
    const material = montar(nome);
    const { renderer } = rendererFalso();
    const progresso = 3.6;
    material.desenhar(renderer, 2, 1 / 60, progresso);
    material.uniformesDaTela.uHalos.value.forEach((halo, i) => {
      expect(halo.x, `x do halo ${i}`).toBeGreaterThan(0);
      expect(halo.x, `x do halo ${i}`).toBeLessThan(LARGURA);
      expect(halo.y, `y do halo ${i}`).toBeGreaterThan(0);
      expect(halo.y, `y do halo ${i}`).toBeLessThan(ALTURA);
      expect(halo.z).toBeCloseTo(riscoDoGrupo((i + 1) as 1 | 2 | 3 | 4, progresso), 6);
    });
    // Menos graves à esquerda, mais graves à direita — como no roteiro.
    const [baixa, media, alta, critica] = material.uniformesDaTela.uHalos.value;
    expect(Math.max(baixa.x, media.x)).toBeLessThan(LARGURA / 2);
    expect(Math.min(alta.x, critica.x)).toBeGreaterThan(LARGURA / 2);
  });
});

describe("Cura do grupo", () => {
  it("MAT-05 — baixa nunca, média até a metade, alta e crítica inteiras", () => {
    for (let p = 0; p <= 5; p += 0.25) expect(curaDoGrupo(1, p)).toBe(0);
    expect(curaDoGrupo(2, 5)).toBeCloseTo(0.5, 6);
    expect(curaDoGrupo(3, 5)).toBeCloseTo(1, 6);
    expect(curaDoGrupo(4, 5)).toBeCloseTo(1, 6);
    expect(curaDoGrupo(4, 3)).toBe(0);
    // Começa pelo mais grave.
    for (let p = 3.7; p <= 4.7; p += 0.05) {
      expect(curaDoGrupo(4, p)).toBeGreaterThanOrEqual(curaDoGrupo(3, p));
      expect(curaDoGrupo(3, p)).toBeGreaterThanOrEqual(curaDoGrupo(2, p));
    }
  });
});
