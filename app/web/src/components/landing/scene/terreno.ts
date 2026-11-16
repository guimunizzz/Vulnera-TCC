/**
 * components/landing/scene/terreno.ts
 *
 * O QUE FAZ
 * Material "terreno" dos atos 3–5: a grade de caracteres ganha a terceira
 * dimensão e vira um mapa topográfico do risco. As falhas são glifos que se
 * erguem da página numa haste e vão pousar no monte da sua severidade.
 *
 *   Ato 3 · Organizar  a grade inclina e ondula; os glifos de falha saltam
 *                      para quatro montes nas laterais, que crescem com eles
 *   Ato 4 · Corrigir   do mais alto para o mais baixo, o monte fica verde e
 *                      afunda; os glifos viram "✓", sobem e somem
 *   Ato 5 · Estável    planície calma, luz quente, um morro baixo que fica
 *                      (risco residual aceito)
 *
 * COMO
 * - Uma malha plana deslocada no vértice por `altura()` (ondulação + quatro
 *   montes analíticos). Nenhuma textura de altura, nada guardado.
 * - A grade e as curvas de nível são desenhadas no fragmento, com a largura
 *   medida em pixels de tela (`fwidth`): nítidas de perto, e somem antes de
 *   virar moiré ao longe.
 * - A malha é desenhada do fundo para a frente e o preenchimento é
 *   translúcido: a encosta da frente vela a de trás sem buffer de
 *   profundidade.
 * - Os glifos são cartazes que amostram o MESMO atlas da cena ASCII: o "@"
 *   que estava na página é o "@" que sobe para o monte.
 *
 * Não use crase dentro dos templates GLSL: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `materiais.ts` (chunk lazy da cena).
 */

import * as THREE from "three";
import {
  criarCena3d, criarQuadInstanciado, FRAGMENT_LINHA_3D, GLSL_COMUM_3D, GLSL_VERTICE_3D,
} from "./cena-3d";
import { CENA_3D, GLIFO, PINTURA } from "./config";
import type { Pintura } from "./pintura";

const f = (n: number) => n.toFixed(4);
const T = CENA_3D.terreno;

/** Altura do terreno num ponto do plano: ondulação calma + os quatro montes. */
const GLSL_ALTURA = /* glsl */ `
const float ALTURA_DO_MONTE[4] = float[4](${T.alturaDosMontesPx.map(f).join(", ")});
const vec2 RAIO_DO_MONTE = vec2(${f(T.raioDoMontePx[0])}, ${f(T.raioDoMontePx[1])});

// Peso (0 a 1) do monte "i" no ponto p, sem o risco: a forma da cordilheira.
float formaDoMonte(vec2 p, int i) {
  vec2 d = (p - uGrupos[i].xy) / RAIO_DO_MONTE;
  // Crista serrilhada: o monte não é um sino liso.
  float crista = 1.0 - abs(2.0 * ruido(p * 0.017 + float(i) * 7.3) - 1.0);
  return exp(-dot(d, d)) * (0.6 + 0.4 * crista);
}

float altura(vec2 p) {
  float onda = (ruido(p * 0.0042 + uRitmo * 0.035) - 0.5) * ${f(T.ondulacaoPx)}
    + (ruido(p * 0.011 - uRitmo * 0.027) - 0.5) * ${f(T.ondulacaoPx * 0.4)};
  float h = onda * uVirada;
  for (int i = 0; i < 4; i++) {
    if (uGrupos[i].w < 0.004) continue;
    h += ALTURA_DO_MONTE[i] * uGrupos[i].w * formaDoMonte(p, i);
  }
  return h;
}
`;

const VERTEX_TERRENO = /* glsl */ `
${GLSL_COMUM_3D}
${GLSL_ALTURA}

varying vec2 vPlano;
varying float vAltura;
varying vec3 vNormal;
varying float vDistancia;
// rgb = cor do monte que domina aqui (severidade → verde ao corrigir), a = peso.
varying vec4 vMonte;

void main() {
  vec2 p = position.xy;
  float h = altura(p);
  // Normal por diferença finita: a luz precisa da inclinação da encosta.
  float e = 7.0;
  vNormal = normalize(vec3(h - altura(p + vec2(e, 0.0)), h - altura(p + vec2(0.0, e)), e));

  vec3 cor = vec3(0.0);
  float peso = 0.0;
  for (int i = 0; i < 4; i++) {
    float g = formaDoMonte(p, i) * uGrupos[i].w;
    cor += mix(uSeveridade[i], uSucesso, uCura[i]) * g;
    peso += g;
  }
  vMonte = vec4(peso > 0.001 ? cor / peso : vec3(0.0), min(peso * 1.6, 1.0));
  vPlano = p;
  vAltura = h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, h, 1.0);
  vDistancia = gl_Position.w;
}
`;

const FRAGMENT_TERRENO = /* glsl */ `
${GLSL_COMUM_3D}

varying vec2 vPlano;
varying float vAltura;
varying vec3 vNormal;
varying float vDistancia;
varying vec4 vMonte;

// Linha de 1 px de tela na coordenada "c" (uma linha a cada unidade inteira),
// que se apaga quando as linhas ficam mais juntas que ~2 px (evita moiré).
float linhaEm(float c, float largura) {
  float d = fwidth(c);
  float cobertura = 1.0 - clamp(abs(fract(c - 0.5) - 0.5) / max(d, 1e-5) - (largura - 1.0), 0.0, 1.0);
  return cobertura * (1.0 - smoothstep(0.3, 0.6, d));
}

void main() {
  vec2 celula = vPlano / vec2(${f(T.gradePx[0])}, ${f(T.gradePx[1])});
  // A virada chega aqui em onda, da esquerda para a direita, como no ASCII.
  float nasceu = nasceuEm(vPlano, hashCelula(floor(celula)));
  if (nasceu < 0.004) discard;

  float alto = smoothstep(4.0, 56.0, vAltura);
  // Luz de cima e da esquerda; no ato 5 ela esquenta.
  float luz = clamp(dot(normalize(vNormal), normalize(vec3(-0.5, 0.42, 0.76))), 0.0, 1.0);

  vec3 corDoChao = mix(uMatiz[1], uMatiz[3], 0.25 * ruido(vPlano * 0.004 + 3.0));
  vec3 corBase = mix(corDoChao, vMonte.rgb, vMonte.a);
  corBase = mix(corBase, uQuente, uEstavel * 0.3 * luz);

  // Preenchimento: quase nada na planície (a página aparece), mais corpo no
  // monte — é ele que vela as encostas de trás. Parte da cor da página e é
  // tingido pelo monte e pela luz: funciona no tema escuro e no claro.
  vec3 corDoFundo = mix(uFundo, corBase, (0.07 + 0.3 * vMonte.a) * (0.35 + 0.95 * luz));
  float alfaDoFundo = mix(0.05, 0.62, alto);

  // Grade (a herança das células) e curvas de nível (o mapa do risco).
  float grade = max(linhaEm(celula.x, 1.0), linhaEm(celula.y, 1.0));
  float curva = linhaEm(vAltura / ${f(T.curvaDeNivelPx)}, 1.3) * smoothstep(5.0, 16.0, vAltura);
  float alfaDaLinha = clamp(grade * mix(0.3, 0.5, alto) + curva * 0.9, 0.0, 1.0);
  vec3 corDaLinha = mix(corBase, vec3(1.0), ${f(PINTURA.tomClaro)} * luz * curva);

  vec4 saida = vec4(corDoFundo * alfaDoFundo, alfaDoFundo);
  saida = vec4(corDaLinha * alfaDaLinha, alfaDaLinha) + saida * (1.0 - alfaDaLinha);

  // Neblina: o fundo do terreno se dissolve em vez de terminar numa aresta.
  float neblina = 1.0 - smoothstep(uDistancia * 1.2, uDistancia * 1.95, vDistancia);
  // Vinheta: mais discreto atrás da coluna de texto.
  float lateral = smoothstep(0.1, 0.8, abs(gl_FragCoord.x / uAlvo.x * 2.0 - 1.0));
  gl_FragColor = saida * nasceu * neblina * mix(0.6, 1.0, max(lateral, alto));
}
`;

/** Onde está o marcador (glifo) de uma falha: do glifo na página ao monte. */
const GLSL_MARCADOR = /* glsl */ `
${GLSL_ALTURA}

struct Marcador {
  vec3 pe;      // ponto do terreno embaixo dele
  vec3 cabeca;  // onde o glifo está
  vec3 cor;
  float alfa;
  float glifo;
  float escala;
};

// Devolve false quando a célula não tem falha (a instância não desenha).
bool marcadorDaCelula(vec2 cel, out Marcador m) {
  float severidade = severidadeDaCelula(cel);
  if (severidade < 0.5) return false;
  int g = int(severidade) - 1;
  float h1 = hashCelula(cel + 17.0);
  float h2 = hashCelula(cel + 23.0);
  float h3 = hashCelula(cel + 31.0);

  vec2 casa = planoDaCelula(cel);
  float nasceu = nasceuEm(casa, hashCelula(cel + 113.0));
  float chegada = chegadaDaCelula(cel);
  float corrigida = correcaoDaCelula(cel, severidade);

  // Pouso: um ponto sorteado dentro do monte da severidade.
  vec2 pouso = uGrupos[g].xy + RAIO_DO_MONTE * 0.78 * sqrt(h1) * vec2(cos(h2 * 6.2832), sin(h2 * 6.2832));
  vec2 xy = mix(casa, pouso, chegada);
  float chao = altura(xy);
  float haste = mix(9.0, 24.0, h3) * nasceu;
  // Da página ao monte em salto; corrigida, sobe e some.
  float z = chao + haste + sin(PI * chegada) * 78.0 + corrigida * corrigida * 130.0;

  m.pe = vec3(xy, chao);
  m.cabeca = vec3(xy, z);
  m.cor = mix(uSeveridade[g], uSucesso, smoothstep(0.0, 0.35, corrigida));
  m.cor = mix(m.cor, uQuente, uEstavel * 0.22);
  m.alfa = nasceu * (1.0 - smoothstep(0.55, 1.0, corrigida));
  // Ato 5: a baixa continua, discreta (risco residual aceito).
  if (severidade < 1.5) m.alfa *= 1.0 - ${f(PINTURA.discricaoDaBaixa)} * uEstavel;
  // O glifo da severidade vira "✓" quando a correção passa da metade.
  m.glifo = corrigida > 0.4 ? ${GLIFO.ok}.0 : ${GLIFO.baixa - 1}.0 + severidade;
  m.escala = mix(1.0, 1.3, h3);
  return m.alfa > 0.004;
}
`;

const VERTEX_GLIFO = /* glsl */ `
${GLSL_COMUM_3D}
${GLSL_VERTICE_3D}
${GLSL_MARCADOR}

varying vec2 vUv;
varying float vGlifo;
varying vec4 vCor;

void main() {
  Marcador m;
  if (!marcadorDaCelula(celulaDaInstancia(float(gl_InstanceID)), m)) {
    gl_Position = FORA;
    return;
  }
  // O cartaz tem o tamanho da célula ASCII, mais uma folga para o brilho.
  gl_Position = cartaz(m.cabeca, position.xy, 0.5 * uCelulaCss * m.escala * 1.5);
  vUv = position.xy * 0.75 + 0.5;
  vGlifo = m.glifo;
  vCor = vec4(m.cor, m.alfa);
}
`;

const FRAGMENT_GLIFO = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTotalGlifos;
varying vec2 vUv;
varying float vGlifo;
varying vec4 vCor;

void main() {
  // Fora de 0..1 é a folga do cartaz: só o brilho, sem vazar o glifo vizinho.
  vec2 dentro = step(vec2(0.0), vUv) * step(vUv, vec2(1.0));
  float cobertura = texture2D(uAtlas, vec2((floor(vGlifo + 0.5) + clamp(vUv.x, 0.0, 1.0)) / uTotalGlifos, clamp(vUv.y, 0.0, 1.0))).a
    * dentro.x * dentro.y;
  vec2 d = (vUv - 0.5) * 2.0;
  float brilho = exp(-dot(d, d) * 2.2) * 0.3;
  float alfa = clamp(cobertura + brilho, 0.0, 1.0) * vCor.a;
  gl_FragColor = vec4(vCor.rgb * alfa, alfa);
}
`;

const VERTEX_HASTE = /* glsl */ `
${GLSL_COMUM_3D}
${GLSL_VERTICE_3D}
${GLSL_MARCADOR}

varying vec2 vLinha;
varying vec4 vCor;

void main() {
  Marcador m;
  if (!marcadorDaCelula(celulaDaInstancia(float(gl_InstanceID)), m)) {
    gl_Position = FORA;
    return;
  }
  float desloc;
  // A haste para um pouco antes do glifo.
  vec3 topo = mix(m.pe, m.cabeca, 0.72);
  gl_Position = segmento(m.pe, topo, position.x, position.y, 0.35, desloc);
  vLinha = vec2(desloc, 0.35);
  vCor = vec4(m.cor, m.alfa * 0.55);
}
`;

export function criarTerreno(atlas: { uAtlas: THREE.IUniform; uTotalGlifos: THREE.IUniform }): Pintura {
  const malha = new THREE.Mesh(new THREE.BufferGeometry(), undefined);
  const hastes = new THREE.Mesh(criarQuadInstanciado("segmento"), undefined);
  const glifos = new THREE.Mesh(criarQuadInstanciado("cartaz"), undefined);

  const { uniformes, cena, material } = criarCena3d({
    inclinacaoGraus: T.inclinacaoGraus,
    centros: (largura, altura) => T.centros.map(([x, y]) => [x * largura / 2, y * altura / 2, 0] as const),
    // O halo fica a meia encosta: é onde o monte tem mais corpo na tela.
    alturaDoHalo: (indice, risco) => T.alturaDosMontesPx[indice] * risco * 0.45,
    aoAjustar({ largura, altura, celulas }) {
      // Plano bem maior que a tela: inclinado, o fundo encolhe e a frente cresce.
      const colunas = Math.ceil((largura * 1.8) / T.malhaPx);
      const linhas = Math.ceil((altura * 2.8) / T.malhaPx);
      const x0 = -largura * 0.9;
      const yTopo = altura * 1.85;
      const vertices = new Float32Array((colunas + 1) * (linhas + 1) * 3);
      const indices: number[] = [];
      // Linha 0 é o fundo (y maior): desenhar nesta ordem é a ordem do pintor.
      for (let l = 0; l <= linhas; l += 1) {
        for (let c = 0; c <= colunas; c += 1) {
          const i = (l * (colunas + 1) + c) * 3;
          vertices[i] = x0 + c * T.malhaPx;
          vertices[i + 1] = yTopo - l * T.malhaPx;
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
      (hastes.geometry as THREE.InstancedBufferGeometry).instanceCount = celulas;
      (glifos.geometry as THREE.InstancedBufferGeometry).instanceCount = celulas;
    },
  });

  const comum = {
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  } as const;
  malha.material = new THREE.ShaderMaterial({
    ...comum, uniforms: uniformes, vertexShader: VERTEX_TERRENO, fragmentShader: FRAGMENT_TERRENO,
  });
  hastes.material = new THREE.ShaderMaterial({
    ...comum, uniforms: uniformes, vertexShader: VERTEX_HASTE, fragmentShader: FRAGMENT_LINHA_3D,
  });
  glifos.material = new THREE.ShaderMaterial({
    ...comum, uniforms: { ...uniformes, ...atlas }, vertexShader: VERTEX_GLIFO, fragmentShader: FRAGMENT_GLIFO,
  });
  // Posições saem do shader; a ordem de inclusão é a ordem de desenho.
  [malha, hastes, glifos].forEach((objeto, ordem) => {
    objeto.frustumCulled = false;
    objeto.renderOrder = ordem;
    cena.add(objeto);
  });
  return material;
}
