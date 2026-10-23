/**
 * Tipos de `oklch.mjs` — o módulo é JavaScript puro para o Node
 * (`scripts/check-contrast.mjs`) importá-lo sem build; o TypeScript lê daqui.
 */

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

export function oklchParaOklab(L: number, C: number, H: number): Oklab;
export function oklabParaLinearSrgb(lab: Oklab): { r: number; g: number; b: number };
export const gammaCodifica: (x: number) => number;
export const gammaDecodifica: (x: number) => number;
export function oklchParaSrgbNormalizado(
  L: number,
  C: number,
  H: number,
): { rgb: [number, number, number]; foraDeGamut: boolean };
