/**
 * three/pings.ts
 *
 * O QUE FAZ
 * Ping de scanner das cenas: um clique no fundo dispara um pulso de radar —
 * um anel que se abre a partir do ponto clicado — e o que o anel toca
 * responde. Este módulo guarda os pings (posição em px do buffer + instante),
 * ouve os cliques e fornece o trecho GLSL que diz, para um ponto, quão perto
 * a frente do anel está e há quanto tempo ela passou.
 *
 * POR QUE EXISTE
 * A interação com o fundo é SOMENTE por clique — nada segue o ponteiro
 * (pedido do Rafael, 2026-10-30). Até 2026-11-16 o clique era uma gota d'água
 * que ondulava a grade; água não tinha nada a ver com a história da página.
 * O ping faz o que o produto faz: procura. Só a landing usa (na área
 * autenticada o clique é trabalho).
 *
 * REGRAS
 *   - O canvas continua `pointer-events: none` e fora do foco: o clique é
 *     ouvido na janela, e só conta quando o alvo NÃO é interativo (link,
 *     botão, campo, item de menu…) — clicar num botão nunca dispara ping.
 *   - Clique por teclado (`detail === 0`) não dispara ping.
 *   - Movimento reduzido: a cena nem monta (gate do kit), então não há ping.
 *   - O que o anel acende é de quem desenha; o teto de opacidade da cena não
 *     muda com o ping.
 *
 * QUEM USA
 * `components/landing/scene/` (hook, shaders da grade e do terreno).
 */

/** Quantos pings convivem; o mais antigo é substituído. */
export const MAX_PINGS = 6;

/** Física do anel, em px CSS e segundos. */
export const PING = {
  /** Quanto tempo um ping vive até sumir. */
  duracao: 2.2,
  /** Velocidade da frente do anel. */
  velocidadePx: 420,
  /** Meia largura do anel. */
  larguraPx: 22,
  /** Atrás da frente fica um eco que some nesta distância. */
  rastroPx: 240,
  /** A força do anel cai pela metade a esta distância do clique. */
  alcancePx: 900,
} as const;

/**
 * O ping num ponto: `distanciaPx` do clique, `idadeS` desde o clique.
 * `anel` (0 a 1) é a frente passando; `rastro` (0 a 1) é o eco atrás dela.
 * Espelho do GLSL de `glslDoPing`, para testar a conta sem WebGL.
 */
export function pingEm(distanciaPx: number, idadeS: number): { anel: number; rastro: number } {
  if (idadeS < 0 || idadeS > PING.duracao) return { anel: 0, rastro: 0 };
  // Positivo: a frente já passou por aqui.
  const x = idadeS * PING.velocidadePx - distanciaPx;
  const vida = 1 - idadeS / PING.duracao;
  const forca = vida / (1 + distanciaPx / PING.alcancePx);
  return {
    anel: Math.exp(-(x * x) / (PING.larguraPx * PING.larguraPx)) * forca,
    rastro: x >= 0 ? Math.exp(-x / PING.rastroPx) * forca : 0,
  };
}

/** Alvos que já têm uma ação própria: clicar neles não é clicar no fundo. */
const INTERATIVOS = [
  "a", "button", "input", "select", "textarea", "label", "summary", "details", "option",
  "[role='button']", "[role='link']", "[role='menuitem']", "[role='tab']", "[role='option']",
  "[role='switch']", "[role='checkbox']", "[role='dialog']", "[contenteditable='true']",
].join(",");

export function eAlvoInterativo(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest(INTERATIVOS) !== null;
}

export interface Pings {
  uniformes: {
    /** (x, y, início) por ping, em px do buffer e segundos da cena; início < 0 = vazio. */
    uPings: { value: Float32Array };
    uTempo: { value: number };
    uDpr: { value: number };
  };
  /** Há anel vivo neste instante? Sem ping vivo o laço do shader nem precisa rodar. */
  ativo(tempo: number): boolean;
  parar(): void;
}

export interface OpcoesPings {
  canvas: HTMLCanvasElement;
  /** Relógio da cena (s): o mesmo que alimenta `uTempo`. */
  tempoAtual: () => number;
  /** Pixel ratio do renderer, para converter o clique em px do buffer. */
  dpr: () => number;
  /**
   * Avisado a cada ping, com o ponto em px do buffer (y para cima) e o
   * instante: a cena pode levar o ping para outro espaço (ex.: o terreno da
   * landing projeta o ponto no plano 3D).
   */
  aoPingar?: (xBuffer: number, yBuffer: number, tempo: number) => void;
}

export function criarPings({ canvas, tempoAtual, dpr, aoPingar }: OpcoesPings): Pings {
  const dados = new Float32Array(MAX_PINGS * 3);
  for (let i = 0; i < MAX_PINGS; i += 1) dados[i * 3 + 2] = -1e4;
  let proximo = 0;
  let ultimo = -1e4;

  const uniformes = {
    uPings: { value: dados },
    uTempo: { value: 0 },
    uDpr: { value: 1 },
  };

  function aoClicar(evento: MouseEvent): void {
    if (evento.button !== 0 || evento.detail === 0) return;
    if (eAlvoInterativo(evento.target)) return;
    const caixa = canvas.getBoundingClientRect();
    const { clientX: x, clientY: y } = evento;
    if (x < caixa.left || x > caixa.right || y < caixa.top || y > caixa.bottom) return;
    const razao = dpr();
    const agora = tempoAtual();
    const xBuffer = (x - caixa.left) * razao;
    // gl_FragCoord cresce de baixo para cima.
    const yBuffer = (caixa.bottom - y) * razao;
    dados.set([xBuffer, yBuffer, agora], proximo * 3);
    proximo = (proximo + 1) % MAX_PINGS;
    ultimo = agora;
    uniformes.uDpr.value = razao;
    aoPingar?.(xBuffer, yBuffer, agora);
  }

  window.addEventListener("click", aoClicar, { passive: true });

  return {
    uniformes,
    ativo: (tempo) => tempo - ultimo < PING.duracao,
    parar: () => window.removeEventListener("click", aoClicar),
  };
}

const f = (n: number) => n.toFixed(4);

/**
 * GLSL: declara o uniform `uniforme` (vec3[MAX_PINGS]: xy = ponto, z = instante)
 * e a função `funcao(p)`, que devolve x = anel (a frente passando por `p`) e
 * y = rastro (o eco atrás dela), os dois de 0 a 1.
 * `pxPorUnidade` converte a distância para px CSS (ex.: `uDpr` quando os
 * pontos estão em px do buffer). Quem inclui precisa declarar `uTempo`.
 */
export function glslDoPing({ funcao, uniforme, pxPorUnidade }: { funcao: string; uniforme: string; pxPorUnidade: string }): string {
  return /* glsl */ `
uniform vec3 ${uniforme}[${MAX_PINGS}];
vec2 ${funcao}(vec2 p) {
  float anel = 0.0;
  float rastro = 0.0;
  for (int i = 0; i < ${MAX_PINGS}; i++) {
    float t = uTempo - ${uniforme}[i].z;
    if (t < 0.0 || t > ${f(PING.duracao)}) continue;
    float d = length(p - ${uniforme}[i].xy) / ${pxPorUnidade};
    // Positivo: a frente já passou por aqui.
    float x = t * ${f(PING.velocidadePx)} - d;
    float vida = 1.0 - t / ${f(PING.duracao)};
    float forca = vida / (1.0 + d / ${f(PING.alcancePx)});
    anel += exp(-(x * x) / ${f(PING.larguraPx * PING.larguraPx)}) * forca;
    rastro += step(0.0, x) * exp(-x / ${f(PING.rastroPx)}) * forca;
  }
  return clamp(vec2(anel, rastro), 0.0, 1.0);
}
`;
}
