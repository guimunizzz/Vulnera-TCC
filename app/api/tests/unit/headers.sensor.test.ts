import { avaliarHeaders, HeadersSensor } from "../../src/services/sensors/headers.sensor";

const ALVO = "https://alvo.test/";

function resposta(status: number, headers: Record<string, string> = {}, cookies: string[] = []): Response {
  const h = new Headers(headers);
  for (const c of cookies) h.append("set-cookie", c);
  return new Response(null, { status, headers: h });
}

const ids = (findings: { pluginId: string }[]) => findings.map((f) => f.pluginId.replace("sensor:headers:", "")).sort();

describe("avaliarHeaders", () => {
  it("resposta sem nenhum header de segurança gera um achado por regra, em namespace", () => {
    const achados = avaliarHeaders(ALVO, 200, new Headers(), []);
    expect(ids(achados)).toEqual(["anti-clickjacking-ausente", "csp-ausente", "hsts-ausente", "nosniff-ausente", "referrer-policy-ausente"]);
    expect(achados.every((f) => f.sensorKey === "headers" && f.fingerprint.length === 64)).toBe(true);
  });

  it("resposta bem configurada não gera achado", () => {
    const headers = new Headers({
      "content-security-policy": "default-src 'self'; frame-ancestors 'self'",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
    });
    expect(avaliarHeaders(ALVO, 200, headers, ["sid=abc; Path=/; Secure; HttpOnly; SameSite=Lax"])).toEqual([]);
  });

  it("frame-ancestors na CSP dispensa X-Frame-Options; HSTS curto e HTTP sem HSTS são tratados", () => {
    const comCsp = avaliarHeaders(ALVO, 200, new Headers({ "content-security-policy": "frame-ancestors 'none'", "strict-transport-security": "max-age=600" }), []);
    expect(ids(comCsp)).toContain("hsts-curto");
    expect(ids(comCsp)).not.toContain("anti-clickjacking-ausente");
    expect(ids(avaliarHeaders("http://alvo.test/", 200, new Headers(), []))).not.toContain("hsts-ausente");
  });

  it("cookie sem flags gera um achado por flag, sem expor o valor do cookie", () => {
    const achados = avaliarHeaders(ALVO, 200, new Headers(), ["SESSION=segredo-de-verdade; Path=/"]);
    const deCookie = achados.filter((f) => f.param === "SESSION");
    expect(ids(deCookie)).toEqual(["cookie-sem-httponly", "cookie-sem-samesite", "cookie-sem-secure"]);
    expect(deCookie.every((f) => !f.evidence?.includes("segredo"))).toBe(true);
  });
});

describe("HeadersSensor", () => {
  it("OK com os achados da resposta real", async () => {
    const fetchFalso = jest.fn().mockResolvedValue(resposta(200, { "x-content-type-options": "nosniff" }));
    const resultado = await new HeadersSensor(fetchFalso).run({ targetUrl: ALVO, simulated: false });
    expect(resultado.status).toBe("OK");
    expect(ids(resultado.findings)).not.toContain("nosniff-ausente");
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("alvo que não responde vira UNAVAILABLE, sem achado e sem dado simulado", async () => {
    const erro = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    const resultado = await new HeadersSensor(jest.fn().mockRejectedValue(erro)).run({ targetUrl: ALVO, simulated: false });
    expect(resultado).toEqual({ status: "UNAVAILABLE", message: expect.stringContaining("ECONNREFUSED"), findings: [] });
  });

  it("segue redirect da mesma origem e NÃO segue para outro host", async () => {
    const fetchFalso = jest
      .fn()
      .mockResolvedValueOnce(resposta(302, { location: "/login" }))
      .mockResolvedValueOnce(resposta(301, { location: "https://outro-host.test/" }));
    const resultado = await new HeadersSensor(fetchFalso).run({ targetUrl: ALVO, simulated: false });
    expect(fetchFalso).toHaveBeenCalledTimes(2);
    expect(fetchFalso.mock.calls[1][0]).toBe("https://alvo.test/login");
    expect(resultado.message).toContain("https://alvo.test/login");
  });

  it("modo simulado não faz requisição e se identifica como simulado", async () => {
    const fetchFalso = jest.fn();
    const resultado = await new HeadersSensor(fetchFalso).run({ targetUrl: ALVO, simulated: true });
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(resultado.status).toBe("OK");
    expect(resultado.message).toMatch(/simulado/i);
    expect(resultado.findings.length).toBeGreaterThan(0);
  });
});
