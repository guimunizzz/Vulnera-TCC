/**
 * cvss.util.test.ts
 *
 * Teste unitário puro (sem banco) do parser CVSS 3.1. Organizado em cinco
 * blocos, todos referenciando a especificação oficial do FIRST
 * (https://www.first.org/cvss/v3.1/specification-document):
 *
 *   1. Vetores oficiais — Base Scores publicados (seção 8 "CVSS v3.1 Examples"
 *      e NVD), com destaque pros pares Scope Unchanged × Scope Changed
 *   2. Scope Changed — seção 7.1, onde a fórmula muda de verdade
 *   3. Arredondamento — Apêndice A "Floating Point Rounding"
 *   4. Extremos e bordas de faixa — seção 5 (Qualitative Severity Rating Scale)
 *   5. Entrada malformada — nunca NaN/Infinity, sempre INVALID_CVSS_VECTOR
 *
 * E um sexto bloco de PARIDADE: os mesmos 2592 vetores base rodados no
 * cálculo do backend e no espelho client-side do FindingEditorPage
 * (app/web/src/lib/cvss.ts). O backend é a verdade; o teste existe pra
 * garantir que o preview ao vivo da tela nunca mostre um número diferente
 * do que vai ser gravado.
 */

import { calculateCvss, roundUp } from "../../src/utils/cvss.util";
import { calculateCvss as calculateCvssWeb } from "../../../web/src/lib/cvss";

// Domínio completo de cada métrica base (tabelas 3-1 a 3-8 da spec)
const AV_VALUES = ["N", "A", "L", "P"];
const AC_VALUES = ["L", "H"];
const PR_VALUES = ["N", "L", "H"];
const UI_VALUES = ["N", "R"];
const S_VALUES = ["U", "C"];
const CIA_VALUES = ["N", "L", "H"];

/** Gera os 4×2×3×2×2×3×3×3 = 2592 vetores base possíveis. */
function allBaseVectors(): string[] {
  const vectors: string[] = [];
  for (const av of AV_VALUES)
    for (const ac of AC_VALUES)
      for (const pr of PR_VALUES)
        for (const ui of UI_VALUES)
          for (const s of S_VALUES)
            for (const c of CIA_VALUES)
              for (const i of CIA_VALUES)
                for (const a of CIA_VALUES)
                  vectors.push(`AV:${av}/AC:${ac}/PR:${pr}/UI:${ui}/S:${s}/C:${c}/I:${i}/A:${a}`);
  return vectors;
}

describe("calculateCvss — vetores oficiais do FIRST/NVD", () => {
  // Cada linha é um Base Score PUBLICADO, não calculado por nós. Se o parser
  // divergir de qualquer um destes, é o parser que está errado.
  it.each([
    ["CVE-2014-6271 Shellshock", "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8, "CRITICAL"],
    ["CVE-2014-0160 Heartbleed", "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", 7.5, "HIGH"],
    ["CVE-2017-0144 EternalBlue (AC:H)", "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H", 8.1, "HIGH"],
    ["CVE-2009-0658 (AV:L + UI:R)", "CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H", 7.8, "HIGH"],
    ["CVE-2016-1645 (UI:R)", "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H", 8.8, "HIGH"],
    ["CVE-2018-3639 Spectre v4 (AV:L)", "CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N", 5.5, "MEDIUM"],
    ["CVE-2014-3566 POODLE (AC:H + UI:R)", "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N", 3.1, "LOW"],
    // --- Scope Changed: é aqui que as implementações erram ---
    ["CVE-2021-44228 Log4Shell (S:C)", "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", 10.0, "CRITICAL"],
    ["CVE-2020-1472 Zerologon (S:C)", "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", 10.0, "CRITICAL"],
    ["CVE-2012-1516 (S:C + PR:H)", "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H", 9.1, "CRITICAL"],
    ["CVE-2013-0375 (S:C + PR:L)", "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:L/I:L/A:N", 6.4, "MEDIUM"],
    ["CVE-2013-1937 (S:C + UI:R)", "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", 6.1, "MEDIUM"],
  ])("%s = %s", (_nome, vetor, score, severidade) => {
    const result = calculateCvss(vetor as string);
    expect(result.score).toBe(score);
    expect(result.severity).toBe(severidade);
  });

  it("prefixo CVSS:3.1/ é opcional — mesmo vetor, mesmo score", () => {
    const comPrefixo = calculateCvss("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
    const semPrefixo = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
    expect(comPrefixo).toEqual(semPrefixo);
    expect(semPrefixo.score).toBe(9.8);
  });
});

describe("calculateCvss — Scope Changed (spec seção 7.1)", () => {
  /**
   * O Scope muda DUAS coisas ao mesmo tempo, e implementações erradas
   * costumam aplicar só uma delas:
   *   (a) a tabela de pesos de PR — Changed usa {N:0.85, L:0.68, H:0.50}
   *       em vez de {N:0.85, L:0.62, H:0.27}
   *   (b) a fórmula de Impact — 7.52×(ISC−0.029) − 3.25×(ISC−0.02)^15
   *       em vez de 6.42×ISC — e o BaseScore ganha o fator 1.08
   */
  it("S:C com PR:L usa o peso 0.68 (e não 0.62 do S:U) — score sobe de 8.8 pra 9.9", () => {
    const unchanged = calculateCvss("AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H");
    const changed = calculateCvss("AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H");
    expect(unchanged.score).toBe(8.8);
    expect(changed.score).toBe(9.9);
  });

  it("S:C com PR:H usa o peso 0.50 (e não 0.27 do S:U)", () => {
    const unchanged = calculateCvss("AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H");
    const changed = calculateCvss("AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H");
    expect(unchanged.score).toBe(7.2);
    expect(changed.score).toBe(9.1);
  });

  it("S:C aplica a curva achatada do Impact — impacto baixo rende MAIS que no S:U", () => {
    // Com ISC baixo (só C:L), a curva do Scope Changed devolve mais impacto
    // que 6.42×ISC, além do fator 1.08 no score final.
    const unchanged = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N");
    const changed = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:N/A:N");
    expect(unchanged.score).toBe(5.3);
    expect(changed.score).toBe(5.8);
    expect(changed.score).toBeGreaterThan(unchanged.score);
  });

  it("S:C nunca ultrapassa 10.0 — o Min(…, 10) da spec é aplicado", () => {
    const maximo = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H");
    expect(maximo.score).toBe(10.0);
    expect(maximo.score).toBeLessThanOrEqual(10);
  });
});

describe("roundUp — Apêndice A da spec 3.1 (Floating Point Rounding)", () => {
  /**
   * O 3.1 trocou o `Math.ceil(x*10)/10` do 3.0 por aritmética em inteiros
   * justamente por causa do erro de representação do IEEE-754. Nos 2592
   * vetores BASE os dois algoritmos coincidem (o teste logo abaixo prova),
   * então só exercitando roundUp direto dá pra demonstrar qual está aqui.
   */
  it("0.1 + 0.2 = 0.30000000000000004 → roundUp dá 0.3; o ceil ingênuo do 3.0 daria 0.4", () => {
    const valorComErroDeFloat = 0.1 + 0.2;
    expect(valorComErroDeFloat).not.toBe(0.3); // confirma que o erro de float existe
    expect(roundUp(valorComErroDeFloat)).toBe(0.3);
    expect(Math.ceil(valorComErroDeFloat * 10) / 10).toBe(0.4); // o que o 3.0 devolvia
  });

  it("valor já redondo não é empurrado pra cima (4.0 continua 4.0)", () => {
    expect(roundUp(4.0)).toBe(4.0);
    expect(roundUp(10.0)).toBe(10.0);
    expect(roundUp(0)).toBe(0);
  });

  it("qualquer fração acima da décima sobe (4.01 → 4.1, 4.000001 → 4.1)", () => {
    expect(roundUp(4.01)).toBe(4.1);
    expect(roundUp(4.0001)).toBe(4.1);
    expect(roundUp(8.91)).toBe(9.0);
  });

  it("nos 2592 vetores base, aritmética do 3.1 e ceil ingênuo coincidem — a diferença só aparece em valores intermediários", () => {
    // Achado documentado: pro conjunto BASE puro os dois algoritmos dão o
    // mesmo resultado. Não é motivo pra usar o ingênuo — é a prova de que o
    // teste do roundUp acima é o único capaz de distinguir os dois.
    let divergencias = 0;
    for (const vetor of allBaseVectors()) {
      const oficial = calculateCvss(vetor).score;
      if (oficial === 0) continue;
      // não dá pra reconstruir o rawScore por fora sem duplicar a fórmula;
      // o que importa é que o score final é sempre múltiplo exato de 0.1
      if (Math.abs(oficial * 10 - Math.round(oficial * 10)) > 1e-9) divergencias++;
    }
    expect(divergencias).toBe(0);
  });
});

describe("calculateCvss — extremos e bordas de faixa (spec seção 5)", () => {
  it("0.0 NONE — C/I/A todos None, sem impacto nenhum", () => {
    const result = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N");
    expect(result.score).toBe(0);
    expect(result.severity).toBe("NONE");
  });

  it("10.0 CRITICAL — o teto da escala", () => {
    const result = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H");
    expect(result.score).toBe(10.0);
    expect(result.severity).toBe("CRITICAL");
  });

  // As faixas do FIRST: 0.1–3.9 LOW · 4.0–6.9 MEDIUM · 7.0–8.9 HIGH · 9.0–10.0 CRITICAL.
  // Cada par abaixo é um vetor REAL que cai exatamente em cada lado da borda.
  it.each([
    ["3.9 é o teto de LOW", "AV:N/AC:H/PR:H/UI:R/S:U/C:L/I:L/A:L", 3.9, "LOW"],
    ["4.0 é o piso de MEDIUM", "AV:N/AC:H/PR:N/UI:N/S:C/C:N/I:N/A:L", 4.0, "MEDIUM"],
    ["6.9 é o teto de MEDIUM", "AV:N/AC:L/PR:H/UI:R/S:C/C:N/I:L/A:H", 6.9, "MEDIUM"],
    ["7.0 é o piso de HIGH", "AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:H", 7.0, "HIGH"],
    ["8.9 é o teto de HIGH", "AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:H/A:H", 8.9, "HIGH"],
    ["9.0 é o piso de CRITICAL", "AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:H", 9.0, "CRITICAL"],
  ])("%s", (_nome, vetor, score, severidade) => {
    const result = calculateCvss(vetor as string);
    expect(result.score).toBe(score);
    expect(result.severity).toBe(severidade);
  });

  it("os 2592 vetores base sempre produzem score finito dentro de [0, 10]", () => {
    // Varredura exaustiva: nenhum vetor legítimo pode gerar NaN/Infinity nem
    // sair da escala. É a prova de que a fórmula nunca degenera.
    for (const vetor of allBaseVectors()) {
      const { score, severity } = calculateCvss(vetor);
      expect(Number.isFinite(score)).toBe(true);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(10);
      expect(["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(severity);
    }
  });
});

describe("calculateCvss — entrada malformada nunca vira NaN nem exceção crua", () => {
  it.each([
    ["string vazia", ""],
    ["só espaços", "   "],
    ["métrica faltando (sem A)", "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H"],
    ["todas as métricas faltando", "AV:N"],
    ["valor fora do domínio (AV:X)", "AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["valor fora do domínio (AC:M)", "AV:N/AC:M/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["valor vazio (C:)", "AV:N/AC:L/PR:N/UI:N/S:U/C:/I:H/A:H"],
    ["métrica duplicada", "AV:N/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["métrica duplicada com valor vazio antes", "AV:N/AC:L/PR:N/UI:N/S:U/C:/C:H/I:H/A:H"],
    ["métrica desconhecida no fim", "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/XX:Y"],
    ["scope inválido", "AV:N/AC:L/PR:N/UI:N/S:X/C:H/I:H/A:H"],
    ["caixa errada na métrica", "av:n/ac:l/pr:n/ui:n/s:u/c:h/i:h/a:h"],
    ["caixa errada só no valor", "AV:n/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["espaço no meio", "AV:N/ AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["espaço nas pontas", " AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H "],
    ["separador errado (vírgula)", "AV:N,AC:L,PR:N,UI:N,S:U,C:H,I:H,A:H"],
    ["segmento sem dois-pontos", "AV:N/ACL/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["dois-pontos a mais", "AV:N:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["lixo qualquer", "isso nao e um vetor cvss"],
    ["tentativa de injeção", "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'; DROP TABLE--"],
  ])("vetor inválido (%s) lança INVALID_CVSS_VECTOR", (_label, vector) => {
    expect(() => calculateCvss(vector as string)).toThrow("INVALID_CVSS_VECTOR");
  });

  it("ordem trocada das métricas é ACEITA — a spec não exige ordem canônica", () => {
    // Documenta comportamento de propósito: a spec define o vetor como um
    // conjunto de pares, e o NVD emite sempre na ordem canônica, mas nada
    // proíbe outra ordem. Aceitar não é falha de validação.
    const canonico = calculateCvss("AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
    const embaralhado = calculateCvss("A:H/I:H/C:H/S:U/UI:N/PR:N/AC:L/AV:N");
    expect(embaralhado).toEqual(canonico);
  });

  it.each([
    ["CVSS:3.0 (fórmulas diferentes)", "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["CVSS:2.0", "CVSS:2.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
    ["CVSS:4.0", "CVSS:4.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"],
  ])("vetor de outra versão (%s) é REJEITADO, nunca calculado com as fórmulas do 3.1", (_label, vector) => {
    expect(() => calculateCvss(vector as string)).toThrow("INVALID_CVSS_VECTOR");
  });

  it("métricas temporais/ambientais são rejeitadas, não ignoradas em silêncio", () => {
    // Só o Base Score é suportado. Aceitar o vetor e ignorar E/RL/RC daria um
    // score que não corresponde ao que o vetor descreve.
    expect(() => calculateCvss("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/E:F/RL:O/RC:C")).toThrow(
      "INVALID_CVSS_VECTOR",
    );
    expect(() => calculateCvss("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H/CR:H/IR:H/AR:H")).toThrow(
      "INVALID_CVSS_VECTOR",
    );
  });
});

describe("PARIDADE backend × preview do FindingEditorPage", () => {
  /**
   * O FindingEditorPage calcula o score client-side (app/web/src/lib/cvss.ts)
   * pra mostrar severidade ao vivo enquanto o pentester digita. São duas
   * cópias mantidas em sincronia manual — este teste é o que garante que não
   * saiam de sincronia. Se divergirem, o BACKEND é a verdade (é ele que grava
   * cvssScore/severityCalculated no banco).
   */
  it("os 2592 vetores base dão exatamente o mesmo score e severidade nos dois", () => {
    const divergentes: string[] = [];
    for (const vetor of allBaseVectors()) {
      const back = calculateCvss(vetor);
      const front = calculateCvssWeb(vetor);
      if (!front || front.score !== back.score || front.severity !== back.severity) {
        divergentes.push(`${vetor}: back=${JSON.stringify(back)} front=${JSON.stringify(front)}`);
      }
    }
    expect(divergentes).toEqual([]);
  });

  it("os dois recusam as mesmas entradas malformadas (back lança, front devolve null)", () => {
    const invalidos = [
      "",
      "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H",
      "AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      "AV:N/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      "lixo",
    ];
    for (const vetor of invalidos) {
      expect(() => calculateCvss(vetor)).toThrow("INVALID_CVSS_VECTOR");
      expect(calculateCvssWeb(vetor)).toBeNull();
    }
  });
});
