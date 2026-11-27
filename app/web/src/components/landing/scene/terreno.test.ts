/**
 * terreno.test.ts
 *
 * O terreno dos atos 3–5 (ADR-055): as regras puras de `terreno-logica.ts` e
 * a montagem de `terreno.ts`. three roda de verdade no jsdom (montar cena,
 * malha e alvo não precisa de WebGL); o renderer é falso, e verifica-se o que
 * o terreno pede a ele.
 *
 *   TER-01  virada global: 0 antes, 1 depois, crescente no meio
 *   TER-02  virada local: onda da esquerda para a direita
 *   TER-03  ordem de correção: baixa nunca, média só a metade sorteada, alta e
 *           crítica sempre; crítica primeiro
 *   TER-04  chegada ao monte: sorteio maior chega depois
 *   TER-05  altura do monte: 0 antes de se formar; no fim crítica e alta
 *           planas, média pela metade, baixa inteira
 *   TER-06  a varredura verde desce ANTES de o monte afundar
 *   TER-07  frente da varredura: fora do monte no começo; desce até a base na
 *           crítica, até a meia encosta na média; nunca entra na baixa
 *   TER-08  risco do grupo (halo) e ritmo do ato 5
 *   TER-09  qualidade: só um trecho sustentado de quadros lentos rebaixa
 *   TER-10  antes da virada o terreno não desenha e a camada fica inativa
 *   TER-11  depois da virada desenha no próprio alvo e devolve o renderer
 *   TER-12  o halo fica dentro da tela, do lado certo, com o risco do grupo
 *   TER-13  o ping do clique nasce no ponto do plano embaixo do cursor
 *   TER-14  preparar compila em segundo plano, no alvo do terreno, sem
 *           desenhar; até ficar pronto a virada não acontece (o ASCII segue)
 *   TER-15  epílogo: com o marco do fim da página o progresso vai de 5 a 6;
 *           a rede nasce nesse trecho e o horizonte amanhece só no fim
 *   TER-16  câmera: de frente antes da virada (a célula cai sobre o glifo),
 *           sem órbita enquanto ASCII e terreno se cruzam, e nunca para de
 *           se mover até o fim da página
 *   TER-17  cura do grupo (cor do nó do monte): baixa nunca, média até a
 *           metade, alta e crítica inteiras
 *   TER-18  o grafo entra no desenho: arestas e nós têm instâncias para a
 *           rede, para as falhas e para os montes
 */

import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { TERRENO, mapearProgresso } from "./config";
import { criarTerreno } from "./terreno";
import {
  alturaDoMonte, avaliarQualidade, cameraDoTerreno, chegadaAoGrupo, correcaoDoMonte, curaDoGrupo, epilogo,
  estabilidade, fracaoCorrigida, redeDeMonitoramento, riscoDoGrupo, ritmoDaCena, viradaGlobal, viradaLocal,
} from "./terreno-logica";

const LARGURA = 1440;
const ALTURA = 900;
const passos = (de: number, ate: number, passo: number) =>
  Array.from({ length: Math.round((ate - de) / passo) + 1 }, (_, i) => de + i * passo);

describe("Lógica do terreno", () => {
  it("TER-01 — virada global: 0 antes, 1 depois, crescente no meio", () => {
    expect(viradaGlobal(TERRENO.virada[0] - 0.1)).toBe(0);
    expect(viradaGlobal(TERRENO.virada[1] + 0.1)).toBe(1);
    const meio = passos(TERRENO.virada[0], TERRENO.virada[1], 0.05).map(viradaGlobal);
    meio.slice(1).forEach((valor, i) => expect(valor).toBeGreaterThanOrEqual(meio[i]));
  });

  it("TER-02 — virada local: onda da esquerda para a direita", () => {
    for (const x of [0, 0.5, 1]) {
      for (const ruido of [0, 0.5, 1]) {
        expect(viradaLocal(0, x, ruido)).toBe(0);
        expect(viradaLocal(1, x, ruido)).toBe(1);
      }
    }
    expect(viradaLocal(0.5, 0, 0.5)).toBeGreaterThan(viradaLocal(0.5, 1, 0.5));
  });

  it("TER-03 — ordem de correção pelo mais grave", () => {
    for (const p of passos(0, 5, 0.25)) {
      expect(fracaoCorrigida(1, 0.99, 0, p)).toBe(0);
      expect(fracaoCorrigida(2, 0.2, 0, p)).toBe(0);
    }
    expect(fracaoCorrigida(2, 0.9, 0.5, 5)).toBe(1);
    expect(fracaoCorrigida(3, 0, 0.5, 5)).toBe(1);
    expect(fracaoCorrigida(4, 0, 0.5, 5)).toBe(1);
    for (const p of passos(3.7, 4.6, 0.05)) {
      expect(fracaoCorrigida(4, 0, 0.5, p)).toBeGreaterThanOrEqual(fracaoCorrigida(3, 0, 0.5, p));
      expect(fracaoCorrigida(3, 0, 0.5, p)).toBeGreaterThanOrEqual(fracaoCorrigida(2, 0.9, 0.5, p));
    }
  });

  it("TER-04 — chegada ao monte: sorteio maior chega depois", () => {
    expect(chegadaAoGrupo(3, 0)).toBe(0);
    expect(chegadaAoGrupo(4, 0)).toBe(1);
    expect(chegadaAoGrupo(4, 1)).toBe(1);
    expect(chegadaAoGrupo(3.3, 0)).toBeGreaterThan(chegadaAoGrupo(3.3, 1));
  });

  it("TER-05 — altura do monte ao longo da história", () => {
    for (const severidade of [1, 2, 3, 4] as const) {
      expect(alturaDoMonte(severidade, 2.9)).toBe(0);
      // No auge do ato 3 todos estão formados e inteiros.
      expect(alturaDoMonte(severidade, 3.7)).toBeCloseTo(1, 6);
      for (const p of passos(0, 5, 0.1)) {
        expect(alturaDoMonte(severidade, p)).toBeGreaterThanOrEqual(0);
        expect(alturaDoMonte(severidade, p)).toBeLessThanOrEqual(1);
      }
    }
    expect(alturaDoMonte(4, 5)).toBeCloseTo(0, 6);
    expect(alturaDoMonte(3, 5)).toBeCloseTo(0, 6);
    expect(alturaDoMonte(2, 5)).toBeCloseTo(0.5, 6);
    expect(alturaDoMonte(1, 5)).toBe(1);
  });

  it("TER-06 — a varredura verde desce antes de o monte afundar", () => {
    // Procura o instante em que a frente da crítica chega à base.
    const chegouNaBase = passos(3.7, 4.6, 0.005).find((p) => correcaoDoMonte(4, p).frente <= 0.01);
    expect(chegouNaBase).toBeDefined();
    // Nesse instante o monte ainda tem quase toda a altura: dá para ver a encosta verde.
    expect(alturaDoMonte(4, chegouNaBase!)).toBeGreaterThan(0.85);
    expect(correcaoDoMonte(4, chegouNaBase!).verde).toBe(1);
  });

  it("TER-07 — frente da varredura por severidade", () => {
    for (const severidade of [1, 2, 3, 4] as const) {
      // Antes da correção a frente está acima do cume: nada de verde.
      expect(correcaoDoMonte(severidade, 3.5).frente).toBeGreaterThan(1);
      expect(correcaoDoMonte(severidade, 3.5).faixa).toBeCloseTo(0, 6);
    }
    expect(correcaoDoMonte(4, 5).frente).toBeCloseTo(0, 6);
    expect(correcaoDoMonte(3, 5).frente).toBeCloseTo(0, 6);
    expect(correcaoDoMonte(2, 5).frente).toBeCloseTo(0.5, 6);
    // A baixa nunca é corrigida: a frente nunca entra no monte.
    for (const p of passos(0, 5, 0.1)) expect(correcaoDoMonte(1, p).frente).toBeGreaterThan(1);
    // No fim o verde some (na média, o que sobra do monte volta à cor da severidade).
    expect(correcaoDoMonte(2, 5).verde).toBeCloseTo(0, 6);
    // A faixa de luz só existe enquanto a frente desce.
    expect(Math.max(...passos(3.7, 4.6, 0.01).map((p) => correcaoDoMonte(4, p).faixa))).toBeGreaterThan(0.95);
    expect(correcaoDoMonte(4, 5).faixa).toBeCloseTo(0, 6);
  });

  it("TER-08 — risco do grupo e ritmo do ato 5", () => {
    expect(riscoDoGrupo(4, 2.9)).toBe(0);
    expect(riscoDoGrupo(4, 5)).toBeCloseTo(0, 6);
    expect(riscoDoGrupo(3, 5)).toBeCloseTo(0, 6);
    expect(riscoDoGrupo(2, 5)).toBeCloseTo(0.5, 6);
    expect(riscoDoGrupo(1, 5)).toBeCloseTo(1 - TERRENO.discricaoDaBaixa, 6);
    expect(estabilidade(4)).toBe(0);
    expect(estabilidade(5)).toBe(1);
    expect(ritmoDaCena(4)).toBe(1);
    expect(ritmoDaCena(5)).toBeCloseTo(1 - TERRENO.freioEstavel, 6);
  });

  it("TER-09 — só um trecho sustentado de quadros lentos rebaixa a qualidade", () => {
    let q = { nivel: 0, lentos: 0 };
    for (let i = 0; i < 1000; i += 1) q = avaliarQualidade(q, 1 / 60);
    expect(q).toEqual({ nivel: 0, lentos: 0 });
    // Um engasgo isolado no meio de quadros rápidos não conta.
    q = avaliarQualidade(q, 1 / 20);
    for (let i = 0; i < 10; i += 1) q = avaliarQualidade(q, 1 / 60);
    expect(q.nivel).toBe(0);
    for (let i = 0; i < TERRENO.quadrosParaRebaixar; i += 1) q = avaliarQualidade(q, 1 / 30);
    expect(q).toEqual({ nivel: 1, lentos: 0 });
    // No último degrau não desce mais.
    q = { nivel: TERRENO.qualidade.length - 1, lentos: 0 };
    for (let i = 0; i < TERRENO.quadrosParaRebaixar * 3; i += 1) q = avaliarQualidade(q, 1 / 30);
    expect(q.nivel).toBe(TERRENO.qualidade.length - 1);
  });

  it("TER-15 — epílogo: o progresso segue até o fim da página e a rede nasce nele", () => {
    // Os marcos dos seis atos mais o do fim da rolagem (use-landing-scene.ts).
    const marcos = [0, 1000, 2000, 3000, 6000, 7000, 10000];
    expect(mapearProgresso(7000, marcos)).toBe(5);
    expect(mapearProgresso(8500, marcos)).toBe(5.5);
    expect(mapearProgresso(10000, marcos)).toBe(TERRENO.progressoFinal);
    expect(redeDeMonitoramento(4.5)).toBe(0);
    expect(redeDeMonitoramento(TERRENO.progressoFinal)).toBe(1);
    // Em "Planos" (p = 5) a rede já começou, mas falta a maior parte: sobra história para o resto da página.
    expect(redeDeMonitoramento(5)).toBeGreaterThan(0);
    expect(redeDeMonitoramento(5)).toBeLessThan(0.3);
    expect(epilogo(5)).toBe(0);
    expect(epilogo(TERRENO.progressoFinal)).toBe(1);
  });

  it("TER-16 — câmera: de frente antes da virada e em movimento até o fim", () => {
    expect(cameraDoTerreno(0)).toEqual({ inclinacao: 0, orbita: 0 });
    expect(cameraDoTerreno(2.5)).toEqual({ inclinacao: 0, orbita: 0 });
    // Durante a virada só inclina: a órbita tiraria a célula de cima do glifo.
    for (const p of passos(TERRENO.virada[0], TERRENO.virada[1], 0.05)) expect(cameraDoTerreno(p).orbita).toBe(0);
    expect(cameraDoTerreno(TERRENO.virada[1]).inclinacao).toBeCloseTo(TERRENO.inclinacaoGraus, 6);
    const fim = cameraDoTerreno(TERRENO.progressoFinal);
    expect(fim.inclinacao).toBeCloseTo(TERRENO.inclinacaoGraus + TERRENO.inclinacaoDoEpilogoGraus, 6);
    expect(fim.orbita).toBeCloseTo(TERRENO.orbitaGraus, 6);
    // Depois de "Planos" a câmera continua andando: era ali que o fundo parava.
    const depoisDePlanos = passos(5, TERRENO.progressoFinal, 0.1).map((p) => cameraDoTerreno(p));
    depoisDePlanos.slice(1, -1).forEach((camera, i) => {
      expect(camera.orbita).toBeGreaterThan(depoisDePlanos[i].orbita);
      expect(camera.inclinacao).toBeGreaterThan(depoisDePlanos[i].inclinacao);
    });
  });

  it("TER-17 — cura do grupo: baixa nunca, média até a metade, alta e crítica inteiras", () => {
    for (const p of passos(0, TERRENO.progressoFinal, 0.25)) expect(curaDoGrupo(1, p)).toBe(0);
    expect(curaDoGrupo(2, 5)).toBeCloseTo(0.5, 6);
    expect(curaDoGrupo(3, 5)).toBeCloseTo(1, 6);
    expect(curaDoGrupo(4, 5)).toBeCloseTo(1, 6);
    expect(curaDoGrupo(4, 3.5)).toBe(0);
  });
});

function rendererFalso() {
  let alvo: THREE.WebGLRenderTarget | null = null;
  const desenhos: (THREE.WebGLRenderTarget | null)[] = [];
  const renderer = {
    getRenderTarget: () => alvo,
    setRenderTarget: (novo: THREE.WebGLRenderTarget | null) => { alvo = novo; },
    render: vi.fn(() => { desenhos.push(alvo); }),
    // Registra o alvo corrente na hora da compilação: é parte da chave do programa.
    compileAsync: vi.fn(() => {
      alvosDaCompilacao.push(alvo);
      return new Promise<void>((resolve) => { terminarCompilacao = resolve; });
    }),
  };
  const alvosDaCompilacao: (THREE.WebGLRenderTarget | null)[] = [];
  let terminarCompilacao: () => void = () => {};
  return {
    renderer: renderer as unknown as THREE.WebGLRenderer,
    desenhos,
    alvoAtual: () => alvo,
    alvosDaCompilacao,
    terminarCompilacao: () => terminarCompilacao(),
  };
}

/** Prepara o terreno com o renderer falso, já com a compilação concluída. */
async function preparar(terreno: ReturnType<typeof montar>, falso: ReturnType<typeof rendererFalso>) {
  const pronto = terreno.preparar(falso.renderer);
  falso.terminarCompilacao();
  await pronto;
}

function montar() {
  const uniformes = { uAtlas: { value: null }, uTotalGlifos: { value: 19 } };
  const terreno = criarTerreno(uniformes);
  // Tela de 1440 × 900 a DPR 1, com a grade ASCII de 12 × 18 px.
  terreno.redimensionar(LARGURA, ALTURA, 1, new THREE.Vector2(120, 50), new THREE.Vector2(12, 18));
  return terreno;
}

describe("Montagem do terreno", () => {
  it("TER-10 — antes da virada não desenha e a camada fica inativa", () => {
    const terreno = montar();
    const { renderer, desenhos } = rendererFalso();
    terreno.desenhar(renderer, 1, 1 / 60, 1.5);
    expect(desenhos).toHaveLength(0);
    expect(terreno.uniformesDaTela.uCamadaAtiva.value).toBe(0);
    expect(terreno.uniformesDaTela.uVirada.value).toBe(0);
  });

  it("TER-11 — depois da virada desenha no próprio alvo e devolve o renderer", async () => {
    const terreno = montar();
    const falso = rendererFalso();
    const { renderer, desenhos, alvoAtual } = falso;
    await preparar(terreno, falso);
    terreno.desenhar(renderer, 2, 1 / 60, 3.6);
    // Um desenho por quadro, num alvo fora da tela — nada direto no canvas.
    expect(desenhos).toHaveLength(1);
    expect(desenhos[0]).not.toBeNull();
    expect(alvoAtual()).toBeNull();
    expect(terreno.uniformesDaTela.uCamadaAtiva.value).toBe(1);
    expect(terreno.uniformesDaTela.uVirada.value).toBe(1);
    expect(terreno.uniformesDaTela.uCamada.value).toBeInstanceOf(THREE.Texture);
  });

  it("TER-12 — o halo fica dentro da tela, do lado certo, com o risco do grupo", async () => {
    const terreno = montar();
    const falso = rendererFalso();
    const { renderer } = falso;
    await preparar(terreno, falso);
    const progresso = 3.6;
    terreno.desenhar(renderer, 2, 1 / 60, progresso);
    const halos = terreno.uniformesDaTela.uHalos.value;
    halos.forEach((halo, i) => {
      expect(halo.x, `x do halo ${i}`).toBeGreaterThan(0);
      expect(halo.x, `x do halo ${i}`).toBeLessThan(LARGURA);
      expect(halo.y, `y do halo ${i}`).toBeGreaterThan(0);
      expect(halo.y, `y do halo ${i}`).toBeLessThan(ALTURA);
      expect(halo.z).toBeCloseTo(riscoDoGrupo((i + 1) as 1 | 2 | 3 | 4, progresso), 6);
    });
    // Menos graves à esquerda, mais graves à direita — como no roteiro.
    const [baixa, media, alta, critica] = halos;
    expect(Math.max(baixa.x, media.x)).toBeLessThan(LARGURA / 2);
    expect(Math.min(alta.x, critica.x)).toBeGreaterThan(LARGURA / 2);
  });

  it("TER-13 — o ping do clique nasce no ponto do plano embaixo do cursor", async () => {
    const terreno = montar();
    const falso = rendererFalso();
    const { renderer } = falso;
    await preparar(terreno, falso);
    // Antes da virada a câmera olha de frente: o centro da tela é a origem do plano.
    terreno.desenhar(renderer, 0, 1 / 60, 0);
    const malha = (renderer.render as ReturnType<typeof vi.fn>);
    expect(malha).not.toHaveBeenCalled();
    terreno.desenhar(renderer, 1, 1 / 60, 3.6);
    const cena = malha.mock.calls[0][0] as THREE.Scene;
    const uniformes = ((cena.children[0] as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
    expect(uniformes.uPingsAtivos.value).toBe(0);
    terreno.ping(LARGURA / 2, ALTURA / 2, 1.5);
    const ping = (uniformes.uPingsNoPlano.value as THREE.Vector3[])[0];
    expect(ping.x).toBeCloseTo(0, 3);
    expect(ping.y).toBeCloseTo(0, 3);
    expect(ping.z).toBe(1.5);
    // Um clique à direita cai à direita no plano.
    terreno.ping(LARGURA * 0.9, ALTURA / 2, 1.6);
    expect((uniformes.uPingsNoPlano.value as THREE.Vector3[])[1].x).toBeGreaterThan(200);
    // Com ping vivo, o próximo quadro liga o laço dos pings no shader.
    terreno.desenhar(renderer, 1.7, 1 / 60, 3.6);
    expect(uniformes.uPingsAtivos.value).toBe(1);
  });

  it("TER-18 — o grafo entra no desenho: instâncias para a rede, as falhas e os montes", async () => {
    const terreno = montar();
    const falso = rendererFalso();
    const { renderer } = falso;
    await preparar(terreno, falso);
    terreno.desenhar(renderer, 1, 1 / 60, 5.5);
    const cena = (renderer.render as ReturnType<typeof vi.fn>).mock.calls[0][0] as THREE.Scene;
    // Ordem de desenho: malha, arestas, hastes, nós, glifos.
    expect(cena.children).toHaveLength(5);
    const [, arestas, hastes, nos, glifos] = cena.children.map((o) => (o as THREE.Mesh).geometry as THREE.InstancedBufferGeometry);
    const celulas = 120 * 50;
    const uniformes = ((cena.children[0] as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
    const rede = (uniformes.uGradeDaRede.value as THREE.Vector2).x * (uniformes.uGradeDaRede.value as THREE.Vector2).y;
    expect(rede).toBeGreaterThan(100);
    expect(hastes.instanceCount).toBe(celulas);
    expect(glifos.instanceCount).toBe(celulas);
    // Rede (3 vizinhos por ponto) + uma aresta por célula + as 2 que ligam os montes de cada lado.
    expect(arestas.instanceCount).toBe(rede * 3 + celulas + 2);
    // Nós da rede + o nó de cada um dos 4 montes.
    expect(nos.instanceCount).toBe(rede + 4);
    // No epílogo a rede está nascendo e o horizonte começou a amanhecer.
    expect(uniformes.uRede.value).toBeGreaterThan(0.3);
    expect(uniformes.uFinal.value).toBeCloseTo(0.5, 6);
    expect(uniformes.uFormado.value).toBe(1);
  });

  it("TER-14 — preparar compila em segundo plano, no alvo do terreno, sem desenhar", async () => {
    const terreno = montar();
    const falso = rendererFalso();
    const { renderer, desenhos, alvosDaCompilacao, alvoAtual } = falso;
    const pronto = terreno.preparar(renderer);
    // Compila no alvo em que o terreno desenha (não no canvas) e devolve o anterior.
    expect(alvosDaCompilacao).toHaveLength(1);
    expect(alvosDaCompilacao[0]).not.toBeNull();
    expect(alvoAtual()).toBeNull();
    expect(desenhos).toHaveLength(0);
    // Chamado de novo (quadros seguintes), não recompila.
    expect(terreno.preparar(renderer)).toBe(pronto);
    expect(renderer.compileAsync).toHaveBeenCalledTimes(1);
    // Ainda compilando: mesmo depois da virada, nada usa os programas.
    terreno.desenhar(renderer, 2, 1 / 60, 3.6);
    expect(desenhos).toHaveLength(0);
    expect(terreno.uniformesDaTela.uCamadaAtiva.value).toBe(0);
    expect(terreno.uniformesDaTela.uVirada.value).toBe(0);
    // Pronto: o próximo quadro já vira.
    falso.terminarCompilacao();
    await pronto;
    terreno.desenhar(renderer, 2.1, 1 / 60, 3.6);
    expect(desenhos).toHaveLength(1);
    expect(terreno.uniformesDaTela.uVirada.value).toBe(1);
    expect(() => terreno.descartar()).not.toThrow();
  });
});
