/**
 * three/palette.ts
 *
 * O QUE FAZ
 * Lê tokens de cor do CSS em runtime e os converte para `THREE.Color`; avisa
 * quando o tema muda.
 *
 * POR QUE EXISTE
 * Um `uniform` ou material WebGL não entende `oklch(var(--token))`. Antes, cada
 * cena guardava hex aproximados que já tinham divergido dos tokens. Agora a
 * cor sai do próprio `tokens.css`: o navegador resolve o alias (o valor
 * computado de `--color-ambient-ink` já vem como "L C H") e a conversão é a
 * mesma do verificador de contraste (`design/oklch.mjs`).
 *
 * `observarTema` olha o atributo `data-theme` de `<html>`, que `aplicarTema`
 * grava de forma síncrona — a cena não depende da ordem dos efeitos do React.
 *
 * QUEM USA
 * Os hooks de cena (hoje `use-dashboard-scene.ts`).
 */

import * as THREE from "three";
import { oklchParaSrgbNormalizado } from "../design/oklch.mjs";

export type TemaDaCena = "dark" | "light";

/** O tema estampado em `<html>`; "dark" é o padrão do `:root` em tokens.css. */
export function temaAtual(): TemaDaCena {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/**
 * Cor exibida de um token no contexto de `elemento`. Aceita os dois formatos
 * de paleta do projeto: "L C H" (tokens do design system, `tokens.css`) e hex
 * (paleta própria da landing, `landing.css`). Escreve em `destino` quando
 * informado — materiais existentes trocam de cor sem alocar.
 */
export function lerCorDoToken(elemento: Element, token: string, destino = new THREE.Color()): THREE.Color {
  const valor = getComputedStyle(elemento).getPropertyValue(token).trim();
  if (/^#[0-9a-f]{6}$/i.test(valor)) return destino.setStyle(valor, THREE.SRGBColorSpace);
  const [L, C, H] = valor.split(/\s+/).map(Number);
  if ([L, C, H].some((parte) => parte === undefined || Number.isNaN(parte))) {
    throw new Error(`Token ${token} fora do formato "L C H" ou hex: "${valor}"`);
  }
  const { rgb } = oklchParaSrgbNormalizado(L, C, H);
  return destino.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
}

export function observarTema(aoMudar: () => void): () => void {
  const observador = new MutationObserver(aoMudar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observador.disconnect();
}
