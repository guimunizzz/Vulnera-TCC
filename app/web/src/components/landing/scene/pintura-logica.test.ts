/**
 * pintura-logica.test.ts
 *
 * O QUE FAZ
 * Testa as regras puras da pintura dos atos 3–5 (ADR-054): quando a virada
 * acontece, quando cada falha chega ao grupo, quando é corrigida, quanto risco
 * resta em cada grupo, a vida das pinceladas e a qualidade do quadro. Sem three,
 * sem DOM, sem WebGL.
 *
 * POR QUE EXISTE
 * O shader repete estas contas na GPU. Se elas saírem do combinado, a tinta e o
 * halo dos grupos deixam de contar a mesma história que o pôster ASCII. Os
 * números vêm de `PINTURA` (config.ts), então os testes conferem a forma da
 * regra, não valores mágicos.
 *
 *   PIN-01  virada global: 0 antes do início, 1 depois do fim, monotônica
 *   PIN-02  virada local: onda da esquerda para a direita, com o ruído por célula
 *   PIN-03  envelope de vida: 0 no nascimento e na morte, 1 no meio, preso na faixa
 *   PIN-04  correção pelo mais grave: baixa nunca, média só na metade sorteada,
 *           alta e crítica sempre; crítica começa antes
 *   PIN-05  risco do grupo: zero antes de formar; no fim, só a média e a baixa
 *           sobram, e a baixa de forma discreta
 *   PIN-06  velocidade do fluxo e estabilidade: o ato 5 freia o fluxo
 *   PIN-07  chegada ao grupo: no intervalo certo e escalonada pelo sorteio
 *   PIN-08  total de pinceladas: proporcional à área, dentro dos limites
 *   PIN-09  avaliação de qualidade: só rebaixa com trecho sustentado de quadros lentos
 *   PIN-10  grupos da pintura ficam nas laterais, com a severidade do lado certo
 */

import { describe, expect, it } from "vitest";
import { PINTURA } from "./config";
import { CENTRO_DOS_GRUPOS, eCorrigivel } from "./layout";
import {
  avaliarQualidade,
  chegadaAoGrupo,
  envelopeDeVida,
  estabilidade,
  fracaoCorrigida,
  riscoDoGrupo,
  totalDePinceladas,
  velocidadeDoFluxo,
  viradaGlobal,
  viradaLocal,
} from "./pintura-logica";

const QUADRO_RAPIDO = 1 / 60;
const QUADRO_LENTO = 1 / 30;
const SEVERIDADES = [1, 2, 3, 4] as const;

describe("Virada da pintura", () => {
  it("PIN-01 — a virada global vai de 0 a 1 entre os dois limites, sem voltar", () => {
    const [inicio, fim] = PINTURA.virada;
    expect(viradaGlobal(inicio - 0.1)).toBe(0);
    expect(viradaGlobal(fim + 0.1)).toBe(1);
    let anterior = -1;
    for (let i = 0; i <= 100; i += 1) {
      const p = inicio + ((fim - inicio) * i) / 100;
      const v = viradaGlobal(p);
      expect(v).toBeGreaterThanOrEqual(anterior);
      anterior = v;
    }
    expect(viradaGlobal(inicio)).toBe(0);
    expect(viradaGlobal(fim)).toBe(1);
  });

  it("PIN-02 — a virada local é uma onda da esquerda para a direita", () => {
    for (const x of [0, 0.3, 0.7, 1]) {
      for (const ruido of [0, 0.5, 1]) {
        expect(viradaLocal(0, x, ruido)).toBe(0);
        expect(viradaLocal(1, x, ruido)).toBeCloseTo(1, 10);
      }
    }
    // No meio da onda, a célula da esquerda já virou e a da direita ainda não.
    expect(viradaLocal(0.5, 0, 0.5)).toBeGreaterThan(viradaLocal(0.5, 1, 0.5));
    expect(viradaLocal(0.5, 0, 0.5)).toBe(1);
    expect(viradaLocal(0.5, 1, 0.5)).toBe(0);
    // Ao longo de x, a virada só diminui (a frente anda para a direita).
    let anterior = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= 20; i += 1) {
      const v = viradaLocal(0.4, i / 20, 0.5);
      expect(v).toBeLessThanOrEqual(anterior);
      anterior = v;
    }
  });

  it("PIN-03 — o envelope de vida nasce e morre em zero, pico no meio, nunca negativo", () => {
    const vida = 2;
    expect(envelopeDeVida(0, vida)).toBeCloseTo(0, 10);
    expect(envelopeDeVida(vida, vida)).toBeCloseTo(0, 10);
    expect(envelopeDeVida(vida / 2, vida)).toBeCloseTo(1, 10);
    for (let idade = -1; idade <= vida + 1; idade += 0.05) {
      expect(envelopeDeVida(idade, vida)).toBeGreaterThanOrEqual(0);
    }
    // Fora da faixa, o envelope fica preso nos extremos.
    expect(envelopeDeVida(-5, vida)).toBeCloseTo(0, 10);
    expect(envelopeDeVida(99, vida)).toBeCloseTo(0, 10);
    expect(envelopeDeVida(99, vida)).toBeCloseTo(envelopeDeVida(vida, vida), 10);
  });
});

describe("Correção e risco", () => {
  it("PIN-04 — corrigir: baixa nunca; média só com a metade sorteada; alta e crítica sempre; crítica primeiro", () => {
    for (let p = 0; p <= 5; p += 0.25) {
      for (const sorteio of [0, 0.25, 0.5, 0.75, 0.99]) {
        expect(fracaoCorrigida(1, sorteio, sorteio, p)).toBe(0);
      }
    }
    expect(fracaoCorrigida(2, 0.49, 0.5, 5)).toBe(0);
    expect(fracaoCorrigida(2, 0.5, 0.5, 5)).toBe(1);
    expect(fracaoCorrigida(3, 0, 0.5, 5)).toBe(1);
    expect(fracaoCorrigida(4, 0, 0.5, 5)).toBe(1);

    for (let i = 0; i <= 18; i += 1) {
      const p = 3.7 + i * 0.05;
      const critica = fracaoCorrigida(4, 0, 0.5, p);
      const alta = fracaoCorrigida(3, 0, 0.5, p);
      const media = fracaoCorrigida(2, 0.9, 0.5, p);
      expect(critica, `p=${p}`).toBeGreaterThanOrEqual(alta);
      expect(alta, `p=${p}`).toBeGreaterThanOrEqual(media);
    }
  });

  it("PIN-05 — o risco do grupo some no fim, com a média meio aberta e a baixa discreta", () => {
    for (const severidade of SEVERIDADES) {
      expect(riscoDoGrupo(severidade, 2.9)).toBe(0);
    }
    expect(riscoDoGrupo(4, 5)).toBeCloseTo(0, 10);
    expect(riscoDoGrupo(3, 5)).toBeCloseTo(0, 10);
    expect(riscoDoGrupo(2, 5)).toBeCloseTo(0.5, 10);
    expect(riscoDoGrupo(1, 5)).toBeCloseTo(1 - PINTURA.discricaoDaBaixa, 10);
    for (let p = 0; p <= 5.5; p += 0.1) {
      for (const severidade of SEVERIDADES) {
        const r = riscoDoGrupo(severidade, p);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("Fluxo e chegada", () => {
  it("PIN-06 — o ato 5 freia o fluxo e estabiliza a cena", () => {
    expect(velocidadeDoFluxo(4)).toBeCloseTo(1, 10);
    expect(velocidadeDoFluxo(5)).toBeCloseTo(1 - PINTURA.freioEstavel, 10);
    expect(estabilidade(4)).toBeCloseTo(0, 10);
    expect(estabilidade(5)).toBeCloseTo(1, 10);
  });

  it("PIN-07 — a falha chega ao grupo entre 'Organizar' e o fim, e o sorteio escalona a chegada", () => {
    expect(chegadaAoGrupo(3, 0)).toBe(0);
    expect(chegadaAoGrupo(4, 0)).toBe(1);
    expect(chegadaAoGrupo(3, 1)).toBe(0);
    expect(chegadaAoGrupo(4, 1)).toBe(1);
    // Com sorteio maior, a mesma posição de scroll encontra a falha mais atrasada.
    expect(chegadaAoGrupo(3.3, 0)).toBeGreaterThan(chegadaAoGrupo(3.3, 1));
  });
});

describe("Pinceladas e qualidade", () => {
  it("PIN-08 — o total de pinceladas segue a área, dentro dos limites", () => {
    const [minimo, maximo] = PINTURA.limitesDePinceladas;
    const total = (w: number, h: number, fracao = 1) => {
      const { colunas, linhas } = totalDePinceladas(w, h, fracao);
      return colunas * linhas;
    };
    const perto = (valor: number, alvo: number) => Math.abs(valor - alvo) / alvo <= 0.03;

    expect(perto(total(1440, 900), PINTURA.pinceladas)).toBe(true);
    expect(perto(total(300, 300), minimo)).toBe(true);
    expect(perto(total(5000, 3000), maximo)).toBe(true);
    expect(perto(total(1440, 900, 0.5), PINTURA.pinceladas / 2)).toBe(true);
  });

  it("PIN-09 — só um trecho sustentado de quadros lentos rebaixa a qualidade", () => {
    let estado = { nivel: 0, lentos: 0 };
    for (let i = 0; i < 1000; i += 1) estado = avaliarQualidade(estado, QUADRO_RAPIDO);
    expect(estado.nivel).toBe(0);

    estado = { nivel: 0, lentos: 0 };
    for (let i = 0; i < PINTURA.quadrosParaRebaixar - 1; i += 1) estado = avaliarQualidade(estado, QUADRO_LENTO);
    expect(estado.nivel).toBe(0);
    estado = avaliarQualidade(estado, QUADRO_LENTO);
    expect(estado).toEqual({ nivel: 1, lentos: 0 });

    // Um engasgo isolado no meio de quadros rápidos não rebaixa.
    estado = { nivel: 0, lentos: 0 };
    for (let i = 0; i < 1000; i += 1) {
      estado = avaliarQualidade(estado, i === 500 ? QUADRO_LENTO : QUADRO_RAPIDO);
    }
    expect(estado.nivel).toBe(0);

    // No último degrau não há para onde descer.
    const ultimo = PINTURA.qualidade.length - 1;
    estado = { nivel: ultimo, lentos: 0 };
    for (let i = 0; i < PINTURA.quadrosParaRebaixar * 3; i += 1) estado = avaliarQualidade(estado, QUADRO_LENTO);
    expect(estado.nivel).toBe(ultimo);
  });
});

describe("Posição dos grupos", () => {
  it("PIN-10 — os grupos ficam nas laterais: baixa e média à esquerda, alta e crítica à direita", () => {
    for (const severidade of SEVERIDADES) {
      const [x] = CENTRO_DOS_GRUPOS[severidade];
      expect(Math.abs(x), `severidade ${severidade}`).toBeGreaterThan(0.7);
    }
    expect(CENTRO_DOS_GRUPOS[1][0]).toBeLessThan(0);
    expect(CENTRO_DOS_GRUPOS[2][0]).toBeLessThan(0);
    expect(CENTRO_DOS_GRUPOS[3][0]).toBeGreaterThan(0);
    expect(CENTRO_DOS_GRUPOS[4][0]).toBeGreaterThan(0);
    // A regra de correção confirma que alta e crítica são as corrigíveis sempre.
    expect(eCorrigivel(4, 0)).toBe(true);
    expect(eCorrigivel(3, 0)).toBe(true);
  });
});
