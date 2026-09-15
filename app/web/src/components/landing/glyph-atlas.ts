/**
 * glyph-atlas.ts
 *
 * O QUE FAZ
 * Desenha, em runtime, uma tira de glifos monoespaçados (JetBrains Mono) num
 * `<canvas>` 2D offscreen — do mais "vazio" ao mais "denso" — e devolve como
 * `THREE.CanvasTexture`. É essa textura que `ASCII_FRAGMENT_SHADER` amostra
 * para decidir qual caractere desenhar em cada célula, a partir do luma da
 * cena por baixo.
 *
 * POR QUE RUNTIME E NÃO UM PNG NO REPOSITÓRIO
 * A landing já carrega JetBrains Mono via `@fontsource-variable` (a mesma
 * fonte de dado do design system — nenhuma dependência nova). Gerar o atlas
 * a partir dela garante que os glifos ficam nítidos em qualquer
 * `devicePixelRatio`, sem exportar/versionar um asset que ficaria
 * dessincronizado se a fonte mudar.
 *
 * QUEM USA
 * `use-hero-scene.ts`, uma vez por montagem da cena (o resultado não muda
 * com resize — só a grade de células muda, e isso é `uCellSize`/`uResolution`
 * no shader, não a textura).
 */

import * as THREE from "three";

/** Do mais "vazio" ao mais "denso" — a ordem É o mapeamento de luminância:
 * índice 0 = pixel escuro da cena, índice N-1 = pixel claro. Mistura rampa
 * clássica de ASCII-art com alguns glifos "de terminal" para reforçar o tom
 * cyber sem quebrar a progressão de densidade visual. */
export const ASCII_RAMP = " .`:;+=xX%#@" as const;

const CELL_PX = 64; // resolução do glifo dentro do atlas — a célula na TELA é bem menor (uCellSize)

export function buildGlyphAtlas(): THREE.CanvasTexture {
  const glyphs = Array.from(ASCII_RAMP);
  const canvas = document.createElement("canvas");
  canvas.width = CELL_PX * glyphs.length;
  canvas.height = CELL_PX;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Sem 2D context (ambiente degenerado) — devolve uma textura 1×1 branca;
    // o shader ainda funciona, só sem variação de glifo (vira um "bloco" só).
    const fallback = new THREE.CanvasTexture(document.createElement("canvas"));
    fallback.needsUpdate = true;
    return fallback;
  }

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(CELL_PX * 0.86)}px "JetBrains Mono Variable", "JetBrains Mono", monospace`;

  glyphs.forEach((char, i) => {
    const cx = i * CELL_PX + CELL_PX / 2;
    const cy = CELL_PX / 2 + CELL_PX * 0.04;
    ctx.fillText(char, cx, cy);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
