/**
 * components/landing/scene/layout.ts
 *
 * O QUE FAZ
 * A regra de cada célula de caractere num ato inteiro, sem animação: que
 * glifo mostrar e em que tom. É o espelho do fragment shader
 * (`shaders.ts`), usado pelo pôster ASCII estático.
 *
 * POR QUE EXISTE
 * Sem WebGL, com movimento reduzido ou em tela estreita, a landing mostra o
 * pôster — e ele precisa contar a mesma história nos mesmos lugares: grupos
 * nas laterais, varredura no meio, "✓" onde a falha foi corrigida. O sorteio
 * aqui é próprio (inteiro, reprodutível); as proporções são as do shader.
 * Nada aqui é dado real: severidade e correção são sorteadas.
 *
 * QUEM USA
 * `landing-poster.tsx` e `shaders.ts` (centros dos grupos).
 */

import { GLIFO, GLIFOS, VINHETA } from "./config";

/** 0 = saudável; 1 baixa, 2 média, 3 alta, 4 crítica. */
export type Severidade = 0 | 1 | 2 | 3 | 4;

/**
 * Centros dos grupos em coordenadas de recorte (-1 a 1), nas laterais onde
 * não há texto: menos graves à esquerda, mais graves à direita.
 */
export const CENTRO_DOS_GRUPOS: Record<Exclude<Severidade, 0>, readonly [number, number]> = {
  1: [-0.86, 0.34],
  2: [-0.86, -0.34],
  3: [0.86, 0.34],
  4: [0.86, -0.34],
};

export const PROPORCAO_FALHAS = 0.045;

export type Tom = "base" | "neon" | "resolvido" | Exclude<Severidade, 0>;

export interface CelulaDoPoster {
  glifo: string;
  tom: Tom;
  destaque: boolean;
}

/** Hash inteiro por célula (reprodutível em qualquer navegador), em [0, 1). */
function hash(x: number, y: number, sal: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(sal, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const glifo = (indice: number) => Array.from(GLIFOS)[indice];
const GLIFO_DA_SEVERIDADE: Record<Exclude<Severidade, 0>, number> = {
  1: GLIFO.baixa,
  2: GLIFO.media,
  3: GLIFO.alta,
  4: GLIFO.critica,
};

/** Corrigir começa pelo mais grave: crítica e alta sempre; média, metade; baixa, nunca. */
export function eCorrigivel(severidade: Severidade, sorteio: number): boolean {
  return severidade >= 3 || (severidade === 2 && sorteio >= 0.5);
}

export interface Medidas {
  colunas: number;
  linhas: number;
  /** Tamanho da célula em px (CSS), para medir a distância aos grupos. */
  larguraCelula: number;
  alturaCelula: number;
  raioDoGrupoPx: number;
}

/** Estado de uma célula no ato `ato` (0 a 5), ou `null` quando ela fica vazia. */
export function estadoDaCelula(x: number, y: number, ato: number, m: Medidas): CelulaDoPoster | null {
  const clipX = ((x + 0.5) / m.colunas) * 2 - 1;
  const clipY = 1 - ((y + 0.5) / m.linhas) * 2;

  // Varredura parada no meio, só no ato "Encontrar".
  if (ato === 2) {
    const distancia = Math.abs(x + 0.5 - m.colunas / 2);
    if (distancia < 4) return { glifo: glifo(GLIFO.blocoCheio - Math.floor(distancia)), tom: "neon", destaque: true };
  }

  // Grupos nas laterais, a partir de "Organizar".
  if (ato >= 3) {
    let maisPerto: Exclude<Severidade, 0> = 1;
    let menor = Number.POSITIVE_INFINITY;
    for (const [chave, [cx, cy]] of Object.entries(CENTRO_DOS_GRUPOS)) {
      const dx = ((clipX - cx) / 2) * m.colunas * m.larguraCelula;
      const dy = ((clipY - cy) / 2) * m.linhas * m.alturaCelula;
      const d = Math.hypot(dx, dy);
      if (d < menor) {
        menor = d;
        maisPerto = Number(chave) as Exclude<Severidade, 0>;
      }
    }
    if (menor < m.raioDoGrupoPx && hash(x, y, 97) >= 0.4) {
      const dissolvido = ato >= 4 && eCorrigivel(maisPerto, hash(x, y, 83));
      if (!dissolvido) return { glifo: glifo(GLIFO_DA_SEVERIDADE[maisPerto]), tom: maisPerto, destaque: true };
    }
  }

  // Falhas espalhadas na grade.
  if (hash(x, y, 41) < PROPORCAO_FALHAS) {
    const severidade = (1 + Math.floor(hash(x, y, 53) * 4)) as Exclude<Severidade, 0>;
    if (ato === 1) return { glifo: glifo(GLIFO.alerta), tom: "base", destaque: true };
    if (ato === 2) return { glifo: glifo(GLIFO_DA_SEVERIDADE[severidade]), tom: severidade, destaque: true };
    if (ato >= 4 && eCorrigivel(severidade, hash(x, y, 83))) return { glifo: glifo(GLIFO.ok), tom: "resolvido", destaque: true };
    if (ato >= 3) return null;
  }

  // Campo calmo de terminal, com a mesma vinheta do shader.
  const t = Math.min(1, Math.max(0, (Math.abs(clipX) - VINHETA.inicio) / (VINHETA.fim - VINHETA.inicio)));
  const lateral = t * t * (3 - 2 * t);
  const densidade = VINHETA.densidadeCentro + (VINHETA.densidadeLateral - VINHETA.densidadeCentro) * lateral;
  if (hash(x, y, 1) >= densidade) return null;
  const sorteio = hash(x, y, 29);
  const indice = hash(x, y, 61) >= 0.75
    ? (sorteio < 0.5 ? GLIFO.zero : GLIFO.um)
    : GLIFO.rampaInicio + Math.floor(sorteio * sorteio * GLIFO.rampaTotal);
  return { glifo: glifo(indice), tom: hash(x, y, 71) >= 0.97 ? "neon" : "base", destaque: false };
}
