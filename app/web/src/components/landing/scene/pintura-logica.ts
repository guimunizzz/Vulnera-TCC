/**
 * components/landing/scene/pintura-logica.ts
 *
 * O QUE FAZ
 * As regras puras da pintura dos atos 3–5: quando cada célula vira pincelada,
 * quando uma falha chega ao grupo, quando é corrigida, quanto risco resta em
 * cada grupo e como a vida de uma pincelada sobe e desce.
 *
 * POR QUE EXISTE
 * O shader (`pintura.ts`) repete estas contas na GPU; aqui elas existem em
 * TypeScript para (1) serem testadas sem WebGL e (2) alimentar os uniforms
 * que não dependem de pixel — o risco de cada grupo (halo e redemoinho), a
 * virada global e a velocidade do fluxo. Não importa three.
 * Nada aqui é dado real: severidade e correção são sorteadas (ADR-054).
 *
 * QUEM USA
 * `pintura.ts`, `use-landing-scene.ts` e `pintura-logica.test.ts`.
 */

import { PINTURA } from "./config";
import { eCorrigivel, type Severidade } from "./layout";

type Falha = Exclude<Severidade, 0>;

/** O smoothstep do GLSL: 0 antes de `a`, 1 depois de `b`, curva suave entre os dois. */
export function suavizar(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Quanto da virada ASCII → pintura já aconteceu (0 a 1) no progresso `p`. */
export function viradaGlobal(p: number): number {
  return suavizar(PINTURA.virada[0], PINTURA.virada[1], p);
}

/**
 * A virada num ponto da tela: onda da esquerda (`x` = 0) para a direita
 * (`x` = 1), com `ruido` (0 a 1) por célula para a frente não ser uma régua.
 * 0 = ainda glifo; 1 = já pincelada.
 */
export function viradaLocal(m: number, x: number, ruido: number): number {
  const onda = PINTURA.ondaDaVirada;
  return suavizar(0, 1, m * (1 + onda.x + onda.ruido) - onda.x * x - onda.ruido * ruido);
}

/** Largura relativa da pincelada ao longo da vida: nasce e morre em zero, sem salto. */
export function envelopeDeVida(idade: number, vida: number): number {
  return Math.sin(Math.PI * Math.min(1, Math.max(0, idade / vida)));
}

/** Quanto a falha já migrou da grade para o grupo (0 a 1); `sorteio` escalona as chegadas. */
export function chegadaAoGrupo(p: number, sorteio: number): number {
  const atraso = sorteio * PINTURA.espalhamentoDaChegada;
  return suavizar(PINTURA.organizar[0] + atraso, PINTURA.organizar[1] + atraso, p);
}

/**
 * Quanto da correção de uma falha já aconteceu (0 a 1). Crítica primeiro,
 * depois alta, depois a metade sorteada da média; baixa nunca (risco residual
 * aceito). `sorteioCorrecao` decide a metade da média; `sorteioAtraso`
 * escalona as pinceladas do mesmo grupo.
 */
export function fracaoCorrigida(severidade: Falha, sorteioCorrecao: number, sorteioAtraso: number, p: number): number {
  if (!eCorrigivel(severidade, sorteioCorrecao)) return 0;
  const inicio = PINTURA.corrigirInicio
    + (4 - severidade) * PINTURA.atrasoPorSeveridade
    + sorteioAtraso * PINTURA.espalhamentoDaCorrecao;
  return suavizar(inicio, inicio + PINTURA.corrigirDuracao, p);
}

/** Quanto do ato 5 (Estável) já chegou. */
export function estabilidade(p: number): number {
  return suavizar(PINTURA.estavel[0], PINTURA.estavel[1], p);
}

/** Multiplicador da velocidade do fluxo: cai 45% no ato 5. */
export function velocidadeDoFluxo(p: number): number {
  return 1 - PINTURA.freioEstavel * estabilidade(p);
}

/**
 * Risco que resta no grupo de uma severidade (0 a 1): alimenta o halo e o
 * redemoinho em volta dele. Antes de o grupo se formar é 0; a metade da média
 * e toda a baixa nunca são corrigidas.
 */
export function riscoDoGrupo(severidade: Falha, p: number): number {
  const formado = chegadaAoGrupo(p, 0.5);
  const corrigivel = severidade >= 3 ? 1 : severidade === 2 ? 0.5 : 0;
  const corrigido = corrigivel * fracaoCorrigida(severidade, 1, 0.5, p);
  const discricao = severidade === 1 ? 1 - PINTURA.discricaoDaBaixa * estabilidade(p) : 1;
  return formado * (1 - corrigido) * discricao;
}

/**
 * Pinceladas do fundo para uma tela: proporcional à área, dentro dos limites,
 * vezes a fração do degrau de qualidade.
 */
export function totalDePinceladas(larguraPx: number, alturaPx: number, fracao = 1): { colunas: number; linhas: number } {
  const [minimo, maximo] = PINTURA.limitesDePinceladas;
  const alvo = fracao * Math.min(maximo, Math.max(minimo, (PINTURA.pinceladas * larguraPx * alturaPx) / (1440 * 900)));
  const colunas = Math.max(1, Math.round(Math.sqrt((alvo * larguraPx) / alturaPx)));
  return { colunas, linhas: Math.max(1, Math.round(alvo / colunas)) };
}

export interface Qualidade {
  /** Índice em `PINTURA.qualidade` (0 = melhor). */
  nivel: number;
  /** Quadros lentos acumulados; quadro rápido desconta em dobro. */
  lentos: number;
}

/**
 * Um quadro da avaliação de qualidade: `delta` é o tempo desde o quadro
 * anterior. Só um trecho sustentado de quadros lentos rebaixa — um engasgo
 * isolado da página não conta.
 */
export function avaliarQualidade({ nivel, lentos }: Qualidade, delta: number): Qualidade {
  const acumulado = delta > PINTURA.quadroLentoS ? lentos + 1 : Math.max(0, lentos - 2);
  if (acumulado >= PINTURA.quadrosParaRebaixar && nivel < PINTURA.qualidade.length - 1) return { nivel: nivel + 1, lentos: 0 };
  return { nivel, lentos: acumulado };
}

/**
 * Quanto da correção possível de um grupo já aconteceu (0 a 1): colore o monte
 * e o nó central nas cenas 3D. Baixa fica sempre em 0; a média chega a 0,5
 * porque só a metade dela é corrigida.
 */
export function curaDoGrupo(severidade: Falha, p: number): number {
  const corrigivel = severidade >= 3 ? 1 : severidade === 2 ? 0.5 : 0;
  return corrigivel * fracaoCorrigida(severidade, 1, 0.5, p);
}
