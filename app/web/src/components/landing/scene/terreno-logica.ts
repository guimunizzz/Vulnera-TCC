/**
 * components/landing/scene/terreno-logica.ts
 *
 * O QUE FAZ
 * As regras puras do terreno dos atos 3–5: quando cada célula sai da página,
 * quando uma falha chega ao monte, quando é corrigida, quanto cada monte tem
 * de altura, onde está a varredura verde da correção e quanto risco resta.
 *
 * POR QUE EXISTE
 * O shader (`terreno-shaders.ts`) repete parte destas contas na GPU; aqui
 * elas existem em TypeScript para (1) serem testadas sem WebGL e (2) alimentar
 * os uniforms que não dependem de pixel — altura e correção de cada monte, a
 * virada global e o ritmo da cena. Não importa three.
 * Nada aqui é dado real: severidade e correção são sorteadas (ADR-055).
 *
 * QUEM USA
 * `terreno.ts`, `terreno-shaders.ts` (só os números) e `terreno-logica.test.ts`.
 */

import { TERRENO } from "./config";
import { eCorrigivel, type Severidade } from "./layout";

type Falha = Exclude<Severidade, 0>;

/** O smoothstep do GLSL: 0 antes de `a`, 1 depois de `b`, curva suave entre os dois. */
export function suavizar(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Quanto da virada ASCII → terreno já aconteceu (0 a 1) no progresso `p`. */
export function viradaGlobal(p: number): number {
  return suavizar(TERRENO.virada[0], TERRENO.virada[1], p);
}

/**
 * A virada num ponto da tela: onda da esquerda (`x` = 0) para a direita
 * (`x` = 1), com `ruido` (0 a 1) por célula para a frente não ser uma régua.
 * 0 = ainda glifo; 1 = já terreno.
 */
export function viradaLocal(m: number, x: number, ruido: number): number {
  const onda = TERRENO.ondaDaVirada;
  return suavizar(0, 1, m * (1 + onda.x + onda.ruido) - onda.x * x - onda.ruido * ruido);
}

/** Quanto a falha já foi da página para o monte (0 a 1); `sorteio` escalona as chegadas. */
export function chegadaAoGrupo(p: number, sorteio: number): number {
  const atraso = sorteio * TERRENO.espalhamentoDaChegada;
  return suavizar(TERRENO.organizar[0] + atraso, TERRENO.organizar[1] + atraso, p);
}

/**
 * Quanto da correção de uma falha já aconteceu (0 a 1). Crítica primeiro,
 * depois alta, depois a metade sorteada da média; baixa nunca (risco residual
 * aceito). `sorteioCorrecao` decide a metade da média; `sorteioAtraso`
 * escalona os glifos do mesmo monte.
 */
export function fracaoCorrigida(severidade: Falha, sorteioCorrecao: number, sorteioAtraso: number, p: number): number {
  if (!eCorrigivel(severidade, sorteioCorrecao)) return 0;
  const inicio = TERRENO.corrigirInicio
    + (4 - severidade) * TERRENO.atrasoPorSeveridade
    + sorteioAtraso * TERRENO.espalhamentoDaCorrecao;
  return suavizar(inicio, inicio + TERRENO.corrigirDuracao, p);
}

/** Quanto do ato 5 (Estável) já chegou. */
export function estabilidade(p: number): number {
  return suavizar(TERRENO.estavel[0], TERRENO.estavel[1], p);
}

/** Multiplicador do relógio do relevo: a ondulação fica 45% mais lenta no ato 5. */
export function ritmoDaCena(p: number): number {
  return 1 - TERRENO.freioEstavel * estabilidade(p);
}

/** Fração do monte que a correção remove: crítica e alta inteiras, média a metade, baixa nada. */
function parteCorrigivel(severidade: Falha): number {
  return severidade >= 3 ? 1 : severidade === 2 ? 0.5 : 0;
}

/** Andamento da correção do monte como um todo (0 a 1), no meio do escalonamento dos glifos. */
function correcaoDoGrupo(severidade: Falha, p: number): number {
  return fracaoCorrigida(severidade, 1, 0.5, p);
}

/**
 * Risco que resta no grupo de uma severidade (0 a 1): alimenta o halo atrás
 * do monte. Antes de o grupo se formar é 0; a metade da média e toda a baixa
 * nunca são corrigidas.
 */
export function riscoDoGrupo(severidade: Falha, p: number): number {
  const formado = chegadaAoGrupo(p, 0.5);
  const corrigido = parteCorrigivel(severidade) * correcaoDoGrupo(severidade, p);
  const discricao = severidade === 1 ? 1 - TERRENO.discricaoDaBaixa * estabilidade(p) : 1;
  return formado * (1 - corrigido) * discricao;
}

/**
 * Altura do monte em relação à altura cheia dele (0 a 1). Cresce quando as
 * falhas chegam e só começa a afundar depois que a varredura verde já desceu
 * a encosta (`TERRENO.inicioDoAfundamento`).
 */
export function alturaDoMonte(severidade: Falha, p: number): number {
  const afundado = suavizar(TERRENO.inicioDoAfundamento, 1, correcaoDoGrupo(severidade, p));
  return chegadaAoGrupo(p, 0.5) * (1 - parteCorrigivel(severidade) * afundado);
}

export interface CorrecaoDoMonte {
  /**
   * Altitude relativa (1 = cume, 0 = base) da frente da varredura: acima dela
   * a encosta já está verde. Começa fora do monte (> 1) e desce até onde a
   * correção alcança — a base na crítica e na alta, a meia encosta na média.
   */
  frente: number;
  /** Força do verde (0 a 1): some depois que o monte afunda. */
  verde: number;
  /** Força da faixa de luz na frente (0 a 1): só enquanto ela está descendo. */
  faixa: number;
}

/** Onde está a varredura verde que desce a encosta do monte no ato 4. */
export function correcaoDoMonte(severidade: Falha, p: number): CorrecaoDoMonte {
  const andamento = correcaoDoGrupo(severidade, p);
  const descida = suavizar(0, TERRENO.fimDaVarredura, andamento);
  return {
    frente: 1.15 - descida * (parteCorrigivel(severidade) + 0.15),
    verde: 1 - suavizar(0.75, 1, andamento),
    faixa: Math.sin(Math.PI * descida),
  };
}

export interface Qualidade {
  /** Índice em `TERRENO.qualidade` (0 = melhor). */
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
  const acumulado = delta > TERRENO.quadroLentoS ? lentos + 1 : Math.max(0, lentos - 2);
  if (acumulado >= TERRENO.quadrosParaRebaixar && nivel < TERRENO.qualidade.length - 1) return { nivel: nivel + 1, lentos: 0 };
  return { nivel, lentos: acumulado };
}
