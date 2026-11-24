/**
 * exposure-analysis.model.test.ts — as regras puras das análises (ADR-061).
 *
 *   EXA-U01  agravantes comprovados: Internet, gravidade, KEV > EPSS, dado, produção
 *   EXA-U02  tóxica exige Internet E gravidade E ≥ 3 agravantes
 *   EXA-U03  ordem: mais agravantes; KEV antes de EPSS; VRS; severidade; mais antiga
 *   EXA-U04  manual/DAST sem advisory entra sem o fator de ameaça
 *   EXA-U05  raio de impacto agrupa por aplicação ativa e descarta as de fora
 *   EXA-U06  raio de impacto: exposta primeiro, depois pior severidade
 *   EXA-U07  destino do STATUS_CHANGE tolera diffJson malformado
 */

import {
  agravantesDe,
  destinoDaMudanca,
  ehToxica,
  LIMIAR_EPSS_PERCENTIL,
  montarCombinacoes,
  montarImpacto,
  normalizarValorDeImpacto,
  type ContextoDaAplicacao,
  type VulnerabilidadeCandidata,
} from "../../src/models/exposure-analysis.model";

const APP_EXPOSTA: ContextoDaAplicacao = {
  id: "app-1",
  name: "Portal",
  environment: "PROD",
  criticality: "CRITICAL",
  internetFacing: true,
  dataSensitivity: "RESTRICTED",
};
const APP_INTERNA: ContextoDaAplicacao = { ...APP_EXPOSTA, id: "app-2", name: "ERP", internetFacing: false, environment: "HOMOL", dataSensitivity: "INTERNAL" };

let seq = 0;
function vuln(dados: Partial<VulnerabilidadeCandidata> = {}): VulnerabilidadeCandidata {
  seq += 1;
  return {
    id: `v-${seq}`,
    title: `Vulnerabilidade ${seq}`,
    severityFinal: "CRITICAL",
    owaspCategory: "A06",
    sourceType: "SCA_IMPORT",
    vrsScore: 70,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    aplicacao: APP_EXPOSTA,
    ameaca: null,
    ...dados,
  };
}

const kev = { id: "CVE-2021-44228", kev: true, kevAddedAt: new Date("2021-12-10T00:00:00Z"), epssScore: 0.97, epssPercentile: 0.99 };
const epssAlto = { id: "CVE-2024-0001", kev: false, kevAddedAt: null, epssScore: 0.4, epssPercentile: LIMIAR_EPSS_PERCENTIL };
const epssBaixo = { id: "CVE-2024-0002", kev: false, kevAddedAt: null, epssScore: 0.001, epssPercentile: 0.2 };

describe("Combinações tóxicas — regras puras", () => {
  it("EXA-U01 — lista os agravantes comprovados, KEV vence EPSS", () => {
    const codigos = agravantesDe(vuln({ ameaca: kev })).map((a) => a.codigo);
    expect(codigos).toEqual(["INTERNET", "GRAVE", "AMEACA_ATIVA", "DADO_SENSIVEL", "PRODUCAO"]);
    expect(agravantesDe(vuln({ ameaca: kev })).find((a) => a.codigo === "AMEACA_ATIVA")!.detalhe).toBe("CVE-2021-44228 no KEV desde 2021-12-10");

    const comEpss = agravantesDe(vuln({ ameaca: epssAlto })).find((a) => a.codigo === "AMEACA_ATIVA")!;
    expect(comEpss.rotulo).toMatch(/EPSS/);
    expect(comEpss.detalhe).toBe("CVE-2024-0001 no percentil 90 do EPSS");
    // Abaixo do limiar, EPSS não é ameaça ativa.
    expect(agravantesDe(vuln({ ameaca: epssBaixo })).some((a) => a.codigo === "AMEACA_ATIVA")).toBe(false);
  });

  it("EXA-U02 — tóxica exige Internet, gravidade e um terceiro agravante", () => {
    expect(ehToxica(agravantesDe(vuln()))).toBe(true); // Internet + crítica + dado restrito + produção
    expect(ehToxica(agravantesDe(vuln({ aplicacao: APP_INTERNA, ameaca: kev })))).toBe(false); // sem Internet
    expect(ehToxica(agravantesDe(vuln({ severityFinal: "MEDIUM", ameaca: kev })))).toBe(false); // sem gravidade
    const soDuas = vuln({ aplicacao: { ...APP_EXPOSTA, dataSensitivity: "PUBLIC", environment: "DEV" } });
    expect(ehToxica(agravantesDe(soDuas))).toBe(false); // Internet + crítica e nada mais
    expect(ehToxica(agravantesDe({ ...soDuas, ameaca: kev }))).toBe(true); // + KEV
  });

  it("EXA-U03 — ordena por agravantes, ameaça, VRS, severidade e idade", () => {
    const base = { aplicacao: { ...APP_EXPOSTA, dataSensitivity: "PUBLIC" } }; // Internet + produção + gravidade
    const comKev = vuln({ ...base, id: "kev", ameaca: kev, vrsScore: 10 });
    const comEpss = vuln({ ...base, id: "epss", ameaca: epssAlto, vrsScore: 99 });
    const vrsAlto = vuln({ ...base, id: "vrs-alto", vrsScore: 90 });
    const vrsBaixoAntiga = vuln({ ...base, id: "antiga", vrsScore: 50, createdAt: new Date("2026-01-01T00:00:00Z") });
    const vrsBaixoNova = vuln({ ...base, id: "nova", vrsScore: 50, createdAt: new Date("2026-09-01T00:00:00Z") });
    // Internet + crítica + dado restrito + produção = 4, como KEV e EPSS; perde para eles na ameaça.
    const quatroSemAmeaca = vuln({ id: "sem-ameaca", ameaca: epssBaixo, vrsScore: 1 });

    const { total, combinacoes } = montarCombinacoes([vrsBaixoNova, comEpss, vrsBaixoAntiga, quatroSemAmeaca, vrsAlto, comKev]);
    expect(total).toBe(6);
    expect(combinacoes.map((c) => c.vulnerabilityId)).toEqual(["kev", "epss", "sem-ameaca", "vrs-alto", "antiga", "nova"]);
  });

  it("EXA-U04 — manual sem advisory entra sem o fator de ameaça", () => {
    const manual = vuln({ sourceType: "MANUAL", ameaca: null });
    const { combinacoes } = montarCombinacoes([manual]);
    expect(combinacoes).toHaveLength(1);
    expect(combinacoes[0].advisory).toBeNull();
    expect(combinacoes[0].agravantes.map((a) => a.codigo)).not.toContain("AMEACA_ATIVA");
  });
});

describe("Raio de impacto — regras puras", () => {
  it("EXA-U05 — agrupa por aplicação ativa e descarta ocorrência de fora", () => {
    const impacto = montarImpacto("PACOTE", "lodash", [APP_EXPOSTA, APP_INTERNA], [
      { applicationId: "app-1", severidade: "HIGH", versao: "4.17.15" },
      { applicationId: "app-1", severidade: "critical", versao: "4.17.15" },
      { applicationId: "app-1", severidade: "MEDIUM", versao: "4.17.11" },
      { applicationId: "app-2", severidade: "LOW", versao: "4.17.20" },
      { applicationId: "app-de-outra-company", severidade: "CRITICAL", versao: "4.0.0" },
    ]);
    expect(impacto.aplicacoes.map((a) => a.id)).toEqual(["app-1", "app-2"]);
    expect(impacto.aplicacoes[0]).toMatchObject({ ocorrencias: 3, piorSeveridade: "CRITICAL", detalhes: ["4.17.11", "4.17.15"] });
    expect(impacto.resumo).toEqual({ aplicacoes: 2, expostas: 1, emProducao: 1, ocorrencias: 4 });
  });

  it("EXA-U06 — exposta primeiro; CVE detalha o pacote que a traz", () => {
    const impacto = montarImpacto("CVE", "CVE-2021-44228", [APP_INTERNA, APP_EXPOSTA], [
      { applicationId: "app-2", severidade: "CRITICAL", pacote: "log4j-core", versao: "2.14.1" },
      { applicationId: "app-1", severidade: "LOW", pacote: "log4j-core", versao: "2.15.0" },
    ]);
    expect(impacto.aplicacoes.map((a) => a.id)).toEqual(["app-1", "app-2"]);
    expect(impacto.aplicacoes[1].detalhes).toEqual(["log4j-core@2.14.1"]);
    expect(normalizarValorDeImpacto("CVE", " cve-2021-44228 ")).toBe("CVE-2021-44228");
    expect(normalizarValorDeImpacto("PACOTE", " Lodash ")).toBe("Lodash");
  });
});

describe("Histórico — destino da mudança", () => {
  it("EXA-U07 — lê o destino e tolera texto que não é JSON", () => {
    expect(destinoDaMudanca('{"from":"OPEN","to":"FIXED"}')).toBe("FIXED");
    expect(destinoDaMudanca("não é json")).toBeNull();
    expect(destinoDaMudanca('{"from":"OPEN"}')).toBeNull();
    expect(destinoDaMudanca(null)).toBeNull();
  });
});
