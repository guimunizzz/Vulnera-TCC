/**
 * components/landing/scene/cena-3d.ts
 *
 * O QUE FAZ
 * A base comum dos materiais 3D dos atos 3–5 (terreno e grafo): câmera em
 * perspectiva, alvo fora da tela, cores dos tokens, degraus de qualidade e o
 * GLSL que os dois compartilham (hash das células, virada, cartazes e
 * segmentos virados para a câmera).
 *
 * POR QUE EXISTE
 * A pintura (ADR-054) usa pouco do three.js: é tudo plano. O Rafael pediu para
 * explorar profundidade, câmera e geometria (2026-11-16). Para os três
 * materiais conviverem, os 3D entregam exatamente o que a pintura entrega —
 * uma textura sRGB com alfa pré-multiplicado e os mesmos uniforms de tela — e
 * a passada de composição (`shaders.ts`) não sabe qual deles está ativo.
 *
 * COMO
 * - Mundo em px CSS, origem no centro da tela. Sem inclinação, o plano z = 0
 *   é a própria tela: a célula ASCII (c, l) fica em cima do seu glifo, e é
 *   por isso que a virada lê como transformação, não como troca de cena.
 * - A câmera gira em volta do eixo horizontal da tela conforme a virada
 *   avança. O movimento é do scroll: parou de rolar, a câmera para.
 * - Sem buffer de profundidade e sem MSAA: a malha do terreno é desenhada do
 *   fundo para a frente (ordem do pintor) e linhas, nós e glifos têm a borda
 *   suavizada na conta. Fica mais leve que a camada de tinta.
 *
 * Não use crase dentro dos templates GLSL: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `terreno.ts` e `grafo.ts` (chunk lazy da cena).
 */

import * as THREE from "three";
import { lerCorDoToken } from "../../../three/palette";
import { CENA_3D, PINTURA } from "./config";
import { PROPORCAO_FALHAS } from "./layout";
import { GLSL_VIRADA, type Pintura } from "./pintura";
import {
  avaliarQualidade, chegadaAoGrupo, curaDoGrupo, estabilidade, riscoDoGrupo, suavizar, velocidadeDoFluxo,
  viradaGlobal, type Qualidade,
} from "./pintura-logica";

const f = (n: number) => n.toFixed(4);

/** Os mesmos tokens da pintura, na mesma ordem: o teste de contraste cobre os três materiais. */
const TOKENS_MATIZ = ["--vx-indigo", "--vx-accent", "--vx-accent-soft", "--vx-cyan", "--vx-magenta"] as const;
const TOKENS_SEVERIDADE = [
  "--color-severity-low", "--color-severity-medium", "--color-severity-high", "--color-severity-critical",
] as const;

/**
 * GLSL comum (vértice e fragmento): uniforms, sorteios por célula e as regras
 * de falha, chegada ao grupo e correção — as mesmas de `pintura-logica.ts`.
 */
export const GLSL_COMUM_3D = /* glsl */ `
#define PI 3.14159265
uniform vec2 uTela;
uniform vec2 uAlvo;
uniform float uTempo;
uniform float uRitmo;
uniform float uProgresso;
uniform float uVirada;
uniform float uEstavel;
uniform float uFormado;
uniform float uDistancia;
uniform vec2 uGradeAscii;
uniform vec2 uCelulaCss;
uniform vec3 uMatiz[5];
uniform vec3 uSeveridade[4];
uniform vec3 uSucesso;
uniform vec3 uQuente;
// Cor de fundo da página: o preenchimento parte dela, nos dois temas.
uniform vec3 uFundo;
// xyz = centro do grupo no mundo (px), w = risco que resta nele (0 a 1).
uniform vec4 uGrupos[4];
// Quanto da correção possível do grupo já aconteceu (0 a 1).
uniform float uCura[4];

${GLSL_VIRADA}

// O mesmo hash do shader de células ASCII: as falhas saem das mesmas células.
float hashCelula(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float ruido(vec2 p) {
  vec2 i = floor(p);
  vec2 t = fract(p);
  t = t * t * (3.0 - 2.0 * t);
  return mix(
    mix(hashCelula(i), hashCelula(i + vec2(1.0, 0.0)), t.x),
    mix(hashCelula(i + vec2(0.0, 1.0)), hashCelula(i + vec2(1.0, 1.0)), t.x),
    t.y
  );
}

// Célula ASCII da instância e o ponto do plano (mundo) em cima do glifo dela.
vec2 celulaDaInstancia(float id) {
  return vec2(mod(id, uGradeAscii.x), floor(id / uGradeAscii.x));
}
vec2 planoDaCelula(vec2 cel) {
  return (cel + 0.5) * uCelulaCss - 0.5 * uTela;
}
// A virada no ponto do plano: a onda vai da esquerda para a direita.
float nasceuEm(vec2 plano, float sorteio) {
  return viradaLocal(uVirada, plano.x / uTela.x + 0.5, sorteio);
}

// 0 = célula sem falha; 1 baixa, 2 média, 3 alta, 4 crítica.
float severidadeDaCelula(vec2 cel) {
  if (hashCelula(cel + 41.0) > ${f(PROPORCAO_FALHAS)}) return 0.0;
  return 1.0 + floor(hashCelula(cel + 53.0) * 4.0);
}
float chegadaDaCelula(vec2 cel) {
  float r = hashCelula(cel);
  return smoothstep(
    ${f(PINTURA.organizar[0])} + r * ${f(PINTURA.espalhamentoDaChegada)},
    ${f(PINTURA.organizar[1])} + r * ${f(PINTURA.espalhamentoDaChegada)},
    uProgresso
  );
}
// Corrigir: crítica e alta sempre, média pela metade, baixa nunca.
float correcaoDaCelula(vec2 cel, float severidade) {
  float corrigivel = severidade > 2.5 ? 1.0 : (severidade > 1.5 && hashCelula(cel + 83.0) >= 0.5 ? 1.0 : 0.0);
  float inicio = ${f(PINTURA.corrigirInicio)} + (4.0 - severidade) * ${f(PINTURA.atrasoPorSeveridade)}
    + hashCelula(cel + 89.0) * ${f(PINTURA.espalhamentoDaCorrecao)};
  return corrigivel * smoothstep(inicio, inicio + ${f(PINTURA.corrigirDuracao)}, uProgresso);
}
`;

/** GLSL só de vértice: geometria virada para a câmera, com tamanho em px de tela. */
export const GLSL_VERTICE_3D = /* glsl */ `
const vec4 FORA = vec4(2.0, 2.0, 2.0, 1.0);

// Cartaz: quad de meio-tamanho "meio" (px) centrado em "centro" (mundo), sempre
// de frente. Perto da câmera fica maior, como qualquer coisa em perspectiva.
vec4 cartaz(vec3 centro, vec2 canto, vec2 meio) {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(centro, 1.0);
  clip.xy += canto * meio * (uDistancia / clip.w) * 2.0 / uTela * clip.w;
  return clip;
}

// Segmento entre dois pontos do mundo com largura em px de tela. "t" vai de 0
// (a) a 1 (b); "lado" é -1 ou 1. Devolve em "desloc" a distância ao eixo (px),
// que o fragmento usa para suavizar a borda.
vec4 segmento(vec3 a, vec3 b, float t, float lado, float meia, out float desloc) {
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(a, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(b, 1.0);
  vec2 direcao = (cb.xy / cb.w - ca.xy / ca.w) * uTela;
  vec2 normal = normalize(vec2(-direcao.y, direcao.x) + vec2(1e-5, 0.0));
  vec4 clip = mix(ca, cb, t);
  desloc = lado * (meia + 0.75);
  clip.xy += normal * desloc * 2.0 / uTela * clip.w;
  return clip;
}
`;

/** Fragmento de linha: borda suavizada na conta, alfa pré-multiplicado. */
export const FRAGMENT_LINHA_3D = /* glsl */ `
// x = distância ao eixo (px, com sinal), y = meia largura (px).
varying vec2 vLinha;
varying vec4 vCor;
void main() {
  float alfa = clamp(vLinha.y + 0.5 - abs(vLinha.x), 0.0, 1.0) * vCor.a;
  gl_FragColor = vec4(vCor.rgb * alfa, alfa);
}
`;

/** Quad de 4 vértices para cartazes (cantos ±1) e segmentos (x = 0 ou 1, y = lado). */
export function criarQuadInstanciado(tipo: "cartaz" | "segmento"): THREE.InstancedBufferGeometry {
  const geometria = new THREE.InstancedBufferGeometry();
  const x0 = tipo === "cartaz" ? -1 : 0;
  geometria.setAttribute("position", new THREE.Float32BufferAttribute([x0, -1, 0, 1, -1, 0, x0, 1, 0, 1, 1, 0], 3));
  geometria.setIndex([0, 1, 2, 1, 3, 2]);
  geometria.instanceCount = 0;
  return geometria;
}

export type Uniformes3d = ReturnType<typeof criarUniformes>;

function criarUniformes() {
  const cores = (total: number) => Array.from({ length: total }, () => new THREE.Color());
  return {
    uTela: { value: new THREE.Vector2(1, 1) },
    /** Tamanho do alvo em px do buffer (a tela × o DPR do degrau de qualidade). */
    uAlvo: { value: new THREE.Vector2(1, 1) },
    uTempo: { value: 0 },
    /** Relógio que desacelera no ato 5: ondulação do terreno e giro do grafo. */
    uRitmo: { value: 0 },
    uProgresso: { value: 0 },
    uVirada: { value: 0 },
    uEstavel: { value: 0 },
    uFormado: { value: 0 },
    uDistancia: { value: 1 },
    uGradeAscii: { value: new THREE.Vector2(1, 1) },
    uCelulaCss: { value: new THREE.Vector2(1, 1) },
    uMatiz: { value: cores(TOKENS_MATIZ.length) },
    uSeveridade: { value: cores(TOKENS_SEVERIDADE.length) },
    uSucesso: { value: new THREE.Color() },
    uQuente: { value: new THREE.Color() },
    uFundo: { value: new THREE.Color() },
    uGrupos: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    uCura: { value: [0, 0, 0, 0] },
  };
}

export interface OpcoesDaCena3d {
  inclinacaoGraus: number;
  /** Centro de cada grupo (baixa → crítica) no mundo, para a tela dada. */
  centros(largura: number, altura: number): readonly (readonly [number, number, number])[];
  /** Altura (px, eixo z) em que o halo do grupo é projetado, dado o risco que resta. */
  alturaDoHalo?(indice: number, risco: number): number;
  /** Chamado em todo ajuste de tela ou de qualidade: geometria e contagem de instâncias. */
  aoAjustar(tela: { largura: number; altura: number; celulas: number }, uniformes: Uniformes3d): void;
}

export interface Cena3d {
  uniformes: Uniformes3d;
  cena: THREE.Scene;
  material: Pintura;
}

export function criarCena3d(opcoes: OpcoesDaCena3d): Cena3d {
  const uniformes = criarUniformes();
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CENA_3D.campoDeVisaoGraus, 1, 1, 10);
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
  const uniformesDaTela: Pintura["uniformesDaTela"] = {
    uTinta: { value: alvo.texture },
    uTintaAtiva: { value: 0 },
    uVirada: uniformes.uVirada,
    uTetoDaTinta: { value: PINTURA.tetoDeAlfa },
    uHalos: { value: halos },
    uRaioDoHalo: { value: 1 },
    uAlfaDoHalo: { value: PINTURA.alfaDoHalo },
    uCorDoHalo: { value: uniformes.uSeveridade.value },
    uTexelDaTinta: { value: new THREE.Vector2(1, 1) },
    // O relevo iluminado é da tinta espessa; aqui a luz vem da própria cena.
    uLuzDoRelevo: { value: 0 },
  };

  let qualidade: Qualidade = { nivel: 0, lentos: 0 };
  let ritmo = 0;
  const tela = { largura: 1, altura: 1, dpr: 1, celula: new THREE.Vector2(1, 1) };
  const ponto = new THREE.Vector3();

  function ajustar(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, PINTURA.qualidade[qualidade.nivel].maxDpr);
    alvo.setSize(Math.max(1, Math.round(tela.largura * dpr)), Math.max(1, Math.round(tela.altura * dpr)));
    uniformes.uAlvo.value.set(alvo.width, alvo.height);
    uniformes.uTela.value.set(tela.largura, tela.altura);
    uniformes.uCelulaCss.value.copy(tela.celula).divideScalar(tela.dpr);
    // Distância em que o plano z = 0 preenche a tela exatamente.
    const distancia = tela.altura / 2 / Math.tan(THREE.MathUtils.degToRad(CENA_3D.campoDeVisaoGraus / 2));
    uniformes.uDistancia.value = distancia;
    camera.aspect = tela.largura / tela.altura;
    camera.near = distancia * 0.05;
    camera.far = distancia * 8;
    camera.updateProjectionMatrix();
    opcoes.centros(tela.largura, tela.altura).forEach(([x, y, z], i) => {
      uniformes.uGrupos.value[i].set(x, y, z, uniformes.uGrupos.value[i].w);
    });
    uniformesDaTela.uRaioDoHalo.value = PINTURA.raioDoGrupoPx * 1.5 * tela.dpr;
    const grade = uniformes.uGradeAscii.value;
    opcoes.aoAjustar({ largura: tela.largura, altura: tela.altura, celulas: grade.x * grade.y }, uniformes);
  }

  function apontarCamera(virada: number): void {
    const angulo = THREE.MathUtils.degToRad(opcoes.inclinacaoGraus) * suavizar(0, 1, virada);
    const distancia = uniformes.uDistancia.value;
    camera.position.set(0, -distancia * Math.sin(angulo), distancia * Math.cos(angulo));
    camera.up.set(0, 1, 0);
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

  const material: Pintura = {
    uniformesDaTela,
    aplicarPaleta(elemento) {
      TOKENS_MATIZ.forEach((token, i) => lerSrgb(elemento, token, uniformes.uMatiz.value[i]));
      TOKENS_SEVERIDADE.forEach((token, i) => lerSrgb(elemento, token, uniformes.uSeveridade.value[i]));
      lerSrgb(elemento, "--vx-success", uniformes.uSucesso.value);
      lerSrgb(elemento, "--vx-yellow", uniformes.uQuente.value);
      lerSrgb(elemento, "--vx-bg", uniformes.uFundo.value);
    },
    redimensionar(larguraCss, alturaCss, dprDaTela, gradeAscii, celulaPx) {
      Object.assign(tela, { largura: larguraCss, altura: alturaCss, dpr: dprDaTela });
      tela.celula.copy(celulaPx);
      uniformes.uGradeAscii.value.copy(gradeAscii);
      ajustar();
    },
    aquecer(renderer) {
      // Um quadro com a virada completa compila todos os programas no carregamento.
      uniformes.uVirada.value = 1;
      apontarCamera(1);
      renderizar(renderer);
      uniformes.uVirada.value = 0;
    },
    desenhar(renderer, tempo, delta, progresso) {
      const virada = viradaGlobal(progresso);
      uniformes.uVirada.value = virada;
      if (virada <= 0) {
        uniformesDaTela.uTintaAtiva.value = 0;
        return;
      }
      ritmo += delta * velocidadeDoFluxo(progresso);
      uniformes.uTempo.value = tempo;
      uniformes.uRitmo.value = ritmo;
      uniformes.uProgresso.value = progresso;
      uniformes.uEstavel.value = estabilidade(progresso);
      uniformes.uFormado.value = chegadaAoGrupo(progresso, 0.5);
      apontarCamera(virada);
      ([1, 2, 3, 4] as const).forEach((severidade, i) => {
        const grupo = uniformes.uGrupos.value[i];
        grupo.w = riscoDoGrupo(severidade, progresso);
        uniformes.uCura.value[i] = curaDoGrupo(severidade, progresso);
        // O halo fica atrás do grupo NA TELA: projeta o centro do mundo.
        ponto.set(grupo.x, grupo.y, grupo.z + (opcoes.alturaDoHalo?.(i, grupo.w) ?? 0)).project(camera);
        halos[i].set((ponto.x * 0.5 + 0.5) * tela.largura * tela.dpr, (ponto.y * 0.5 + 0.5) * tela.altura * tela.dpr, grupo.w);
      });
      renderizar(renderer);
      uniformesDaTela.uTintaAtiva.value = 1;
      // Máquina sem fôlego: desce um degrau de resolução (ver PINTURA.qualidade).
      const anterior = qualidade.nivel;
      qualidade = avaliarQualidade(qualidade, delta);
      if (qualidade.nivel !== anterior) ajustar();
    },
    descartar() {
      alvo.dispose();
      cena.traverse((objeto) => {
        const { geometry, material: materialDoObjeto } = objeto as Partial<THREE.Mesh>;
        geometry?.dispose();
        (Array.isArray(materialDoObjeto) ? materialDoObjeto : materialDoObjeto ? [materialDoObjeto] : []).forEach((m) => m.dispose());
      });
    },
  };

  return { uniformes, cena, material };
}
