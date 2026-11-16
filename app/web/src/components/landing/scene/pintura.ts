/**
 * components/landing/scene/pintura.ts
 *
 * O QUE FAZ
 * A pintura dos atos 3–5 da cena narrativa (ADR-054): milhares de pinceladas
 * que seguem um campo de fluxo, desenhadas numa camada de tinta que acumula e
 * desbota (`src/three/acumulacao.ts`). A passada de tela (`shaders.ts`) só lê
 * essa camada e a compõe com o ASCII, os halos e o granulado.
 *
 * COMO
 * - Uma única malha instanciada, uma draw call: cada instância é uma fita de
 *   `PINTURA.segmentos` trechos, afinada nas pontas. Não há buffer por
 *   pincelada: o vértice deriva tudo do número da instância (`gl_InstanceID`).
 * - Pincelada do fundo: nasce num ponto de uma grade com jitter (mais densa
 *   nas bordas), e o vértice integra o campo de fluxo a partir dali — a fita
 *   é um pedaço da linha de fluxo, curva, sem quinas. A posição é função do
 *   tempo, não estado guardado: não precisa de textura de posição nem de alvo
 *   em ponto flutuante, e redimensionar a tela não perde nada.
 *   O campo é congelado no instante em que a pincelada nasce; se acompanhasse
 *   o relógio, a linha inteira deslizaria de lado enquanto a pincelada anda.
 * - Pincelada de falha: uma para cada célula que o ASCII marca como falha
 *   (mesmo hash do shader de células), então nasce exatamente onde o glifo
 *   esmaece, migra para o grupo da sua severidade e gira em volta dele.
 * - Cores em sRGB, lidas dos tokens em runtime: a tinta se mistura como num
 *   canvas 2D, e 8 bits bastam sem faixas nos tons escuros.
 *
 * As contas espelham `pintura-logica.ts`, onde são testadas sem WebGL.
 * Não use crase dentro dos templates GLSL: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `use-landing-scene.ts` (chunk lazy da cena).
 */

import * as THREE from "three";
import { criarAcumulacao } from "../../../three/acumulacao";
import { lerCorDoToken } from "../../../three/palette";
import { PINTURA } from "./config";
import { CENTRO_DOS_GRUPOS, PROPORCAO_FALHAS } from "./layout";
import {
  avaliarQualidade, estabilidade, riscoDoGrupo, totalDePinceladas, velocidadeDoFluxo, viradaGlobal, type Qualidade,
} from "./pintura-logica";

const f = (n: number) => n.toFixed(4);

/** A virada num ponto: onda da esquerda para a direita, com ruído por célula. */
export const GLSL_VIRADA = /* glsl */ `
float viradaLocal(float m, float x, float ruido) {
  return smoothstep(0.0, 1.0, m * ${f(1 + PINTURA.ondaDaVirada.x + PINTURA.ondaDaVirada.ruido)}
    - ${f(PINTURA.ondaDaVirada.x)} * x - ${f(PINTURA.ondaDaVirada.ruido)} * ruido);
}
`;

/** Tokens da pintura. Os cinco matizes da marca vêm primeiro, na ordem do shader. */
const TOKENS_MATIZ = ["--vx-indigo", "--vx-accent", "--vx-accent-soft", "--vx-cyan", "--vx-magenta"] as const;
const TOKENS_SEVERIDADE = [
  "--color-severity-low", "--color-severity-medium", "--color-severity-high", "--color-severity-critical",
] as const;
const TOKEN_SUCESSO = "--vx-success";
/** A "luz quente vinda de cima" do ato 5. */
const TOKEN_QUENTE = "--vx-yellow";

/** Passos de Euler por vértice; o campo varia devagar (períodos > 1000 px), 6 bastam. */
const PASSOS_DO_FLUXO = 6;

const VERTEX_PINCELADA = /* glsl */ `
#define PI 3.14159265
uniform vec2 uTela;
uniform float uTempo;
uniform float uProgresso;
uniform float uVirada;
uniform float uVelocidade;
uniform float uEstavel;
uniform vec2 uGradeFluxo;
uniform float uTotalFluxo;
uniform vec2 uGradeAscii;
uniform vec2 uCelulaCss;
uniform vec3 uMatiz[5];
uniform vec3 uSeveridade[4];
uniform vec3 uSucesso;
uniform vec3 uQuente;
// xy = centro do grupo (px CSS), z = risco que resta nele (0 a 1).
uniform vec3 uGrupos[4];

// x = distância à linha central (px, com sinal), y = meia largura (px), z = relevo.
varying vec3 vFita;
varying vec4 vCor;

${GLSL_VIRADA}

// O mesmo hash do shader de células: as falhas saem das mesmas células.
float hashCelula(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float sorteio(float n, float sal) { return hashCelula(vec2(n, sal)); }

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

// Direção do fluxo em p (px CSS). Perto de um grupo com risco em aberto o
// fluxo entra em redemoinho em volta dele.
vec2 fluxo(vec2 p, float t) {
  float a = 1.7 * sin(p.x * 0.0042 + t * 0.12)
    + 1.3 * cos(p.y * 0.0057 - t * 0.09)
    + 0.9 * sin((p.x - p.y) * 0.0021 + t * 0.05);
  vec2 d = vec2(cos(a), sin(a));
  for (int i = 0; i < 4; i++) {
    // Grupo sem risco não puxa o fluxo: nem faz a conta.
    if (uGrupos[i].z < 0.01) continue;
    vec2 r = p - uGrupos[i].xy;
    float d2 = dot(r, r);
    float queda = 1.0 / (1.0 + d2 / ${f((PINTURA.raioDoGrupoPx * 1.6) ** 2)});
    float giro = i < 2 ? 1.0 : -1.0;
    d = mix(d, giro * vec2(-r.y, r.x) / sqrt(d2 + 1.0), 0.9 * uGrupos[i].z * queda * queda);
  }
  return normalize(d + vec2(1e-4, 0.0));
}

void main() {
  float n = float(gl_InstanceID);
  float u = position.x;
  vec2 centro;
  vec2 dir;
  float largura;
  float alfa;
  float relevo;
  vec3 cor;

  if (n < uTotalFluxo) {
    // --- Pincelada do fundo: um pedaço de linha de fluxo.
    float vida = mix(${f(PINTURA.vidaS[0])}, ${f(PINTURA.vidaS[1])}, sorteio(n, 1.0));
    float fase = sorteio(n, 2.0);
    float relogio = uTempo / vida + fase;
    float ciclo = floor(relogio);
    float idade = fract(relogio);
    float nascimento = (ciclo - fase) * vida;

    // Grade com jitter; a cada vida a pincelada renasce noutro ponto da célula.
    vec2 cel = vec2(mod(n, uGradeFluxo.x), floor(n / uGradeFluxo.x));
    vec2 jitter = vec2(hashCelula(cel + ciclo * 0.37 + 5.0), hashCelula(cel.yx + ciclo * 0.53 + 9.0));
    vec2 q = (cel + jitter) / uGradeFluxo;
    // Vinheta: empurra as pinceladas para as bordas, longe da coluna de texto.
    float sx = q.x * 2.0 - 1.0;
    float x = mix(sx, sign(sx) * pow(abs(sx), 0.6), 0.8);
    vec2 origem = vec2(x * 0.54 + 0.5, q.y * 1.1 - 0.05) * uTela;

    float comprimento = mix(${f(PINTURA.comprimentoPx[0])}, ${f(PINTURA.comprimentoPx[1])}, sorteio(n, 3.0));
    float avanco = idade * vida * ${f(PINTURA.velocidadePxS)} * mix(0.6, 1.4, sorteio(n, 5.0)) * uVelocidade;
    // Recém-nascida, a cauda ainda está na origem: a fita cresce a partir dali.
    float passo = max(0.0, avanco - u * comprimento) / ${PASSOS_DO_FLUXO}.0;
    vec2 p = origem;
    for (int i = 0; i < ${PASSOS_DO_FLUXO}; i++) p += fluxo(p, nascimento) * passo;
    centro = p;
    dir = fluxo(p, nascimento);

    float nasceu = viradaLocal(uVirada, origem.x / uTela.x, sorteio(n, 6.0));
    // Na frente da virada a pincelada nasce mais larga e mais clara.
    float frente = nasceu * (1.0 - nasceu) * 4.0;
    largura = mix(${f(PINTURA.larguraPx[0])}, ${f(PINTURA.larguraPx[1])}, pow(sorteio(n, 4.0), 1.5))
      * sin(PI * idade) * (1.0 + 0.9 * frente);
    float lateral = smoothstep(0.2, 0.85, abs(origem.x / uTela.x * 2.0 - 1.0));
    alfa = ${f(PINTURA.alfaDaPincelada)} * nasceu * mix(0.5, 1.0, lateral);
    relevo = step(sorteio(n, 10.0), ${f(PINTURA.relevo)});

    // Cor partida: o matiz vem de manchas grandes que derivam devagar; o
    // sorteio por pincelada quebra a fronteira entre duas manchas.
    vec2 pm = origem * 0.0019 + vec2(uTempo * 0.011, -uTempo * 0.007);
    float mancha = smoothstep(0.18, 0.82, ruido(pm)) + (sorteio(n, 7.0) - 0.5) * 0.3;
    cor = mancha < 0.22 ? uMatiz[0] : mancha < 0.5 ? uMatiz[1] : mancha < 0.7 ? uMatiz[2] : uMatiz[3];
    if (sorteio(n, 8.0) < 0.06) cor = uMatiz[4];
    float tom = ruido(pm * 2.3 + 31.0) + (sorteio(n, 9.0) - 0.5) * 0.5;
    if (tom < 0.38) cor *= ${f(PINTURA.tomEscuro)};
    else if (tom > 0.66) cor = mix(cor, vec3(1.0), ${f(PINTURA.tomClaro)});
    cor = mix(cor, uMatiz[3], 0.45 * frente);
  } else {
    // --- Pincelada de falha: nasce na célula do glifo e vai para o grupo.
    float j = n - uTotalFluxo;
    float idCelula = floor(j / ${PINTURA.porFalha}.0);
    vec2 cel = vec2(mod(idCelula, uGradeAscii.x), floor(idCelula / uGradeAscii.x));
    if (hashCelula(cel + 41.0) > ${f(PROPORCAO_FALHAS)}) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vFita = vec3(0.0);
      vCor = vec4(0.0);
      return;
    }
    float severidade = 1.0 + floor(hashCelula(cel + 53.0) * 4.0);
    int g = int(severidade) - 1;
    float r = hashCelula(cel);
    float h1 = sorteio(j, 11.0);
    float h2 = sorteio(j, 12.0);
    float h3 = sorteio(j, 13.0);

    vec2 casa = (cel + 0.5) * uCelulaCss;
    float nasceu = viradaLocal(uVirada, casa.x / uTela.x, hashCelula(cel + 113.0));
    float chegada = smoothstep(
      ${f(PINTURA.organizar[0])} + r * ${f(PINTURA.espalhamentoDaChegada)},
      ${f(PINTURA.organizar[1])} + r * ${f(PINTURA.espalhamentoDaChegada)},
      uProgresso
    );
    // Corrigir: crítica e alta sempre, média pela metade, baixa nunca.
    float corrigivel = severidade > 2.5 ? 1.0 : (severidade > 1.5 && hashCelula(cel + 83.0) >= 0.5 ? 1.0 : 0.0);
    float inicio = ${f(PINTURA.corrigirInicio)} + (4.0 - severidade) * ${f(PINTURA.atrasoPorSeveridade)}
      + h3 * ${f(PINTURA.espalhamentoDaCorrecao)};
    float corrigida = corrigivel * smoothstep(inicio, inicio + ${f(PINTURA.corrigirDuracao)}, uProgresso);

    // Órbita em volta do centro do grupo; menos graves giram num sentido,
    // mais graves no outro. A fita é um arco da própria órbita (tangente).
    float sentido = severidade > 2.5 ? -1.0 : 1.0;
    float comprimento = mix(${f(PINTURA.comprimentoPx[0] + 6)}, ${f(PINTURA.comprimentoPx[1])}, h1);
    float raio = ${f(PINTURA.raioDoGrupoPx)} * mix(0.2, 1.0, sqrt(h2)) * (1.0 + 0.07 * sin(uTempo * 0.7 + h1 * 6.2832));
    float omega = sentido * mix(0.3, 0.7, h3) * 70.0 / max(raio, 30.0);
    // Enquanto migra, a pincelada chega em espiral.
    float angulo = h1 * 6.2832 + omega * uTempo + (1.0 - chegada) * 2.6 * sentido;
    // Antes de migrar: um traço curto no lugar do glifo, ao longo do fluxo.
    vec2 dCasa = fluxo(casa, uTempo * 0.3);
    vec2 pontos[2];
    for (int i = 0; i < 2; i++) {
      float uu = u + float(i) * 0.02;
      float th = angulo - sentido * uu * comprimento / raio;
      // O raio ondula com o ângulo: a órbita não é um círculo de compasso.
      float raioAqui = raio * (1.0 + 0.1 * sin(3.0 * th + h2 * 6.2832));
      vec2 orbita = uGrupos[g].xy + raioAqui * vec2(cos(th), sin(th) * 0.94);
      float s = (0.5 - uu) * comprimento * 0.7 + 5.0 * sin(uTempo * 1.3 + h1 * 6.2832);
      vec2 lar = casa + dCasa * s + vec2(-dCasa.y, dCasa.x) * s * s * 0.024 * (h2 - 0.5);
      pontos[i] = mix(lar, orbita, chegada);
    }
    // Corrigida, sobe e se dissolve.
    vec2 subida = vec2(sin(corrigida * 3.0 + h1 * 6.2832) * 12.0 * corrigida, corrigida * corrigida * mix(70.0, 150.0, h2));
    centro = pontos[0] + subida;
    dir = normalize(pontos[0] - pontos[1] + vec2(1e-4, 0.0));

    largura = mix(2.4, ${f(PINTURA.larguraPx[1] + 0.8)}, h3) * (1.0 - 0.5 * corrigida);
    alfa = min(1.0, ${f(PINTURA.alfaDaPincelada * 1.6)}) * nasceu * (1.0 - smoothstep(0.55, 1.0, corrigida));
    // Ato 5: a baixa continua, discreta (risco residual aceito).
    if (severidade < 1.5) alfa *= 1.0 - ${f(PINTURA.discricaoDaBaixa)} * uEstavel;
    relevo = step(h1, ${f(PINTURA.relevo)});
    cor = uSeveridade[g] * mix(0.78, 1.0, h2);
    if (h3 > 0.7) cor = mix(cor, vec3(1.0), ${f(PINTURA.tomClaro * 0.6)});
    cor = mix(cor, uSucesso, smoothstep(0.0, 0.35, corrigida));
  }

  if (alfa < 0.004) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vFita = vec3(0.0);
    vCor = vec4(0.0);
    return;
  }
  // Ato 5: luz quente vinda de cima.
  cor = mix(cor, uQuente, uEstavel * (0.1 + 0.42 * clamp(centro.y / uTela.y, 0.0, 1.0)));

  // Fita afinada nas pontas; 0,75 px de folga para a borda suavizada.
  float meia = 0.5 * largura * pow(max(sin(PI * u), 0.0), 0.6);
  vec2 normal = vec2(-dir.y, dir.x);
  float deslocamento = position.y * (meia + 0.75);
  vec2 pos = centro + normal * deslocamento;
  gl_Position = vec4(pos / uTela * 2.0 - 1.0, 0.0, 1.0);
  vFita = vec3(deslocamento, meia, relevo);
  vCor = vec4(cor, alfa);
}
`;

const FRAGMENT_PINCELADA = /* glsl */ `
varying vec3 vFita;
varying vec4 vCor;

void main() {
  // Borda suavizada na conta (sem MSAA): cobertura cai em 1 px no contorno.
  float cobertura = clamp(vFita.y + 0.5 - abs(vFita.x), 0.0, 1.0) * min(1.0, vFita.y * 2.0);
  float alfa = cobertura * vCor.a;
  // Relevo: filete claro fora do centro, como a crista da tinta espessa...
  float filete = 1.0 - smoothstep(${f(PINTURA.fileteDoRelevoPx / 2)}, ${f(PINTURA.fileteDoRelevoPx / 2 + 0.6)}, abs(vFita.x - vFita.y * 0.4));
  float crista = vFita.z * filete * step(1.0, vFita.y);
  vec3 cor = mix(vCor.rgb, mix(vCor.rgb, vec3(1.0), 0.6), crista * 0.85);
  // ...e a borda oposta um pouco mais escura, para a fita ter volume.
  cor *= 1.0 - 0.2 * smoothstep(0.0, 1.0, -vFita.x / max(vFita.y, 0.5));
  // Alfa pré-multiplicado: é o formato da camada de acumulação.
  gl_FragColor = vec4(cor * alfa, alfa);
}
`;

export interface Pintura {
  /** Uniforms que a passada de tela precisa para compor a tinta. */
  uniformesDaTela: {
    uTinta: { value: THREE.Texture };
    uTintaAtiva: { value: number };
    uVirada: { value: number };
    uTetoDaTinta: { value: number };
    /** xy = centro do grupo (px do buffer da tela), z = risco que resta (0 a 1). */
    uHalos: { value: THREE.Vector3[] };
    uRaioDoHalo: { value: number };
    uAlfaDoHalo: { value: number };
    uCorDoHalo: { value: THREE.Color[] };
  };
  /** Lê as cores dos tokens (troca de tema). */
  aplicarPaleta(elemento: Element): void;
  /**
   * Ajusta à tela. `gradeAscii` e `celulaPx` são os da grade de células (px do
   * buffer): as falhas nascem nas mesmas células do ASCII.
   */
  redimensionar(larguraCss: number, alturaCss: number, dprDaTela: number, gradeAscii: THREE.Vector2, celulaPx: THREE.Vector2): void;
  /**
   * Desenha a pintura uma vez, fora da vista, e apaga: os shaders são
   * compilados no carregamento. Sem isso a compilação caía no primeiro quadro
   * da virada (167 ms de engasgo medido no build de produção, 2026-11-15).
   */
  aquecer(renderer: THREE.WebGLRenderer): void;
  /** Um quadro da camada de tinta. Antes da virada não desenha nada. */
  desenhar(renderer: THREE.WebGLRenderer, tempo: number, delta: number, progresso: number): void;
  descartar(): void;
}

export function criarPintura(): Pintura {
  const acumulacao = criarAcumulacao();
  const cores = (total: number) => Array.from({ length: total }, () => new THREE.Color());
  const grupos = Array.from({ length: 4 }, () => new THREE.Vector3());
  const halos = Array.from({ length: 4 }, () => new THREE.Vector3());

  const uVirada = { value: 0 };
  const uniformes = {
    uTela: { value: new THREE.Vector2(1, 1) },
    uTempo: { value: 0 },
    uProgresso: { value: 0 },
    uVirada,
    uVelocidade: { value: 1 },
    uEstavel: { value: 0 },
    uGradeFluxo: { value: new THREE.Vector2(1, 1) },
    uTotalFluxo: { value: 0 },
    uGradeAscii: { value: new THREE.Vector2(1, 1) },
    uCelulaCss: { value: new THREE.Vector2(1, 1) },
    uMatiz: { value: cores(TOKENS_MATIZ.length) },
    uSeveridade: { value: cores(TOKENS_SEVERIDADE.length) },
    uSucesso: { value: new THREE.Color() },
    uQuente: { value: new THREE.Color() },
    uGrupos: { value: grupos },
  };
  const uniformesDaTela: Pintura["uniformesDaTela"] = {
    uTinta: acumulacao.uniforme,
    uTintaAtiva: { value: 0 },
    uVirada,
    uTetoDaTinta: { value: PINTURA.tetoDeAlfa },
    uHalos: { value: halos },
    uRaioDoHalo: { value: 1 },
    uAlfaDoHalo: { value: PINTURA.alfaDoHalo },
    // Mesmos objetos de cor das pinceladas de falha (sRGB).
    uCorDoHalo: { value: uniformes.uSeveridade.value },
  };

  // Fita-base: x = posição ao longo (0 = cabeça, 1 = cauda), y = lado (-1 ou 1).
  const geometria = new THREE.InstancedBufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  for (let k = 0; k <= PINTURA.segmentos; k += 1) {
    vertices.push(k / PINTURA.segmentos, -1, 0, k / PINTURA.segmentos, 1, 0);
    if (k < PINTURA.segmentos) indices.push(2 * k, 2 * k + 1, 2 * k + 2, 2 * k + 1, 2 * k + 3, 2 * k + 2);
  }
  geometria.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometria.setIndex(indices);
  geometria.instanceCount = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: uniformes,
    vertexShader: VERTEX_PINCELADA,
    fragmentShader: FRAGMENT_PINCELADA,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: false,
    depthWrite: false,
    // A fita vira conforme o fluxo: os dois lados contam.
    side: THREE.DoubleSide,
  });
  const malha = new THREE.Mesh(geometria, material);
  // As posições saem do shader; não há caixa para recortar.
  malha.frustumCulled = false;
  const cena = new THREE.Scene();
  cena.add(malha);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let ativa = false;
  let qualidade: Qualidade = { nivel: 0, lentos: 0 };
  // Última medida da tela: o rebaixamento de qualidade refaz o ajuste com ela.
  const tela = { largura: 1, altura: 1, dpr: 1, celula: new THREE.Vector2(1, 1) };

  function ajustar(): void {
    const degrau = PINTURA.qualidade[qualidade.nivel];
    const dprDaTinta = Math.min(window.devicePixelRatio || 1, degrau.maxDpr);
    acumulacao.redimensionar(tela.largura * dprDaTinta, tela.altura * dprDaTinta);
    const { colunas, linhas } = totalDePinceladas(tela.largura, tela.altura, degrau.pinceladas);
    const gradeAscii = uniformes.uGradeAscii.value;
    uniformes.uTela.value.set(tela.largura, tela.altura);
    uniformes.uGradeFluxo.value.set(colunas, linhas);
    uniformes.uTotalFluxo.value = colunas * linhas;
    uniformes.uCelulaCss.value.copy(tela.celula).divideScalar(tela.dpr);
    geometria.instanceCount = colunas * linhas + gradeAscii.x * gradeAscii.y * PINTURA.porFalha;
    ([1, 2, 3, 4] as const).forEach((severidade, i) => {
      const [cx, cy] = CENTRO_DOS_GRUPOS[severidade];
      grupos[i].set((cx * 0.5 + 0.5) * tela.largura, (cy * 0.5 + 0.5) * tela.altura, grupos[i].z);
      halos[i].set(grupos[i].x * tela.dpr, grupos[i].y * tela.dpr, halos[i].z);
    });
    uniformesDaTela.uRaioDoHalo.value = PINTURA.raioDoGrupoPx * 1.5 * tela.dpr;
  }

  function lerSrgb(elemento: Element, token: string, destino: THREE.Color): void {
    lerCorDoToken(elemento, token, destino);
    destino.convertLinearToSRGB();
  }

  return {
    uniformesDaTela,
    aplicarPaleta(elemento) {
      TOKENS_MATIZ.forEach((token, i) => lerSrgb(elemento, token, uniformes.uMatiz.value[i]));
      TOKENS_SEVERIDADE.forEach((token, i) => lerSrgb(elemento, token, uniformes.uSeveridade.value[i]));
      lerSrgb(elemento, TOKEN_SUCESSO, uniformes.uSucesso.value);
      lerSrgb(elemento, TOKEN_QUENTE, uniformes.uQuente.value);
    },
    redimensionar(larguraCss, alturaCss, dprDaTela, gradeAscii, celulaPx) {
      Object.assign(tela, { largura: larguraCss, altura: alturaCss, dpr: dprDaTela });
      tela.celula.copy(celulaPx);
      uniformes.uGradeAscii.value.copy(gradeAscii);
      ajustar();
    },
    aquecer(renderer) {
      acumulacao.pintar(renderer, cena, camera, 1);
      acumulacao.limpar(renderer);
    },
    desenhar(renderer, tempo, delta, progresso) {
      const virada = viradaGlobal(progresso);
      uVirada.value = virada;
      if (virada <= 0) {
        // Voltou para os atos ASCII: a tinta não pode reaparecer com rastro velho.
        if (ativa) acumulacao.limpar(renderer);
        ativa = false;
        uniformesDaTela.uTintaAtiva.value = 0;
        return;
      }
      uniformes.uTempo.value = tempo;
      uniformes.uProgresso.value = progresso;
      uniformes.uVelocidade.value = velocidadeDoFluxo(progresso);
      uniformes.uEstavel.value = estabilidade(progresso);
      ([1, 2, 3, 4] as const).forEach((severidade, i) => {
        grupos[i].z = riscoDoGrupo(severidade, progresso);
        halos[i].z = grupos[i].z;
      });
      // O desbote é por quadro a 60 fps; com quadro mais longo, desbota o equivalente.
      acumulacao.pintar(renderer, cena, camera, (1 - PINTURA.desbotePorQuadro) ** (delta * 60));
      ativa = true;
      uniformesDaTela.uTintaAtiva.value = 1;
      // Máquina sem fôlego: desce um degrau de qualidade (ver PINTURA.qualidade).
      const anterior = qualidade.nivel;
      qualidade = avaliarQualidade(qualidade, delta);
      if (qualidade.nivel !== anterior) ajustar();
    },
    descartar() {
      acumulacao.descartar();
      geometria.dispose();
      material.dispose();
    },
  };
}
