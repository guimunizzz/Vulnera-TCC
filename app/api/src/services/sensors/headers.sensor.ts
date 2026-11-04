/**
 * headers.sensor.ts
 *
 * Sensor passivo de headers de segurança: UM GET ao alvo, sem corpo, sem login,
 * sem formulário, e avaliação dos cabeçalhos da resposta — CSP, HSTS,
 * X-Frame-Options, X-Content-Type-Options, Referrer-Policy e as flags de cada
 * cookie (HttpOnly, Secure, SameSite).
 *
 * Por que é passivo e seguro de rodar: pede a mesma página que o ZAP já
 * visitou, uma vez, e só lê headers (o corpo é descartado sem ler).
 *
 * Redirecionamentos: seguidos à mão, no máximo 3, e só dentro da MESMA origem
 * do alvo autorizado. Um 30x para outro host não é seguido — os headers
 * avaliados passam a ser os do próprio 30x. Seguir para fora seria pedir uma
 * página que ninguém autorizou (e abriria caminho para SSRF via redirect).
 *
 * Status:
 *   OK          — a resposta chegou (com ou sem achados; zero achados = headers ok)
 *   UNAVAILABLE — o alvo não respondeu (timeout, DNS, conexão recusada)
 *   ERROR       — falha inesperada do próprio sensor
 * NOT_APPLICABLE e NO_DATA não se aplicam a este sensor: ele sempre mede algo
 * ou diz que não conseguiu medir.
 *
 * `avaliarHeaders` é PURA (testável sem rede); `HeadersSensor` só faz o I/O.
 */

import { DastRisk } from "@prisma/client";
import { computeFingerprint, normalizeUrl, type CandidateFinding } from "../dast-findings.service";
import { motivoDeRede } from "./falhas";
import type { Sensor, SensorContext, SensorResult } from "./sensor.types";

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
/** 180 dias: abaixo disso o HSTS protege pouco entre visitas (recomendação OWASP). */
const HSTS_MAX_AGE_MINIMO = 15_552_000;

interface Regra {
  id: string;
  titulo: string;
  risco: DastRisk;
  cwe: string;
  descricao: string;
  solucao: string;
  referencia: string;
}

const REGRAS = {
  csp: {
    id: "csp-ausente",
    titulo: "CSP ausente",
    risco: DastRisk.MEDIUM,
    cwe: "693",
    descricao:
      "A resposta não envia Content-Security-Policy. Sem ela, o navegador não tem como restringir de onde scripts, estilos e frames podem ser carregados, o que agrava um XSS.",
    solucao: "Defina uma Content-Security-Policy restritiva (comece por default-src 'self') e ajuste as fontes que a página realmente usa.",
    referencia: "https://developer.mozilla.org/docs/Web/HTTP/CSP https://owasp.org/www-project-secure-headers/",
  },
  hsts: {
    id: "hsts-ausente",
    titulo: "HSTS ausente",
    risco: DastRisk.LOW,
    cwe: "319",
    descricao: "A página HTTPS não envia Strict-Transport-Security: um primeiro acesso por HTTP pode ser interceptado e rebaixado.",
    solucao: "Envie Strict-Transport-Security: max-age=31536000; includeSubDomains nas respostas HTTPS.",
    referencia: "https://developer.mozilla.org/docs/Web/HTTP/Headers/Strict-Transport-Security",
  },
  hstsCurto: {
    id: "hsts-curto",
    titulo: "HSTS com max-age curto",
    risco: DastRisk.LOW,
    cwe: "319",
    descricao: "O Strict-Transport-Security tem max-age menor que 180 dias e expira entre visitas.",
    solucao: "Use max-age de pelo menos 15552000 (180 dias); 31536000 (1 ano) é o usual.",
    referencia: "https://developer.mozilla.org/docs/Web/HTTP/Headers/Strict-Transport-Security",
  },
  clickjacking: {
    id: "anti-clickjacking-ausente",
    titulo: "Proteção contra clickjacking ausente",
    risco: DastRisk.MEDIUM,
    cwe: "1021",
    descricao: "Sem X-Frame-Options nem frame-ancestors na CSP, a página pode ser embutida num iframe de outro site e usada em clickjacking.",
    solucao: "Envie Content-Security-Policy: frame-ancestors 'self' (ou X-Frame-Options: DENY/SAMEORIGIN para navegadores antigos).",
    referencia: "https://owasp.org/www-community/attacks/Clickjacking",
  },
  nosniff: {
    id: "nosniff-ausente",
    titulo: "X-Content-Type-Options ausente",
    risco: DastRisk.LOW,
    cwe: "693",
    descricao: "Sem X-Content-Type-Options: nosniff, o navegador pode adivinhar o tipo do conteúdo e executar como script algo servido como texto.",
    solucao: "Envie X-Content-Type-Options: nosniff em todas as respostas.",
    referencia: "https://developer.mozilla.org/docs/Web/HTTP/Headers/X-Content-Type-Options",
  },
  referrer: {
    id: "referrer-policy-ausente",
    titulo: "Referrer-Policy ausente",
    risco: DastRisk.INFO,
    cwe: "200",
    descricao: "Sem Referrer-Policy, o comportamento padrão do navegador decide quanto da URL vaza para outros sites ao seguir um link.",
    solucao: "Envie Referrer-Policy: strict-origin-when-cross-origin (ou mais restritiva).",
    referencia: "https://developer.mozilla.org/docs/Web/HTTP/Headers/Referrer-Policy",
  },
  cookieHttpOnly: {
    id: "cookie-sem-httponly",
    titulo: "Cookie sem HttpOnly",
    risco: DastRisk.LOW,
    cwe: "1004",
    descricao: "O cookie pode ser lido por JavaScript da página; num XSS, ele é roubado.",
    solucao: "Marque o cookie com HttpOnly, a menos que o front precise lê-lo de propósito.",
    referencia: "https://owasp.org/www-community/HttpOnly",
  },
  cookieSecure: {
    id: "cookie-sem-secure",
    titulo: "Cookie sem Secure",
    risco: DastRisk.LOW,
    cwe: "614",
    descricao: "Num site HTTPS, o cookie sem Secure também é enviado em requisições HTTP sem criptografia.",
    solucao: "Marque o cookie com Secure.",
    referencia: "https://developer.mozilla.org/docs/Web/HTTP/Cookies#restrict_access_to_cookies",
  },
  cookieSameSite: {
    id: "cookie-sem-samesite",
    titulo: "Cookie sem SameSite",
    risco: DastRisk.INFO,
    cwe: "1275",
    descricao: "Sem SameSite explícito, a proteção contra CSRF depende do padrão de cada navegador.",
    solucao: "Defina SameSite=Lax (ou Strict) no cookie.",
    referencia: "https://developer.mozilla.org/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value",
  },
} satisfies Record<string, Regra>;

function finding(regra: Regra, url: string, evidencia: string, param: string | null = null): CandidateFinding {
  const pluginId = `sensor:headers:${regra.id}`;
  const normalizedUrl = normalizeUrl(url);
  return {
    fingerprint: computeFingerprint(pluginId, normalizedUrl, param),
    pluginId,
    title: param ? `${regra.titulo} (${param})` : regra.titulo,
    risk: regra.risco,
    // A checagem é determinística: o header estava (ou não) na resposta.
    confidence: "High",
    cweId: regra.cwe,
    wascId: null,
    url,
    normalizedUrl,
    param,
    evidence: evidencia,
    description: regra.descricao,
    solution: regra.solucao,
    reference: regra.referencia,
    sensorKey: "headers",
  };
}

/** Avalia os headers de UMA resposta. `setCookies` vem separado: `Headers` funde Set-Cookie. */
export function avaliarHeaders(url: string, status: number, headers: Headers, setCookies: string[]): CandidateFinding[] {
  const achados: CandidateFinding[] = [];
  const https = url.startsWith("https:");
  const sem = (nome: string) => `${nome} ausente na resposta HTTP ${status} de ${url}`;

  const csp = headers.get("content-security-policy");
  if (!csp) achados.push(finding(REGRAS.csp, url, sem("Content-Security-Policy")));

  if (https) {
    const hsts = headers.get("strict-transport-security");
    if (!hsts) {
      achados.push(finding(REGRAS.hsts, url, sem("Strict-Transport-Security")));
    } else {
      const maxAge = Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts)?.[1] ?? 0);
      if (maxAge < HSTS_MAX_AGE_MINIMO) achados.push(finding(REGRAS.hstsCurto, url, `Strict-Transport-Security: ${hsts}`));
    }
  }

  const xfo = headers.get("x-frame-options");
  if (!xfo && !/frame-ancestors/i.test(csp ?? "")) {
    achados.push(finding(REGRAS.clickjacking, url, `${sem("X-Frame-Options")}; a CSP também não define frame-ancestors`));
  }

  if (headers.get("x-content-type-options")?.trim().toLowerCase() !== "nosniff") {
    const valor = headers.get("x-content-type-options");
    achados.push(finding(REGRAS.nosniff, url, valor ? `X-Content-Type-Options: ${valor}` : sem("X-Content-Type-Options")));
  }

  if (!headers.get("referrer-policy")) achados.push(finding(REGRAS.referrer, url, sem("Referrer-Policy")));

  for (const cookie of setCookies) {
    const [par, ...atributos] = cookie.split(";").map((p) => p.trim());
    const nome = par.split("=")[0]?.trim();
    if (!nome) continue;
    const flags = atributos.map((a) => a.split("=")[0].trim().toLowerCase());
    // Evidência só com nome e atributos: o VALOR do cookie pode ser uma sessão real.
    const evidencia = `Set-Cookie: ${nome}=…${atributos.length ? `; ${atributos.join("; ")}` : ""}`;
    if (!flags.includes("httponly")) achados.push(finding(REGRAS.cookieHttpOnly, url, evidencia, nome));
    if (https && !flags.includes("secure")) achados.push(finding(REGRAS.cookieSecure, url, evidencia, nome));
    if (!flags.includes("samesite")) achados.push(finding(REGRAS.cookieSameSite, url, evidencia, nome));
  }

  return achados;
}

/**
 * Resposta fixa do scan de DEMONSTRAÇÃO: o modo simulado não toca a rede, mas
 * o grafo precisa mostrar o sensor funcionando (spec: "sensores simulados,
 * rotulados como tal"). Nunca usada como fallback de falha do modo real.
 */
function cabecalhosSimulados(): { headers: Headers; setCookies: string[] } {
  return {
    headers: new Headers({ "x-frame-options": "SAMEORIGIN", "strict-transport-security": "max-age=86400" }),
    setCookies: ["SESSIONID=simulado; Path=/; Secure"],
  };
}

export class HeadersSensor implements Sensor {
  readonly key = "headers" as const;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = TIMEOUT_MS,
  ) {}

  async run(ctx: SensorContext): Promise<SensorResult> {
    if (ctx.simulated) {
      const { headers, setCookies } = cabecalhosSimulados();
      return {
        status: "OK",
        message: "Resultado simulado (scan de demonstração): nenhuma requisição foi feita ao alvo.",
        findings: avaliarHeaders(ctx.targetUrl, 200, headers, setCookies),
      };
    }

    try {
      const { url, resposta } = await this.buscar(ctx.targetUrl, ctx.signal);
      const findings = avaliarHeaders(url, resposta.status, resposta.headers, resposta.headers.getSetCookie());
      return { status: "OK", message: `HTTP ${resposta.status} de ${url}`, findings };
    } catch (erro) {
      if (erro instanceof SensorIndisponivel) return { status: "UNAVAILABLE", message: erro.message, findings: [] };
      return { status: "ERROR", message: `Falha no sensor de headers: ${(erro as Error).message}`, findings: [] };
    }
  }

  private async buscar(alvo: string, signal?: AbortSignal): Promise<{ url: string; resposta: Response }> {
    const origem = new URL(alvo).origin;
    let url = alvo;
    for (let saltos = 0; ; saltos += 1) {
      const sinais = [AbortSignal.timeout(this.timeoutMs), ...(signal ? [signal] : [])];
      let resposta: Response;
      try {
        resposta = await this.fetchImpl(url, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.any(sinais),
          headers: { "user-agent": "Vulnera-DAST/headers-sensor (passivo)" },
        });
      } catch (erro) {
        throw new SensorIndisponivel(`Não foi possível ler os headers: ${motivoDeRede(erro)}.`);
      }
      // Só os headers importam: descarta o corpo sem baixá-lo.
      await resposta.body?.cancel().catch(() => undefined);
      const destino = resposta.headers.get("location");
      if (resposta.status < 300 || resposta.status >= 400 || !destino || saltos >= MAX_REDIRECTS) return { url, resposta };
      const proximo = new URL(destino, url);
      if (proximo.origin !== origem) return { url, resposta };
      url = proximo.href;
    }
  }
}

class SensorIndisponivel extends Error {}
