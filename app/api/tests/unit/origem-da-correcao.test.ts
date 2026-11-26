/**
 * origem-da-correcao.test.ts — o que o detalhe da vulnerabilidade expõe para a
 * correção sugerida (ADR-063).
 *   ODC-U01  ecossistema a partir do Package URL
 *   ODC-U02  SCA: pacote, versão, versão corrigida e advisory do CodeFinding
 *   ODC-U03  SAST: arquivo, linha, trecho, recomendação e referência
 *   ODC-U04  Threat Intel: o pacote do inventário e a versão corrigida do casamento
 *   ODC-U05  manual/DAST: null
 */

import { ecossistemaDoPurl, origemDaCorrecao } from "../../src/models/vulnerability.model";

const codigo = {
  category: "SCA",
  packageName: "lodash",
  packageVersion: "4.17.15",
  purl: "pkg:npm/lodash@4.17.15",
  fixedVersion: "4.17.21",
  advisoryId: "CVE-2021-23337",
  filePath: null,
  startLine: null,
  snippet: null,
  recommendation: null,
  helpUri: null,
};

describe("origemDaCorrecao", () => {
  it("ODC-U01 — ecossistema do purl", () => {
    expect(ecossistemaDoPurl("pkg:npm/lodash@4.17.15")).toBe("npm");
    expect(ecossistemaDoPurl("pkg:PyPI/django@3.2")).toBe("pypi");
    expect(ecossistemaDoPurl("lodash")).toBeNull();
    expect(ecossistemaDoPurl(null)).toBeNull();
  });

  it("ODC-U02 — SCA", () => {
    expect(origemDaCorrecao({ sourceCodeFinding: codigo, sourceThreatMatch: null })).toMatchObject({
      tipo: "SCA",
      ecossistema: "npm",
      pacote: "lodash",
      versao: "4.17.15",
      versaoCorrigida: "4.17.21",
      advisoryId: "CVE-2021-23337",
    });
  });

  it("ODC-U03 — SAST", () => {
    // O "eval" abaixo é só TEXTO: o trecho do código vulnerável que o SAST apontou. Nada é executado.
    const sast = { ...codigo, category: "SAST", packageName: null, packageVersion: null, purl: null, fixedVersion: null, filePath: "src/app.js", startLine: 42, snippet: "eval(req.body.x)", recommendation: "Não use eval.", helpUri: "https://semgrep.dev/r/x" };
    expect(origemDaCorrecao({ sourceCodeFinding: sast, sourceThreatMatch: null })).toMatchObject({
      tipo: "SAST",
      ecossistema: null,
      arquivo: "src/app.js",
      linha: 42,
      trecho: "eval(req.body.x)",
      recomendacao: "Não use eval.",
      referencia: "https://semgrep.dev/r/x",
    });
  });

  it("ODC-U04 — Threat Intel", () => {
    const casamento = { fixedVersion: "2.15.0", advisoryId: "CVE-2021-44228", asset: { ecosystem: "Maven", packageName: "org.apache.logging.log4j:log4j-core", version: "2.14.1", displayName: "log4j-core 2.14.1" } };
    expect(origemDaCorrecao({ sourceCodeFinding: null, sourceThreatMatch: casamento })).toMatchObject({
      tipo: "THREAT_INTEL",
      ecossistema: "Maven",
      pacote: "org.apache.logging.log4j:log4j-core",
      versao: "2.14.1",
      versaoCorrigida: "2.15.0",
    });
  });

  it("ODC-U05 — sem origem de código ou Threat Intel → null", () => {
    expect(origemDaCorrecao({ sourceCodeFinding: null, sourceThreatMatch: null })).toBeNull();
    expect(origemDaCorrecao({})).toBeNull();
  });
});
