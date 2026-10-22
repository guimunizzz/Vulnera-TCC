/**
 * findings-xlsx-texto-tempo.test.ts
 *
 * As defesas e as conversões da exportação Excel. Funções puras, sem banco.
 *
 *   FX-U-01  texto que o Excel leria como fórmula é sinalizado (= + - @ TAB CR LF)
 *   FX-U-02  caracteres proibidos em XML são removidos; TAB/LF ficam, CRLF/CR viram LF
 *   FX-U-03  substituto UTF-16 solto é removido; emoji válido fica
 *   FX-U-04  texto acima do limite da célula é truncado COM marcador explícito
 *   FX-U-05  o corte não parte um emoji ao meio
 *   FX-U-06  a fronteira exata do limite
 *   FX-U-07  escape de XML
 *   FX-U-08  altura de linha: mínimo, quebras e teto
 *   FX-U-10  instante UTC → relógio de São Paulo
 *   FX-U-11  serial do Excel
 *   FX-U-12  o dia SP não é o dia UTC perto da meia-noite
 *   FX-U-13  carimbo do nome do arquivo
 *   FX-U-14  dia da semana
 *   FX-U-15  horário de verão antigo e fronteira da transição (cache por hora exato)
 */

import {
  LIMITE_CELULA,
  LIMITE_UTIL,
  alturaDeLinha,
  escaparXml,
  prepararTexto,
} from "../../src/utils/findings-xlsx/texto";
import {
  carimboDeArquivo,
  dataDoDia,
  diaDaSemana,
  diaSP,
  relogioSP,
  serialExcel,
  soData,
} from "../../src/utils/findings-xlsx/tempo";

describe("findings-xlsx · texto", () => {
  it.each(["=cmd|' /C calc'!A0", "+SUM(1;1)", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd", "\ncmd"])(
    "FX-U-01 sinaliza como perigoso: %j",
    (valor) => {
      const r = prepararTexto(valor);
      expect(r.perigoso).toBe(true);
      // O dado NÃO é alterado: nada de aspa, nada de prefixo (só a quebra CR vira LF, como no Excel).
      expect(r.texto).toBe(valor.replace(/\r\n?/g, "\n"));
    },
  );

  it.each(["normal", "a=b", "texto - com hífen", " =com espaço antes", "1+1", ""])("FX-U-01 não sinaliza: %j", (valor) => {
    expect(prepararTexto(valor).perigoso).toBe(false);
  });

  it("FX-U-01 nulo e indefinido viram texto vazio", () => {
    expect(prepararTexto(null)).toEqual({ texto: "", perigoso: false, truncado: false });
    expect(prepararTexto(undefined)).toEqual({ texto: "", perigoso: false, truncado: false });
  });

  it("FX-U-02 remove controles ilegais em XML, mantém TAB e LF e normaliza CRLF/CR para LF", () => {
    expect(prepararTexto(`a\u0000b\u0007c\u001Fd${String.fromCharCode(0xfffe)}e`).texto).toBe("abcde");
    expect(prepararTexto("a\tb\nc\r\nd\re").texto).toBe("a\tb\nc\nd\ne");
  });

  it("FX-U-03 remove substituto solto e preserva emoji válido", () => {
    expect(prepararTexto("a\uD800b").texto).toBe("ab");
    expect(prepararTexto("a\uDC00b").texto).toBe("ab");
    expect(prepararTexto("ok 😀 ação").texto).toBe("ok 😀 ação");
  });

  it("FX-U-04 trunca acima do limite, nunca em silêncio", () => {
    const r = prepararTexto("x".repeat(40_000));
    expect(r.truncado).toBe(true);
    expect(r.texto.length).toBeLessThanOrEqual(LIMITE_CELULA);
    expect(r.texto.startsWith("x".repeat(LIMITE_UTIL))).toBe(true);
    // O marcador diz QUANTO ficou de fora (40.000 − 32.700 = 7.300).
    expect(r.texto).toMatch(/\n\[… truncado: 7\.300 caracteres omitidos\]$/);
  });

  it("FX-U-05 o corte não parte um par substituto", () => {
    // O emoji ocupa os índices 32.699 (alto) e 32.700 (baixo): cortar em 32.700 o partiria.
    const r = prepararTexto("a".repeat(32_699) + "😀" + "b".repeat(500));
    expect(r.truncado).toBe(true);
    expect(r.texto).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(r.texto.length).toBeLessThanOrEqual(LIMITE_CELULA);
  });

  it("FX-U-06 exatamente no limite não trunca; um caractere acima trunca", () => {
    expect(prepararTexto("y".repeat(LIMITE_UTIL)).truncado).toBe(false);
    expect(prepararTexto("y".repeat(LIMITE_UTIL + 1)).truncado).toBe(true);
  });

  it("FX-U-07 escapa XML e remove o que o XML não admite", () => {
    expect(escaparXml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;'");
    expect(escaparXml("a\u0000b")).toBe("ab");
  });

  it("FX-U-08 altura de linha: mínimo, quebras explícitas e teto", () => {
    expect(alturaDeLinha([{ texto: "curto", largura: 40 }])).toBe(18);
    const tresLinhas = alturaDeLinha([{ texto: "a\nb\nc", largura: 40 }]);
    expect(tresLinhas).toBeGreaterThan(18);
    expect(alturaDeLinha([{ texto: "z".repeat(50_000), largura: 40 }])).toBe(160);
    // Vence a coluna que precisa de mais linhas.
    expect(alturaDeLinha([{ texto: "a", largura: 40 }, { texto: "a\nb\nc\nd", largura: 40 }])).toBeGreaterThan(tresLinhas);
  });
});

describe("findings-xlsx · tempo", () => {
  it("FX-U-10 converte UTC para o relógio de São Paulo (UTC−3, sem horário de verão)", () => {
    const tarde = relogioSP(new Date(Date.UTC(2026, 9, 22, 23, 30)));
    expect([tarde.getUTCFullYear(), tarde.getUTCMonth(), tarde.getUTCDate(), tarde.getUTCHours(), tarde.getUTCMinutes()]).toEqual([2026, 9, 22, 20, 30]);

    const madrugada = relogioSP(new Date(Date.UTC(2026, 9, 22, 2, 0)));
    expect([madrugada.getUTCDate(), madrugada.getUTCHours()]).toEqual([21, 23]);
  });

  it("FX-U-11 serial do Excel: 22/10/2026 = 46317 e 01/03/1900 = 61", () => {
    expect(serialExcel(new Date(Date.UTC(2026, 9, 22)))).toBe(46317);
    expect(serialExcel(new Date(Date.UTC(1900, 2, 1)))).toBe(61);
    expect(serialExcel(new Date(Date.UTC(2026, 9, 22, 12)))).toBe(46317.5);
  });

  it("FX-U-12 perto da meia-noite o dia SP é o anterior ao dia UTC", () => {
    expect(diaSP(new Date(Date.UTC(2026, 9, 22, 2, 0)))).toBe(46316); // 21/10 23:00 em SP
    expect(diaSP(new Date(Date.UTC(2026, 9, 22, 3, 0)))).toBe(46317); // 22/10 00:00 em SP
    expect(soData(new Date(Date.UTC(2026, 9, 22, 2, 0))).getTime()).toBe(dataDoDia(46316).getTime());
  });

  it("FX-U-13 carimbo do arquivo usa o relógio de SP", () => {
    expect(carimboDeArquivo(new Date("2026-10-22T14:30:00Z"))).toBe("2026-10-22_1130");
    expect(carimboDeArquivo(new Date("2026-10-23T02:05:00Z"))).toBe("2026-10-22_2305");
  });

  it("FX-U-15 horário de verão antigo (UTC−2) e a fronteira da transição — o cache por hora é exato", () => {
    const campos = (iso: string) => {
      const r = relogioSP(new Date(iso));
      return [r.getUTCFullYear(), r.getUTCMonth() + 1, r.getUTCDate(), r.getUTCHours(), r.getUTCMinutes(), r.getUTCSeconds()];
    };
    // Verão de 2018/19: UTC−2. Depois (2019 em diante, sem horário de verão): UTC−3.
    expect(campos("2018-12-01T12:00:00Z")).toEqual([2018, 12, 1, 10, 0, 0]);
    expect(campos("2019-12-01T12:00:00Z")).toEqual([2019, 12, 1, 9, 0, 0]);
    // O verão começou em 04/11/2018, à meia-noite local (03:00Z): 23:59:59 do dia 3 → 01:00:00 do dia 4.
    expect(campos("2018-11-04T02:59:59Z")).toEqual([2018, 11, 3, 23, 59, 59]);
    expect(campos("2018-11-04T03:00:00Z")).toEqual([2018, 11, 4, 1, 0, 0]);
    // Chamar de novo (agora vindo do cache) dá o mesmo resultado, e minutos/segundos não se perdem no cache por hora.
    expect(campos("2018-11-04T03:00:00Z")).toEqual([2018, 11, 4, 1, 0, 0]);
    expect(campos("2026-10-22T14:37:42Z")).toEqual([2026, 10, 22, 11, 37, 42]);
    expect(campos("2026-10-22T14:05:09Z")).toEqual([2026, 10, 22, 11, 5, 9]);
  });

  it("FX-U-14 dia da semana (22/10/2026 é quinta)", () => {
    expect(diaDaSemana(46317)).toBe(4);
    expect(diaDaSemana(46314)).toBe(1); // segunda, 19/10
  });
});
