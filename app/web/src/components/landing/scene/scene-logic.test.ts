/**
 * scene-logic.test.ts
 *
 * Partes puras da cena narrativa ASCII (sem three, sem DOM):
 *   NAR-01  mapeamento scroll → progresso: 0 no topo, inteiro em cada marco,
 *           linear entre marcos, teto no último ato
 *   NAR-02  marcos: o ato k começa quando a seção chega ao meio da tela
 *   NAR-03  atlas: cada índice de GLIFO aponta para o caractere certo
 *   NAR-04  regra da célula é determinística
 *   NAR-05  vinheta: campo esparso atrás do texto, mais cheio nas laterais
 *   NAR-06  falhas: "!" no ato 1, glifo e tom da severidade no ato 2
 *   NAR-07  varredura só no ato 2, no meio, em blocos
 *   NAR-08  grupos só nas laterais, fora da coluna de texto
 *   NAR-09  corrigir: alta/crítica somem dos grupos e viram "✓" na grade
 *   NAR-10  regra de correção pelo mais grave
 *   NAR-11  sorteios independentes: o binário do campo divide "0" e "1"
 */

import { describe, expect, it } from "vitest";
import { GLIFO, GLIFOS, ULTIMO_ATO, VINHETA, calcularMarcos, mapearProgresso } from "./config";
import { PROPORCAO_FALHAS, eCorrigivel, estadoDaCelula, type CelulaDoPoster, type Medidas } from "./layout";

const MEDIDAS: Medidas = { colunas: 120, linhas: 52, larguraCelula: 12, alturaCelula: 21, raioDoGrupoPx: 88 };
const glifos = Array.from(GLIFOS);

function varrer(ato: number, filtro: (c: CelulaDoPoster, x: number, y: number) => boolean) {
  const encontradas: { c: CelulaDoPoster; x: number; y: number }[] = [];
  for (let y = 0; y < MEDIDAS.linhas; y += 1) {
    for (let x = 0; x < MEDIDAS.colunas; x += 1) {
      const c = estadoDaCelula(x, y, ato, MEDIDAS);
      if (c && filtro(c, x, y)) encontradas.push({ c, x, y });
    }
  }
  return encontradas;
}
const clipX = (x: number) => ((x + 0.5) / MEDIDAS.colunas) * 2 - 1;

describe("Progresso narrativo", () => {
  it("NAR-01 — mapeia o scroll em 0 a 5, linear entre marcos", () => {
    const marcos = [0, 1000, 2000, 3500, 5000, 6000];
    expect(mapearProgresso(0, marcos)).toBe(0);
    expect(mapearProgresso(500, marcos)).toBe(0.5);
    expect(mapearProgresso(2000, marcos)).toBe(2);
    expect(mapearProgresso(2750, marcos)).toBe(2.5);
    expect(mapearProgresso(9999, marcos)).toBe(ULTIMO_ATO);
    expect(mapearProgresso(100, [])).toBe(0);
  });

  it("NAR-02 — marcos no meio da tela, primeiro ato no topo", () => {
    expect(calcularMarcos([0, 900, 1800], 900)).toEqual([0, 450, 1350]);
    expect(calcularMarcos([0, 200], 900)).toEqual([0, 0]);
  });
});

describe("Regra das células", () => {
  it("NAR-03 — índices do atlas apontam para os glifos certos", () => {
    expect(glifos[GLIFO.vazio]).toBe(" ");
    expect(glifos[GLIFO.alerta]).toBe("!");
    expect(glifos[GLIFO.ok]).toBe("✓");
    expect(glifos[GLIFO.blocoCheio]).toBe("█");
    expect(glifos.slice(GLIFO.blocoCheio - 3, GLIFO.blocoCheio + 1).join("")).toBe("░▒▓█");
    const severidades = [GLIFO.baixa, GLIFO.media, GLIFO.alta, GLIFO.critica].map((i) => glifos[i]);
    expect(new Set(severidades).size).toBe(4);
    // Severidade nunca se confunde com o campo calmo.
    const rampa = glifos.slice(GLIFO.rampaInicio, GLIFO.rampaInicio + GLIFO.rampaTotal);
    severidades.forEach((g) => expect(rampa).not.toContain(g));
  });

  it("NAR-04 — mesma célula, mesmo ato, mesmo resultado", () => {
    for (const ato of [0, 2, 4]) {
      expect(estadoDaCelula(17, 9, ato, MEDIDAS)).toEqual(estadoDaCelula(17, 9, ato, MEDIDAS));
    }
  });

  it("NAR-05 — vinheta: esparso no centro, cheio nas laterais", () => {
    const calmas = varrer(0, (c) => c.tom === "base" && !c.destaque);
    const centro = calmas.filter(({ x }) => Math.abs(clipX(x)) < VINHETA.inicio).length;
    const lateral = calmas.filter(({ x }) => Math.abs(clipX(x)) > VINHETA.fim).length;
    const colunasCentro = Array.from({ length: MEDIDAS.colunas }, (_, x) => x).filter((x) => Math.abs(clipX(x)) < VINHETA.inicio).length;
    const colunasLateral = Array.from({ length: MEDIDAS.colunas }, (_, x) => x).filter((x) => Math.abs(clipX(x)) > VINHETA.fim).length;
    const densidadeCentro = centro / (colunasCentro * MEDIDAS.linhas);
    const densidadeLateral = lateral / (colunasLateral * MEDIDAS.linhas);
    expect(densidadeCentro).toBeLessThan(VINHETA.densidadeCentro + 0.05);
    expect(densidadeLateral).toBeGreaterThan(densidadeCentro * 2);
  });

  it("NAR-06 — falhas piscam '!' no ato 1 e mostram a severidade no ato 2", () => {
    const alertas = varrer(1, (c) => c.glifo === "!");
    const total = MEDIDAS.colunas * MEDIDAS.linhas;
    expect(alertas.length / total).toBeGreaterThan(PROPORCAO_FALHAS * 0.6);
    expect(alertas.length / total).toBeLessThan(PROPORCAO_FALHAS * 1.4);
    alertas.forEach(({ x, y }) => {
      const depois = estadoDaCelula(x, y, 2, MEDIDAS)!;
      // No meio da tela a varredura pode cobrir a célula com um bloco.
      if (depois.tom === "neon") return;
      expect([1, 2, 3, 4]).toContain(depois.tom);
      expect(depois.destaque).toBe(true);
    });
  });

  it("NAR-07 — varredura só no ato 2, no meio, em blocos", () => {
    const blocos = (ato: number) => varrer(ato, (c) => "░▒▓█".includes(c.glifo));
    expect(blocos(0)).toHaveLength(0);
    expect(blocos(3)).toHaveLength(0);
    const ato2 = blocos(2);
    expect(ato2.length).toBeGreaterThan(0);
    ato2.forEach(({ c, x }) => {
      expect(c.tom).toBe("neon");
      expect(Math.abs(x + 0.5 - MEDIDAS.colunas / 2)).toBeLessThan(4);
    });
  });

  it("NAR-08 — grupos só nas laterais", () => {
    const doGrupo = varrer(3, (c, x) => c.tom !== "base" && c.tom !== "neon" && Math.abs(clipX(x)) > 0.55);
    expect(doGrupo.length).toBeGreaterThan(20);
    const noMeio = varrer(3, (c, x) => typeof c.tom === "number" && Math.abs(clipX(x)) < 0.5);
    // No ato 3 as falhas da grade já saíram: severidade no meio da tela, só zero.
    expect(noMeio).toHaveLength(0);
    // Menos graves à esquerda, mais graves à direita.
    doGrupo.forEach(({ c, x }) => {
      if (typeof c.tom !== "number") return;
      expect(Math.sign(clipX(x))).toBe(c.tom >= 3 ? 1 : -1);
    });
  });

  it("NAR-09 — corrigir: alta e crítica saem dos grupos e voltam como '✓'", () => {
    const graves = varrer(4, (c) => c.tom === 3 || c.tom === 4);
    expect(graves).toHaveLength(0);
    expect(varrer(4, (c) => c.tom === 1).length).toBeGreaterThan(0); // baixa segue em acompanhamento
    const ok = varrer(4, (c) => c.glifo === "✓");
    expect(ok.length).toBeGreaterThan(0);
    ok.forEach(({ c }) => expect(c.tom).toBe("resolvido"));
    expect(varrer(1, (c) => c.glifo === "✓")).toHaveLength(0);
  });

  it("NAR-10 — regra de correção pelo mais grave", () => {
    expect(eCorrigivel(4, 0)).toBe(true);
    expect(eCorrigivel(3, 0)).toBe(true);
    expect(eCorrigivel(2, 0.7)).toBe(true);
    expect(eCorrigivel(2, 0.2)).toBe(false);
    expect(eCorrigivel(1, 0.99)).toBe(false);
  });

  it("NAR-11 — sorteios independentes: '0' e '1' se dividem no campo", () => {
    const zeros = varrer(0, (c) => c.glifo === "0").length;
    const uns = varrer(0, (c) => c.glifo === "1").length;
    expect(zeros + uns).toBeGreaterThan(100);
    expect(zeros / (zeros + uns)).toBeGreaterThan(0.4);
    expect(zeros / (zeros + uns)).toBeLessThan(0.6);
  });
});
