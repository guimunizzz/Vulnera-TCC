/**
 * fingerprint.sensor.ts
 *
 * Sensor de tecnologias: UM GET à página do alvo (a mesma que o ZAP já
 * visitou) e leitura do que ela mesma anuncia — headers `Server`,
 * `X-Powered-By`, `X-AspNet-Version`, `X-Generator`, nomes de cookies de
 * sessão e marcas no início do HTML (`<meta name="generator">`, `wp-content`,
 * `__NEXT_DATA__`, `ng-version`). Do corpo, lê no máximo 64 KB.
 *
 * Só gera ATIVOS (nós de tecnologia no CyberGraph), não findings: "versão
 * exposta em header" o ZAP já reporta, e repetir aqui contaria duas vezes.
 *
 * Redirecionamento: igual ao sensor de headers — até 3, só na mesma origem.
 *
 * `detectarTecnologias` é PURA; `FingerprintSensor` só faz o I/O.
 */

import { motivoDeRede } from "./falhas";
import type { ObservedAsset, Sensor, SensorContext, SensorResult } from "./sensor.types";

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 64 * 1024;

export interface Tecnologia {
  nome: string;
  versao: string | null;
  fonte: string;
}

const COOKIES: [RegExp, string][] = [
  [/^PHPSESSID$/i, "PHP"],
  [/^JSESSIONID$/i, "Java (Servlet)"],
  [/^ASP\.NET_SessionId$/i, "ASP.NET"],
  [/^ASPSESSIONID/i, "ASP clássico"],
  [/^laravel_session$/i, "Laravel"],
  [/^connect\.sid$/i, "Express"],
  [/^ci_session$/i, "CodeIgniter"],
  [/^wordpress_|^wp-settings/i, "WordPress"],
  [/^_rails|^_session_id$/i, "Ruby on Rails"],
  [/^csrftoken$/i, "Django"],
];

const MARCAS_HTML: [RegExp, string][] = [
  [/\/wp-content\/|\/wp-includes\//i, "WordPress"],
  [/__NEXT_DATA__|\/_next\/static\//, "Next.js"],
  [/\/_nuxt\//, "Nuxt"],
  [/data-drupal-|\/sites\/default\/files\//i, "Drupal"],
  [/\/media\/jui\/|content="Joomla/i, "Joomla"],
];

/** "nginx/1.18.0 (Ubuntu)" → [{nginx, 1.18.0}]; o conteúdo entre parênteses (SO) é ignorado. */
function produtosDoHeader(valor: string, fonte: string): Tecnologia[] {
  const semComentario = valor.replace(/\([^)]*\)/g, " ");
  const achados: Tecnologia[] = [];
  for (const m of semComentario.matchAll(/([A-Za-z][\w.+-]*?)(?:\/(\d[\w.-]*))?(?=\s|,|$)/g)) {
    if (m[1]) achados.push({ nome: m[1], versao: m[2] ?? null, fonte });
  }
  return achados;
}

/** Detecta tecnologias pelo que a página anuncia. PURA. */
export function detectarTecnologias(headers: Headers, setCookies: string[], html: string): Tecnologia[] {
  const achados: Tecnologia[] = [];
  const server = headers.get("server");
  if (server) achados.push(...produtosDoHeader(server, "header Server"));
  const poweredBy = headers.get("x-powered-by");
  if (poweredBy) achados.push(...produtosDoHeader(poweredBy, "header X-Powered-By"));
  const aspnet = headers.get("x-aspnet-version");
  if (aspnet) achados.push({ nome: "ASP.NET", versao: aspnet.trim(), fonte: "header X-AspNet-Version" });
  if (headers.get("x-drupal-cache") || headers.get("x-drupal-dynamic-cache")) achados.push({ nome: "Drupal", versao: null, fonte: "header X-Drupal-Cache" });

  const geradores = [headers.get("x-generator"), /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1]];
  for (const g of geradores) {
    if (!g) continue;
    const m = /^(.+?)\s+v?(\d[\w.]*)\b/.exec(g.trim());
    achados.push({ nome: (m?.[1] ?? g).trim(), versao: m?.[2] ?? null, fonte: "gerador declarado" });
  }

  for (const cookie of setCookies) {
    const nome = cookie.split("=")[0]?.trim() ?? "";
    const regra = COOKIES.find(([re]) => re.test(nome));
    if (regra) achados.push({ nome: regra[1], versao: null, fonte: `cookie ${nome}` });
  }

  for (const [re, nome] of MARCAS_HTML) if (re.test(html)) achados.push({ nome, versao: null, fonte: "marcas no HTML" });
  const angular = /ng-version="([\d.]+)"/.exec(html);
  if (angular) achados.push({ nome: "Angular", versao: angular[1], fonte: "marcas no HTML" });

  // Uma entrada por nome; a que tem versão vence.
  const porNome = new Map<string, Tecnologia>();
  for (const t of achados) {
    const chave = t.nome.toLowerCase();
    const atual = porNome.get(chave);
    if (!atual || (!atual.versao && t.versao)) porNome.set(chave, t);
  }
  return [...porNome.values()];
}

export function tecnologiasComoAtivos(tecnologias: Tecnologia[]): ObservedAsset[] {
  return tecnologias.map((t) => ({
    kind: "TECHNOLOGY",
    value: t.versao ? `${t.nome} ${t.versao}` : t.nome,
    parentValue: null,
    metadata: { nome: t.nome, versao: t.versao, fonte: t.fonte },
  }));
}

async function lerInicio(resposta: Response): Promise<string> {
  const tipo = resposta.headers.get("content-type") ?? "";
  if (!resposta.body || !/html/i.test(tipo)) {
    await resposta.body?.cancel().catch(() => undefined);
    return "";
  }
  const leitor = resposta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await leitor.read();
    if (done || !value) break;
    partes.push(value);
    total += value.length;
  }
  await leitor.cancel().catch(() => undefined);
  return Buffer.concat(partes).subarray(0, MAX_HTML_BYTES).toString("utf8");
}

export class FingerprintSensor implements Sensor {
  readonly key = "fingerprint" as const;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = TIMEOUT_MS,
  ) {}

  async run(ctx: SensorContext): Promise<SensorResult> {
    if (ctx.simulated) {
      const tecnologias: Tecnologia[] = [
        { nome: "Apache", versao: "2.4.49", fonte: "header Server" },
        { nome: "PHP", versao: "7.4.3", fonte: "header X-Powered-By" },
        { nome: "WordPress", versao: "5.8", fonte: "gerador declarado" },
      ];
      return {
        status: "OK",
        message: `Resultado simulado (scan de demonstração): nenhuma requisição foi feita. ${listar(tecnologias)}`,
        findings: [],
        assets: tecnologiasComoAtivos(tecnologias),
      };
    }

    const origem = new URL(ctx.targetUrl).origin;
    let url = ctx.targetUrl;
    try {
      for (let saltos = 0; ; saltos += 1) {
        let resposta: Response;
        try {
          resposta = await this.fetchImpl(url, {
            method: "GET",
            redirect: "manual",
            signal: AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(ctx.signal ? [ctx.signal] : [])]),
            headers: { "user-agent": "Vulnera-DAST/fingerprint-sensor (passivo)" },
          });
        } catch (erro) {
          return { status: "UNAVAILABLE", message: `Não foi possível ler a página do alvo: ${motivoDeRede(erro)}.`, findings: [] };
        }
        const destino = resposta.headers.get("location");
        const proximo = destino ? new URL(destino, url) : null;
        if (resposta.status >= 300 && resposta.status < 400 && proximo && proximo.origin === origem && saltos < MAX_REDIRECTS) {
          await resposta.body?.cancel().catch(() => undefined);
          url = proximo.href;
          continue;
        }
        const html = await lerInicio(resposta);
        const tecnologias = detectarTecnologias(resposta.headers, resposta.headers.getSetCookie(), html);
        if (tecnologias.length === 0) {
          return {
            status: "NO_DATA",
            message: "A página não anuncia tecnologia (headers, cookies e HTML sem marcas conhecidas) — isso é bom: menos informação para um atacante.",
            findings: [],
          };
        }
        return { status: "OK", message: listar(tecnologias), findings: [], assets: tecnologiasComoAtivos(tecnologias) };
      }
    } catch (erro) {
      return { status: "ERROR", message: `Falha no sensor de tecnologias: ${(erro as Error).message}`, findings: [] };
    }
  }
}

function listar(tecnologias: Tecnologia[]): string {
  return `${tecnologias.length} tecnologia(s): ${tecnologias.map((t) => (t.versao ? `${t.nome} ${t.versao}` : t.nome)).join(", ")}.`;
}
