/**
 * components/landing/scene/terreno-shaders.ts
 *
 * O QUE FAZ
 * GLSL do terreno dos atos 3–5 (ADR-055): a malha do relevo, os glifos de
 * falha que pousam nos montes, as hastes que os prendem ao chão e o grafo
 * que vive em cima dele (nó de cada monte e a rede do epílogo).
 *
 * COMO
 * - O relevo é uma FUNÇÃO (`altura`): ondulação calma + quatro montes de
 *   crista erodida + as selas que os ligam em cordilheira. Não há textura de
 *   altura nem nada guardado: o vértice calcula.
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
 * - Grafo: um nó flutua sobre cada cume, ligado aos glifos daquele monte; no
 *   epílogo, uma rede de nós nasce sobre a planície. Como a ligação precisa
 *   ser calculável dos dois lados sem busca, a rede é uma treliça com jitter
 *   e cada nó se liga a vizinhos em deslocamentos fixos.
 * - Vida contínua (anima com a página parada): pulsos que correm pelas
 *   arestas, anéis de sonar que saem dos montes, uma faixa de luz que varre o
 *   relevo e os glifos balançando na haste.
 * - Ping de scanner (clique no fundo): o ponto clicado chega projetado no
 *   plano; o anel acende a grade e as curvas de nível por onde corre, e os
 *   glifos, nós e arestas que ele toca piscam.
 *
 * As contas de narrativa espelham `terreno-logica.ts`, onde são testadas.
 * Não use crase dentro destes templates: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `terreno.ts` e `shaders.ts` (só `GLSL_VIRADA`).
 */

import { glslDoPing } from "../../../three/pings";
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
// Pings de scanner do clique: xy = ponto do plano (px), z = instante.
uniform float uPingsAtivos;
${glslDoPing({ funcao: "pingNoPlano", uniforme: "uPingsNoPlano", pxPorUnidade: "1.0" })}
// O ping no ponto p do plano: x = o anel passando, y = o eco atrás dele (0 a 1).
// Sem ping vivo o laço nem roda.
vec2 pingAqui(vec2 p) {
  return uPingsAtivos > 0.5 ? pingNoPlano(p) : vec2(0.0);
}
// Quanto o ping acende o que está em p (glifo, nó, aresta).
float ecoDoPing(vec2 p) {
  vec2 ping = pingAqui(p);
  return max(ping.x, ping.y * 0.6);
}
// Grafo: quanto os montes já se formaram, a cura de cada um (0 a 1), quanto da
// rede do epílogo já nasceu e quanto do epílogo já passou.
uniform float uFormado;
uniform float uCura[4];
uniform float uRede;
uniform float uFinal;
// Treliça da rede no plano: colunas e linhas, e o canto de onde ela parte (px).
uniform vec2 uGradeDaRede;
uniform vec2 uOrigemDaRede;

const vec2 RAIO_DO_MONTE = ${vec(TERRENO.raioDoMontePx)};

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

float altura(vec2 p) {
  float onda = (ruido(p * 0.0042 + uRitmo * 0.035) - 0.5) * ${f(TERRENO.ondulacaoPx)}
    + (ruido(p * 0.011 - uRitmo * 0.027) - 0.5) * ${f(TERRENO.ondulacaoPx * 0.4)};
  return onda * uVirada + alturaDosMontes(p);
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

  // Sonar: de tempos em tempos um anel sai de cada monte e corre pelo chão,
  // na cor dele. Quanto mais risco em aberto, mais forte; o monte resolvido cala.
  float sonar = 0.0;
  vec3 corDoSonar = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (uMontes[i].z < 0.05) continue;
    float fase = fract(uTempo / ${f(TERRENO.periodoDoSonarS)} + float(i) * 0.27);
    float d = (length((vPlano - uMontes[i].xy) / RAIO_DO_MONTE) - fase * 2.8) / 0.07;
    float anel = exp(-d * d) * (1.0 - fase) * (1.0 - fase) * uMontes[i].z;
    sonar += anel;
    corDoSonar += mix(uSeveridade[i], uSucesso, uCura[i]) * anel;
  }
  // Varredura: uma faixa de luz atravessa o relevo do fundo para a frente.
  // Ganha força no ato 5, quando o terreno está calmo e ela é o que se move.
  float posicao = mix(1.7, -1.0, fract(uTempo / ${f(TERRENO.periodoDaVarreduraS)})) * uTela.y;
  float distanciaDaVarredura = (vPlano.y - posicao) / 70.0;
  float varredura = exp(-distanciaDaVarredura * distanciaDaVarredura) * mix(0.35, 1.0, uEstavel);

  // Ping de scanner: o anel do clique corre pelo relevo como uma linha de luz,
  // e as linhas por onde ele acabou de passar ficam acesas mais um instante.
  vec2 ping = pingAqui(vPlano);

  // Na sombra as linhas perdem força; a faixa da correção, o sonar, a
  // varredura e o ping acendem as que tocam.
  float alfaDaLinha = clamp(
    (grade * mix(0.3, 0.5, alto) + curva * 0.9) * (1.0 - 0.45 * vLuz.z) * (1.0 + 0.9 * varredura)
      + faixa * 0.55 + sonar * (0.16 + 0.5 * grade) + ping.x * 0.8 + ping.y * 0.55 * max(grade, curva),
    0.0, 1.0);
  vec3 corDaLinha = mix(corBase, vec3(1.0), ${f(TERRENO.tomClaro)} * clamp(luz * curva + faixa + 0.6 * varredura, 0.0, 1.0));
  corDaLinha = mix(corDaLinha, corDoSonar / max(sonar, 1e-4), clamp(sonar, 0.0, 1.0) * 0.8);
  corDaLinha = mix(corDaLinha, mix(uCorDoAcento, vec3(1.0), ${f(TERRENO.tomClaro)}), clamp(ping.x + ping.y * 0.6, 0.0, 1.0));

  vec4 saida = vec4(corDoFundo * alfaDoFundo, alfaDoFundo);
  saida = vec4(corDaLinha * alfaDaLinha, alfaDaLinha) + saida * (1.0 - alfaDaLinha);

  // Luz de contorno: a crista de lado para a câmera acende e destaca a silhueta.
  float contorno = vLuz.y * ${f(TERRENO.luzDeContorno)};
  saida.rgb = mix(saida.rgb, mix(corBase, vec3(1.0), ${f(TERRENO.tomClaro)}) * max(saida.a, contorno), contorno);
  saida.a = max(saida.a, contorno);

  // Neblina com cor: ao longe o relevo puxa para a cor profunda e depois some,
  // em vez de terminar numa aresta.
  float longe = smoothstep(uDistancia * 1.02, uDistancia * 1.8, vDistancia);
  // Epílogo: o horizonte amanhece — a neblina do fundo puxa para a luz quente.
  vec3 corDaNeblina = mix(mix(uFundo, uCorProfunda, 0.6), uQuente, uFinal * 0.5);
  float alfaComNeblina = max(saida.a, longe * (0.2 + 0.3 * uFinal));
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

// O que está longe some na neblina, como o terreno.
float neblinaEm(float distancia) {
  return 1.0 - smoothstep(uDistancia * 1.3, uDistancia * 2.0, distancia);
}

struct Marcador {
  vec3 pe;      // ponto do terreno embaixo dele
  vec3 cabeca;  // onde o glifo está
  vec3 cor;
  float alfa;
  float glifo;
  float escala;
  int grupo;        // monte da severidade (0 baixa … 3 crítica)
  float chegada;    // 0 na página, 1 no monte
  float corrigida;  // 0 em aberto, 1 corrigida
};

// Devolve false quando a célula "id" não tem falha (a instância não desenha).
bool marcadorDaCelula(float id, out Marcador m) {
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
  // A haste balança de leve: o glifo nunca fica parado.
  float haste = (mix(9.0, 24.0, h3) + 2.2 * sin(uTempo * 1.5 + h1 * 40.0)) * nasceu;
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
  // O ping do clique toca o glifo: ele cresce e clareia por um instante.
  float eco = ecoDoPing(xy);
  m.cor = mix(m.cor, vec3(1.0), ${f(TERRENO.tomClaro)} * eco);
  m.escala = mix(1.0, 1.3, h3) * (1.0 + 0.35 * eco);
  m.grupo = g;
  m.chegada = chegada;
  m.corrigida = corrigida;
  return m.alfa > 0.004;
}

// --- Grafo sobre o terreno.

// Nó central de um monte: flutua acima do cume e sobe e desce com ele.
vec3 noDoMonte(int i) {
  vec2 centro = uMontes[i].xy;
  return vec3(centro, altura(centro) + ${f(TERRENO.alturaDoNoDoMontePx)} + 5.0 * sin(uTempo * 0.9 + float(i) * 1.7));
}
// Cor do nó: a da severidade, virando verde conforme o grupo é corrigido.
vec3 corDoMonte(int i) {
  return mix(mix(uSeveridade[i], uSucesso, uCura[i]), uQuente, uEstavel * 0.22);
}

// Nó "q" da treliça da rede de monitoramento (epílogo). Devolve false quando o
// ponto da treliça não tem nó ou a rede ainda não chegou ali.
bool noDaRede(vec2 q, out vec3 pos, out float nasceu) {
  if (q.x < 0.0 || q.y < 0.0 || q.x >= uGradeDaRede.x || q.y >= uGradeDaRede.y) return false;
  if (hashCelula(q + 301.0) > ${f(TERRENO.densidadeDaRede)}) return false;
  float h = hashCelula(q + 323.0);
  vec2 jitter = vec2(hashCelula(q + 311.0), hashCelula(q + 317.0)) - 0.5;
  vec2 xy = uOrigemDaRede + (q + 0.5 + jitter * 0.62) * ${f(TERRENO.malhaDaRedePx)};
  // A rede se espalha como a virada: da esquerda para a direita.
  nasceu = viradaLocal(uRede, clamp(xy.x / uTela.x + 0.5, 0.0, 1.0), h);
  if (nasceu < 0.004) return false;
  float flutua = mix(${f(TERRENO.alturaDaRedePx[0])}, ${f(TERRENO.alturaDaRedePx[1])}, h) * nasceu
    + 3.0 * sin(uTempo * 1.1 + h * 40.0);
  pos = vec3(xy, altura(xy) + flutua);
  return true;
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
  if (!marcadorDaCelula(float(gl_InstanceID), m)) {
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
varying vec3 vPulso;

void main() {
  // A haste não leva pulso.
  vPulso = vec3(0.0);
  Marcador m;
  if (!marcadorDaCelula(float(gl_InstanceID), m)) {
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

/**
 * Arestas do grafo, numa draw call. A instância decide o que é:
 *   [0, 3R)        rede do epílogo: nó da treliça ↔ três vizinhos fixos
 *   [3R, 3R + C)   nó do monte ↔ glifo da célula (só as células com falha)
 *   as 2 últimas   os dois montes de cada lado, ligados
 * (R = pontos da treliça, C = células ASCII.)
 */
export const VERTEX_ARESTA = /* glsl */ `
${GLSL_COMUM}
${GLSL_RELEVO}
${GLSL_MARCADOR}

varying vec2 vLinha;
varying vec4 vCor;
// x = posição ao longo (0 a 1), y = fase do pulso, z = força do pulso.
varying vec3 vPulso;

void main() {
  float id = float(gl_InstanceID);
  float totalDaRede = uGradeDaRede.x * uGradeDaRede.y * 3.0;
  float totalDeCelulas = uGradeAscii.x * uGradeAscii.y;
  vec3 a;
  vec3 b;
  vec3 cor;
  float alfa;
  float meia = 0.35;
  float pulso = 0.0;

  if (id < totalDaRede) {
    float ponto = floor(id / 3.0);
    vec2 q = vec2(mod(ponto, uGradeDaRede.x), floor(ponto / uGradeDaRede.x));
    float qual = mod(id, 3.0);
    vec2 vizinho = q + (qual < 0.5 ? vec2(1.0, 0.0) : qual < 1.5 ? vec2(0.0, 1.0) : vec2(1.0, 1.0));
    float nasceuA;
    float nasceuB;
    if (!noDaRede(q, a, nasceuA) || !noDaRede(vizinho, b, nasceuB)) { gl_Position = FORA; return; }
    cor = mix(uCorDoAcento, uSucesso, 0.5);
    alfa = min(nasceuA, nasceuB) * 0.34;
    // Metade das arestas leva um pulso: a rede está viva, alguém está olhando.
    pulso = step(0.5, hashCelula(q + qual * 7.0 + 331.0));
  } else if (id < totalDaRede + totalDeCelulas) {
    Marcador m;
    if (!marcadorDaCelula(id - totalDaRede, m)) { gl_Position = FORA; return; }
    a = noDoMonte(m.grupo);
    b = m.cabeca;
    cor = m.cor;
    // A aresta só aparece quando o glifo pousa, e se solta quando ele é corrigido.
    alfa = m.alfa * 0.46 * smoothstep(0.75, 1.0, m.chegada) * (1.0 - smoothstep(0.0, 0.5, m.corrigida));
    pulso = step(0.6, hashCelula(vec2(id, 337.0)));
  } else {
    // Os dois montes de cada lado se ligam: é uma rede, não quatro ilhas.
    int g = id < totalDaRede + totalDeCelulas + 0.5 ? 0 : 2;
    a = noDoMonte(g);
    b = noDoMonte(g + 1);
    cor = mix(corDoMonte(g), corDoMonte(g + 1), 0.5);
    alfa = 0.45 * uFormado;
    meia = 0.5;
    pulso = 1.0;
  }

  if (alfa < 0.004) { gl_Position = FORA; return; }
  // O ping se propaga pela rede: a aresta acende quando o anel passa pelo meio dela.
  float eco = ecoDoPing(0.5 * (a.xy + b.xy));
  alfa = min(1.0, alfa * (1.0 + 1.8 * eco));
  cor = mix(cor, vec3(1.0), ${f(TERRENO.tomClaro)} * eco);
  float desloc;
  gl_Position = segmento(a, b, position.x, position.y, meia, desloc);
  vLinha = vec2(desloc, meia);
  vCor = vec4(cor, alfa * neblinaEm(gl_Position.w));
  vPulso = vec3(position.x, hashCelula(vec2(id, 341.0)), pulso);
}
`;

/**
 * Nós do grafo, numa draw call: [0, R) os nós da rede do epílogo; os 4
 * últimos, o nó central de cada monte.
 */
export const VERTEX_NO = /* glsl */ `
${GLSL_COMUM}
${GLSL_RELEVO}
${GLSL_MARCADOR}

varying vec2 vCanto;
// x = raio do disco (fração do cartaz), y = força do anel.
varying vec2 vForma;
varying vec4 vCor;

void main() {
  float id = float(gl_InstanceID);
  float totalDaRede = uGradeDaRede.x * uGradeDaRede.y;
  vec3 centro;
  vec3 cor;
  float alfa;
  float raioPx;
  float anel = 0.0;

  if (id < totalDaRede) {
    vec2 q = vec2(mod(id, uGradeDaRede.x), floor(id / uGradeDaRede.x));
    float nasceu;
    if (!noDaRede(q, centro, nasceu)) { gl_Position = FORA; return; }
    float h = hashCelula(q + 347.0);
    raioPx = mix(2.0, 3.4, h);
    cor = mix(uCorDoAcento, uSucesso, 0.35 + 0.4 * h);
    alfa = nasceu * mix(0.6, 1.0, h);
  } else {
    int g = int(id - totalDaRede);
    centro = noDoMonte(g);
    raioPx = 6.5;
    anel = 1.0;
    cor = corDoMonte(g);
    // O nó fica mesmo com o monte resolvido: verde, é o que restou a vigiar.
    alfa = uFormado;
    if (g == 0) alfa *= 1.0 - ${f(TERRENO.discricaoDaBaixa)} * uEstavel;
  }

  if (alfa < 0.004) { gl_Position = FORA; return; }
  // O ping toca o nó: ele cresce e acende por um instante.
  float eco = ecoDoPing(centro.xy);
  raioPx *= 1.0 + 0.5 * eco;
  alfa = min(1.0, alfa * (1.0 + eco));
  cor = mix(cor, vec3(1.0), ${f(TERRENO.tomClaro)} * eco);
  // O cartaz tem 3× o raio do disco: o resto é o brilho e o anel.
  gl_Position = cartaz(centro, position.xy, vec2(raioPx * 3.0));
  vCanto = position.xy;
  vForma = vec2(1.0 / 3.0, anel);
  vCor = vec4(cor, alfa * neblinaEm(gl_Position.w));
}
`;

export const FRAGMENT_NO = /* glsl */ `
uniform float uTempo;
varying vec2 vCanto;
varying vec2 vForma;
varying vec4 vCor;

void main() {
  float r = length(vCanto);
  float borda = fwidth(r);
  float disco = 1.0 - smoothstep(vForma.x - borda, vForma.x + borda, r);
  // Anel em volta dos nós dos montes, pulsando devagar.
  float raioDoAnel = vForma.x * (1.9 + 0.25 * sin(uTempo * 1.4));
  float anel = vForma.y * (1.0 - smoothstep(borda, borda * 2.5, abs(r - raioDoAnel)));
  float brilho = exp(-r * r * 7.0) * 0.4;
  float alfa = clamp(disco + anel * 0.8 + brilho, 0.0, 1.0) * vCor.a * (1.0 - smoothstep(0.9, 1.0, r));
  // O miolo é um tom mais claro: o nó parece aceso.
  vec3 cor = mix(vCor.rgb, vec3(1.0), ${f(TERRENO.tomClaro)} * disco);
  gl_FragColor = vec4(cor * alfa, alfa);
}
`;

/**
 * Fragmento de linha (hastes e arestas): borda suavizada na conta, alfa
 * pré-multiplicado e, nas arestas, um pulso de luz que corre de uma ponta à outra.
 */
export const FRAGMENT_LINHA = /* glsl */ `
uniform float uTempo;
varying vec2 vLinha;
varying vec4 vCor;
varying vec3 vPulso;
void main() {
  float d = (vPulso.x - fract(uTempo * 0.35 + vPulso.y)) / 0.09;
  float pulso = exp(-d * d) * vPulso.z;
  float alfa = clamp(vLinha.y + 0.5 - abs(vLinha.x), 0.0, 1.0) * min(1.0, vCor.a * (1.0 + 2.2 * pulso));
  vec3 cor = mix(vCor.rgb, vec3(1.0), ${f(TERRENO.tomClaro)} * pulso);
  gl_FragColor = vec4(cor * alfa, alfa);
}
`;
