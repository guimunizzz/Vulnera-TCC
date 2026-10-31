import { cpeComVersao, NvdCveService, parseNvdCve, parseNvdLista, riscoPorCvss, severidadeCvss } from "../../src/services/sensors/nvd-cve.service";

const RESPOSTA_LOG4J = {
  vulnerabilities: [
    {
      cve: {
        id: "CVE-2021-44228",
        published: "2021-12-10T10:15:09.143",
        descriptions: [
          { lang: "es", value: "Las características JNDI…" },
          { lang: "en", value: "Apache Log4j2 JNDI features…" },
        ],
        metrics: {
          cvssMetricV31: [
            { type: "Secondary", cvssData: { version: "3.1", vectorString: "CVSS:3.1/AV:N/X", baseScore: 9.0 } },
            { type: "Primary", cvssData: { version: "3.1", vectorString: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", baseScore: 10 } },
          ],
          cvssMetricV2: [{ type: "Primary", cvssData: { version: "2.0", vectorString: "AV:N/AC:M", baseScore: 9.3 } }],
        },
        weaknesses: [{ description: [{ value: "NVD-CWE-Other" }, { value: "CWE-917" }] }],
        references: [{ url: "https://a" }, { url: "https://b" }],
      },
    },
  ],
};

function cacheVazio() {
  return { findManyByIds: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue(undefined) };
}
const semEspera = jest.fn().mockResolvedValue(undefined);
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });

describe("parseNvdCve", () => {
  it("prefere CVSS v3.1 Primary, descrição em inglês e o primeiro CWE numérico", () => {
    const info = parseNvdCve("CVE-2021-44228", RESPOSTA_LOG4J)!;
    expect(info).toMatchObject({
      cvssScore: 10,
      cvssVersion: "3.1",
      cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
      cweId: "917",
      description: "Apache Log4j2 JNDI features…",
      references: ["https://a", "https://b"],
    });
    expect(info.publishedAt?.getUTCFullYear()).toBe(2021);
  });

  it("CVE sem métrica fica sem CVSS; resposta vazia é null", () => {
    expect(parseNvdCve("CVE-2026-1", { vulnerabilities: [{ cve: { descriptions: [] } }] })?.cvssScore).toBeNull();
    expect(parseNvdCve("CVE-2026-1", { vulnerabilities: [] })).toBeNull();
  });
});

describe("riscoPorCvss", () => {
  it("segue as faixas oficiais e nunca infla risco desconhecido", () => {
    expect([9.8, 7, 6.9, 4, 3.9, 0, null].map(riscoPorCvss)).toEqual(["HIGH", "HIGH", "MEDIUM", "MEDIUM", "LOW", "INFO", "INFO"]);
    expect(severidadeCvss(9.8)).toBe("Crítica");
    expect(severidadeCvss(null)).toBe("pendente");
  });
});

describe("NvdCveService.enriquecer", () => {
  it("usa o cache válido, consulta só o que falta e grava no cache", async () => {
    const cache = cacheVazio();
    cache.findManyByIds.mockResolvedValue([
      { id: "CVE-2020-1", description: null, cvssScore: 5, cvssVersion: "3.1", cvssVector: "v", cweId: null, publishedAt: null, references: [], fetchedAt: new Date() },
    ]);
    const fetchFalso = jest.fn().mockResolvedValue(json(RESPOSTA_LOG4J));
    const r = await new NvdCveService(cache, null, fetchFalso, semEspera).enriquecer(["CVE-2020-1", "CVE-2021-44228", "lixo"]);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(fetchFalso.mock.calls[0][0]).toContain("cveId=CVE-2021-44228");
    expect(r.infos.get("CVE-2020-1")?.cvssScore).toBe(5);
    expect(r.infos.get("CVE-2021-44228")?.cvssScore).toBe(10);
    expect(cache.upsert).toHaveBeenCalledTimes(1);
    expect(r.pendentes).toEqual([]);
  });

  it("sem chave respeita o teto de 25 consultas por scan; o resto fica pendente", async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `CVE-2024-${1000 + i}`);
    const fetchFalso = jest.fn().mockImplementation(async () => json({ vulnerabilities: [] }));
    const r = await new NvdCveService(cacheVazio(), null, fetchFalso, semEspera).enriquecer(ids);
    expect(fetchFalso).toHaveBeenCalledTimes(25);
    expect(r.pendentes).toHaveLength(5);
    expect(r.interrupcao).toMatch(/teto de 25/);
  });

  it("manda a chave no header quando configurada", async () => {
    const fetchFalso = jest.fn().mockResolvedValue(json(RESPOSTA_LOG4J));
    await new NvdCveService(cacheVazio(), "chave-teste", fetchFalso, semEspera).enriquecer(["CVE-2021-44228"]);
    expect(fetchFalso.mock.calls[0][1].headers.apiKey).toBe("chave-teste");
  });

  it("NVD limitando (429) para de consultar e deixa o resto pendente, sem inventar CVSS", async () => {
    const fetchFalso = jest.fn().mockResolvedValue(json({}, 429));
    const r = await new NvdCveService(cacheVazio(), null, fetchFalso, semEspera).enriquecer(["CVE-2024-1001", "CVE-2024-1002"]);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(r.infos.size).toBe(0);
    expect(r.pendentes.sort()).toEqual(["CVE-2024-1001", "CVE-2024-1002"]);
    expect(r.interrupcao).toMatch(/429/);
  });

  it("consulta primeiro por software (CPE com versão) e só pede por id o que sobrou", async () => {
    const porSoftware = {
      vulnerabilities: [
        { cve: { id: "CVE-2021-44228", metrics: { cvssMetricV31: [{ type: "Primary", cvssData: { version: "3.1", vectorString: "v", baseScore: 10 } }] } } },
        { cve: { id: "CVE-2099-9999", metrics: {} } },
      ],
    };
    const fetchFalso = jest.fn().mockImplementation(async (url: string) => (url.includes("virtualMatchString") ? json(porSoftware) : json({ vulnerabilities: [] })));
    const cache = cacheVazio();
    const r = await new NvdCveService(cache, null, fetchFalso, semEspera).enriquecer(["CVE-2021-44228", "CVE-2020-1234"], {
      cpes: ["cpe:/a:apache:log4j:2.14.1", "cpe:/o:canonical:ubuntu_linux"],
    });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(fetchFalso.mock.calls[0][0]).toContain(encodeURIComponent("cpe:2.3:a:apache:log4j:2.14.1"));
    expect(fetchFalso.mock.calls[1][0]).toContain("cveId=CVE-2020-1234");
    expect(r.infos.get("CVE-2021-44228")?.cvssScore).toBe(10);
    // CVE da resposta que a InternetDB não citou não entra nem no cache.
    expect(r.infos.has("CVE-2099-9999")).toBe(false);
    expect(cache.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("CPE", () => {
  it("converte CPE 2.2 com versão para 2.3 e ignora CPE sem versão", () => {
    expect(cpeComVersao("cpe:/a:apache:http_server:2.4.7")).toBe("cpe:2.3:a:apache:http_server:2.4.7");
    expect(cpeComVersao("cpe:/o:canonical:ubuntu_linux")).toBeNull();
    expect(cpeComVersao("lixo")).toBeNull();
    expect(parseNvdLista({ vulnerabilities: [{ cve: { id: "CVE-2021-1000" } }] }).has("CVE-2021-1000")).toBe(true);
  });
});
