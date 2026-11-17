/**
 * components/dashboard/hero/atmosfera-config.ts
 *
 * O QUE FAZ
 * Os números da atmosfera ASCII da área autenticada num lugar só: glifos,
 * tetos de opacidade, ondas, aurora, hover e varredura.
 *
 * POR QUE EXISTE
 * O hook da cena (`use-dashboard-scene.ts`) importa three e só roda no chunk
 * lazy; este módulo não importa nada pesado, então o teste de contraste
 * (`atmosfera-contrast.test.ts`) confere os mesmos valores que a cena usa.
 *
 * QUEM USA
 * `use-dashboard-scene.ts` e `atmosfera-contrast.test.ts`.
 */

export const FPS_ATMOSFERA = 60;
export const MAX_DPR_ATMOSFERA = 1.5;
/** Largura da célula em px CSS: maior que a da landing — aqui é textura. */
export const CELULA_ATMOSFERA_PX = 14;
/** Ritmo das trocas de glifo e velocidade-base da chuva (linhas/s). */
export const TIQUES_ATMOSFERA = 4;

/**
 * Rampa calma, traço da chuva e traço das ondas. Sem dígitos: no produto
 * número é dado, e um "0" ou "1" solto ao lado de um KPI, rótulo ou aba
 * seria lido como tal. Nada de alerta ou severidade no fundo do produto.
 */
export const GLIFOS_ATMOSFERA = " .·:-+|/\\~=";

/** Índices em GLIFOS_ATMOSFERA, na ordem do atlas. */
export const GLIFO_ATMOSFERA = {
  rampaInicio: 1,
  rampaTotal: 5,
  dois_pontos: 3,
  traco: 4,
  barra: 6,
  subida: 7,
  descida: 8,
  til: 9,
  igual: 10,
} as const;

/**
 * Teto de opacidade dos glifos por tema. É o limite em que o texto primário e
 * o secundário do produto seguem AA mesmo com um glifo — em qualquer cor da
 * aurora — cruzando a letra; cabeçalhos soltos sobre o fundo têm véu
 * (`.atmosfera-veu`). Conferido por `atmosfera-contrast.test.ts`.
 */
export const OPACIDADE_ATMOSFERA = { dark: 0.3, light: 0.24 } as const;

/** Lavagem de cor da aurora por trás dos glifos (fração do teto). */
export const LAVAGEM_AURORA = 0.05;

/**
 * Ondas: as curvas do fundo antigo (refactor web-motion-3d, Fase 2), agora
 * desenhadas com glifos. Mesma função: topo − i·passo + sen(x·2,3 + t·0,22 +
 * i·0,08)·0,22 + cos(x·4,1 − t·0,13)·0,09, com x de −1,2 a 1,2 e y em
 * coordenadas de recorte. O passo é maior que o antigo (0,037) porque cada
 * curva agora ocupa uma linha inteira de caracteres.
 */
export const ONDAS = { quantidade: 6, topo: 0.42, passo: 0.11 } as const;

/** Hover discreto: raio em px CSS e suavização por quadro (0–1). */
export const HOVER = { raioPx: 150, suavizacao: 0.14 } as const;

/** Varredura: faixa que desce pela tela na troca de página e periodicamente. */
export const VARREDURA = { duracao: 1.6, intervaloS: 36 } as const;
