/**
 * components/landing/scene/shaders.ts
 *
 * O QUE FAZ
 * GLSL da cena narrativa, em duas passadas:
 *   1. FRAGMENT_CELULAS roda uma vez por célula de caractere (textura do
 *      tamanho da grade, `src/three/grade-celulas.ts`) e decide, pelo
 *      progresso (0 a 5, um por ato), glifo, cor e alfa. A partir da virada
 *      (ato 3, ADR-055) cada célula esmaece e o terreno nasce no lugar.
 *   2. FRAGMENT_TELA roda por pixel: lê a célula, carimba o glifo do atlas
 *      (`src/three/ascii.ts`) com scanlines e compõe a camada 3D do terreno
 *      (`terreno.ts`) e os halos dos montes.
 * Estética de terminal hacker (ASCII, scanlines, glitch raro, acentos neon),
 * sem logos nem assets de terceiros.
 *
 * POR QUE EXISTE
 * Nenhum vértice por caractere, nenhuma geometria por ato. As duas passadas
 * existem por desempenho: a lógica só muda por célula e, por pixel, custava
 * ~250× mais do que precisa (rolagem a 31 fps na GPU integrada, 2026-11-03).
 * Movimento contínuo (uTempo, 60 fps): o campo respira e o alerta pulsa em
 * curva suave. Só a troca de glifo e o glitch seguem em "tiques" — trocar
 * caractere é discreto por natureza.
 * O clique no fundo é um ping de scanner (`src/three/pings.ts`): um anel de
 * glifos se abre a partir do ponto e, por onde passa, a falha escondida
 * aparece na cor da severidade por um instante.
 *
 * Os atos seguem `docs/LANDING_NARRATIVA.md` §3. O espelho sem animação está
 * em `estadoDaCelula` (layout.ts), usado pelo pôster — que continua contando
 * os atos 3–5 em ASCII (grupos e "✓"); aqui eles são do terreno.
 * Não use crase dentro destes templates: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `use-landing-scene.ts`.
 */

import { GLSL_ASCII } from "../../../three/ascii";
import { glslDoPing } from "../../../three/pings";
import { GLSL_LER_CELULAS } from "../../../three/grade-celulas";
import { PROPORCAO_FALHAS } from "./layout";
import { GLIFO, TRANSICAO_CENA, VINHETA } from "./config";
import { GLSL_VIRADA } from "./terreno-shaders";

/** Ids de cor gravados na textura de células (canal g). */
export const COR = { base: 0, neon: 1, glitch: 2, baixa: 3, media: 4, alta: 5, critica: 6, resolvido: 7 } as const;

export { VERTEX_TELA_CHEIA as VERTEX_ASCII } from "../../../three/grade-celulas";

/** Passada 1: uma execução por célula; grava (glifo, id de cor, alfa). */
export const FRAGMENT_CELULAS = /* glsl */ `
${GLSL_ASCII}

uniform float uProgresso;
uniform float uTique;
uniform float uTempo;
uniform float uVirada;
// Ping de scanner: pontos em px do buffer; sem ping vivo o laço nem roda.
uniform float uPingsAtivos;
uniform float uDpr;
${glslDoPing({ funcao: "pingNaTela", uniforme: "uPings", pxPorUnidade: "uDpr" })}
uniform float uAlfaSaudavel;
uniform float uAlfaDestaque;
uniform float uAlfaFeixe;
uniform float uTransicaoInicio;
uniform float uTransicaoSentido;

${GLSL_VIRADA}

float glifoDaSeveridade(float s) {
  if (s < 1.5) return ${GLIFO.baixa}.0;
  if (s < 2.5) return ${GLIFO.media}.0;
  if (s < 3.5) return ${GLIFO.alta}.0;
  return ${GLIFO.critica}.0;
}

// Severidade 1..4 -> id de cor (baixa..crítica).
float corDaSeveridade(float s) { return ${COR.baixa - 1}.0 + s; }

void main() {
  // Cada texel desta passada é uma célula.
  vec2 celula = floor(gl_FragCoord.xy);
  vec2 grade = gradeDaTela();
  float p = uProgresso;

  // Glitch raro: em poucos tiques, uma faixa de duas linhas desliza duas células.
  float glitch = step(0.93, hashCelula(vec2(uTique, 7.0)));
  float faixa = floor(hashCelula(vec2(uTique, 9.0)) * grade.y);
  float naFaixa = glitch * step(faixa, celula.y) * step(celula.y, faixa + 1.0);
  celula.x += naFaixa * 2.0;

  vec2 clip = (celula + 0.5) / grade * 2.0 - 1.0;
  float r = hashCelula(celula);
  float rFalha = hashCelula(celula + 41.0);
  float rSev = hashCelula(celula + 53.0);
  float rTique = hashCelula(celula + vec2(uTique, 3.0));

  // --- Ato 0 (Funciona): campo de terminal calmo, com troca rara de glifo.
  // Vinheta: esparso atrás da coluna de texto, mais cheio nas laterais —
  // a cena emoldura o conteúdo em vez de competir com ele.
  float lateral = smoothstep(${VINHETA.inicio.toFixed(2)}, ${VINHETA.fim.toFixed(2)}, abs(clip.x));
  float presente = step(1.0 - mix(${VINHETA.densidadeCentro.toFixed(2)}, ${VINHETA.densidadeLateral.toFixed(2)}, lateral), r);
  float cintila = step(0.95, rTique);
  float sorteio = mix(hashCelula(celula + 29.0), rTique, cintila);
  float binario = step(0.75, hashCelula(celula + 61.0));
  // Quadrado do sorteio: a rampa pesa para os glifos leves (. · :).
  float indice = binario > 0.5
    ? mix(${GLIFO.zero}.0, ${GLIFO.um}.0, step(0.5, sorteio))
    : ${GLIFO.rampaInicio}.0 + floor(sorteio * sorteio * ${GLIFO.rampaTotal}.0);
  float cor = step(0.97, hashCelula(celula + 71.0)) > 0.5 ? ${COR.neon}.0 : ${COR.base}.0;
  // Respiração lenta e dessincronizada: brilho contínuo, sem salto por tique.
  float respira = 0.78 + 0.22 * sin(uTempo * 0.8 + r * 6.2832);
  float alfa = presente * uAlfaSaudavel * mix(0.55, 1.0, r) * mix(0.6, 1.0, lateral) * respira;

  // --- Falhas espalhadas na grade (≈ 4,5% das células).
  float falha = step(rFalha, ${PROPORCAO_FALHAS.toFixed(3)});
  float sev = 1.0 + floor(rSev * 4.0);

  // Ato 1 (Mas tem falhas): "!" pulsando devagar, ainda sem cor de severidade.
  float pisca = 0.5 + 0.5 * sin((uTempo * 0.9 + r) * 6.2832);
  float alerta = falha * smoothstep(0.25, 0.9, p) * (1.0 - smoothstep(1.4, 2.0, p));
  // Ato 2 (Encontrar): a varredura passa e revela a severidade.
  float trecho = clamp(p - 1.0, 0.0, 1.0);
  float feixeX = mix(-1.15, 1.15, trecho);
  float revelado = falha * smoothstep(clip.x, clip.x + 0.1, feixeX);

  // A falha revelada fica no lugar até a virada alcançar a célula (ato 3):
  // ali o glifo esmaece e o mesmo glifo se ergue do terreno (terreno.ts).
  if (falha > 0.5) {
    if (revelado > 0.01) {
      indice = glifoDaSeveridade(sev);
      cor = corDaSeveridade(sev);
      alfa = uAlfaDestaque * revelado;
    } else if (alerta > 0.01) {
      indice = ${GLIFO.alerta}.0;
      alfa = mix(uAlfaSaudavel, uAlfaDestaque, alerta * pisca);
    }
  }

  // --- Ping de scanner (clique no fundo): o anel é feito de glifos da rampa,
  // em neon, e o que ele toca responde — a falha escondida aparece na cor da
  // severidade e some com o eco. Nunca passa do alfa de destaque, o limite
  // que o teste de contraste garante.
  if (uPingsAtivos > 0.5) {
    vec2 ping = pingNaTela((celula + 0.5) * uCelula);
    float eco = max(ping.x, ping.y);
    float alfaDoAnel = uAlfaDestaque * ping.x;
    if (alfaDoAnel > alfa) {
      // Os glifos mais cheios da rampa (":" a "="): o anel precisa ler de longe.
      indice = ${GLIFO.rampaInicio + 2}.0 + floor(ping.x * ${(GLIFO.rampaTotal - 2.01).toFixed(2)});
      cor = ${COR.neon}.0;
      alfa = alfaDoAnel;
    }
    if (falha > 0.5 && uAlfaDestaque * eco >= alfa * 0.6) {
      indice = glifoDaSeveridade(sev);
      cor = corDaSeveridade(sev);
      alfa = max(alfa, uAlfaDestaque * eco);
    } else {
      // O campo calmo só acende um pouco quando o anel passa.
      alfa = min(alfa * (1.0 + 0.8 * eco), max(alfa, uAlfaDestaque));
    }
  }

  // --- Varredura (ato 2): blocos neon com franja magenta logo atrás.
  float presenca = sin(trecho * 3.14159);
  float distanciaFeixe = abs(clip.x - feixeX) * grade.x * 0.5;
  if (presenca > 0.001 && distanciaFeixe < 4.0) {
    float bloco = clamp(floor(distanciaFeixe), 0.0, 3.0);
    indice = ${GLIFO.blocoCheio}.0 - bloco;
    cor = clip.x < feixeX && bloco > 1.5 ? ${COR.glitch}.0 : ${COR.neon}.0;
    alfa = uAlfaFeixe * presenca * (1.0 - bloco / 4.0);
  }

  // Faixa de glitch tingida de magenta.
  if (naFaixa > 0.5) cor = ${COR.glitch}.0;

  // --- Transição entre seções: faixa de "=" / "-" no sentido da rolagem.
  // Easing suave (smoothstep), frente nítida e rastro longo atrás dela.
  float tt = uTempo - uTransicaoInicio;
  if (tt > 0.0 && tt < ${TRANSICAO_CENA.duracaoS.toFixed(2)}) {
    float k = tt / ${TRANSICAO_CENA.duracaoS.toFixed(2)};
    float suave = k * k * (3.0 - 2.0 * k);
    float frente = uTransicaoSentido * (1.15 - 2.3 * suave);
    // Distância em linhas, positiva ATRÁS da frente (de onde a faixa veio).
    float dv = (clip.y - frente) * uTransicaoSentido * grade.y * 0.5;
    float banda = dv < 0.0 ? exp(-dv * dv * 0.8) : exp(-dv / ${TRANSICAO_CENA.rastroLinhas.toFixed(1)});
    // Entra e sai sem corte: sobe nos primeiros 10% e esmaece no fim.
    banda *= min(1.0, k * 10.0) * (1.0 - k * k);
    float alfaFaixa = banda * uAlfaFeixe;
    if (banda > 0.05 && alfaFaixa >= alfa * 0.6) {
      indice = banda > 0.6 ? ${GLIFO.igual}.0 : ${GLIFO.traco}.0;
      cor = banda > 0.35 ? ${COR.neon}.0 : ${COR.base}.0;
      alfa = max(alfa, alfaFaixa);
    }
  }

  // --- Virada (ato 3): onda da esquerda para a direita; o glifo esmaece onde
  // o terreno nasce. A conta é a mesma do fragmento do terreno.
  float xTela = (celula.x + 0.5) * uCelula.x / uResolucao.x;
  alfa *= 1.0 - viradaLocal(uVirada, xTela, hashCelula(celula + 113.0));

  gl_FragColor = vec4(indice / 255.0, cor / 255.0, clamp(alfa, 0.0, 1.0), 1.0);
}
`;

/** Passada 2: por pixel — glifo do atlas, scanlines e a camada do terreno. */
export const FRAGMENT_TELA = /* glsl */ `
${GLSL_ASCII}
${GLSL_LER_CELULAS}

uniform vec3 uCorBase;
uniform vec3 uCorNeon;
uniform vec3 uCorGlitch;
uniform vec3 uCorBaixa;
uniform vec3 uCorMedia;
uniform vec3 uCorAlta;
uniform vec3 uCorCritica;
uniform vec3 uCorResolvido;
// Terreno (atos 3–5): camada 3D em sRGB com alfa pré-multiplicado.
uniform sampler2D uCamada;
uniform float uCamadaAtiva;
uniform float uVirada;
uniform float uTetoDaCamada;
uniform vec3 uHalos[4];
uniform vec3 uCorDoHalo[4];
uniform float uRaioDoHalo;
uniform float uAlfaDoHalo;

vec3 corPorId(float id) {
  if (id < ${COR.neon}.5) return id < ${COR.base}.5 ? uCorBase : uCorNeon;
  if (id < ${COR.glitch}.5) return uCorGlitch;
  if (id < ${COR.baixa}.5) return uCorBaixa;
  if (id < ${COR.media}.5) return uCorMedia;
  if (id < ${COR.alta}.5) return uCorAlta;
  if (id < ${COR.critica}.5) return uCorCritica;
  return uCorResolvido;
}

void main() {
  // Saída em sRGB com alfa pré-multiplicado.
  vec4 saida = vec4(0.0);

  // Depois da virada completa não há glifo: pula a leitura do atlas.
  if (uVirada < 0.999) {
    vec4 dado = lerCelula(celulaDaTela());
    // Scanlines: uma linha de pixel a cada três, mais escura.
    float scanline = 1.0 - 0.18 * step(2.0, mod(floor(gl_FragCoord.y), 3.0));
    float cobertura = coberturaDoGlifo(byte(dado.r)) * dado.b * scanline;
    saida = vec4(linearToOutputTexel(vec4(corPorId(byte(dado.g)), 1.0)).rgb * cobertura, cobertura);
  }

  if (uCamadaAtiva > 0.5) {
    // Um grão fino por pixel quebra o degradê liso do preenchimento (8 bits).
    float grao = hashCelula(floor(gl_FragCoord.xy)) - 0.5;
    vec4 camada = texture2D(uCamada, gl_FragCoord.xy / uResolucao) * uTetoDaCamada * (1.0 + 0.05 * grao);

    // Halos: luz suave atrás de cada monte, proporcional ao risco que resta.
    vec4 halo = vec4(0.0);
    for (int i = 0; i < 4; i++) {
      vec2 d = (gl_FragCoord.xy - uHalos[i].xy) / uRaioDoHalo;
      float brilho = exp(-dot(d, d)) * uHalos[i].z * uAlfaDoHalo;
      halo += vec4(uCorDoHalo[i] * brilho, brilho);
    }
    vec4 fundo = camada + halo * (1.0 - camada.a);
    saida += fundo * (1.0 - saida.a);
  }

  gl_FragColor = saida;
}
`;
