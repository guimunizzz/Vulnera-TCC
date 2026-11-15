/**
 * threat-intel.util.test.ts — partes puras da Threat Intel (ADR-053).
 *
 * As amostras de JSON são recortes REAIS das fontes (OSV, NVD 2.0, CISA KEV,
 * FIRST EPSS e o dicionário CPE), copiados em 2026-11-15: se uma fonte mudar
 * de formato, é aqui que fica vermelho.
 *
 *   TI-U-01  purl → pacote do OSV (escopo npm, Maven, PyPI, tipo sem cobertura)
 *   TI-U-02  chave de identidade normaliza caixa, "v" e versão vazia
 *   TI-U-03  aviso do OSV: id vira a CVE, nota calculada do vetor, CWE e aliases
 *   TI-U-04  versão corrigida do OSV escolhe a da linha em uso
 *   TI-U-05  NVD 2.0: data sem fuso é UTC; versão corrigida pelo cpeMatch
 *   TI-U-06  KEV e EPSS
 *   TI-U-07  fingerprint e CPE 2.2 → identidade; nome desconhecido não sugere
 *   TI-U-08  quem notifica (D19.6/D19.7)
 *   TI-U-09  mais de 3 eventos na empresa viram resumo
 *   TI-U-10  dicionário CPE: um item por fabricante:produto, sem os obsoletos
 */

import {
  ativoDoCpe22,
  ativoDoFingerprint,
  avisoDoOsv,
  avisosDoNvd,
  catalogoKev,
  chaveDeIdentidade,
  eventosQueNotificam,
  notasEpss,
  pacoteDoPurl,
  produtosDoDicionarioCpe,
  versaoCorrigidaNoNvd,
  versaoCorrigidaNoOsv,
  type EventoCandidato,
} from "../../src/utils/threat-intel.util";
import { montarMensagens } from "../../src/services/threat-intel/threat-intel-sync.service";

const OSV_LODASH = {
  id: "GHSA-35jh-r3h4-6jhm",
  summary: "Command Injection in lodash",
  details: "`lodash` versions prior to 4.17.21 are vulnerable to Command Injection via the template function.",
  aliases: ["CVE-2021-23337"],
  modified: "2026-10-17T02:55:38.085813876Z",
  published: "2021-05-06T16:05:51Z",
  database_specific: { cwe_ids: ["CWE-77", "CWE-94"], severity: "HIGH", github_reviewed: true },
  references: [{ type: "ADVISORY", url: "https://nvd.nist.gov/vuln/detail/CVE-2021-23337" }],
  affected: [{ package: { ecosystem: "npm", name: "lodash" }, ranges: [{ type: "SEMVER", events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] }],
  severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:H" }],
};

describe("threat-intel.util", () => {
  it("TI-U-01 purl → pacote do OSV", () => {
    expect(pacoteDoPurl("pkg:npm/%40angular/core@16.2.0")).toEqual({ ecosystem: "npm", name: "@angular/core", version: "16.2.0" });
    expect(pacoteDoPurl("pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1")).toEqual({ ecosystem: "Maven", name: "org.apache.logging.log4j:log4j-core", version: "2.14.1" });
    expect(pacoteDoPurl("pkg:pypi/django@3.2")).toEqual({ ecosystem: "PyPI", name: "django", version: "3.2" });
    expect(pacoteDoPurl("pkg:npm/lodash")).toEqual({ ecosystem: "npm", name: "lodash", version: null });
    expect(pacoteDoPurl("pkg:deb/debian/openssl@1.1.1")).toBeNull();
    expect(pacoteDoPurl("lodash@4")).toBeNull();
  });

  it("TI-U-02 chave de identidade", () => {
    expect(chaveDeIdentidade({ kind: "PACKAGE", ecosystem: "npm", packageName: "Lodash", version: "v4.17.15" })).toBe("package|npm|lodash|4.17.15");
    expect(chaveDeIdentidade({ kind: "PACKAGE", ecosystem: "npm", packageName: "lodash", version: " " })).toBe("package|npm|lodash|*");
    expect(chaveDeIdentidade({ kind: "PRODUCT", cpeVendor: "F5", cpeProduct: "nginx", version: "1.27.5" })).toBe("product|a|f5|nginx|1.27.5");
  });

  it("TI-U-03 aviso do OSV", () => {
    const a = avisoDoOsv(OSV_LODASH)!;
    expect(a.id).toBe("CVE-2021-23337");
    expect(a.aliases).toEqual(["GHSA-35jh-r3h4-6jhm"]);
    expect(a.cvssScore).toBe(7.2);
    expect(a.severity).toBe("HIGH");
    expect(a.cweId).toBe("77");
    expect(a.title).toBe("Command Injection in lodash");
    expect(a.publishedAt?.toISOString()).toBe("2021-05-06T16:05:51.000Z");
    // Sem vetor 3.x: fica a severidade declarada, sem inventar nota.
    const semVetor = avisoDoOsv({ ...OSV_LODASH, severity: [{ type: "CVSS_V4", score: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N" }], database_specific: { severity: "MODERATE" } })!;
    expect(semVetor.cvssScore).toBeNull();
    expect(semVetor.severity).toBe("MEDIUM");
    // Sem CVE, o id do aviso fica.
    expect(avisoDoOsv({ ...OSV_LODASH, aliases: [] })!.id).toBe("GHSA-35jh-r3h4-6jhm");
    expect(avisoDoOsv({})).toBeNull();
  });

  it("TI-U-04 versão corrigida da linha em uso", () => {
    const duasLinhas = {
      affected: [
        { package: { ecosystem: "npm", name: "next" }, ranges: [{ events: [{ introduced: "13.0.0" }, { fixed: "13.5.7" }] }] },
        { package: { ecosystem: "npm", name: "next" }, ranges: [{ events: [{ introduced: "14.0.0" }, { fixed: "14.2.10" }] }] },
        { package: { ecosystem: "npm", name: "outro" }, ranges: [{ events: [{ fixed: "1.0.0" }] }] },
      ],
    };
    expect(versaoCorrigidaNoOsv(duasLinhas, "npm", "next", "14.1.0")).toBe("14.2.10");
    expect(versaoCorrigidaNoOsv(duasLinhas, "npm", "next", "13.4.0")).toBe("13.5.7");
    expect(versaoCorrigidaNoOsv(duasLinhas, "npm", "next", null)).toBe("13.5.7");
    expect(versaoCorrigidaNoOsv(OSV_LODASH, "npm", "lodash", "4.17.15")).toBe("4.17.21");
    expect(versaoCorrigidaNoOsv({ affected: [] }, "npm", "lodash", "1")).toBeNull();
  });

  it("TI-U-05 NVD 2.0", () => {
    const nvd = {
      totalResults: 1,
      vulnerabilities: [
        {
          cve: {
            id: "CVE-2021-23017",
            published: "2021-06-01T13:15:07.853",
            lastModified: "2026-11-13T00:20:09.977",
            descriptions: [{ lang: "en", value: "A security issue in nginx resolver was identified. It may allow an attacker to cause a 1-byte memory overwrite." }],
            metrics: { cvssMetricV31: [{ type: "Primary", cvssData: { version: "3.1", vectorString: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H", baseScore: 8.1 } }] },
            weaknesses: [{ description: [{ value: "CWE-193" }] }],
            configurations: [{ nodes: [{ cpeMatch: [{ vulnerable: true, criteria: "cpe:2.3:a:f5:nginx:*:*:*:*:*:*:*:*", versionEndExcluding: "1.21.0" }] }] }],
            references: [{ url: "http://mailman.nginx.org/pipermail/nginx-announce/2021/000300.html" }],
          },
        },
      ],
    };
    const [a] = avisosDoNvd(nvd);
    expect(a).toMatchObject({ id: "CVE-2021-23017", source: "NVD", cvssScore: 8.1, severity: "HIGH", cweId: "193" });
    expect(a!.title).toBe("A security issue in nginx resolver was identified.");
    expect(a!.modifiedAt?.toISOString()).toBe("2026-11-13T00:20:09.977Z");
    expect(versaoCorrigidaNoNvd(nvd, "CVE-2021-23017", "f5", "nginx")).toBe("1.21.0");
    expect(versaoCorrigidaNoNvd(nvd, "CVE-2021-23017", "apache", "http_server")).toBeNull();
  });

  it("TI-U-06 KEV e EPSS", () => {
    const [e] = catalogoKev({
      vulnerabilities: [
        { cveID: "CVE-2021-44228", vulnerabilityName: "Apache Log4j2 RCE", dateAdded: "2021-12-10", dueDate: "2021-12-24", knownRansomwareCampaignUse: "Known", shortDescription: "JNDI" },
        { cveID: "nao-e-cve" },
      ],
    });
    expect(e).toMatchObject({ cveId: "CVE-2021-44228", nome: "Apache Log4j2 RCE", ransomware: true });
    expect(e!.adicionadaEm?.toISOString()).toBe("2021-12-10T00:00:00.000Z");
    const epss = notasEpss({ data: [{ cve: "CVE-2021-44228", epss: "0.999990000", percentile: "1.000000000" }, { cve: "CVE-1", epss: "x" }] });
    expect(epss.get("CVE-2021-44228")).toEqual({ score: 0.99999, percentil: 1 });
    expect(epss.size).toBe(1);
  });

  it("TI-U-07 fingerprint e CPE 2.2", () => {
    expect(ativoDoFingerprint("nginx", "1.27.5")).toMatchObject({ kind: "PRODUCT", cpeVendor: "f5", cpeProduct: "nginx", version: "1.27.5" });
    expect(ativoDoFingerprint("Express", null)).toMatchObject({ kind: "PACKAGE", ecosystem: "npm", packageName: "express", version: null });
    expect(ativoDoFingerprint("ServidorCaseiro", "1.0")).toBeNull();
    expect(ativoDoCpe22("cpe:/a:apache:http_server:2.4.49")).toMatchObject({ cpeVendor: "apache", cpeProduct: "http_server", version: "2.4.49" });
    expect(ativoDoCpe22("lixo")).toBeNull();
  });

  const evento = (over: Partial<EventoCandidato>): EventoCandidato => ({
    matchId: "m",
    companyId: "c",
    advisoryId: "CVE-2026-1",
    titulo: "t",
    ativo: "lodash 4 (npm)",
    cvssScore: 9.8,
    kev: false,
    preexisting: false,
    kevNovo: false,
    jaNotificada: false,
    versionConfirmed: true,
    ...over,
  });

  it("TI-U-08 quem notifica", () => {
    expect(eventosQueNotificam([evento({})])).toHaveLength(1); // nova e crítica
    expect(eventosQueNotificam([evento({ cvssScore: 6.9 })])).toHaveLength(0); // abaixo de 7
    expect(eventosQueNotificam([evento({ cvssScore: 5, kev: true })])).toHaveLength(1); // KEV vale sem nota alta
    expect(eventosQueNotificam([evento({ cvssScore: null })])).toHaveLength(0); // sem nota ainda: espera
    expect(eventosQueNotificam([evento({ preexisting: true })])).toHaveLength(0); // D19.7
    expect(eventosQueNotificam([evento({ jaNotificada: true })])).toHaveLength(0); // uma vez só
    expect(eventosQueNotificam([evento({ preexisting: true, jaNotificada: true, kevNovo: true })])).toHaveLength(1); // virou KEV depois
  });

  it("TI-U-09 resumo acima de 3", () => {
    const tres = montarMensagens("c1", [evento({ matchId: "a" }), evento({ matchId: "b" }), evento({ matchId: "c", kevNovo: true })]);
    expect(tres).toHaveLength(3);
    expect(tres[2]).toMatchObject({ category: "THREAT_KEV", link: "/threat-intel?empresa=c1&aba=afeta&match=c" });
    expect(tres[0]!.title).toBe("CVE-2026-1 afeta lodash 4 (npm)");
    const quatro = montarMensagens("c1", [evento({}), evento({}), evento({ kev: true }), evento({})]);
    expect(quatro).toHaveLength(1);
    expect(quatro[0]).toMatchObject({ category: "THREAT_DIGEST", title: "4 CVEs novas afetam o inventário" });
    expect(quatro[0]!.message).toContain("1 delas exploradas ativamente");
  });

  it("TI-U-10 dicionário CPE", () => {
    const r = produtosDoDicionarioCpe({
      products: [
        { cpe: { cpeName: "cpe:2.3:a:f5:nginx:1.18.0:*:*:*:*:*:*:*", deprecated: false, titles: [{ title: "F5 Nginx 1.18.0", lang: "en" }] } },
        { cpe: { cpeName: "cpe:2.3:a:f5:nginx:1.19.0:*:*:*:*:*:*:*", deprecated: false, titles: [{ title: "F5 Nginx 1.19.0", lang: "en" }] } },
        { cpe: { cpeName: "cpe:2.3:a:nginx:nginx:1.0:*:*:*:*:*:*:*", deprecated: true } },
      ],
    });
    expect(r).toEqual([{ cpePart: "a", cpeVendor: "f5", cpeProduct: "nginx", titulo: "F5 Nginx", exemplo: "cpe:2.3:a:f5:nginx:1.18.0:*:*:*:*:*:*:*" }]);
  });
});
