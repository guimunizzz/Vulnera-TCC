/**
 * code-import.util.test.ts — parser de SARIF/CycloneDX (ADR-052), sem banco.
 *
 * Os documentos abaixo reproduzem a FORMA do que Semgrep, CodeQL e Trivy
 * emitem de verdade (campos e convenções de cada um). A validação contra
 * relatórios gerados pelas ferramentas reais está em docs/CODE_IMPORT.md.
 *
 *   CI-SARIF-01  Semgrep: título vem da mensagem, CWE das tags, severidade do level
 *   CI-SARIF-02  CodeQL: security-severity vence o level; regra pelo ruleIndex; CWE "external/cwe/cwe-079"
 *   CI-SARIF-03  Trivy SARIF: CVE vira SCA com pacote/versão/correção lidos da mensagem
 *   CI-SARIF-04  fingerprint estável ignora a linha; sem ele, a linha conta
 *   CI-SARIF-05  resultado suprimido na origem não entra
 *   CI-SARIF-06  versão diferente de 2.1.0 → UNSUPPORTED_SARIF_VERSION
 *   CI-CDX-01    CycloneDX 1.5: tools.components, componentes aninhados, maior severidade
 *   CI-CDX-02    um achado por componente afetado; vetor sem prefixo ganha CVSS:3.x
 *   CI-CDX-03    SBOM sem `vulnerabilities` importa com aviso e zero achados
 *   CI-SARIF-07  Semgrep OSS sem login ("requires login") não junta ocorrências de linhas diferentes
 *   CI-SARIF-08  Trivy SARIF com id fora do padrão (NSWG-ECO-*) continua SCA
 *   CI-CDX-04    Trivy CycloneDX: v3.1 antes de v3.0 e versão corrigida lida da recomendação
 *   CI-GEN-01    JSON inválido / formato desconhecido / BOM / limite / ocorrência repetida
 *   CI-DRAFT-01  rascunho: SCA é A06 e usa o vetor da ferramenta; SAST mapeia CWE e sugere por severidade
 */

import { buildCodePromotionDraft, extractCwe, MAX_FINDINGS_PER_IMPORT, parseCodeReport, severityFromScore } from "../../src/utils/code-import.util";
import { owaspCategoryForCwe } from "../../src/utils/dast-promotion.util";
import { calculateCvss } from "../../src/utils/cvss.util";

const sarif = (runs: unknown[], version = "2.1.0") => JSON.stringify({ version, $schema: "https://json.schemastore.org/sarif-2.1.0.json", runs });

const semgrepRun = {
  tool: {
    driver: {
      name: "Semgrep OSS",
      semanticVersion: "1.95.0",
      rules: [
        {
          id: "javascript.express.security.audit.xss.direct-response-write",
          name: "javascript.express.security.audit.xss.direct-response-write",
          shortDescription: { text: "Semgrep Finding: javascript.express.security.audit.xss.direct-response-write" },
          fullDescription: { text: "Detected directly writing to a Response object from user-defined input." },
          defaultConfiguration: { level: "warning" },
          help: { markdown: "Use a template engine that escapes output.", text: "Escape output." },
          helpUri: "https://semgrep.dev/r/javascript.express.security.audit.xss.direct-response-write",
          properties: { tags: ["CWE-79: Improper Neutralization of Input During Web Page Generation", "OWASP-A03:2021 - Injection"] },
        },
      ],
    },
  },
  results: [
    {
      ruleId: "javascript.express.security.audit.xss.direct-response-write",
      message: { text: "Detected directly writing to a Response object from user-defined input." },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: "app/routes/session.js", uriBaseId: "%SRCROOT%" },
            region: { startLine: 42, endLine: 42, snippet: { text: "res.send(req.query.name)" } },
          },
        },
      ],
      fingerprints: { "matchBasedId/v1": "abc123" },
    },
  ],
};

describe("code-import.util — SARIF", () => {
  it("CI-SARIF-01 Semgrep: título da mensagem, CWE das tags, severidade do level", () => {
    const r = parseCodeReport(sarif([semgrepRun]));
    expect(r.format).toBe("SARIF");
    expect(r.toolName).toBe("Semgrep OSS");
    expect(r.toolVersion).toBe("1.95.0");
    expect(r.findings).toHaveLength(1);
    const f = r.findings[0];
    expect(f.category).toBe("SAST");
    // "Semgrep Finding: <id>" não diz nada, e o nome da regra é o próprio id:
    // o título vem da 1ª frase da mensagem
    expect(f.title).toBe("Detected directly writing to a Response object from user-defined input.");
    expect(f.cweId).toBe("79");
    expect(f.severity).toBe("MEDIUM");
    expect(f.filePath).toBe("app/routes/session.js");
    expect(f.startLine).toBe(42);
    expect(f.snippet).toBe("res.send(req.query.name)");
    // texto puro antes do markdown (a tela não renderiza markdown/HTML)
    expect(f.recommendation).toBe("Escape output.");
    expect(f.helpUri).toContain("semgrep.dev");
  });

  it("CI-SARIF-02 CodeQL: security-severity vence o level; regra por ruleIndex; CWE com zero à esquerda", () => {
    const run = {
      tool: {
        driver: { name: "CodeQL", semanticVersion: "2.19.0" },
        extensions: [
          {
            name: "codeql/javascript-queries",
            rules: [
              {
                id: "js/sql-injection",
                shortDescription: { text: "Database query built from user-controlled sources" },
                properties: { "security-severity": "8.8", tags: ["security", "external/cwe/cwe-089"] },
              },
            ],
          },
        ],
      },
      results: [
        {
          rule: { id: "js/sql-injection", index: 0 },
          level: "note",
          message: { text: "This query depends on a user-provided value." },
          locations: [{ physicalLocation: { artifactLocation: { uri: "file:///src/db%20utils.js" }, region: { startLine: 7 } } }],
          partialFingerprints: { primaryLocationLineHash: "deadbeef:1" },
        },
      ],
    };
    const [f] = parseCodeReport(sarif([run])).findings;
    expect(f.ruleId).toBe("js/sql-injection");
    expect(f.title).toBe("Database query built from user-controlled sources");
    expect(f.severity).toBe("HIGH"); // 8.8, apesar do level "note"
    expect(f.cvssScore).toBe(8.8);
    expect(f.cweId).toBe("89");
    expect(f.filePath).toBe("src/db utils.js");
  });

  it("CI-SARIF-03 Trivy SARIF: CVE vira SCA com pacote, versão e correção", () => {
    const run = {
      tool: { driver: { name: "Trivy", version: "0.57.0", rules: [{ id: "CVE-2021-23337", shortDescription: { text: "lodash: command injection via template" }, properties: { "security-severity": "7.2", tags: ["vulnerability", "security", "HIGH"] } }] } },
      results: [
        {
          ruleId: "CVE-2021-23337",
          ruleIndex: 0,
          level: "error",
          message: { text: "Package: lodash\nInstalled Version: 4.17.15\nVulnerability CVE-2021-23337\nSeverity: HIGH\nFixed Version: 4.17.21\nLink: [CVE-2021-23337](https://avd.aquasec.com/nvd/cve-2021-23337)" },
          locations: [{ physicalLocation: { artifactLocation: { uri: "package-lock.json" }, region: { startLine: 1 } } }],
        },
      ],
    };
    const [f] = parseCodeReport(sarif([run])).findings;
    expect(f.category).toBe("SCA");
    expect(f.advisoryId).toBe("CVE-2021-23337");
    expect(f.packageName).toBe("lodash");
    expect(f.packageVersion).toBe("4.17.15");
    expect(f.fixedVersion).toBe("4.17.21");
    expect(f.severity).toBe("HIGH");
  });

  it("CI-SARIF-04 fingerprint estável ignora a linha; sem ele, a linha muda o fingerprint", () => {
    const comLinha = (line: number, fp?: string) =>
      parseCodeReport(
        sarif([
          {
            ...semgrepRun,
            results: [{ ...semgrepRun.results[0], fingerprints: fp ? { "matchBasedId/v1": fp } : undefined, locations: [{ physicalLocation: { artifactLocation: { uri: "a.js" }, region: { startLine: line } } }] }],
          },
        ]),
      ).findings[0].fingerprint;

    expect(comLinha(10, "x")).toBe(comLinha(99, "x"));
    expect(comLinha(10)).not.toBe(comLinha(11));
    expect(comLinha(10, "x")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("CI-SARIF-05 resultado suprimido na origem não entra; supressão rejeitada entra", () => {
    const base = semgrepRun.results[0];
    const r = parseCodeReport(
      sarif([
        {
          ...semgrepRun,
          results: [
            { ...base, suppressions: [{ kind: "inSource" }] },
            { ...base, fingerprints: { "matchBasedId/v1": "outro" }, suppressions: [{ kind: "external", status: "rejected" }] },
          ],
        },
      ]),
    );
    expect(r.findings).toHaveLength(1);
  });

  it("CI-SARIF-06 versão SARIF diferente de 2.1.0 é recusada", () => {
    expect(() => parseCodeReport(sarif([semgrepRun], "1.0.0"))).toThrow("UNSUPPORTED_SARIF_VERSION");
  });
});

const cdx = (extra: Record<string, unknown>) =>
  JSON.stringify({
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    metadata: { tools: { components: [{ type: "application", name: "trivy", version: "0.57.0" }] } },
    components: [
      { "bom-ref": "pkg:npm/lodash@4.17.15", name: "lodash", version: "4.17.15", purl: "pkg:npm/lodash@4.17.15" },
      {
        "bom-ref": "pkg:npm/express@4.16.0",
        name: "express",
        version: "4.16.0",
        purl: "pkg:npm/express@4.16.0",
        components: [{ "bom-ref": "pkg:npm/%40types/qs@6.5.1", group: "@types", name: "qs", version: "6.5.1", purl: "pkg:npm/%40types/qs@6.5.1" }],
      },
    ],
    ...extra,
  });

describe("code-import.util — formas vistas em relatórios reais (2026-11-13)", () => {
  it("CI-SARIF-07 'requires login' do Semgrep OSS não junta ocorrências de linhas diferentes", () => {
    const run = {
      tool: { driver: { name: "Semgrep OSS", rules: [{ id: "eval-detected", name: "eval-detected" }] } },
      results: [16, 21, 26].map((line) => ({
        ruleId: "eval-detected",
        message: { text: "Detected the use of eval(). This can be dangerous." },
        locations: [{ physicalLocation: { artifactLocation: { uri: "app/routes/contributions.js" }, region: { startLine: line } } }],
        fingerprints: { "matchBasedId/v1": "requires login" },
      })),
    };
    const r = parseCodeReport(sarif([run]));
    expect(r.findings).toHaveLength(3);
    expect(new Set(r.findings.map((f) => f.fingerprint)).size).toBe(3);
    expect(r.findings[0].title).toBe("Detected the use of eval().");

    // Fingerprint "de verdade" que se repete em linhas diferentes também não distingue: vale a linha.
    const mesmoHash = { ...run, results: run.results.map((x) => ({ ...x, fingerprints: { "matchBasedId/v1": "abc" } })) };
    expect(new Set(parseCodeReport(sarif([mesmoHash])).findings.map((f) => f.fingerprint)).size).toBe(3);
  });

  it("CI-SARIF-09 ajuda do Semgrep: sem a linha de propaganda e sem repetir a descrição", () => {
    const desc = "Data is being eval'd from a `curl` command.";
    const run = {
      tool: {
        driver: {
          name: "Semgrep OSS",
          rules: [
            {
              id: "curl-eval",
              name: "curl-eval",
              fullDescription: { text: desc },
              help: {
                text: `${desc}\n💎 Enable cross-file analysis and Pro rules for free at sg.run/pro`,
                markdown: `${desc}\n\n#### 💎 Enable cross-file analysis and Pro rules for free at <a href='https://sg.run/pro'>sg.run/pro</a>`,
              },
            },
            {
              id: "outra",
              name: "outra",
              fullDescription: { text: "Algo inseguro." },
              help: { text: "Use a função segura X.\n💎 Enable cross-file analysis and Pro rules for free at sg.run/pro" },
            },
          ],
        },
      },
      results: [
        { ruleId: "curl-eval", message: { text: desc }, locations: [{ physicalLocation: { artifactLocation: { uri: "a.sh" }, region: { startLine: 1 } } }] },
        { ruleId: "outra", message: { text: "Algo inseguro." }, locations: [{ physicalLocation: { artifactLocation: { uri: "b.js" }, region: { startLine: 2 } } }] },
      ],
    };
    const [a, b] = parseCodeReport(sarif([run])).findings;
    expect(a.recommendation).toBeNull();
    expect(b.recommendation).toBe("Use a função segura X.");
  });

  it("CI-SARIF-08 Trivy SARIF com id NSWG-ECO-* continua SCA, com pacote", () => {
    const run = {
      tool: { driver: { name: "Trivy", rules: [{ id: "NSWG-ECO-101", shortDescription: { text: "marked: XSS" } }] } },
      results: [
        {
          ruleId: "NSWG-ECO-101",
          message: { text: "Package: marked\nInstalled Version: 0.3.5\nVulnerability NSWG-ECO-101\nFixed Version: >=0.3.6" },
          locations: [{ physicalLocation: { artifactLocation: { uri: "package-lock.json" }, region: { startLine: 900 } } }],
        },
      ],
    };
    const [f] = parseCodeReport(sarif([run])).findings;
    expect(f).toMatchObject({ category: "SCA", advisoryId: "NSWG-ECO-101", packageName: "marked", packageVersion: "0.3.5", fixedVersion: ">=0.3.6" });
  });

  it("CI-CDX-04 Trivy CycloneDX: CVSS v3.1 antes do v3.0 e versão corrigida da recomendação", () => {
    const r = parseCodeReport(
      JSON.stringify({
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        metadata: { tools: { components: [{ name: "trivy", version: "0.76.2" }] } },
        components: [{ "bom-ref": "pkg:npm/uglify-js@2.4.24", name: "uglify-js", version: "2.4.24", purl: "pkg:npm/uglify-js@2.4.24" }],
        vulnerabilities: [
          {
            id: "CVE-2015-8858",
            ratings: [
              { source: { name: "ghsa" }, score: 7.5, severity: "high", method: "CVSSv3", vector: "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H" },
              { source: { name: "nvd" }, score: 7.8, severity: "high", method: "CVSSv2", vector: "AV:N/AC:L/Au:N/C:N/I:N/A:C" },
              { source: { name: "nvd" }, score: 7.5, severity: "high", method: "CVSSv31", vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H" },
            ],
            recommendation: "Upgrade uglify-js to version >=2.6.0",
            affects: [{ ref: "pkg:npm/uglify-js@2.4.24", versions: [{ version: "2.4.24", status: "affected" }] }],
          },
        ],
      }),
    );
    expect(r.findings[0]).toMatchObject({ cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", fixedVersion: ">=2.6.0" });
  });
});

describe("code-import.util — CycloneDX", () => {
  it("CI-CDX-01 tools.components (1.5), componentes aninhados e a MAIOR severidade entre as fontes", () => {
    const r = parseCodeReport(
      cdx({
        vulnerabilities: [
          {
            id: "CVE-2021-23337",
            source: { name: "nvd", url: "https://nvd.nist.gov/vuln/detail/CVE-2021-23337" },
            ratings: [
              { source: { name: "ghsa" }, severity: "high", score: 7.2, method: "CVSSv31", vector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H" },
              { source: { name: "redhat" }, severity: "medium" },
            ],
            cwes: [94],
            description: "Command injection via template.",
            affects: [{ ref: "pkg:npm/lodash@4.17.15" }],
          },
        ],
      }),
    );
    expect(r.format).toBe("CYCLONEDX");
    expect(r.toolName).toBe("trivy");
    expect(r.componentsCount).toBe(3);
    const [f] = r.findings;
    expect(f).toMatchObject({
      category: "SCA",
      advisoryId: "CVE-2021-23337",
      severity: "HIGH",
      cweId: "94",
      packageName: "lodash",
      packageVersion: "4.17.15",
      purl: "pkg:npm/lodash@4.17.15",
      cvssScore: 7.2,
      cvssVector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H",
      title: "CVE-2021-23337 em lodash@4.17.15",
    });
  });

  it("CI-CDX-02 um achado por componente afetado; vetor sem prefixo recebe CVSS:3.x pelo method", () => {
    const r = parseCodeReport(
      cdx({
        metadata: { tools: [{ vendor: "anchore", name: "grype", version: "0.80.0" }] }, // forma 1.4
        vulnerabilities: [
          {
            id: "GHSA-29mw-wpgm-hmr9",
            ratings: [{ score: 9.8, method: "CVSSv3", vector: "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" }],
            affects: [{ ref: "pkg:npm/express@4.16.0" }, { ref: "pkg:npm/%40types/qs@6.5.1" }],
          },
        ],
      }),
    );
    expect(r.toolName).toBe("grype");
    expect(r.findings).toHaveLength(2);
    expect(r.findings[0].severity).toBe("CRITICAL");
    expect(r.findings[0].cvssVector).toBe("CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H");
    expect(r.findings[1].packageName).toBe("@types/qs");
    expect(r.findings[0].fingerprint).not.toBe(r.findings[1].fingerprint);
  });

  it("CI-CDX-03 SBOM sem `vulnerabilities` importa com aviso e zero achados", () => {
    const r = parseCodeReport(cdx({}));
    expect(r.findings).toHaveLength(0);
    expect(r.componentsCount).toBe(3);
    expect(r.warnings.join(" ")).toMatch(/vulnerabilities/);
  });

  it("SBOM sem nenhum componente (Trivy sem lockfile) avisa em vez de parecer 'nada vulnerável'", () => {
    const r = parseCodeReport(JSON.stringify({ bomFormat: "CycloneDX", specVersion: "1.6", components: [], vulnerabilities: [] }));
    expect(r.findings).toHaveLength(0);
    expect(r.warnings.join(" ")).toMatch(/lockfile/);
  });
});

describe("code-import.util — geral", () => {
  it("CI-GEN-01 JSON inválido, formato desconhecido, BOM, limite e duplicatas", () => {
    expect(() => parseCodeReport("isto não é json")).toThrow("INVALID_FILE_FORMAT");
    expect(() => parseCodeReport("[]")).toThrow("INVALID_FILE_FORMAT");
    expect(() => parseCodeReport(JSON.stringify({ foo: 1 }))).toThrow("UNSUPPORTED_REPORT_FORMAT");
    expect(parseCodeReport(`﻿${sarif([semgrepRun])}`).findings).toHaveLength(1);

    const muitos = Array.from({ length: MAX_FINDINGS_PER_IMPORT + 1 }, (_, i) => ({ ...semgrepRun.results[0], fingerprints: { id: `fp-${i}` } }));
    expect(() => parseCodeReport(sarif([{ ...semgrepRun, results: muitos }]))).toThrow("IMPORT_TOO_LARGE");

    // Duas ocorrências idênticas (mesma regra, arquivo e linha — ex.: duas
    // chamadas na mesma linha) continuam DOIS achados, numerados pela ordem.
    const repetidos = parseCodeReport(sarif([{ ...semgrepRun, results: [semgrepRun.results[0], semgrepRun.results[0]] }]));
    expect(repetidos.findings).toHaveLength(2);
    expect(repetidos.findings[0].fingerprint).not.toBe(repetidos.findings[1].fingerprint);
  });

  it("faixas de severidade e extração de CWE", () => {
    expect([9.8, 7, 4, 0.1, 0].map(severityFromScore)).toEqual(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);
    expect(extractCwe(["security", "external/cwe/cwe-022"])).toBe("22");
    expect(extractCwe([352])).toBe("352");
    expect(extractCwe(["nada"])).toBeNull();
  });

  it("CI-DRAFT-01 rascunho: SCA é A06 com vetor da ferramenta; SAST mapeia CWE e sugere vetor por severidade", () => {
    const valido = (v: string) => {
      try {
        calculateCvss(v);
        return true;
      } catch {
        return false;
      }
    };
    const origem = { toolName: "trivy", fileName: "sbom.json" };
    const sca = parseCodeReport(
      cdx({ vulnerabilities: [{ id: "CVE-2021-23337", ratings: [{ severity: "high", method: "CVSSv31", vector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H" }], cwes: [94], affects: [{ ref: "pkg:npm/lodash@4.17.15" }] }] }),
    ).findings[0];
    const d1 = buildCodePromotionDraft(sca, origem, owaspCategoryForCwe, valido);
    expect(d1.owaspCategory).toBe("A06");
    expect(d1.cvssVectorSource).toBe("TOOL");
    expect(d1.cvssVector).toBe("CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H");
    expect(d1.description).toContain("Componente: lodash@4.17.15");

    const sast = parseCodeReport(sarif([semgrepRun])).findings[0];
    const d2 = buildCodePromotionDraft(sast, origem, owaspCategoryForCwe, valido);
    expect(d2.owaspCategory).toBe("A03"); // CWE-79
    expect(d2.cvssVectorSource).toBe("SEVERITY");
    expect(valido(d2.cvssVector)).toBe(true);
    expect(d2.description).toContain("Local: app/routes/session.js:42");

    // Vetor 3.0 da ferramenta: mesmas métricas base, o prefixo vira 3.1 (o calculador só aceita 3.1)
    const v30 = buildCodePromotionDraft({ ...sca, cvssVector: "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" }, origem, owaspCategoryForCwe, valido);
    expect(v30).toMatchObject({ cvssVectorSource: "TOOL", cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" });
    // Vetor que não é CVSS 3.x válido: cai na sugestão por severidade
    const lixo = buildCodePromotionDraft({ ...sca, cvssVector: "AV:N/AC:L/Au:N/C:N/I:N/A:C" }, origem, owaspCategoryForCwe, valido);
    expect(lixo.cvssVectorSource).toBe("SEVERITY");
  });
});
