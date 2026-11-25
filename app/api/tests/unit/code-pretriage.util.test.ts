/**
 * code-pretriage.util.test.ts — pré-triagem SAST/SCA (contexto + sinais + sugestão), sem banco.
 *
 *   PT-CTX-01  caminhos reais do import de 2026-11-17 caem no contexto certo (inclusive com `\` do Windows)
 *   PT-SIG-01  KEV e EPSS ≥ 10% são sinais fortes; inventário do Threat Intel é fraco; GHSA casa pela chave pedida
 *   PT-SIG-02  DAST confirmado no mesmo CWE é sinal forte; outro CWE não
 *   PT-SUG-01  fora de produção → sugestão de falso-positivo, mesmo com sinal
 *   PT-SUG-02  produção + sinal forte → provável vulnerabilidade; só sinal fraco → nenhuma sugestão
 *   PT-SUG-03  achado já triado não recebe sugestão (decisão humana vence), mas mantém contexto e sinais
 *   PT-PATH-01 o parser normaliza `\` → `/`, e o fingerprint fica igual entre Windows e Linux
 */

import { classificarContexto, preTriar, type SignalSources } from "../../src/utils/code-pretriage.util";
import { parseCodeReport } from "../../src/utils/code-import.util";

const vazio: SignalSources = { advisories: new Map(), dastPorCwe: new Map() };

describe("classificarContexto", () => {
  it.each([
    ["app\\api\\src\\services\\zap-runner.service.ts", "PRODUCAO"],
    ["app/web/src/pages/login.tsx", "PRODUCAO"],
    ["src/index.html", "PRODUCAO"],
    ["app/web/src/components/landing/scene/scene-contrast.test.ts", "TESTE"],
    ["tests/integration/code-import.test.ts", "TESTE"],
    ["pkg/handler_test.go", "TESTE"],
    ["app\\api\\prisma\\seeds\\cenarios\\fixtures\\nodegoat-semgrep.sarif", "FIXTURE"],
    ["docs\\evidencias\\dast\\dast-scan-juice-shop.html", "DOCUMENTACAO"],
    ["output\\qa-2026-10-15\\browser-final.cjs", "GERADO"],
    ["output/qa/browser.test.js", "GERADO"],
    ["public/vendor/jquery.min.js", "GERADO"],
    ["app/api/prisma/seed-cenarios.ts", "SCRIPT"],
    ["scripts/deploy.sh", "SCRIPT"],
    [null, "PRODUCAO"],
  ])("PT-CTX-01 %s → %s", (caminho, esperado) => {
    expect(classificarContexto(caminho)).toBe(esperado);
  });
});

describe("sinais e sugestão", () => {
  const advisory = (over: Partial<{ kev: boolean; epssScore: number | null; noInventario: boolean }> = {}) => ({
    id: "CVE-2021-23337",
    kev: false,
    kevRansomware: false,
    epssScore: null,
    cvssVector: null,
    noInventario: false,
    ...over,
  });
  const sca = { filePath: null, cweId: "94", advisoryId: "cve-2021-23337", triageStatus: "NEW" as const };

  it("PT-SIG-01 KEV e EPSS alto são fortes; inventário é fraco", () => {
    const kev = preTriar(sca, { ...vazio, advisories: new Map([["CVE-2021-23337", advisory({ kev: true })]]) });
    expect(kev.sinais).toEqual([expect.objectContaining({ tipo: "KEV", forte: true })]);

    const epss = preTriar(sca, { ...vazio, advisories: new Map([["CVE-2021-23337", advisory({ epssScore: 0.42 })]]) });
    expect(epss.sinais).toEqual([expect.objectContaining({ tipo: "EPSS", forte: true, detalhe: expect.stringContaining("42.0%") })]);

    const baixo = preTriar(sca, { ...vazio, advisories: new Map([["CVE-2021-23337", advisory({ epssScore: 0.02, noInventario: true })]]) });
    expect(baixo.sinais).toEqual([expect.objectContaining({ tipo: "THREAT_INTEL", forte: false })]);
    expect(baixo.sugestao).toBeNull();

    const ghsa = { ...sca, advisoryId: "GHSA-35jh-r3h4-6jhm" };
    const porAlias = preTriar(ghsa, { ...vazio, advisories: new Map([["GHSA-35JH-R3H4-6JHM", advisory({ kev: true })]]) });
    expect(porAlias.sinais[0].detalhe).toContain("CVE-2021-23337");
  });

  it("PT-SIG-02 DAST confirmado no mesmo CWE é forte; CWE diferente não conta", () => {
    const fontes: SignalSources = { ...vazio, dastPorCwe: new Map([["89", [{ vulnerabilityId: "v1", title: "SQLi em /login", cweId: "89" }]]]) };
    const igual = preTriar({ filePath: "src/db.ts", cweId: "89", advisoryId: null, triageStatus: "NEW" }, fontes);
    expect(igual.sinais).toEqual([expect.objectContaining({ tipo: "DAST_CONFIRMADO", forte: true, vulnerabilityId: "v1" })]);
    expect(igual.sugestao).toEqual({ tipo: "PROVAVEL_VULNERABILIDADE", motivo: "confirmado pelo DAST" });

    const outro = preTriar({ filePath: "src/db.ts", cweId: "79", advisoryId: null, triageStatus: "NEW" }, fontes);
    expect(outro.sinais).toEqual([]);
    expect(outro.sugestao).toBeNull();
  });

  it("PT-SUG-01 fora de produção sugere falso-positivo mesmo com sinal forte", () => {
    const fontes: SignalSources = { ...vazio, dastPorCwe: new Map([["89", [{ vulnerabilityId: "v1", title: "SQLi", cweId: "89" }]]]) };
    const r = preTriar({ filePath: "src/__tests__/db.test.ts", cweId: "89", advisoryId: null, triageStatus: "NEW" }, fontes);
    expect(r.contexto).toBe("TESTE");
    expect(r.sugestao).toEqual({ tipo: "FALSO_POSITIVO", motivo: "Fora do código de produção: arquivo de teste." });
    expect(r.sinais).toHaveLength(1); // o sinal continua visível para quem quiser discordar
  });

  it("PT-SUG-02 produção sem sinal: nenhuma sugestão", () => {
    expect(preTriar({ filePath: "src/app.ts", cweId: "22", advisoryId: null, triageStatus: "NEW" }, vazio)).toEqual({ contexto: "PRODUCAO", sinais: [], sugestao: null });
  });

  it("PT-SUG-03 já triado: sem sugestão, mas com contexto e sinais", () => {
    const r = preTriar({ ...sca, triageStatus: "CONFIRMED" }, { ...vazio, advisories: new Map([["CVE-2021-23337", advisory({ kev: true })]]) });
    expect(r.sugestao).toBeNull();
    expect(r.sinais).toHaveLength(1);
  });
});

describe("PT-PATH-01 normalização do caminho no parser", () => {
  const doc = (uri: string) =>
    JSON.stringify({
      version: "2.1.0",
      runs: [{ tool: { driver: { name: "Semgrep OSS", rules: [{ id: "r1" }] } }, results: [{ ruleId: "r1", level: "warning", message: { text: "x" }, locations: [{ physicalLocation: { artifactLocation: { uri }, region: { startLine: 3 } } }] }] }],
    });

  it("`app\\src\\a.ts` e `app/src/a.ts` geram o mesmo caminho e o mesmo fingerprint", () => {
    const win = parseCodeReport(doc("app\\src\\a.ts")).findings[0];
    const linux = parseCodeReport(doc("app/src/a.ts")).findings[0];
    expect(win.filePath).toBe("app/src/a.ts");
    expect(win.fingerprint).toBe(linux.fingerprint);
  });
});
