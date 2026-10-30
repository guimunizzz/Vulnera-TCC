/**
 * three/ascii.ts
 *
 * O QUE FAZ
 * Base das cenas ASCII: desenha um atlas de glifos (uma fileira de
 * caracteres da JetBrains Mono num canvas 2D) e oferece o trecho GLSL que,
 * dentro de um fragment shader, divide a tela em células e carimba o glifo
 * escolhido para cada uma.
 *
 * POR QUE EXISTE
 * A técnica é a mesma da landing e da atmosfera autenticada: um único quad em
 * tela cheia, uma única draw call. O glifo é decidido UMA vez por célula; o
 * custo não cresce com geometria. As células têm tamanho em px CSS (× DPR no
 * shader), então a grade não fica mais densa em tela de alta densidade.
 *
 * O atlas usa a fonte de dado do design system — a mesma que mostra vetor
 * CVSS e ids. Os glifos chegam como cobertura (canal alfa); a cor é de quem
 * desenha, lida dos tokens.
 *
 * QUEM USA
 * `components/landing/scene/use-landing-scene.ts` e
 * `components/dashboard/hero/use-dashboard-scene.ts`.
 */

import * as THREE from "three";

export const FONTE_ASCII = '"JetBrains Mono Variable", ui-monospace, monospace';

export interface AtlasAscii {
  textura: THREE.CanvasTexture;
  /** Quantidade de glifos na fileira. */
  total: number;
  /** Largura / altura de uma célula do glifo. */
  proporcao: number;
}

/**
 * Desenha os glifos numa fileira, brancos sobre transparente. Espera a fonte
 * carregar: desenhar antes faria o atlas sair na fonte de fallback.
 */
export async function criarAtlasAscii(glifos: string, tamanhoPx = 48): Promise<AtlasAscii> {
  const fonte = `${tamanhoPx}px ${FONTE_ASCII}`;
  await document.fonts?.load(fonte).catch(() => undefined);
  const caracteres = Array.from(glifos);
  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Canvas 2D indisponível para o atlas ASCII");
  contexto.font = fonte;
  const largura = Math.ceil(contexto.measureText("M").width);
  const altura = Math.ceil(tamanhoPx * 1.3);
  canvas.width = largura * caracteres.length;
  canvas.height = altura;
  // Redimensionar o canvas zera o estado do contexto.
  contexto.font = fonte;
  contexto.fillStyle = "#fff";
  contexto.textAlign = "center";
  contexto.textBaseline = "middle";
  caracteres.forEach((glifo, i) => contexto.fillText(glifo, i * largura + largura / 2, altura / 2));

  const textura = new THREE.CanvasTexture(canvas);
  textura.generateMipmaps = false;
  textura.minFilter = THREE.LinearFilter;
  textura.magFilter = THREE.LinearFilter;
  return { textura, total: caracteres.length, proporcao: largura / altura };
}

/**
 * Trecho GLSL comum: célula da tela, hash por célula e cobertura do glifo.
 * `uCelula` é o tamanho da célula em px do buffer (CSS × DPR).
 */
export const GLSL_ASCII = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTotalGlifos;
uniform vec2 uCelula;
uniform vec2 uResolucao;

vec2 celulaDaTela() { return floor(gl_FragCoord.xy / uCelula); }
vec2 gradeDaTela() { return floor(uResolucao / uCelula); }

float hashCelula(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Cobertura (0 a 1) do glifo "indice" no pixel atual da célula.
float coberturaDoGlifo(float indice) {
  vec2 local = fract(gl_FragCoord.xy / uCelula);
  vec2 uv = vec2((floor(indice) + local.x) / uTotalGlifos, local.y);
  return texture2D(uAtlas, uv).a;
}
`;
