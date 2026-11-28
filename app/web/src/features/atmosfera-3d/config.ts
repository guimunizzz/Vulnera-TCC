/**
 * features/atmosfera-3d/config.ts
 *
 * Números das atmosferas 3D que precisam valer fora do chunk de three: o teto
 * de opacidade (o teste de contraste confere estes mesmos valores), a duração
 * da troca entre atmosferas e o risco neutro.
 */

import type { TemaDaVariante } from "./tipos-base";

/**
 * Opacidade da camada inteira (CSS) por modo e tema. A cena desenha em
 * intensidade cheia sobre o próprio fundo, e a camada é que limita o pixel
 * mais claro. É o que garante AA ao texto solto sobre ela, no pior caso
 * (branco da soma aditiva no escuro, tinta no claro) — `atmosfera-3d-contrast.test.ts`.
 *
 * plataforma: 0,30 no escuro (o teto do ASCII); 0,32 no claro — o claro usa
 *   blending normal e sumia a 0,24 (D21.5). O AA do claro aguenta até 0,40.
 * apresentacao: o teto calculado de AA (0,32 / 0,40) — não passa disso.
 */
export const TETO_DA_CAMADA: Record<"plataforma" | "apresentacao", Record<TemaDaVariante, number>> = {
  plataforma: { dark: 0.3, light: 0.32 },
  apresentacao: { dark: 0.32, light: 0.4 },
};

/** Crossfade entre atmosferas na troca de seção (pedido do Rafael: 0,8 s). */
export const DURACAO_TROCA_MS = 800;

/** Risco quando a tela não publica o seu (0–1). */
export const RISCO_NEUTRO = 0.3;

/** Constante de tempo (s) com que a cena persegue o risco novo: a mudança se vê. */
export const SEGUIR_RISCO_S = 1.4;
