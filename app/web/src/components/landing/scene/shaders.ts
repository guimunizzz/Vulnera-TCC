/**
 * components/landing/scene/shaders.ts
 *
 * O QUE FAZ
 * GLSL da cena narrativa ASCII: um quad em tela cheia em que cada célula de
 * caractere decide, pelo progresso (0 a 5, um por ato), qual glifo mostrar e
 * em que cor. Estética de terminal hacker (ASCII, scanlines, glitch raro,
 * acentos neon), sem logos nem assets de terceiros.
 *
 * POR QUE EXISTE
 * Uma draw call: nenhum vértice por caractere, nenhuma geometria por ato. O
 * glifo é escolhido uma vez por célula e carimbado do atlas (`src/three/ascii.ts`).
 * O tempo só entra como "tique" inteiro (poucos por segundo): o cintilar dos
 * caracteres não exige render contínuo.
 *
 * Os atos seguem `docs/LANDING_NARRATIVA.md` §3; o espelho sem animação está
 * em `estadoDaCelula` (layout.ts), usado pelo pôster.
 * Não use crase dentro destes templates: fecha a string JS (ADR-026).
 *
 * QUEM USA
 * `use-landing-scene.ts`.
 */

import { GLSL_ASCII } from "../../../three/ascii";
import { CENTRO_DOS_GRUPOS } from "./layout";
import { GLIFO, VINHETA } from "./config";

const vec2 = ([x, y]: readonly [number, number]) => `vec2(${x.toFixed(3)}, ${y.toFixed(3)})`;

export const VERTEX_ASCII = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const FRAGMENT_ASCII = /* glsl */ `
${GLSL_ASCII}

uniform float uProgresso;
uniform float uTique;
uniform float uRaioDoGrupo;
uniform vec3 uCorBase;
uniform vec3 uCorNeon;
uniform vec3 uCorGlitch;
uniform vec3 uCorBaixa;
uniform vec3 uCorMedia;
uniform vec3 uCorAlta;
uniform vec3 uCorCritica;
uniform vec3 uCorResolvido;
uniform float uAlfaSaudavel;
uniform float uAlfaDestaque;
uniform float uAlfaFeixe;

const vec2 GRUPO_BAIXA = ${vec2(CENTRO_DOS_GRUPOS[1])};
const vec2 GRUPO_MEDIA = ${vec2(CENTRO_DOS_GRUPOS[2])};
const vec2 GRUPO_ALTA = ${vec2(CENTRO_DOS_GRUPOS[3])};
const vec2 GRUPO_CRITICA = ${vec2(CENTRO_DOS_GRUPOS[4])};

vec3 corDaSeveridade(float s) {
  if (s < 1.5) return uCorBaixa;
  if (s < 2.5) return uCorMedia;
  if (s < 3.5) return uCorAlta;
  return uCorCritica;
}

float glifoDaSeveridade(float s) {
  if (s < 1.5) return ${GLIFO.baixa}.0;
  if (s < 2.5) return ${GLIFO.media}.0;
  if (s < 3.5) return ${GLIFO.alta}.0;
  return ${GLIFO.critica}.0;
}

// Distância em px do centro da célula ao centro de um grupo (recorte -> px).
float distanciaPx(vec2 clip, vec2 centro) {
  return length((clip - centro) * 0.5 * uResolucao);
}

void main() {
  vec2 celula = celulaDaTela();
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

  // --- Ato 0 (Funciona): campo de terminal calmo, com cintilar por tique.
  // Vinheta: esparso atrás da coluna de texto, mais cheio nas laterais —
  // a cena emoldura o conteúdo em vez de competir com ele.
  float lateral = smoothstep(${VINHETA.inicio.toFixed(2)}, ${VINHETA.fim.toFixed(2)}, abs(clip.x));
  float presente = step(1.0 - mix(${VINHETA.densidadeCentro.toFixed(2)}, ${VINHETA.densidadeLateral.toFixed(2)}, lateral), r);
  float cintila = step(0.88, rTique);
  float sorteio = mix(hashCelula(celula + 29.0), rTique, cintila);
  float binario = step(0.75, hashCelula(celula + 61.0));
  // Quadrado do sorteio: a rampa pesa para os glifos leves (. · :).
  float indice = binario > 0.5
    ? mix(${GLIFO.zero}.0, ${GLIFO.um}.0, step(0.5, sorteio))
    : ${GLIFO.rampaInicio}.0 + floor(sorteio * sorteio * ${GLIFO.rampaTotal}.0);
  vec3 cor = mix(uCorBase, uCorNeon, step(0.97, hashCelula(celula + 71.0)));
  float alfa = presente * uAlfaSaudavel * mix(0.55, 1.0, r) * mix(0.6, 1.0, lateral);

  // Saudáveis apagam enquanto o foco está nos grupos.
  float apagado = smoothstep(2.15, 2.85, p) * (1.0 - smoothstep(3.6, 4.4, p));
  alfa *= 1.0 - 0.5 * apagado;

  // --- Falhas espalhadas na grade (≈ 4,5% das células).
  float falha = step(rFalha, 0.045);
  float sev = 1.0 + floor(rSev * 4.0);
  float corrigivel = step(2.5, sev) + step(1.5, sev) * step(sev, 2.5) * step(0.5, hashCelula(celula + 83.0));
  corrigivel = min(corrigivel, 1.0);

  // Ato 1 (Mas tem falhas): "!" piscando devagar, ainda sem cor de severidade.
  float pisca = step(0.5, fract(uTique / 4.0 + r));
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
      cor = uCorResolvido;
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
    cor = virando > 0.5 ? uCorResolvido : corDaSeveridade(sevGrupo);
    alfa = uAlfaDestaque * grupo;
  }

  // --- Varredura (ato 2): blocos neon com franja magenta logo atrás.
  float presenca = sin(trecho * 3.14159);
  float distanciaFeixe = abs(clip.x - feixeX) * grade.x * 0.5;
  if (presenca > 0.001 && distanciaFeixe < 4.0) {
    float bloco = clamp(floor(distanciaFeixe), 0.0, 3.0);
    indice = ${GLIFO.blocoCheio}.0 - bloco;
    cor = clip.x < feixeX && bloco > 1.5 ? uCorGlitch : uCorNeon;
    alfa = uAlfaFeixe * presenca * (1.0 - bloco / 4.0);
  }

  // Faixa de glitch tingida de neon.
  cor = mix(cor, uCorGlitch, naFaixa * 0.6);
  // Scanlines: uma linha de pixel a cada três, mais escura.
  float scanline = 1.0 - 0.18 * step(2.0, mod(floor(gl_FragCoord.y), 3.0));

  float cobertura = coberturaDoGlifo(indice);
  gl_FragColor = vec4(cor, cobertura * alfa * scanline);
  #include <colorspace_fragment>
}
`;
