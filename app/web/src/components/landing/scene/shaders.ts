/**
 * components/landing/scene/shaders.ts
 *
 * O QUE FAZ
 * GLSL da cena narrativa, em duas passadas:
 *   1. FRAGMENT_CELULAS roda uma vez por célula de caractere (textura do
 *      tamanho da grade, `src/three/grade-celulas.ts`) e decide, pelo
 *      progresso (0 a 5, um por ato), glifo, cor e alfa. A partir da virada
 *      (ato 3, ADR-054) cada célula esmaece e a pincelada nasce no lugar.
 *   2. FRAGMENT_TELA roda por pixel: lê a célula, aplica a onda da gota,
 *      carimba o glifo do atlas (`src/three/ascii.ts`) com scanlines e compõe
 *      a camada de tinta (`pintura.ts`), os halos dos grupos e o granulado.
 * Estética de terminal hacker (ASCII, scanlines, glitch raro, acentos neon),
 * sem logos nem assets de terceiros.
 *
 * POR QUE EXISTE
 * Nenhum vértice por caractere, nenhuma geometria por ato. As duas passadas
 * existem por desempenho: a lógica só muda por célula e, por pixel, custava
 * ~250× mais do que precisa (rolagem a 31 fps na GPU integrada, 2026-11-03).
 * Movimento contínuo (uTempo, 60 fps): o campo respira, o alerta pulsa em
 * curva suave e a gota do clique (`src/three/gotas.ts`) ondula. Só a troca
 * de glifo e o glitch seguem em "tiques" — trocar caractere é discreto por
 * natureza.
 *
 * Os atos seguem `docs/LANDING_NARRATIVA.md` §3. O espelho sem animação está
 * em `estadoDaCelula` (layout.ts), usado pelo pôster — que continua contando
 * os atos 3–5 em ASCII (grupos e "✓"); aqui eles são da pintura.
 * Não use crase dentro destes templates: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `use-landing-scene.ts`.
 */

import { GLSL_ASCII } from "../../../three/ascii";
import { GLSL_GOTAS, GOTA } from "../../../three/gotas";
import { GLSL_LER_CELULAS } from "../../../three/grade-celulas";
import { PROPORCAO_FALHAS } from "./layout";
import { GLIFO, TRANSICAO_CENA, VINHETA } from "./config";
import { GLSL_VIRADA } from "./pintura";

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
  // ali o glifo esmaece e a pincelada da mesma severidade nasce (pintura.ts).
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
  // a pincelada nasce. A conta é a mesma do vértice das pinceladas.
  float xTela = (celula.x + 0.5) * uCelula.x / uResolucao.x;
  alfa *= 1.0 - viradaLocal(uVirada, xTela, hashCelula(celula + 113.0));

  gl_FragColor = vec4(indice / 255.0, cor / 255.0, clamp(alfa, 0.0, 1.0), 1.0);
}
`;

/** Passada 2: por pixel — gota, glifo do atlas, scanlines e a camada de tinta. */
export const FRAGMENT_TELA = /* glsl */ `
${GLSL_ASCII}
${GLSL_GOTAS}
${GLSL_LER_CELULAS}

uniform float uGotasAtivas;
uniform float uAlfaDestaque;
uniform vec3 uCorBase;
uniform vec3 uCorNeon;
uniform vec3 uCorGlitch;
uniform vec3 uCorBaixa;
uniform vec3 uCorMedia;
uniform vec3 uCorAlta;
uniform vec3 uCorCritica;
uniform vec3 uCorResolvido;
// Pintura (atos 3–5): tinta acumulada em sRGB com alfa pré-multiplicado.
uniform sampler2D uTinta;
uniform float uTintaAtiva;
uniform float uVirada;
uniform float uTetoDaTinta;
uniform vec3 uHalos[4];
uniform vec3 uCorDoHalo[4];
uniform float uRaioDoHalo;
uniform float uAlfaDoHalo;
uniform vec2 uTexelDaTinta;
uniform float uLuzDoRelevo;

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
  // Água: a onda das gotas desloca a leitura (refração) — da grade nos atos
  // ASCII, da tinta nos atos de pintura. Sem gota viva, o laço nem roda.
  vec4 onda = uGotasAtivas > 0.5 ? ondaDasGotas(gl_FragCoord.xy) : vec4(0.0);
  vec2 pos = gl_FragCoord.xy - onda.xy * uCelula.x * ${GOTA.deslocamentoCelulas.toFixed(2)};
  // Saída em sRGB com alfa pré-multiplicado.
  vec4 saida = vec4(0.0);

  // Depois da virada completa não há glifo: pula a leitura do atlas.
  if (uVirada < 0.999) {
    vec4 dado = lerCelula(celulaEm(pos));
    float indice = byte(dado.r);
    vec3 cor = corPorId(byte(dado.g));
    float alfa = dado.b;

    // Crista da onda: um anel de glifos da rampa, puxado para o neon. Nunca passa
    // do alfa de destaque — o limite que o teste de contraste garante. Some com
    // a virada: sobre a pintura a gota só refrata a tinta.
    float crista = smoothstep(0.04, 0.45, onda.z);
    float alfaOnda = uAlfaDestaque * crista * (1.0 - uVirada);
    if (alfaOnda > alfa) {
      indice = ${GLIFO.rampaInicio}.0 + floor(crista * ${(GLIFO.rampaTotal - 0.01).toFixed(2)});
      cor = mix(uCorBase, uCorNeon, crista);
      alfa = alfaOnda;
    }
    alfa = max(alfa, min(alfa * (1.0 + 0.6 * onda.w), uAlfaDestaque));

    // Scanlines: uma linha de pixel a cada três, mais escura.
    float scanline = 1.0 - 0.18 * step(2.0, mod(floor(gl_FragCoord.y), 3.0));
    float cobertura = coberturaDoGlifoEm(indice, pos) * alfa * scanline;
    saida = vec4(linearToOutputTexel(vec4(cor, 1.0)).rgb * cobertura, cobertura);
  }

  if (uTintaAtiva > 0.5) {
    vec2 uvTinta = pos / uResolucao;
    vec4 tinta = texture2D(uTinta, uvTinta);
    // Relevo: o alfa acumulado é a espessura da tinta. A luz vem de cima e da
    // esquerda: a borda voltada para ela clareia, a oposta escurece — a tinta
    // ganha volume sem nenhuma geometria a mais.
    vec2 passo = uTexelDaTinta * 1.5;
    float inclinacao = (texture2D(uTinta, uvTinta + vec2(-passo.x, passo.y)).a
      - texture2D(uTinta, uvTinta + vec2(passo.x, -passo.y)).a);
    float luz = clamp(inclinacao * 2.2, -1.0, 1.0) * uLuzDoRelevo;
    tinta.rgb = luz > 0.0 ? mix(tinta.rgb, vec3(tinta.a), luz) : tinta.rgb * (1.0 + luz);
    // Granulado de tela: a trama pega mais tinta nos fios altos, e um ruído
    // fino por pixel quebra o degradê liso.
    float trama = sin(gl_FragCoord.x * 2.2) * sin(gl_FragCoord.y * 2.2);
    float grao = hashCelula(floor(gl_FragCoord.xy)) - 0.5;
    tinta *= uTetoDaTinta * (0.93 + 0.05 * trama + 0.06 * grao);
    // A crista da gota clareia a tinta molhada.
    tinta.rgb *= 1.0 + 0.35 * max(onda.z, 0.0);

    // Halos: luz suave atrás de cada grupo, proporcional ao risco que resta.
    vec4 halo = vec4(0.0);
    for (int i = 0; i < 4; i++) {
      vec2 d = (gl_FragCoord.xy - uHalos[i].xy) / uRaioDoHalo;
      float brilho = exp(-dot(d, d)) * uHalos[i].z * uAlfaDoHalo;
      halo += vec4(uCorDoHalo[i] * brilho, brilho);
    }
    vec4 fundo = tinta + halo * (1.0 - tinta.a);
    saida += fundo * (1.0 - saida.a);
  }

  gl_FragColor = saida;
}
`;
