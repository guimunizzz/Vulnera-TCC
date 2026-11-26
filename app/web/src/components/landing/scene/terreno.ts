/**
 * components/landing/scene/terreno.ts
 *
 * O QUE FAZ
 * Monta o terreno dos atos 3–5 da cena narrativa (ADR-055): a grade de
 * caracteres ganha a terceira dimensão e vira um mapa topográfico do risco.
 *
 *   Ato 3 · Organizar  a grade inclina e ondula; os glifos de falha saltam
 *                      para quatro montes nas laterais, que crescem com eles
 *   Ato 4 · Corrigir   do mais alto para o mais baixo, uma faixa verde desce
 *                      a encosta e o monte afunda; os glifos viram "✓" e somem
 *   Ato 5 · Estável    planície calma, luz quente, um morro baixo que fica
 *                      (risco residual aceito)
 *   Epílogo (5 → 6)    até o fim da página: uma rede de nós nasce sobre a
 *                      planície, a câmera orbita e baixa, o horizonte amanhece
 *
 * Em cima do terreno vive um grafo: um nó sobre cada cume, ligado aos glifos
 * daquele monte, e a rede do epílogo. Pulsos nas arestas, sonar nos montes e
 * a varredura de luz animam mesmo com a página parada.
 *
 * COMO
 * - Mundo em px CSS, origem no centro da tela. Sem inclinação, o plano z = 0
 *   é a própria tela: a célula ASCII fica em cima do seu glifo, e é por isso
 *   que a virada lê como transformação, não como troca de cena.
 * - A câmera gira em volta do eixo horizontal da tela conforme a virada
 *   avança. O movimento é do scroll: parou de rolar, a câmera para.
 * - Cinco draw calls (malha, arestas, hastes, nós, glifos) num alvo fora da tela, sem buffer
 *   de profundidade e sem MSAA. A passada de tela (`shaders.ts`) compõe esse
 *   alvo com o ASCII, os halos e o teto de alfa que o teste de contraste cobre.
 * - Nada é guardado por vértice ou por glifo: tudo sai da função de altura e
 *   do número da instância. O shader está em `terreno-shaders.ts`.
 *
 * QUEM USA
 * `use-landing-scene.ts` (chunk lazy da cena).
 */

import * as THREE from "three";
import { MAX_PINGS, PING } from "../../../three/pings";
import { lerCorDoToken } from "../../../three/palette";
import { TERRENO } from "./config";
import {
  alturaDoMonte, avaliarQualidade, cameraDoTerreno, chegadaAoGrupo, correcaoDoMonte, curaDoGrupo, epilogo,
  estabilidade, redeDeMonitoramento, riscoDoGrupo, ritmoDaCena, viradaGlobal, type Qualidade,
} from "./terreno-logica";
import {
  FRAGMENT_GLIFO, FRAGMENT_LINHA, FRAGMENT_NO, FRAGMENT_TERRENO, VERTEX_ARESTA, VERTEX_GLIFO, VERTEX_HASTE,
  VERTEX_NO, VERTEX_TERRENO,
} from "./terreno-shaders";

/** Tokens lidos em runtime; trocam junto com o tema. Tudo em sRGB no shader. */
const TOKENS = {
  uCorDoChao: "--vx-accent",
  uCorDoAcento: "--vx-cyan",
  uCorProfunda: "--vx-indigo",
  uFundo: "--vx-bg",
  uSucesso: "--vx-success",
  /** A "luz quente" do ato 5. */
  uQuente: "--vx-yellow",
} as const;
const TOKENS_SEVERIDADE = [
  "--color-severity-low", "--color-severity-medium", "--color-severity-high", "--color-severity-critical",
] as const;
const SEVERIDADES = [1, 2, 3, 4] as const;

export interface Terreno {
  /** Uniforms que a passada de tela precisa para compor a camada 3D. */
  uniformesDaTela: {
    /** O terreno desenhado: sRGB com alfa pré-multiplicado. */
    uCamada: { value: THREE.Texture };
    uCamadaAtiva: { value: number };
    uVirada: { value: number };
    uTetoDaCamada: { value: number };
    /** xy = centro do monte NA TELA (px do buffer), z = risco que resta (0 a 1). */
    uHalos: { value: THREE.Vector3[] };
    uRaioDoHalo: { value: number };
    uAlfaDoHalo: { value: number };
    uCorDoHalo: { value: THREE.Color[] };
  };
  /** Lê as cores dos tokens (troca de tema). */
  aplicarPaleta(elemento: Element): void;
  /**
   * Ajusta à tela. `gradeAscii` e `celulaPx` são os da grade de células (px do
   * buffer): as falhas saem das mesmas células do ASCII.
   */
  redimensionar(larguraCss: number, alturaCss: number, dprDaTela: number, gradeAscii: THREE.Vector2, celulaPx: THREE.Vector2): void;
  /**
   * Desenha o terreno uma vez, fora da vista: os shaders são compilados no
   * carregamento. Sem isso a compilação caía no primeiro quadro da virada
   * (167 ms de engasgo medido no build de produção, 2026-11-15).
   */
  aquecer(renderer: THREE.WebGLRenderer): void;
  /** Um quadro. Antes da virada não desenha nada. */
  desenhar(renderer: THREE.WebGLRenderer, tempo: number, delta: number, progresso: number): void;
  /**
   * Ping de scanner: clique no fundo (px do buffer da tela, y para cima). O
   * anel corre pelo relevo a partir do ponto do plano embaixo do cursor.
   */
  ping(xBuffer: number, yBuffer: number, tempo: number): void;
  descartar(): void;
}

/** `atlas` são os uniforms do atlas de glifos da cena ASCII: o terreno desenha os mesmos glifos. */
export function criarTerreno(atlas: { uAtlas: THREE.IUniform; uTotalGlifos: THREE.IUniform }): Terreno {
  const cores = (total: number) => Array.from({ length: total }, () => new THREE.Color());
  const uniformes = {
    uTela: { value: new THREE.Vector2(1, 1) },
    /** Tamanho do alvo em px do buffer (a tela × o DPR do degrau de qualidade). */
    uAlvo: { value: new THREE.Vector2(1, 1) },
    uTempo: { value: 0 },
    /** Relógio da ondulação: desacelera no ato 5. */
    uRitmo: { value: 0 },
    uProgresso: { value: 0 },
    uVirada: { value: 0 },
    uEstavel: { value: 0 },
    uDistancia: { value: 1 },
    uGradeAscii: { value: new THREE.Vector2(1, 1) },
    uCelulaCss: { value: new THREE.Vector2(1, 1) },
    uCorDoChao: { value: new THREE.Color() },
    uCorDoAcento: { value: new THREE.Color() },
    uCorProfunda: { value: new THREE.Color() },
    uFundo: { value: new THREE.Color() },
    uSucesso: { value: new THREE.Color() },
    uQuente: { value: new THREE.Color() },
    uSeveridade: { value: cores(4) },
    uMontes: { value: Array.from({ length: 4 }, () => new THREE.Vector3()) },
    uCorrecao: { value: Array.from({ length: 4 }, () => new THREE.Vector3(2, 0, 0)) },
    uPingsNoPlano: { value: Array.from({ length: MAX_PINGS }, () => new THREE.Vector3(0, 0, -1e4)) },
    uPingsAtivos: { value: 0 },
    // Grafo sobre o terreno.
    uFormado: { value: 0 },
    uCura: { value: [0, 0, 0, 0] },
    uRede: { value: 0 },
    uFinal: { value: 0 },
    uGradeDaRede: { value: new THREE.Vector2(1, 1) },
    uOrigemDaRede: { value: new THREE.Vector2(0, 0) },
  };

  const camera = new THREE.PerspectiveCamera(TERRENO.campoDeVisaoGraus, 1, 1, 10);
  // Sem profundidade (ordem do pintor) e sem MSAA (borda suavizada na conta).
  const alvo = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });
  const halos = Array.from({ length: 4 }, () => new THREE.Vector3());
  const uniformesDaTela: Terreno["uniformesDaTela"] = {
    uCamada: { value: alvo.texture },
    uCamadaAtiva: { value: 0 },
    uVirada: uniformes.uVirada,
    uTetoDaCamada: { value: TERRENO.tetoDeAlfa },
    uHalos: { value: halos },
    uRaioDoHalo: { value: 1 },
    uAlfaDoHalo: { value: TERRENO.alfaDoHalo },
    // Os mesmos objetos de cor dos montes (sRGB).
    uCorDoHalo: { value: uniformes.uSeveridade.value },
  };

  const comum = {
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  } as const;
  const malha = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
    ...comum, uniforms: uniformes, vertexShader: VERTEX_TERRENO, fragmentShader: FRAGMENT_TERRENO,
  }));
  // Quads de 4 vértices, um por célula ASCII: segmento (x = 0 ou 1, y = lado) e cartaz (cantos ±1).
  const quad = (x0: number) => {
    const geometria = new THREE.InstancedBufferGeometry();
    geometria.setAttribute("position", new THREE.Float32BufferAttribute([x0, -1, 0, 1, -1, 0, x0, 1, 0, 1, 1, 0], 3));
    geometria.setIndex([0, 1, 2, 1, 3, 2]);
    geometria.instanceCount = 0;
    return geometria;
  };
  const hastes = new THREE.Mesh(quad(0), new THREE.ShaderMaterial({
    ...comum, uniforms: uniformes, vertexShader: VERTEX_HASTE, fragmentShader: FRAGMENT_LINHA,
  }));
  const arestas = new THREE.Mesh(quad(0), new THREE.ShaderMaterial({
    ...comum, uniforms: uniformes, vertexShader: VERTEX_ARESTA, fragmentShader: FRAGMENT_LINHA,
  }));
  const nos = new THREE.Mesh(quad(-1), new THREE.ShaderMaterial({
    ...comum, uniforms: uniformes, vertexShader: VERTEX_NO, fragmentShader: FRAGMENT_NO,
  }));
  const glifos = new THREE.Mesh(quad(-1), new THREE.ShaderMaterial({
    ...comum,
    // Só os dois uniforms do atlas vêm de fora; o resto é do terreno.
    uniforms: { ...uniformes, uAtlas: atlas.uAtlas, uTotalGlifos: atlas.uTotalGlifos },
    vertexShader: VERTEX_GLIFO,
    fragmentShader: FRAGMENT_GLIFO,
  }));
  const cena = new THREE.Scene();
  // Posições saem do shader; a ordem de inclusão é a ordem de desenho: as
  // linhas ficam por baixo dos nós e dos glifos que elas ligam.
  const objetos = [malha, arestas, hastes, nos, glifos];
  objetos.forEach((objeto, ordem) => {
    objeto.frustumCulled = false;
    objeto.renderOrder = ordem;
    cena.add(objeto);
  });

  let qualidade: Qualidade = { nivel: 0, lentos: 0 };
  let ritmo = 0;
  let proximoPing = 0;
  let ultimoPing = -1e4;
  const tela = { largura: 1, altura: 1, dpr: 1, celula: new THREE.Vector2(1, 1) };
  const ponto = new THREE.Vector3();
  const raio = new THREE.Raycaster();
  const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  function montarMalha(passo: number): void {
    // Plano bem maior que a tela: inclinado, o fundo encolhe e a frente cresce.
    const colunas = Math.ceil((tela.largura * 1.8) / passo);
    const linhas = Math.ceil((tela.altura * 2.8) / passo);
    const x0 = -tela.largura * 0.9;
    const yDoFundo = tela.altura * 1.85;
    const vertices = new Float32Array((colunas + 1) * (linhas + 1) * 3);
    const indices: number[] = [];
    // Linha 0 é o fundo (y maior): desenhar nesta ordem é a ordem do pintor.
    for (let l = 0; l <= linhas; l += 1) {
      for (let c = 0; c <= colunas; c += 1) {
        const i = (l * (colunas + 1) + c) * 3;
        vertices[i] = x0 + c * passo;
        vertices[i + 1] = yDoFundo - l * passo;
        if (l < linhas && c < colunas) {
          const a = l * (colunas + 1) + c;
          const b = a + colunas + 1;
          indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
      }
    }
    malha.geometry.dispose();
    malha.geometry = new THREE.BufferGeometry();
    malha.geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    malha.geometry.setIndex(indices);
  }

  function ajustar(): void {
    const degrau = TERRENO.qualidade[qualidade.nivel];
    const dpr = Math.min(window.devicePixelRatio || 1, degrau.maxDpr);
    alvo.setSize(Math.max(1, Math.round(tela.largura * dpr)), Math.max(1, Math.round(tela.altura * dpr)));
    uniformes.uAlvo.value.set(alvo.width, alvo.height);
    uniformes.uTela.value.set(tela.largura, tela.altura);
    uniformes.uCelulaCss.value.copy(tela.celula).divideScalar(tela.dpr);
    // Distância em que o plano z = 0 preenche a tela exatamente.
    const distancia = tela.altura / 2 / Math.tan(THREE.MathUtils.degToRad(TERRENO.campoDeVisaoGraus / 2));
    uniformes.uDistancia.value = distancia;
    camera.aspect = tela.largura / tela.altura;
    camera.near = distancia * 0.05;
    camera.far = distancia * 8;
    camera.updateProjectionMatrix();
    TERRENO.centros.forEach(([x, y], i) => {
      const monte = uniformes.uMontes.value[i];
      monte.set(x * tela.largura / 2, y * tela.altura / 2, monte.z);
    });
    uniformesDaTela.uRaioDoHalo.value = TERRENO.raioDoHaloPx * tela.dpr;
    montarMalha(degrau.malhaPx);
    const celulas = uniformes.uGradeAscii.value.x * uniformes.uGradeAscii.value.y;
    hastes.geometry.instanceCount = celulas;
    glifos.geometry.instanceCount = celulas;
    // Treliça da rede sobre o mesmo plano da malha (ver montarMalha).
    const colunas = Math.ceil((tela.largura * 1.8) / TERRENO.malhaDaRedePx);
    const linhas = Math.ceil((tela.altura * 2.85) / TERRENO.malhaDaRedePx);
    uniformes.uGradeDaRede.value.set(colunas, linhas);
    uniformes.uOrigemDaRede.value.set(-tela.largura * 0.9, -tela.altura);
    // A ordem das faixas de instância é a do shader (VERTEX_ARESTA e VERTEX_NO).
    arestas.geometry.instanceCount = colunas * linhas * 3 + celulas + 2;
    nos.geometry.instanceCount = colunas * linhas + 4;
  }

  function apontarCamera(progresso: number): void {
    const { inclinacao, orbita } = cameraDoTerreno(progresso);
    const teta = THREE.MathUtils.degToRad(inclinacao);
    const psi = THREE.MathUtils.degToRad(orbita);
    const distancia = uniformes.uDistancia.value;
    // Gira em volta do centro do plano: primeiro inclina, depois orbita.
    camera.position.set(
      distancia * Math.sin(teta) * Math.sin(psi),
      -distancia * Math.sin(teta) * Math.cos(psi),
      distancia * Math.cos(teta),
    );
    // "Para cima" na tela é o fundo do terreno visto de onde a câmera está.
    camera.up.set(-Math.sin(psi), Math.cos(psi), 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
  }

  function renderizar(renderer: THREE.WebGLRenderer): void {
    const anterior = renderer.getRenderTarget();
    renderer.setRenderTarget(alvo);
    renderer.render(cena, camera);
    renderer.setRenderTarget(anterior);
  }

  function lerSrgb(elemento: Element, token: string, destino: THREE.Color): void {
    lerCorDoToken(elemento, token, destino);
    destino.convertLinearToSRGB();
  }

  return {
    uniformesDaTela,
    aplicarPaleta(elemento) {
      for (const [uniforme, token] of Object.entries(TOKENS)) {
        lerSrgb(elemento, token, uniformes[uniforme as keyof typeof TOKENS].value);
      }
      TOKENS_SEVERIDADE.forEach((token, i) => lerSrgb(elemento, token, uniformes.uSeveridade.value[i]));
    },
    redimensionar(larguraCss, alturaCss, dprDaTela, gradeAscii, celulaPx) {
      Object.assign(tela, { largura: larguraCss, altura: alturaCss, dpr: dprDaTela });
      tela.celula.copy(celulaPx);
      uniformes.uGradeAscii.value.copy(gradeAscii);
      ajustar();
    },
    aquecer(renderer) {
      // Um quadro com a virada completa compila os três programas no carregamento.
      uniformes.uVirada.value = 1;
      apontarCamera(TERRENO.virada[1]);
      renderizar(renderer);
      uniformes.uVirada.value = 0;
    },
    desenhar(renderer, tempo, delta, progresso) {
      const virada = viradaGlobal(progresso);
      uniformes.uVirada.value = virada;
      if (virada <= 0) {
        uniformesDaTela.uCamadaAtiva.value = 0;
        return;
      }
      ritmo += delta * ritmoDaCena(progresso);
      uniformes.uTempo.value = tempo;
      uniformes.uRitmo.value = ritmo;
      uniformes.uProgresso.value = progresso;
      uniformes.uEstavel.value = estabilidade(progresso);
      // Sem ping vivo o laço dos pings nem roda.
      uniformes.uPingsAtivos.value = tempo - ultimoPing < PING.duracao ? 1 : 0;
      uniformes.uFormado.value = chegadaAoGrupo(progresso, 0.5);
      uniformes.uRede.value = redeDeMonitoramento(progresso);
      uniformes.uFinal.value = epilogo(progresso);
      apontarCamera(progresso);
      SEVERIDADES.forEach((severidade, i) => {
        uniformes.uCura.value[i] = curaDoGrupo(severidade, progresso);
        const monte = uniformes.uMontes.value[i];
        monte.z = alturaDoMonte(severidade, progresso);
        const { frente, verde, faixa } = correcaoDoMonte(severidade, progresso);
        uniformes.uCorrecao.value[i].set(frente, verde, faixa);
        // O halo fica atrás do monte NA TELA, a meia encosta: projeta o ponto do mundo.
        ponto.set(monte.x, monte.y, TERRENO.alturaDosMontesPx[i] * monte.z * 0.45).project(camera);
        halos[i].set(
          (ponto.x * 0.5 + 0.5) * tela.largura * tela.dpr,
          (ponto.y * 0.5 + 0.5) * tela.altura * tela.dpr,
          riscoDoGrupo(severidade, progresso),
        );
      });
      renderizar(renderer);
      uniformesDaTela.uCamadaAtiva.value = 1;
      // Máquina sem fôlego: desce um degrau de qualidade (ver TERRENO.qualidade).
      const anterior = qualidade.nivel;
      qualidade = avaliarQualidade(qualidade, delta);
      if (qualidade.nivel !== anterior) ajustar();
    },
    ping(xBuffer, yBuffer, tempo) {
      // Do pixel clicado ao ponto do plano z = 0 embaixo dele, com a câmera como está.
      ponto.set(xBuffer / (tela.largura * tela.dpr) * 2 - 1, yBuffer / (tela.altura * tela.dpr) * 2 - 1, 0);
      raio.setFromCamera(new THREE.Vector2(ponto.x, ponto.y), camera);
      if (!raio.ray.intersectPlane(plano, ponto)) return;
      uniformes.uPingsNoPlano.value[proximoPing].set(ponto.x, ponto.y, tempo);
      proximoPing = (proximoPing + 1) % MAX_PINGS;
      ultimoPing = tempo;
    },
    descartar() {
      alvo.dispose();
      objetos.forEach((objeto) => {
        objeto.geometry.dispose();
        objeto.material.dispose();
      });
    },
  };
}
