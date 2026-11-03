/**
 * three/gotas.ts
 *
 * O QUE FAZ
 * Efeito de água das cenas ASCII: um clique no fundo "deixa cair uma gota" e
 * ondulações circulares se espalham pelo campo de caracteres. Este módulo
 * guarda as gotas (posição em px do buffer + instante), ouve os cliques e
 * fornece o trecho GLSL que calcula a onda em cada pixel.
 *
 * POR QUE EXISTE
 * Pedido do Rafael (2026-10-30): interação com o fundo SOMENTE por clique —
 * nada de seguir o ponteiro. A landing e a atmosfera da área autenticada
 * usam a mesma física, então ela mora no kit.
 *
 * REGRAS
 *   - O canvas continua `pointer-events: none` e fora do foco: o clique é
 *     ouvido na janela, e só conta quando o alvo NÃO é interativo (link,
 *     botão, campo, item de menu…) — clicar num botão nunca faz onda.
 *   - Clique por teclado (`detail === 0`) não gera gota.
 *   - Movimento reduzido: a cena nem monta (gate do kit), então não há gota.
 *   - Enquanto houver onda viva, a cena redesenha a cada quadro do loop
 *     (orçamento de fps do kit); quando a última some, volta aos tiques.
 *
 * QUEM USA
 * `components/landing/scene/use-landing-scene.ts` e
 * `components/dashboard/hero/use-dashboard-scene.ts`.
 */

/** Quantas gotas convivem; a mais antiga é substituída. */
export const MAX_GOTAS = 6;

/** Física da onda, em px CSS e segundos. */
export const GOTA = {
  /** Quanto tempo uma gota ondula até sumir. */
  duracao: 2.4,
  /** Velocidade da frente da onda. */
  velocidadePx: 320,
  /** Largura do pacote de ondas atrás da frente. */
  larguraPx: 70,
  /** Distância entre cristas. */
  comprimentoPx: 34,
  /** Quanto a onda desloca a leitura da grade (refração), em células. */
  deslocamentoCelulas: 0.9,
} as const;

/** Alvos que já têm uma ação própria: clicar neles não é clicar no fundo. */
const INTERATIVOS = [
  "a", "button", "input", "select", "textarea", "label", "summary", "details", "option",
  "[role='button']", "[role='link']", "[role='menuitem']", "[role='tab']", "[role='option']",
  "[role='switch']", "[role='checkbox']", "[role='dialog']", "[contenteditable='true']",
].join(",");

export function eAlvoInterativo(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest(INTERATIVOS) !== null;
}

export interface Gotas {
  uniformes: {
    /** (x, y, início) por gota, em px do buffer e segundos da cena; início < 0 = vazio. */
    uGotas: { value: Float32Array };
    uTempo: { value: number };
    uDpr: { value: number };
  };
  /** Há onda viva neste instante? Enquanto sim, a cena redesenha todo quadro. */
  ativa(tempo: number): boolean;
  parar(): void;
}

export interface OpcoesGotas {
  canvas: HTMLCanvasElement;
  /** Relógio da cena (s): o mesmo que alimenta `uTempo`. */
  tempoAtual: () => number;
  /** Pixel ratio do renderer, para converter o clique em px do buffer. */
  dpr: () => number;
  /** Avisado a cada gota: a cena marca que precisa redesenhar. */
  aoCair?: () => void;
}

export function criarGotas({ canvas, tempoAtual, dpr, aoCair }: OpcoesGotas): Gotas {
  const dados = new Float32Array(MAX_GOTAS * 3);
  for (let i = 0; i < MAX_GOTAS; i += 1) dados[i * 3 + 2] = -1e4;
  let proxima = 0;
  let ultimaQueda = -1e4;

  const uniformes = {
    uGotas: { value: dados },
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
    dados[proxima * 3] = (x - caixa.left) * razao;
    // gl_FragCoord cresce de baixo para cima.
    dados[proxima * 3 + 1] = (caixa.bottom - y) * razao;
    dados[proxima * 3 + 2] = agora;
    proxima = (proxima + 1) % MAX_GOTAS;
    ultimaQueda = agora;
    uniformes.uDpr.value = razao;
    aoCair?.();
  }

  window.addEventListener("click", aoClicar, { passive: true });

  return {
    uniformes,
    ativa: (tempo) => tempo - ultimaQueda < GOTA.duracao,
    parar: () => window.removeEventListener("click", aoClicar),
  };
}

const f = (n: number) => n.toFixed(4);

/**
 * GLSL: `ondaDasGotas(p)` devolve, para o pixel `p` (px do buffer),
 * xy = deslocamento radial (para "refratar" a grade), z = altura da onda
 * (-1 a 1) e w = energia (0 a 1). Precisa de `uGotas`, `uTempo` e `uDpr`.
 */
export const GLSL_GOTAS = /* glsl */ `
#define MAX_GOTAS ${MAX_GOTAS}
uniform vec3 uGotas[MAX_GOTAS];
uniform float uTempo;
uniform float uDpr;

vec4 ondaDasGotas(vec2 p) {
  vec2 desloc = vec2(0.0);
  float altura = 0.0;
  float energia = 0.0;
  for (int i = 0; i < MAX_GOTAS; i++) {
    float t = uTempo - uGotas[i].z;
    if (t < 0.0 || t > ${f(GOTA.duracao)}) continue;
    vec2 delta = p - uGotas[i].xy;
    float d = length(delta) / uDpr;
    float x = d - t * ${f(GOTA.velocidadePx)};
    float vida = 1.0 - t / ${f(GOTA.duracao)};
    // Pacote gaussiano atrás da frente, que perde força com o tempo e a distância.
    float pacote = exp(-(x * x) / ${f(GOTA.larguraPx * GOTA.larguraPx)}) * vida * vida / (1.0 + d / 420.0);
    float onda = sin(x * ${f((2 * Math.PI) / GOTA.comprimentoPx)}) * pacote;
    desloc += (d > 0.5 ? delta / (d * uDpr) : vec2(0.0)) * onda;
    altura += onda;
    energia += pacote;
  }
  return vec4(desloc, clamp(altura, -1.0, 1.0), clamp(energia, 0.0, 1.0));
}
`;
