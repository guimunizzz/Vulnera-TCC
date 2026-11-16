/**
 * components/landing/scene/materiais.ts
 *
 * O QUE FAZ
 * Monta o material dos atos 3–5 pedido: terreno, grafo ou pintura.
 *
 * POR QUE EXISTE
 * Os três entregam a mesma coisa à cena (interface `Pintura`: uma textura
 * sRGB com alfa pré-multiplicado e os uniforms de tela), então
 * `use-landing-scene.ts` não precisa saber qual está ativo. Enquanto o Rafael
 * compara os três (2026-11-16), a escolha vem da URL — ver
 * `lerMaterialDaCena` em `config.ts`.
 *
 * QUEM USA
 * `use-landing-scene.ts` (chunk lazy da cena).
 */

import type { IUniform } from "three";
import type { MaterialDaCena } from "./config";
import { criarGrafo } from "./grafo";
import { criarPintura, type Pintura } from "./pintura";
import { criarTerreno } from "./terreno";

/** `atlas` são os uniforms do atlas de glifos da cena ASCII; o terreno desenha os mesmos glifos. */
export function criarMaterialDaCena(nome: MaterialDaCena, atlas: { uAtlas: IUniform; uTotalGlifos: IUniform }): Pintura {
  if (nome === "grafo") return criarGrafo();
  if (nome === "pintura") return criarPintura();
  return criarTerreno(atlas);
}
