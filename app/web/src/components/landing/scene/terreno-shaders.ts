/**
 * components/landing/scene/terreno-shaders.ts
 *
 * O QUE FAZ
 * GLSL do terreno dos atos 3–5 (ADR-055): a malha do relevo, os glifos de
 * falha que pousam nos montes e as hastes que os prendem ao chão.
 *
 * COMO
 * - O relevo é uma FUNÇÃO (`altura`): ondulação calma + quatro montes de
 *   crista erodida + as selas que os ligam em cordilheira + a onda sísmica do
 *   clique. Não há textura de altura nem nada guardado: o vértice calcula.
 * - Luz por vértice: a normal sai da função por diferença finita, a sombra
 *   projetada é uma marcha curta em direção à luz, e a luz de contorno acende
 *   a crista que está de lado para a câmera.
 * - Grade e curvas de nível são desenhadas no fragmento com a largura medida
 *   em pixels de tela (`fwidth`): nítidas de perto, somem antes de virar moiré.
 * - Correção: uma frente verde desce a encosta (comparando a altitude relativa
 *   do fragmento com a frente do monte) e só depois o monte afunda.
 * - A malha é desenhada do fundo para a frente e o preenchimento é
 *   translúcido: a encosta da frente vela a de trás sem buffer de profundidade.
 * - Os glifos são cartazes que amostram o MESMO atlas da cena ASCII e saem das
 *   mesmas células (mesmo hash): o "@" da página é o "@" que sobe para o monte.
 *
 * As contas de narrativa espelham `terreno-logica.ts`, onde são testadas.
 * Não use crase dentro destes templates: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `terreno.ts` e `shaders.ts` (só `GLSL_VIRADA`).
 */

import { GOTA, MAX_GOTAS } from "../../../three/gotas";
import { GLIFO, TERRENO } from "./config";
import { PROPORCAO_FALHAS } from "./layout";

const f = (n: number) => n.toFixed(4);
const vec = (valores: readonly number[]) => `vec${valores.length}(${valores.map(f).join(", ")})`;

/** A virada num ponto: onda da esquerda para a direita, com ruído por célula. */
export const GLSL_VIRADA = /* glsl */ `
float viradaLocal(float m, float x, float ruido) {
  return smoothstep(0.0, 1.0, m * ${f(1 + TERRENO.ondaDaVirada.x + TERRENO.ondaDaVirada.ruido)}
    - ${f(TERRENO.ondaDaVirada.x)} * x - ${f(TERRENO.ondaDaVirada.ruido)} * ruido);
}
`;

/** Uniforms e sorteios comuns ao vértice e ao fragmento. */
const GLSL_COMUM = /* glsl */ `
#define PI 3.14159265
uniform vec2 uTela;
uniform vec2 uAlvo;
uniform float uTempo;
uniform float uRitmo;
uniform float uProgresso;
uniform float uVirada;
uniform float uEstavel;
uniform float uDistancia;
uniform vec2 uGradeAscii;
uniform vec2 uCelulaCss;
// Paleta (sRGB, lida dos tokens): chão, acento do chão, sombra/neblina, página.
uniform vec3 uCorDoChao;
uniform vec3 uCorDoAcento;
uniform vec3 uCorProfunda;
uniform vec3 uFundo;
uniform vec3 uSeveridade[4];
uniform vec3 uSucesso;
uniform vec3 uQuente;
// xy = centro do monte no plano (px), z = altura relativa (0 a 1).
uniform vec3 uMontes[4];
// x = frente da varredura verde (altitude relativa), y = força do verde, z = força da faixa.
uniform vec3 uCorrecao[4];
// Ondas sísmicas do clique: xy = ponto do plano, z = instante.
uniform vec3 uOndas[${MAX_GOTAS}];
uniform float uOndasAtivas;

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

// A virada no ponto do plano: a onda vai da esquerda para a direita.
float nasceuEm(vec2 plano, float sorteio) {
  return viradaLocal(uVirada, plano.x / uTela.x + 0.5, sorteio);
}
`;

/** O relevo: só no vértice. */
const GLSL_RELEVO = /* glsl */ `
const float ALTURA_DO_MONTE[4] = float[4](${TERRENO.alturaDosMontesPx.map(f).join(", ")});
const vec2 RAIO_DO_MONTE = ${vec(TERRENO.raioDoMontePx)};
const vec3 LUZ = normalize(${vec(TERRENO.luz)});

// Cristas em três escalas: a encosta tem espinhaços e ravinas, não é um sino liso.
float cristas(vec2 p, float semente) {
  return 0.5 * (1.0 - abs(2.0 * ruido(p * 0.011 + semente) - 1.0))
    + 0.3 * (1.0 - abs(2.0 * ruido(p * 0.026 + semente * 1.7) - 1.0))
    + 0.2 * (1.0 - abs(2.0 * ruido(p * 0.058 + semente * 2.9) - 1.0));
}

// Forma do monte "i" em p: 1 no cume, 0 fora dele. É também a altitude
// relativa do ponto dentro do monte (a varredura da correção compara com ela).
float formaDoMonte(vec2 p, int i) {
  vec2 d = (p - uMontes[i].xy) / RAIO_DO_MONTE;
  // Longe do monte nem faz o resto da conta.
  if (dot(d, d) > 7.0) return 0.0;
  float semente = float(i) * 7.3;
  // Contorno irregular: o ponto é deslocado antes de medir a distância.
  vec2 q = d + 0.22 * (vec2(ruido(p * 0.009 + semente + 11.0), ruido(p * 0.009 + semente + 47.0)) - 0.5);
  float cume = exp(-dot(q, q));
  // Pico secundário, menor e deslocado ao longo da cordilheira.
  vec2 q2 = (q - vec2(0.18, i == 0 || i == 2 ? -0.62 : 0.62)) / 0.52;
  float ombro = 0.6 * exp(-dot(q2, q2));
  return max(cume, ombro) * (0.42 + 0.58 * cristas(p, semente));
}

// Sela entre os dois montes de cada lado: liga os picos numa cordilheira.
float sela(vec2 p, int a, int b) {
  float menor = min(ALTURA_DO_MONTE[a] * uMontes[a].z, ALTURA_DO_MONTE[b] * uMontes[b].z);
  if (menor < 0.5) return 0.0;
  vec2 ab = uMontes[b].xy - uMontes[a].xy;
  float t = clamp(dot(p - uMontes[a].xy, ab) / dot(ab, ab), 0.0, 1.0);
  vec2 d = (p - (uMontes[a].xy + ab * t)) / (RAIO_DO_MONTE.x * 0.75);
  return menor * 0.3 * exp(-dot(d, d)) * (0.5 + 0.5 * cristas(p, 3.1));
}

float alturaDosMontes(vec2 p) {
  float h = sela(p, 0, 1) + sela(p, 2, 3);
  for (int i = 0; i < 4; i++) {
    if (uMontes[i].z < 0.004) continue;
    h += ALTURA_DO_MONTE[i] * uMontes[i].z * formaDoMonte(p, i);
  }
  return h;
}

// Onda sísmica do clique: anéis que se afastam do ponto e perdem força.
float ondasDoClique(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < ${MAX_GOTAS}; i++) {
    float t = uTempo - uOndas[i].z;
    if (t < 0.0 || t > ${f(GOTA.duracao)}) continue;
    float d = length(p - uOndas[i].xy);
    float x = d - t * ${f(GOTA.velocidadePx)};
    float vida = 1.0 - t / ${f(GOTA.duracao)};
    h += sin(x * ${f((2 * Math.PI) / (GOTA.comprimentoPx * 2))})
      * exp(-(x * x) / ${f((GOTA.larguraPx * 1.4) ** 2)}) * vida * vida / (1.0 + d / 420.0);
  }
  return h * ${f(TERRENO.amplitudeDaOndaPx)};
}

float altura(vec2 p) {
  float onda = (ruido(p * 0.0042 + uRitmo * 0.035) - 0.5) * ${f(TERRENO.ondulacaoPx)}
    + (ruido(p * 0.011 - uRitmo * 0.027) - 0.5) * ${f(TERRENO.ondulacaoPx * 0.4)};
  float h = onda * uVirada + alturaDosMontes(p);
  if (uOndasAtivas > 0.5) h += ondasDoClique(p) * uVirada;
  return h;
}

// Sombra projetada (1 = no sol, 0 = na sombra): marcha em direção à luz e vê
// se algum monte fica acima do raio. Só os montes fazem sombra que se nota.
float sombraEm(vec2 p, float h) {
  vec2 direcao = normalize(LUZ.xy);
  float subida = LUZ.z / length(LUZ.xy);
  float sombra = 1.0;
  for (int k = 1; k <= ${TERRENO.passosDaSombra}; k++) {
    float d = ${f(TERRENO.alcanceDaSombraPx)} * pow(float(k) / ${TERRENO.passosDaSombra}.0, 1.5);
    float folga = h + subida * d + 3.0 - alturaDosMontes(p + direcao * d);
    // Quanto mais longe o obstáculo, mais larga a penumbra.
    sombra = min(sombra, clamp(0.5 + folga * 7.0 / d, 0.0, 1.0));
  }
  return sombra;
}
`;

export const VERTEX_TERRENO = /* glsl */ `
${GLSL_COMUM}
${GLSL_RELEVO}

varying vec2 vPlano;
varying float vAltura;
varying float vDistancia;
// x = luz direta (com sombra), y = luz de contorno, z = quanto está na sombra.
varying vec3 vLuz;
// rgb = cor da severidade do monte que domina aqui, a = peso do monte.
varying vec4 vMonte;
// x = altitude relativa dentro do monte, y = frente da varredura, z = força do verde, w = força da faixa.
varying vec4 vCorrecao;

void main() {
  vec2 p = position.xy;
  float h = altura(p);
  // Normal por diferença finita: a luz precisa da inclinação da encosta.
  float e = 7.0;
  vec3 normal = normalize(vec3(h - altura(p + vec2(e, 0.0)), h - altura(p + vec2(0.0, e)), e));
  float sombra = sombraEm(p, h);
  vec3 vista = normalize(cameraPosition - vec3(p, h));
  float contorno = pow(1.0 - abs(dot(normal, vista)), 2.6);
  vLuz = vec3(max(dot(normal, LUZ), 0.0) * sombra, contorno * smoothstep(6.0, 40.0, h), 1.0 - sombra);

  vec3 cor = vec3(0.0);
  vec3 correcao = vec3(0.0);
  float forma = 0.0;
  float peso = 0.0;
  for (int i = 0; i < 4; i++) {
    float formaDoI = formaDoMonte(p, i);
    float g = formaDoI * uMontes[i].z;
    cor += uSeveridade[i] * g;
    correcao += uCorrecao[i] * g;
    forma += formaDoI * g;
    peso += g;
  }
  float divisor = max(peso, 1e-4);
  vMonte = vec4(cor / divisor, min(peso * 1.6, 1.0));
  // Fora dos montes a frente fica acima de qualquer altitude: nada de verde.
  vCorrecao = peso > 1e-4 ? vec4(forma / divisor, correcao / divisor) : vec4(0.0, 2.0, 0.0, 0.0);
  vPlano = p;
  vAltura = h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, h, 1.0);
  vDistancia = gl_Position.w;
}
`;

export const FRAGMENT_TERRENO = /* glsl */ `
${GLSL_COMUM}

varying vec2 vPlano;
varying float vAltura;
varying float vDistancia;
varying vec3 vLuz;
varying vec4 vMonte;
varying vec4 vCorrecao;

// Linha de "largura" px de tela na coordenada "c" (uma a cada unidade inteira),
// que se apaga quando as linhas ficam mais juntas que ~2 px (evita moiré).
float linhaEm(float c, float largura) {
  float d = fwidth(c);
  float cobertura = 1.0 - clamp(abs(fract(c - 0.5) - 0.5) / max(d, 1e-5) - (largura - 1.0), 0.0, 1.0);
  return cobertura * (1.0 - smoothstep(0.3, 0.6, d));
}

void main() {
  vec2 celula = vPlano / ${vec(TERRENO.gradePx)};
  // A virada chega aqui em onda, da esquerda para a direita, como no ASCII.
  float nasceu = nasceuEm(vPlano, hashCelula(floor(celula)));
  if (nasceu < 0.004) discard;

  float alto = smoothstep(4.0, 56.0, vAltura);
  float luz = vLuz.x;

  // Correção: acima da frente a encosta já está verde; na frente, uma faixa de luz.
  float verde = smoothstep(vCorrecao.y - 0.03, vCorrecao.y + 0.03, vCorrecao.x) * vCorrecao.z;
  float distanciaDaFrente = (vCorrecao.x - vCorrecao.y) / 0.045;
  float faixa = exp(-distanciaDaFrente * distanciaDaFrente) * vCorrecao.w * vMonte.a;

  vec3 corDoChao = mix(uCorDoChao, uCorDoAcento, 0.25 * ruido(vPlano * 0.004 + 3.0));
  vec3 corBase = mix(corDoChao, mix(vMonte.rgb, uSucesso, verde), vMonte.a);
  // Ato 5: a luz esquenta.
  corBase = mix(corBase, uQuente, uEstavel * 0.3 * luz);

  // Preenchimento: quase nada na planície (a página aparece), mais corpo no
  // monte — é ele que vela as encostas de trás. Parte da cor da página e é
  // tingido pelo monte e pela luz: funciona no tema escuro e no claro.
  vec3 corDoFundo = mix(uFundo, corBase, (0.07 + 0.3 * vMonte.a) * (0.3 + 1.0 * luz));
  float alfaDoFundo = mix(0.05, 0.62, alto);
  // Sombra projetada: um véu da cor profunda sobre o que está atrás do monte.
  vec3 corDaSombra = mix(uFundo, uCorProfunda, 0.5);
  corDoFundo = mix(corDoFundo, corDaSombra, vLuz.z * 0.75);
  alfaDoFundo = max(alfaDoFundo, vLuz.z * 0.34);

  // Grade (a herança das células) e curvas de nível (o mapa do risco).
  float grade = max(linhaEm(celula.x, 1.0), linhaEm(celula.y, 1.0));
  float curva = linhaEm(vAltura / ${f(TERRENO.curvaDeNivelPx)}, 1.3) * smoothstep(5.0, 16.0, vAltura);
  // Na sombra as linhas perdem força; a faixa da correção acende as dela.
  float alfaDaLinha = clamp((grade * mix(0.3, 0.5, alto) + curva * 0.9) * (1.0 - 0.45 * vLuz.z) + faixa * 0.55, 0.0, 1.0);
  vec3 corDaLinha = mix(corBase, vec3(1.0), ${f(TERRENO.tomClaro)} * clamp(luz * curva + faixa, 0.0, 1.0));

  vec4 saida = vec4(corDoFundo * alfaDoFundo, alfaDoFundo);
  saida = vec4(corDaLinha * alfaDaLinha, alfaDaLinha) + saida * (1.0 - alfaDaLinha);

  // Luz de contorno: a crista de lado para a câmera acende e destaca a silhueta.
  float contorno = vLuz.y * ${f(TERRENO.luzDeContorno)};
  saida.rgb = mix(saida.rgb, mix(corBase, vec3(1.0), ${f(TERRENO.tomClaro)}) * max(saida.a, contorno), contorno);
  saida.a = max(saida.a, contorno);

  // Neblina com cor: ao longe o relevo puxa para a cor profunda e depois some,
  // em vez de terminar numa aresta.
  float longe = smoothstep(uDistancia * 1.02, uDistancia * 1.8, vDistancia);
  vec3 corDaNeblina = mix(uFundo, uCorProfunda, 0.6);
  float alfaComNeblina = max(saida.a, longe * 0.2);
  saida = vec4(mix(saida.rgb, corDaNeblina * alfaComNeblina, longe * 0.7), alfaComNeblina);
  float some = 1.0 - smoothstep(uDistancia * 1.3, uDistancia * 2.0, vDistancia);

  // Vinheta: mais discreto atrás da coluna de texto.
  float lateral = smoothstep(0.1, 0.8, abs(gl_FragCoord.x / uAlvo.x * 2.0 - 1.0));
  gl_FragColor = saida * nasceu * some * mix(0.6, 1.0, max(lateral, alto));
}
`;

/** Geometria virada para a câmera e o marcador (glifo) de cada falha: só no vértice. */
const GLSL_MARCADOR = /* glsl */ `
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

struct Marcador {
  vec3 pe;      // ponto do terreno embaixo dele
  vec3 cabeca;  // onde o glifo está
  vec3 cor;
  float alfa;
  float glifo;
  float escala;
};

// Devolve false quando a célula não tem falha (a instância não desenha).
bool marcadorDaInstancia(out Marcador m) {
  float id = float(gl_InstanceID);
  vec2 cel = vec2(mod(id, uGradeAscii.x), floor(id / uGradeAscii.x));
  if (hashCelula(cel + 41.0) > ${f(PROPORCAO_FALHAS)}) return false;
  float severidade = 1.0 + floor(hashCelula(cel + 53.0) * 4.0);
  int g = int(severidade) - 1;
  float r = hashCelula(cel);
  float h1 = hashCelula(cel + 17.0);
  float h2 = hashCelula(cel + 23.0);
  float h3 = hashCelula(cel + 31.0);

  // Em cima do glifo: o ponto do plano que cai sobre a célula ASCII.
  vec2 casa = (cel + 0.5) * uCelulaCss - 0.5 * uTela;
  float nasceu = nasceuEm(casa, hashCelula(cel + 113.0));
  float chegada = smoothstep(
    ${f(TERRENO.organizar[0])} + r * ${f(TERRENO.espalhamentoDaChegada)},
    ${f(TERRENO.organizar[1])} + r * ${f(TERRENO.espalhamentoDaChegada)},
    uProgresso
  );
  // Corrigir: crítica e alta sempre, média pela metade, baixa nunca.
  float corrigivel = severidade > 2.5 ? 1.0 : (severidade > 1.5 && hashCelula(cel + 83.0) >= 0.5 ? 1.0 : 0.0);
  float inicio = ${f(TERRENO.corrigirInicio)} + (4.0 - severidade) * ${f(TERRENO.atrasoPorSeveridade)}
    + hashCelula(cel + 89.0) * ${f(TERRENO.espalhamentoDaCorrecao)};
  float corrigida = corrigivel * smoothstep(inicio, inicio + ${f(TERRENO.corrigirDuracao)}, uProgresso);

  // Pouso: um ponto sorteado dentro do monte da severidade.
  vec2 pouso = uMontes[g].xy + RAIO_DO_MONTE * 0.78 * sqrt(h1) * vec2(cos(h2 * 6.2832), sin(h2 * 6.2832));
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
  if (severidade < 1.5) m.alfa *= 1.0 - ${f(TERRENO.discricaoDaBaixa)} * uEstavel;
  // O glifo da severidade vira "✓" quando a correção passa da metade.
  m.glifo = corrigida > 0.4 ? ${GLIFO.ok}.0 : ${GLIFO.baixa - 1}.0 + severidade;
  m.escala = mix(1.0, 1.3, h3);
  return m.alfa > 0.004;
}
`;

export const VERTEX_GLIFO = /* glsl */ `
${GLSL_COMUM}
${GLSL_RELEVO}
${GLSL_MARCADOR}

varying vec2 vUv;
varying float vGlifo;
varying vec4 vCor;

void main() {
  Marcador m;
  if (!marcadorDaInstancia(m)) {
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

export const FRAGMENT_GLIFO = /* glsl */ `
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

export const VERTEX_HASTE = /* glsl */ `
${GLSL_COMUM}
${GLSL_RELEVO}
${GLSL_MARCADOR}

// x = distância ao eixo (px, com sinal), y = meia largura (px).
varying vec2 vLinha;
varying vec4 vCor;

void main() {
  Marcador m;
  if (!marcadorDaInstancia(m)) {
    gl_Position = FORA;
    return;
  }
  float desloc;
  // A haste para um pouco antes do glifo.
  gl_Position = segmento(m.pe, mix(m.pe, m.cabeca, 0.72), position.x, position.y, 0.35, desloc);
  vLinha = vec2(desloc, 0.35);
  vCor = vec4(m.cor, m.alfa * 0.55);
}
`;

/** Fragmento de linha: borda suavizada na conta, alfa pré-multiplicado. */
export const FRAGMENT_HASTE = /* glsl */ `
varying vec2 vLinha;
varying vec4 vCor;
void main() {
  float alfa = clamp(vLinha.y + 0.5 - abs(vLinha.x), 0.0, 1.0) * vCor.a;
  gl_FragColor = vec4(vCor.rgb * alfa, alfa);
}
`;
