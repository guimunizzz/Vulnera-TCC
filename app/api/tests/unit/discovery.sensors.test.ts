import { InternetDbSensor, ipv4Publico, montarExposicao, nomeDoCpe } from "../../src/services/sensors/internetdb.sensor";
import { detectarTecnologias, FingerprintSensor } from "../../src/services/sensors/fingerprint.sensor";
import { CrtShSensor, dominioBase, extrairSubdominios, subdominiosSensiveis } from "../../src/services/sensors/crtsh.sensor";
import type { CveInfo } from "../../src/services/sensors/nvd-cve.service";

const ALVO = "https://alvo.com.br/";
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status });
const nvdVazio = () => ({ enriquecer: jest.fn().mockResolvedValue({ infos: new Map(), pendentes: [], interrupcao: null }) });

describe("InternetDB", () => {
  it("ipv4Publico separa IP roteável de rede privada, loopback e documentação", () => {
    expect(ipv4Publico("45.33.32.156")).toBe(true);
    for (const ip of ["10.0.0.1", "172.17.0.1", "192.168.1.1", "127.0.0.1", "169.254.1.1", "203.0.113.10", "::1"]) expect(ipv4Publico(ip)).toBe(false);
  });

  it("nomeDoCpe deixa o CPE legível", () => {
    expect(nomeDoCpe("cpe:/a:apache:http_server:2.4.7")).toBe("apache http_server 2.4.7");
    expect(nomeDoCpe("cpe:/a:cloudflare:cloudflare")).toBe("cloudflare");
  });

  it("montarExposicao: IP, portas e tecnologias viram ativos; cada CVE vira finding potencial com risco pelo CVSS", () => {
    const cves = new Map<string, CveInfo>([
      ["CVE-2021-42013", { id: "CVE-2021-42013", description: "RCE", cvssScore: 9.8, cvssVersion: "3.1", cvssVector: "CVSS:3.1/AV:N", cweId: "22", publishedAt: null, references: ["https://ref"] }],
    ]);
    const { assets, findings } = montarExposicao(
      ALVO,
      { ip: "45.33.32.156", ports: [22, 80], cpes: ["cpe:/a:apache:http_server:2.4.49"], hostnames: [], tags: [], vulns: ["CVE-2021-42013", "CVE-2024-1"] },
      cves,
    );
    expect(assets.map((a) => `${a.kind}:${a.value}<${a.parentValue}`)).toEqual([
      "IP:45.33.32.156<null",
      "PORT:45.33.32.156:22<45.33.32.156",
      "PORT:45.33.32.156:80<45.33.32.156",
      "TECHNOLOGY:apache http_server 2.4.49<45.33.32.156",
    ]);
    const [comCvss, pendente] = findings;
    expect(comCvss).toMatchObject({ risk: "HIGH", cveId: "CVE-2021-42013", cvssScore: 9.8, confidence: "Low", sensorKey: "internetdb", cweId: "22" });
    expect(comCvss.title).toMatch(/potencial · não validado/);
    expect(comCvss.reference).toContain("https://nvd.nist.gov/vuln/detail/CVE-2021-42013");
    expect(pendente).toMatchObject({ risk: "INFO", cvssScore: null });
    expect(pendente.evidence).toMatch(/CVSS pendente/);
    expect(new Set(findings.map((f) => f.fingerprint)).size).toBe(2);
  });

  it("alvo que só resolve para IP privado: NOT_APPLICABLE com o IP visível e sem consultar a InternetDB", async () => {
    const fetchFalso = jest.fn();
    const r = await new InternetDbSensor(nvdVazio(), fetchFalso, async () => ["172.17.0.1"]).run({ targetUrl: "http://host.docker.internal:8086/", simulated: false });
    expect(r.status).toBe("NOT_APPLICABLE");
    expect(r.message).toMatch(/IP público indisponível/);
    expect(r.assets).toEqual([{ kind: "IP", value: "172.17.0.1", parentValue: null, metadata: { publico: false } }]);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("IP público sem registro (404) é NO_DATA, nunca 'seguro'", async () => {
    const r = await new InternetDbSensor(nvdVazio(), jest.fn().mockResolvedValue(json({ detail: "No information available" }, 404)), async () => ["45.33.32.156"]).run({ targetUrl: ALVO, simulated: false });
    expect(r.status).toBe("NO_DATA");
    expect(r.message).toMatch(/não significa que o IP esteja seguro/);
  });

  it("DNS que falha vira UNAVAILABLE legível", async () => {
    const erro = Object.assign(new Error("x"), { code: "ENOTFOUND" });
    const r = await new InternetDbSensor(nvdVazio(), jest.fn(), async () => Promise.reject(erro)).run({ targetUrl: ALVO, simulated: false });
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.message).toMatch(/não foi encontrado no DNS/);
  });

  it("IP público: consulta a InternetDB, enriquece as CVEs no NVD e repassa o pulso", async () => {
    const nvd = nvdVazio();
    const pulso = jest.fn();
    const fetchFalso = jest.fn().mockResolvedValue(json({ ip: "45.33.32.156", ports: [80, 22], cpes: [], hostnames: [], tags: [], vulns: ["CVE-2017-9798"] }));
    const r = await new InternetDbSensor(nvd, fetchFalso, async () => ["::1", "45.33.32.156"]).run({ targetUrl: ALVO, simulated: false, pulso });
    expect(fetchFalso.mock.calls[0][0]).toBe("https://internetdb.shodan.io/45.33.32.156");
    expect(nvd.enriquecer).toHaveBeenCalledWith(["CVE-2017-9798"], expect.objectContaining({ pulso }));
    expect(r.status).toBe("OK");
    expect(r.message).toMatch(/2 porta\(s\) aberta\(s\) \(22, 80\)/);
    expect(r.findings).toHaveLength(1);
  });

  it("modo simulado não usa rede e rotula o resultado", async () => {
    const fetchFalso = jest.fn();
    const nvd = nvdVazio();
    const r = await new InternetDbSensor(nvd, fetchFalso, jest.fn()).run({ targetUrl: ALVO, simulated: true });
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(nvd.enriquecer).not.toHaveBeenCalled();
    expect(r.message).toMatch(/simulado/);
    expect(r.findings.some((f) => f.cvssScore === 9.8)).toBe(true);
  });
});

describe("Fingerprint", () => {
  it("lê headers, cookies e marcas do HTML, sem duplicar e preferindo a versão", () => {
    const headers = new Headers({ server: "nginx/1.18.0 (Ubuntu)", "x-powered-by": "PHP/8.1.2", "x-generator": "Drupal 10" });
    const html = '<html><meta name="generator" content="WordPress 6.4.2"><link href="/wp-content/x.css"></html>';
    const nomes = detectarTecnologias(headers, ["PHPSESSID=abc; Path=/"], html).map((t) => (t.versao ? `${t.nome} ${t.versao}` : t.nome));
    expect(nomes).toEqual(expect.arrayContaining(["nginx 1.18.0", "PHP 8.1.2", "Drupal 10", "WordPress 6.4.2"]));
    expect(nomes.filter((n) => n.startsWith("PHP"))).toHaveLength(1);
    expect(nomes.filter((n) => n.startsWith("WordPress"))).toHaveLength(1);
    expect(nomes).not.toContain("Ubuntu");
  });

  it("página que não anuncia nada é NO_DATA", async () => {
    const r = await new FingerprintSensor(jest.fn().mockResolvedValue(new Response("<html></html>", { headers: { "content-type": "text/html" } }))).run({ targetUrl: ALVO, simulated: false });
    expect(r.status).toBe("NO_DATA");
  });

  it("gera ativos de tecnologia e nenhum finding", async () => {
    const r = await new FingerprintSensor(jest.fn().mockResolvedValue(new Response("", { headers: { server: "Apache/2.4.49" } }))).run({ targetUrl: ALVO, simulated: false });
    expect(r.status).toBe("OK");
    expect(r.findings).toEqual([]);
    expect(r.assets?.[0]).toMatchObject({ kind: "TECHNOLOGY", value: "Apache 2.4.49" });
  });
});

describe("crt.sh", () => {
  it("dominioBase tira o www e recusa IP, localhost e nomes internos", () => {
    expect(dominioBase("www.alvo.com.br")).toBe("alvo.com.br");
    for (const h of ["127.0.0.1", "localhost", "host.docker.internal", "intranet", "app.local"]) expect(dominioBase(h)).toBeNull();
  });

  it("extrai nomes do JSON (inclusive cortado), sem curinga, sem o domínio base e sem domínio alheio", () => {
    const texto = '[{"name_value":"*.alvo.com\\nalvo.com\\napi.alvo.com"},{"name_value":"dev.alvo.com"},{"name_value":"alvo.com.evil.net"},{"name_value":"staging.alv';
    expect(extrairSubdominios(texto, "alvo.com")).toEqual(["api.alvo.com", "dev.alvo.com"]);
  });

  it("marca como sensível só pelo rótulo inteiro", () => {
    expect(subdominiosSensiveis(["dev.alvo.com", "developers.alvo.com", "admin.api.alvo.com", "www.alvo.com"], "alvo.com")).toEqual(["dev.alvo.com", "admin.api.alvo.com"]);
  });

  it("tenta de novo uma vez e, se o crt.sh seguir fora, devolve UNAVAILABLE com motivo", async () => {
    const fetchFalso = jest.fn().mockResolvedValue(new Response("<html>502</html>", { status: 502 }));
    const r = await new CrtShSensor(fetchFalso).run({ targetUrl: ALVO, simulated: false });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(r.status).toBe("UNAVAILABLE");
    expect(r.message).toMatch(/HTTP 502/);
  });

  it("subdomínios viram ativos; os sensíveis, finding INFO", async () => {
    const fetchFalso = jest.fn().mockResolvedValue(json([{ name_value: "api.alvo.com.br" }, { name_value: "staging.alvo.com.br" }]));
    const r = await new CrtShSensor(fetchFalso).run({ targetUrl: ALVO, simulated: false });
    expect(fetchFalso.mock.calls[0][0]).toContain(encodeURIComponent("%.alvo.com.br"));
    expect(r.assets?.map((a) => a.value)).toEqual(["api.alvo.com.br", "staging.alvo.com.br"]);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ risk: "INFO", param: "staging.alvo.com.br", sensorKey: "crtsh" });
  });

  it("alvo interno é NOT_APPLICABLE sem rede", async () => {
    const fetchFalso = jest.fn();
    const r = await new CrtShSensor(fetchFalso).run({ targetUrl: "http://host.docker.internal:8086/", simulated: false });
    expect(r.status).toBe("NOT_APPLICABLE");
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
