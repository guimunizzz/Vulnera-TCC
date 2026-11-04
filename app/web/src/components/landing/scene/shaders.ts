/**
 * components/landing/scene/shaders.ts
 *
 * O QUE FAZ
 * GLSL da cena narrativa ASCII, em duas passadas:
 *   1. FRAGMENT_CELULAS roda uma vez por célula de caractere (textura do
 *      tamanho da grade, `src/three/grade-celulas.ts`) e decide, pelo
 *      progresso (0 a 5, um por ato), glifo, cor e alfa.
 *   2. FRAGMENT_TELA roda por pixel: lê a célula, aplica a onda da gota e
 *      carimba o glifo do atlas (`src/three/ascii.ts`), com scanlines.
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
 * Os atos seguem `docs/LANDING_NARRATIVA.md` §3; o espelho sem animação está
 * em `estadoDaCelula` (layout.ts), usado pelo pôster.
 * Não use crase dentro destes templates: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `use-landing-scene.ts`.
 */

import { GLSL_ASCII } from "../../../three/ascii";
import { GLSL_GOTAS, GOTA } from "../../../three/gotas";
import { GLSL_LER_CELULAS } from "../../../three/grade-celulas";
import { CENTRO_DOS_GRUPOS } from "./layout";
import { GLIFO, TRANSICAO_CENA, VINHETA } from "./config";

const vec2 = ([x, y]: readonly [number, number]) => `vec2(${x.toFixed(3)}, ${y.toFixed(3)})`;

/** Ids de cor gravados na textura de células (canal g). */
export const COR = { base: 0, neon: 1, glitch: 2, baixa: 3, media: 4, alta: 5, critica: 6, resolvido: 7 } as const;

export { VERTEX_TELA_CHEIA as VERTEX_ASCII } from "../../../three/grade-celulas";

/** Passada 1: uma execução por célula; grava (glifo, id de cor, alfa). */
export const FRAGMENT_CELULAS = /* glsl */ `
${GLSL_ASCII}

uniform float uProgresso;
uniform float uTique;
uniform float uTempo;
uniform float uRaioDoGrupo;
uniform float uAlfaSaudavel;
uniform float uAlfaDestaque;
uniform float uAlfaFeixe;
uniform float uTransicaoInicio;
uniform float uTransicaoSentido;

const vec2 GRUPO_BAIXA = ${vec2(CENTRO_DOS_GRUPOS[1])};
const vec2 GRUPO_MEDIA = ${vec2(CENTRO_DOS_GRUPOS[2])};
const vec2 GRUPO_ALTA = ${vec2(CENTRO_DOS_GRUPOS[3])};
const vec2 GRUPO_CRITICA = ${vec2(CENTRO_DOS_GRUPOS[4])};

float glifoDaSeveridade(float s) {
  if (s < 1.5) return ${GLIFO.baixa}.0;
  if (s < 2.5) return ${GLIFO.media}.0;
  if (s < 3.5) return ${GLIFO.alta}.0;
  return ${GLIFO.critica}.0;
}

// Severidade 1..4 -> id de cor (baixa..crítica).
float corDaSeveridade(float s) { return ${COR.baixa - 1}.0 + s; }

// Distância em px do centro da célula ao centro de um grupo (recorte -> px).
float distanciaPx(vec2 clip, vec2 centro) {
  return length((clip - centro) * 0.5 * uResolucao);
}

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

  // Saudáveis apagam enquanto o foco está nos grupos.
  float apagado = smoothstep(2.15, 2.85, p) * (1.0 - smoothstep(3.6, 4.4, p));
  alfa *= 1.0 - 0.5 * apagado;

  // --- Falhas espalhadas na grade (≈ 4,5% das células).
  float falha = step(rFalha, 0.045);
  float sev = 1.0 + floor(rSev * 4.0);
  float corrigivel = step(2.5, sev) + step(1.5, sev) * step(sev, 2.5) * step(0.5, hashCelula(celula + 83.0));
  corrigivel = min(corrigivel, 1.0);

  // Ato 1 (Mas tem falhas): "!" pulsando devagar, ainda sem cor de severidade.
  float pisca = 0.5 + 0.5 * sin((uTempo * 0.9 + r) * 6.2832);
  float alerta = falha * smoothstep(0.25, 0.9, p) * (1.0 - smoothstep(1.4, 2.0, p));
  // Ato 2 (Encontrar): a varredura passa e revela a severidade.
  float trecho = clamp(p - 1.0, 0.0, 1.0);
  float feixeX = mix(-1.15, 1.15, trecho);
  float revelado = falha * smoothstep(clip.x, clip.x + 0.1, feixeX);
  // Ato 3 (Organizar): a falha sai da grade...
  float saiu = falha * smoothstep(2.15, 2.85, p);
  // Ato 4 (Corrigir): ...e a corrigida volta como "✓" no mesmo lugar.
  float atraso = (4.0 - sev) * 0.12;
  float voltou = falha * corrigivel * smoothstep(3.25 + atraso, 3.85 + atraso, p);

  if (falha > 0.5) {
    if (voltou > 0.01) {
      indice = ${GLIFO.ok}.0;
      cor = ${COR.resolvido}.0;
      alfa = mix(uAlfaSaudavel, uAlfaDestaque, voltou) * voltou;
    } else if (revelado > 0.01) {
      indice = glifoDaSeveridade(sev);
      cor = corDaSeveridade(sev);
      alfa = uAlfaDestaque * revelado * (1.0 - saiu);
    } else if (alerta > 0.01) {
      indice = ${GLIFO.alerta}.0;
      alfa = mix(uAlfaSaudavel, uAlfaDestaque, alerta * pisca);
    }
  }

  // --- Grupos nas laterais (fora da coluna de texto).
  float dBaixa = distanciaPx(clip, GRUPO_BAIXA);
  float dMedia = distanciaPx(clip, GRUPO_MEDIA);
  float dAlta = distanciaPx(clip, GRUPO_ALTA);
  float dCritica = distanciaPx(clip, GRUPO_CRITICA);
  float sevGrupo = 1.0;
  float dGrupo = dBaixa;
  if (dMedia < dGrupo) { dGrupo = dMedia; sevGrupo = 2.0; }
  if (dAlta < dGrupo) { dGrupo = dAlta; sevGrupo = 3.0; }
  if (dCritica < dGrupo) { dGrupo = dCritica; sevGrupo = 4.0; }
  float noGrupo = step(dGrupo, uRaioDoGrupo) * step(0.4, hashCelula(celula + 97.0));
  // Cada célula do grupo chega num momento: o grupo "se forma".
  float chegada = smoothstep(2.15 + r * 0.45, 2.45 + r * 0.45, p);
  float grupoCorrigido = step(2.5, sevGrupo) + step(1.5, sevGrupo) * step(sevGrupo, 2.5) * step(0.5, hashCelula(celula + 83.0));
  float atrasoGrupo = (4.0 - sevGrupo) * 0.12;
  float dissolve = min(grupoCorrigido, 1.0) * smoothstep(3.15 + atrasoGrupo + r * 0.3, 3.55 + atrasoGrupo + r * 0.3, p);
  float grupo = noGrupo * chegada * (1.0 - dissolve);
  if (grupo > 0.01) {
    // Pouco antes de dissolver, a célula corrigida mostra "✓".
    float virando = min(grupoCorrigido, 1.0) * smoothstep(3.0 + atrasoGrupo, 3.2 + atrasoGrupo, p);
    indice = virando > 0.5 ? ${GLIFO.ok}.0 : glifoDaSeveridade(sevGrupo);
    cor = virando > 0.5 ? ${COR.resolvido}.0 : corDaSeveridade(sevGrupo);
    alfa = uAlfaDestaque * grupo;
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

  gl_FragColor = vec4(indice / 255.0, cor / 255.0, clamp(alfa, 0.0, 1.0), 1.0);
}
`;

/** Passada 2: por pixel — onda da gota, glifo do atlas, cor e scanlines. */
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
  // Água: a onda das gotas desloca a leitura da grade (refração). Sem gota
  // viva, o laço das gotas nem roda (uniform: o desvio é coerente na GPU).
  vec4 onda = uGotasAtivas > 0.5 ? ondaDasGotas(gl_FragCoord.xy) : vec4(0.0);
  vec2 pos = gl_FragCoord.xy - onda.xy * uCelula.x * ${GOTA.deslocamentoCelulas.toFixed(2)};
  vec4 dado = lerCelula(celulaEm(pos));
  float indice = byte(dado.r);
  vec3 cor = corPorId(byte(dado.g));
  float alfa = dado.b;

  // Crista da onda: um anel de glifos da rampa, puxado para o neon. Nunca passa
  // do alfa de destaque — o limite que o teste de contraste garante.
  // A altura raramente passa de 0,5 longe do centro: normaliza para o anel aparecer.
  float crista = smoothstep(0.04, 0.45, onda.z);
  float alfaOnda = uAlfaDestaque * crista;
  if (alfaOnda > alfa) {
    indice = ${GLIFO.rampaInicio}.0 + floor(crista * ${(GLIFO.rampaTotal - 0.01).toFixed(2)});
    cor = mix(uCorBase, uCorNeon, crista);
    alfa = alfaOnda;
  }
  alfa = max(alfa, min(alfa * (1.0 + 0.6 * onda.w), uAlfaDestaque));

  // Scanlines: uma linha de pixel a cada três, mais escura.
  float scanline = 1.0 - 0.18 * step(2.0, mod(floor(gl_FragCoord.y), 3.0));

  gl_FragColor = vec4(cor, coberturaDoGlifoEm(indice, pos) * alfa * scanline);
  #include <colorspace_fragment>
}
`;
