/**
 * components/landing/scene/config.ts
 *
 * O QUE FAZ
 * Os números da cena narrativa da landing num lugar só: atos, glifos,
 * opacidades, orçamento, vinheta e o mapeamento scroll → ato.
 *
 * POR QUE EXISTE
 * A cena WebGL (lazy) e o pôster ASCII (fallback) contam a mesma história e
 * precisam concordar em tudo. Este módulo NÃO importa three: o pôster e o
 * teste de contraste o usam sem baixar o chunk da cena. Roteiro completo em
 * `docs/LANDING_NARRATIVA.md`.
 *
 * QUEM USA
 * `use-landing-scene.ts`, `landing-poster.tsx`, `landing-scene.tsx`,
 * `use-ato-atual.ts` e o teste de contraste da cena.
 */

/** Os seis atos, na ordem da página. `data-ato` na seção marca onde cada um começa. */
export const ATOS = [
  { indice: 0, chave: "funciona", rotulo: "Funciona" },
  { indice: 1, chave: "falhas", rotulo: "Mas tem falhas" },
  { indice: 2, chave: "encontrar", rotulo: "Encontrar" },
  { indice: 3, chave: "organizar", rotulo: "Organizar" },
  { indice: 4, chave: "corrigir", rotulo: "Corrigir" },
  { indice: 5, chave: "estavel", rotulo: "Estável" },
] as const;

export const ULTIMO_ATO = ATOS.length - 1;

/**
 * Glifos do atlas, na ordem dos índices de `GLIFO`. Rampa calma de terminal,
 * binário, alerta, um glifo por severidade, blocos da varredura e o "✓".
 */
export const GLIFOS = " .·:-+=01!%#×@░▒▓█✓";

export const GLIFO = {
  vazio: 0,
  rampaInicio: 1,
  rampaTotal: 6,
  zero: 7,
  um: 8,
  alerta: 9,
  baixa: 10,
  media: 11,
  alta: 12,
  critica: 13,
  /** ░ ▒ ▓ █ — a varredura usa `blocoCheio - distância`. */
  blocoCheio: 17,
  ok: 18,
} as const;

/**
 * Opacidade dos glifos. Atrás do texto há a superfície da landing
 * (`.vx-superficie`, `OPACIDADE_SUPERFICIE`); com ela, estes valores mantêm AA
 * no pior caso — conta feita em `scene-contrast.test.ts` com as cores reais
 * dos CSS. Um glifo por célula: não há sobreposição, mas o teste ainda soma
 * dois destaques e a varredura, por margem.
 */
export const OPACIDADE_CENA = {
  /** Caractere calmo do campo de terminal. */
  saudavel: 0.48,
  /** Alerta, severidade revelada, grupo ou "✓". */
  destaque: 0.6,
  /** Blocos da varredura. */
  feixe: 0.45,
} as const;

/** Opacidade do fundo na superfície atrás do texto. Espelha `landing.css`. */
export const OPACIDADE_SUPERFICIE = 0.94;

export const FPS_CENA = 30;
export const MAX_DPR_CENA = 1.5;
/** Largura da célula de caractere em px CSS (a altura sai da proporção da fonte). */
export const CELULA_LANDING_PX = 12;
/**
 * Tiques por segundo do cintilar dos caracteres. Parada, a cena só redesenha
 * nesses tiques — não a 30 fps.
 */
export const TIQUES_POR_SEGUNDO = 8;
/**
 * Densidade do campo calmo: fração das células com caractere, do centro
 * (atrás do texto) para as laterais, entre |x| = inicio e |x| = fim.
 */
export const VINHETA = { inicio: 0.35, fim: 0.95, densidadeCentro: 0.22, densidadeLateral: 0.56 } as const;

/** Raio dos grupos de severidade nas laterais, em px CSS. */
export const RAIO_DO_GRUPO_PX = 88;

/** Abaixo disto a landing usa o pôster — decisão medida, ver LANDING_NARRATIVA §6. */
export const LARGURA_MINIMA_CENA = 768;

/**
 * Posição de scroll em que cada ato é alcançado: quando o topo da seção que o
 * abre chega ao meio da tela. O primeiro ato é alcançado no topo da página.
 */
export function calcularMarcos(topos: number[], alturaDaTela: number): number[] {
  return topos.map((topo, indice) => (indice === 0 ? 0 : Math.max(0, topo - alturaDaTela / 2)));
}

/** Progresso narrativo contínuo (0 a ULTIMO_ATO), linear entre dois marcos. */
export function mapearProgresso(scroll: number, marcos: number[]): number {
  if (marcos.length === 0 || scroll <= marcos[0]) return 0;
  for (let ato = 1; ato < marcos.length; ato += 1) {
    if (scroll < marcos[ato]) {
      const trecho = marcos[ato] - marcos[ato - 1];
      return ato - 1 + (trecho > 0 ? (scroll - marcos[ato - 1]) / trecho : 1);
    }
  }
  return marcos.length - 1;
}
