import { avaliarTls, resumoDoCertificado, SslSensor, type InfoTls } from "../../src/services/sensors/ssl.sensor";
import { motivoDeRede } from "../../src/services/sensors/falhas";

const AGORA = new Date("2026-10-31T12:00:00Z");
const URL_ALVO = "https://alvo.test/";
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000).toUTCString();

function info(parcial: Partial<InfoTls> = {}, cert: Partial<NonNullable<InfoTls["certificado"]>> = {}): InfoTls {
  return {
    host: "alvo.test",
    protocolo: "TLSv1.3",
    cifra: "TLS_AES_256_GCM_SHA384",
    autorizado: true,
    erroDeAutorizacao: null,
    erroDeNome: null,
    ...parcial,
    certificado: {
      subject: { CN: "alvo.test" } as never,
      issuer: { CN: "AC Teste" } as never,
      valid_from: dias(-100),
      valid_to: dias(200),
      subjectaltname: "DNS:alvo.test",
      bits: 2048,
      asn1Curve: undefined as never,
      ...cert,
    },
  };
}

const ids = (findings: { pluginId: string }[]) => findings.map((f) => f.pluginId.replace("sensor:ssl:", "")).sort();

describe("avaliarTls", () => {
  it("certificado bom, TLS 1.3 e cadeia confiável não geram achado", () => {
    expect(avaliarTls(URL_ALVO, info(), AGORA)).toEqual([]);
  });

  it("expirado vira HIGH; expirando em breve vira LOW com os dias no título", () => {
    const expirado = avaliarTls(URL_ALVO, info({ autorizado: false, erroDeAutorizacao: "CERT_HAS_EXPIRED" }, { valid_to: dias(-3) }), AGORA);
    expect(ids(expirado)).toEqual(["certificado-expirado"]);
    expect(expirado[0].risk).toBe("HIGH");

    const breve = avaliarTls(URL_ALVO, info({}, { valid_to: dias(10) }), AGORA);
    expect(ids(breve)).toEqual(["certificado-expira-em-breve"]);
    expect(breve[0].title).toBe("Certificado expira em 10 dias");
  });

  it("autoassinado, nome divergente, TLS 1.0 e RSA 1024 viram um achado cada", () => {
    const achados = avaliarTls(
      URL_ALVO,
      info({ autorizado: false, erroDeAutorizacao: "DEPTH_ZERO_SELF_SIGNED_CERT", protocolo: "TLSv1", erroDeNome: "Host: alvo.test. is not in the cert's altnames" }, { bits: 1024 }),
      AGORA,
    );
    expect(ids(achados)).toEqual(["certificado-nao-confiavel", "certificado-nome-divergente", "chave-fraca", "tls-obsoleto"]);
    expect(achados.every((f) => f.sensorKey === "ssl" && f.pluginId.startsWith("sensor:ssl:"))).toBe(true);
  });

  it("chave de curva elíptica de 256 bits não é chave fraca", () => {
    expect(avaliarTls(URL_ALVO, info({}, { bits: 256, asn1Curve: "prime256v1" }), AGORA)).toEqual([]);
  });

  it("o resumo traz CN, emissor, validade e protocolo para a tela", () => {
    expect(resumoDoCertificado(info(), AGORA)).toMatch(/CN=alvo\.test · emitido por AC Teste · válido até \d{4}-\d{2}-\d{2} \(200 dias\) · TLSv1\.3/);
  });
});

describe("SslSensor", () => {
  it("alvo em HTTP: OK com o achado 'sem HTTPS' e sem tentar conexão", async () => {
    const conectar = jest.fn();
    const r = await new SslSensor(conectar).run({ targetUrl: "http://alvo.test/", simulated: false });
    expect(conectar).not.toHaveBeenCalled();
    expect(r.status).toBe("OK");
    expect(ids(r.findings)).toEqual(["sem-https"]);
  });

  it("usa host e porta do endereço autorizado", async () => {
    const conectar = jest.fn().mockResolvedValue(info());
    await new SslSensor(conectar).run({ targetUrl: "https://alvo.test:8443/app", simulated: false });
    expect(conectar).toHaveBeenCalledWith("alvo.test", 8443, undefined);
  });

  it("falha de conexão vira UNAVAILABLE com motivo legível, sem achado", async () => {
    const conectar = jest.fn().mockRejectedValue(Object.assign(new Error("getaddrinfo"), { code: "ENOTFOUND" }));
    const r = await new SslSensor(conectar).run({ targetUrl: URL_ALVO, simulated: false });
    expect(r).toEqual({ status: "UNAVAILABLE", message: expect.stringContaining("não foi encontrado no DNS"), findings: [] });
  });

  it("modo simulado não conecta e se identifica como simulado", async () => {
    const conectar = jest.fn();
    const r = await new SslSensor(conectar).run({ targetUrl: URL_ALVO, simulated: true });
    expect(conectar).not.toHaveBeenCalled();
    expect(r.message).toMatch(/simulado/i);
    expect(ids(r.findings)).toEqual(["certificado-expira-em-breve"]);
  });
});

describe("motivoDeRede", () => {
  it("traduz o código e mantém o código técnico entre parênteses", () => {
    expect(motivoDeRede(Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }))).toBe(
      "a porta do alvo recusou a conexão — o serviço pode estar parado (ECONNREFUSED)",
    );
    expect(motivoDeRede({ code: "ALGO_NOVO" })).toBe("falha de rede ao falar com o alvo (ALGO_NOVO)");
  });
});
