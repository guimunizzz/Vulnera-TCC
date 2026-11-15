/**
 * design/oklch.mjs
 *
 * O QUE FAZ
 * Converte cores OKLCH (o formato dos tokens) para sRGB, a cor que a tela
 * realmente exibe.
 *
 * POR QUE EXISTE
 * Dois consumidores precisam da MESMA conta: `scripts/check-contrast.mjs`
 * (mede o contraste WCAG no Node) e a paleta das cenas three.js
 * (`src/three/palette.ts`, no navegador). Uma cópia em cada lado divergiria em
 * silêncio. Por isso é `.mjs` sem dependências: o Node importa direto e o Vite
 * empacota; os tipos ficam em `oklch.d.mts`.
 *
 * A matemática vem do artigo original do Björn Ottosson (2020), reimplementada
 * à mão de propósito, para não trazer uma dependência de cor só pra isso.
 */

/** OKLCH → OKLab. H em graus. */
export function oklchParaOklab(L, C, H) {
  const rad = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(rad), b: C * Math.sin(rad) };
}

/** OKLab → sRGB linear (ainda sem gamma, ainda podendo estourar o gamut). */
export function oklabParaLinearSrgb({ L, a, b }) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export const gammaCodifica = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
export const gammaDecodifica = (x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4));

/**
 * OKLCH → sRGB exibido, com canais 0–1.
 *
 * O clamp importa e é reportado: uma cor OKLCH fora do gamut sRGB é exibida
 * pelo navegador em outra cor que não a pedida. Medir (ou pintar) a cor
 * teórica em vez da exibida seria mentira. `foraDeGamut` avisa.
 */
export function oklchParaSrgbNormalizado(L, C, H) {
  const linear = oklabParaLinearSrgb(oklchParaOklab(L, C, H));
  const cru = [linear.r, linear.g, linear.b].map(gammaCodifica);
  const foraDeGamut = cru.some((v) => v < -0.0005 || v > 1.0005);
  return { rgb: cru.map((v) => Math.min(1, Math.max(0, v))), foraDeGamut };
}
