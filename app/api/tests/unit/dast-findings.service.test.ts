/**
 * dast-findings.service.test.ts
 *
 * Testes de unidade do pipeline de parsing/normalização — sem Docker, sem
 * banco. `zap-report-example-com.json` é o JSON REAL capturado na Fase 0
 * (scan de calibração contra https://example.com, mesmo relatório citado no
 * relatório de fases), não um mock fabricado.
 *
 *   DAST-PIPE-01  parsing de JSON real produz o número esperado de findings
 *   DAST-PIPE-02  normalização de URL gera fingerprint estável
 *   DAST-PIPE-05  alerta de domínio externo é descartado
 *
 * PIPE-03 (reprocessar não duplica) e PIPE-04 (contadores batem com o banco)
 * dependem de Prisma — cobertos em tests/integration/dast.test.ts.
 */

import * as path from "path";
import {
  extractFindingsFromReport,
  buildCandidateFindings,
  countByRisk,
  normalizeUrl,
  computeFingerprint,
  mapRiskCode,
  isInScope,
  extractConfidenceLabel,
  stripHtml,
  type ZapReport,
} from "../../src/services/dast-findings.service";

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/dast/zap-report-example-com.json");

describe("dast-findings.service — parsing do JSON real (DAST-PIPE-01)", () => {
  it("produz o número esperado de findings a partir do report.json real", async () => {
    const findings = await extractFindingsFromReport(FIXTURE_PATH, "https://example.com");
    // Número travado contra o JSON real capturado na Fase 0 — se o ZAP
    // mudar de versão e o fixture for atualizado, este número deve ser
    // recalculado (não é um valor arbitrário, é o resultado determinístico
    // do pipeline contra dado real).
    expect(findings.length).toBe(24);
  });

  it("contadores por risco batem com a soma total", async () => {
    const findings = await extractFindingsFromReport(FIXTURE_PATH, "https://example.com");
    const counters = countByRisk(findings);
    const soma = counters.alertsHigh + counters.alertsMedium + counters.alertsLow + counters.alertsInfo;
    expect(soma).toBe(findings.length);
    expect(counters).toEqual({ alertsHigh: 0, alertsMedium: 6, alertsLow: 11, alertsInfo: 7 });
  });

  it("nenhum finding sem título, sem risco válido ou com fingerprint vazio", async () => {
    const findings = await extractFindingsFromReport(FIXTURE_PATH, "https://example.com");
    for (const f of findings) {
      expect(f.title.length).toBeGreaterThan(0);
      expect(["HIGH", "MEDIUM", "LOW", "INFO"]).toContain(f.risk);
      expect(f.fingerprint).toHaveLength(64); // sha256 hex
    }
  });
});

describe("dast-findings.service — mapeamento de risco/confiança", () => {
  it("mapeia riskcode pro enum (3/2/1/0 -> HIGH/MEDIUM/LOW/INFO)", () => {
    expect(mapRiskCode("3")).toBe("HIGH");
    expect(mapRiskCode("2")).toBe("MEDIUM");
    expect(mapRiskCode("1")).toBe("LOW");
    expect(mapRiskCode("0")).toBe("INFO");
  });

  it("extrai o rótulo de confiança do texto entre parênteses do riskdesc", () => {
    expect(extractConfidenceLabel("Medium (High)", "3")).toBe("High");
    expect(extractConfidenceLabel("High (Confirmed)", "4")).toBe("Confirmed");
  });

  it("cai pro código numérico se riskdesc não tiver o formato esperado", () => {
    expect(extractConfidenceLabel("", "2")).toBe("Medium");
  });
});

describe("dast-findings.service — normalização de URL e fingerprint (DAST-PIPE-02)", () => {
  it("segmento numérico vira {id} e produz o MESMO fingerprint pra IDs diferentes", () => {
    const a = normalizeUrl("http://alvo.test/users/1/profile");
    const b = normalizeUrl("http://alvo.test/users/999/profile");
    expect(a).toBe("/users/{id}/profile");
    expect(b).toBe("/users/{id}/profile");
    expect(computeFingerprint("40018", a, null)).toBe(computeFingerprint("40018", b, null));
  });

  it("segmento UUID vira {uuid}", () => {
    expect(normalizeUrl("http://alvo.test/orders/a1b2c3d4-e5f6-4789-a0b1-c2d3e4f5a6b7")).toBe("/orders/{uuid}");
  });

  it("query param com valor longo (>16 chars, ex: token) é descartado; curto é mantido", () => {
    const url = "http://alvo.test/reset?token=eyJhbGciOiJIUzI1NiJ9&ok=1";
    expect(normalizeUrl(url)).toBe("/reset?ok=1");
  });

  it("fingerprint muda se o pluginId ou o param mudar (não colapsa achados diferentes)", () => {
    const norm = normalizeUrl("http://alvo.test/search");
    const f1 = computeFingerprint("40018", norm, "q");
    const f2 = computeFingerprint("40012", norm, "q"); // pluginId diferente
    const f3 = computeFingerprint("40018", norm, "text"); // param diferente
    expect(f1).not.toBe(f2);
    expect(f1).not.toBe(f3);
  });

  it("evidence NÃO entra no fingerprint — dois achados com evidence diferente e resto igual colapsam", () => {
    const report: ZapReport = {
      site: [
        {
          "@name": "http://alvo.test",
          "@host": "alvo.test",
          alerts: [
            {
              pluginid: "40018",
              alert: "SQL Injection",
              riskcode: "3",
              confidence: "3",
              riskdesc: "High (High)",
              instances: [
                { uri: "http://alvo.test/search?q=1", param: "q", evidence: "payload-de-hoje" },
                { uri: "http://alvo.test/search?q=1", param: "q", evidence: "payload-de-ontem-totalmente-diferente" },
              ],
            },
          ],
        },
      ],
    };
    const findings = buildCandidateFindings(report, "http://alvo.test");
    expect(findings).toHaveLength(1); // colapsou — evidence não é parte da identidade
  });
});

describe("dast-findings.service — escopo (DAST-PIPE-05)", () => {
  it("descarta instância cujo host não é o do alvo", () => {
    expect(isInScope("https://alvo.test/a", "alvo.test")).toBe(true);
    expect(isInScope("https://outrodominio.evil/a", "alvo.test")).toBe(false);
  });

  it("buildCandidateFindings remove a instância fora de escopo mas mantém a de dentro", () => {
    const report: ZapReport = {
      site: [
        {
          "@name": "https://alvo.test",
          "@host": "alvo.test",
          alerts: [
            {
              pluginid: "10096",
              alert: "Timestamp Disclosure",
              riskcode: "0",
              confidence: "2",
              riskdesc: "Informational (Medium)",
              instances: [
                { uri: "https://alvo.test/api/status" },
                { uri: "https://cdn.externo.evil/lib.js" },
              ],
            },
          ],
        },
      ],
    };
    const findings = buildCandidateFindings(report, "https://alvo.test");
    expect(findings).toHaveLength(1);
    expect(findings[0].url).toBe("https://alvo.test/api/status");
  });
});

describe("dast-findings.service — limpeza de HTML", () => {
  it("remove tags e decodifica entidades comuns", () => {
    const out = stripHtml("<p>Linha 1</p><p>Linha 2 &amp; mais &quot;texto&quot;</p>");
    expect(out).not.toContain("<p>");
    expect(out).toContain("Linha 1");
    expect(out).toContain("Linha 2 & mais \"texto\"");
  });

  it("devolve null pra entrada vazia/undefined", () => {
    expect(stripHtml(undefined)).toBeNull();
    expect(stripHtml(null)).toBeNull();
    expect(stripHtml("")).toBeNull();
  });
});
