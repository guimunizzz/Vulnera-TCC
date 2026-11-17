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
  /** `-` e `=` (dentro da rampa): a varredura de transição. */
  traco: 4,
  igual: 6,
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
/**
 * Varredura de transição: ao trocar de ato (seção), uma faixa de `=`/`-`
 * cruza a tela no sentido da rolagem — a mesma linguagem da atmosfera da
 * plataforma. O alfa máximo é o do feixe (`OPACIDADE_CENA.feixe`), já coberto
 * pelo teste de contraste. `intervaloMinimoS` evita uma varredura por seção
 * numa rolagem rápida.
 */
export const TRANSICAO_CENA = {
  duracaoS: 1.1,
  intervaloMinimoS: 0.8,
  /** Comprimento do rastro, em linhas de célula. */
  rastroLinhas: 7,
} as const;

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

/** 60 fps: o movimento é contínuo (pedido do Rafael, 2026-11-03). */
export const FPS_CENA = 60;
export const MAX_DPR_CENA = 1.5;
/** Largura da célula de caractere em px CSS (a altura sai da proporção da fonte). */
export const CELULA_LANDING_PX = 12;
/**
 * Fonte do glifo e altura da célula, em px CSS: JetBrains Mono a 13 px numa
 * célula de 12 × 18 (protótipo aprovado em 2026-11-15). Antes a célula tinha
 * 12 × 26 com o glifo a ~20 px: menos linhas e letras maiores.
 */
export const FONTE_LANDING_PX = 13;
export const ALTURA_CELULA_LANDING_PX = 18;
/** Peso da fonte no atlas: a 13 px o traço regular fica ralo demais sobre o fundo escuro. */
export const PESO_FONTE_LANDING = 600;
/**
 * Tiques por segundo da troca de glifo e do glitch — as únicas mudanças
 * discretas; o resto da cena anima em tempo contínuo.
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

/**
 * Terreno: o material dos atos 3–5 (ADR-055). A partir da "virada", a grade
 * de caracteres ganha a terceira dimensão e vira um mapa topográfico do
 * risco. Medidas em px CSS; faixas são [mín, máx]. O mundo 3D tem a origem no
 * centro da tela: sem inclinação, o plano z = 0 coincide com a tela e cada
 * célula ASCII cai exatamente sobre o seu glifo.
 *
 * A lógica pura que usa estes números está em `terreno-logica.ts`; o GLSL,
 * em `terreno-shaders.ts`, é gerado a partir deles.
 */
export const TERRENO = {
  // --- Narrativa: faixas do progresso (0 a 5).
  virada: [2.55, 3.45],
  /**
   * Peso da posição horizontal e do ruído por célula na onda da virada: com
   * peso em x a frente lê de longe como uma onda da esquerda para a direita,
   * e não como um esmaecer geral.
   */
  ondaDaVirada: { x: 1.1, ruido: 0.35 },
  organizar: [3.0, 3.5],
  espalhamentoDaChegada: 0.25,
  /** Corrigir: começa pelo mais grave; cada severidade abaixo atrasa um pouco. */
  corrigirInicio: 3.75,
  corrigirDuracao: 0.35,
  atrasoPorSeveridade: 0.15,
  espalhamentoDaCorrecao: 0.25,
  /**
   * A correção de um monte tem dois tempos (frações da correção dele): a
   * varredura verde desce do cume à base, e só então o monte afunda.
   */
  fimDaVarredura: 0.55,
  inicioDoAfundamento: 0.45,
  estavel: [4.5, 5],
  /** No ato 5 o relevo ondula 45% mais devagar e a baixa fica mais discreta. */
  freioEstavel: 0.45,
  discricaoDaBaixa: 0.4,
  /**
   * Epílogo: o ato 5 abre em "Planos", mas a página ainda tem FAQ, Time e a
   * chamada final. Para o fundo não parar ali, o progresso segue de 5 até este
   * valor, alcançado no fim da rolagem (pedido do Rafael, 2026-11-16).
   */
  progressoFinal: 6,
  /** A rede de monitoramento nasce sobre a planície nesta faixa do progresso. */
  rede: [4.7, 5.9],

  // --- Composição: entram no teste de contraste (scene-contrast.test.ts).
  /** Teto do alfa da camada 3D na composição. */
  tetoDeAlfa: 0.9,
  /** Alfa máximo do halo atrás de um monte com todo o risco em aberto, e o raio dele. */
  alfaDoHalo: 0.16,
  raioDoHaloPx: 144,
  /** Quanto as linhas iluminadas (curvas de nível, contorno) clareiam em direção ao branco. */
  tomClaro: 0.3,
  luzDeContorno: 0.5,

  // --- Câmera.
  campoDeVisaoGraus: 35,
  /** Inclinação no fim da virada. A câmera só se move com o scroll (ADR-055). */
  inclinacaoGraus: 46,
  /** Do fim da virada ao fim da página a câmera orbita isto em volta do terreno... */
  orbitaGraus: 5,
  /** ...e no epílogo baixa mais isto, em direção ao horizonte. */
  inclinacaoDoEpilogoGraus: 7,

  // --- Relevo.
  /** Grade desenhada sobre a malha: duas células ASCII (12 × 18 px) por quadro. */
  gradePx: [24, 36],
  /** Uma curva de nível a cada tantos px de altitude. */
  curvaDeNivelPx: 15,
  /** Ondulação calma do terreno sem falhas. */
  ondulacaoPx: 30,
  /** Altura do monte de cada severidade (baixa → crítica) com todo o risco em aberto. */
  alturaDosMontesPx: [74, 108, 150, 196],
  /** Meio-eixos do monte no plano: comprido no sentido da margem (cordilheira). */
  raioDoMontePx: [96, 190],
  /**
   * Centro dos montes no plano, em frações da meia largura e da meia altura.
   * Mais afastados em y que os grupos do pôster porque a inclinação encurta o
   * eixo; os da frente (y negativo) ficam mais para dentro em x porque a
   * perspectiva os empurra para fora da tela.
   */
  centros: [[-0.93, 0.7], [-0.77, -0.34], [0.93, 0.7], [0.77, -0.34]],
  /** De onde vem a luz, no mundo (x direita, y fundo, z para cima): do alto, à esquerda. */
  luz: [-0.62, 0.38, 0.52],
  /** Sombra projetada: passos da marcha em direção à luz e até onde ela vai. */
  passosDaSombra: 8,
  alcanceDaSombraPx: 240,

  // --- Grafo sobre o terreno e vida contínua (animam mesmo com a página parada).
  /** O nó central flutua acima do cume de cada monte, ligado aos glifos dele. */
  alturaDoNoDoMontePx: 42,
  /** Rede do epílogo: treliça no plano, fração dos pontos que vira nó e a que altura ele flutua. */
  malhaDaRedePx: 84,
  densidadeDaRede: 0.55,
  alturaDaRedePx: [26, 84],
  /** Um anel de sonar sai de cada monte a cada tantos segundos. */
  periodoDoSonarS: 6,
  /** Uma faixa de luz varre o relevo, do fundo para a frente, a cada tantos segundos. */
  periodoDaVarreduraS: 9,

  /**
   * Degraus de qualidade. O primeiro é o padrão: a camada pode passar do teto
   * do kit (DPR 1,5), decisão do Rafael em 2026-11-15. Se a máquina não segura
   * a cadência (`quadroLentoS` por `quadrosParaRebaixar` quadros seguidos), o
   * terreno desce um degrau — menos resolução e malha mais aberta. Não sobe de
   * volta na mesma visita.
   */
  qualidade: [
    { maxDpr: 2, malhaPx: 24 },
    { maxDpr: 1.5, malhaPx: 30 },
    { maxDpr: 1, malhaPx: 40 },
  ],
  quadroLentoS: 1 / 48,
  quadrosParaRebaixar: 90,
} as const;
