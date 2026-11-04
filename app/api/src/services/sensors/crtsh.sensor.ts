/**
 * crtsh.sensor.ts
 *
 * Sensor de subdomínios: consulta os logs públicos de Certificate Transparency
 * no crt.sh. Todo certificado emitido por uma CA pública fica registrado ali
 * com os nomes que cobre — então os subdomínios aparecem sem tocar o alvo.
 *
 * Os subdomínios entram como ATIVOS (nós no CyberGraph), nunca como alvos: o
 * Vulnera não escaneia nada além da URL autorizada. Nomes que sugerem
 * ambiente interno (dev, staging, admin, vpn…) viram um finding INFO cada,
 * porque expor a existência deles já é informação útil para um atacante.
 *
 * O crt.sh é gratuito e instável (502/timeout são comuns): uma nova tentativa,
 * e depois UNAVAILABLE com motivo — nunca "nenhum subdomínio".
 *
 * `extrairSubdominios` e `dominioBase` são PURAS.
 */

import { isIP } from "net";
import { computeFingerprint, normalizeUrl, type CandidateFinding } from "../dast-findings.service";
import { DastRisk } from "@prisma/client";
import { motivoDeRede } from "./falhas";
import type { ObservedAsset, Sensor, SensorContext, SensorResult } from "./sensor.types";

const TIMEOUT_MS = 30_000;
const MAX_SUBDOMINIOS = 50;
/** Domínios enormes devolvem centenas de MB; lemos até aqui e extraímos o que veio. */
const MAX_BYTES = 8 * 1024 * 1024;
const SENSIVEIS = /^(dev|develop|staging|stage|stg|hml|homolog|homologacao|test|teste|qa|uat|sandbox|admin|painel|internal|intranet|vpn|jenkins|ci|git|gitlab|grafana|kibana|backup|old|beta|debug)\d*$/;
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/**
 * Domínio a consultar: o host sem o "www.".
 * shortcut: sem a Public Suffix List, "app.exemplo.com" consulta só "*.app.exemplo.com";
 * trocar por PSL se precisar subir até o domínio registrável.
 */
export function dominioBase(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (isIP(h.replace(/^\[|\]$/g, "")) || !h.includes(".")) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|test|example|invalid)$/.test(h) || h === "host.docker.internal") return null;
  return h.replace(/^www\./, "");
}

/** Lê os `name_value` do JSON do crt.sh (também de um JSON cortado no meio). PURA. */
export function extrairSubdominios(texto: string, base: string): string[] {
  const nomes = new Set<string>();
  for (const m of texto.matchAll(/"name_value"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    for (const bruto of m[1].split("\\n")) {
      const nome = bruto.trim().toLowerCase().replace(/^\*\./, "");
      if (nome !== base && nome.endsWith(`.${base}`) && HOST_RE.test(nome)) nomes.add(nome);
    }
  }
  return [...nomes].sort();
}

export function subdominiosSensiveis(subdominios: string[], base: string): string[] {
  return subdominios.filter((s) => s.slice(0, -(base.length + 1)).split(".").some((rotulo) => SENSIVEIS.test(rotulo)));
}

export function montarSubdominios(targetUrl: string, base: string, todos: string[]): { assets: ObservedAsset[]; findings: CandidateFinding[] } {
  const mostrados = todos.slice(0, MAX_SUBDOMINIOS);
  const normalizedUrl = normalizeUrl(targetUrl);
  const pluginId = "sensor:crtsh:subdominio-sensivel";
  return {
    assets: mostrados.map((s) => ({ kind: "SUBDOMAIN" as const, value: s, parentValue: null, metadata: { fonte: "crt.sh" } })),
    findings: subdominiosSensiveis(mostrados, base).map((s) => ({
      fingerprint: computeFingerprint(pluginId, normalizedUrl, s),
      pluginId,
      title: "Subdomínio sensível em log público de certificados",
      risk: DastRisk.INFO,
      confidence: "Medium",
      cweId: "200",
      wascId: null,
      url: targetUrl,
      normalizedUrl,
      param: s,
      evidence: `crt.sh: certificado público emitido para ${s}`,
      description:
        `O nome ${s} aparece em certificados públicos (Certificate Transparency). O nome sugere ambiente interno, de ` +
        "teste ou administrativo; qualquer pessoa consegue descobri-lo. O Vulnera não acessou esse endereço.",
      solution:
        "Confirme se o ambiente precisa estar acessível pela internet. Se não, restrinja por VPN/IP ou desligue; " +
        "para nomes internos, prefira certificado de CA interna ou um curinga que não revele o nome.",
      reference: `https://crt.sh/?q=${encodeURIComponent(s)}`,
      sensorKey: "crtsh",
    })),
  };
}

async function lerAte(resposta: Response, limite: number): Promise<string> {
  if (!resposta.body) return "";
  const leitor = resposta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (total < limite) {
    const { done, value } = await leitor.read();
    if (done || !value) break;
    partes.push(value);
    total += value.length;
  }
  await leitor.cancel().catch(() => undefined);
  return Buffer.concat(partes).toString("utf8");
}

export class CrtShSensor implements Sensor {
  readonly key = "crtsh" as const;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = TIMEOUT_MS,
  ) {}

  async run(ctx: SensorContext): Promise<SensorResult> {
    const host = new URL(ctx.targetUrl).hostname;
    const base = dominioBase(host);

    if (ctx.simulated) {
      const b = base ?? "exemplo.com";
      const demo = ["api", "www", "staging", "admin", "cdn", "dev"].map((s) => `${s}.${b}`).sort();
      return {
        status: "OK",
        message: `Resultado simulado (scan de demonstração): o crt.sh não foi consultado. ${demo.length} subdomínio(s).`,
        ...montarSubdominios(ctx.targetUrl, b, demo),
      };
    }

    if (!base) {
      return {
        status: "NOT_APPLICABLE",
        message: `${host} não é um domínio público (IP, localhost ou nome interno): não há certificados públicos para consultar.`,
        findings: [],
      };
    }

    const url = `https://crt.sh/?q=${encodeURIComponent(`%.${base}`)}&output=json&exclude=expired`;
    let motivo = "";
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      ctx.pulso?.();
      try {
        const resposta = await this.fetchImpl(url, {
          headers: { "user-agent": "Vulnera-DAST/crtsh" },
          signal: AbortSignal.any([AbortSignal.timeout(this.timeoutMs), ...(ctx.signal ? [ctx.signal] : [])]),
        });
        if (!resposta.ok) {
          await resposta.body?.cancel().catch(() => undefined);
          motivo = `o crt.sh respondeu HTTP ${resposta.status} (serviço público instável)`;
          continue;
        }
        const texto = await lerAte(resposta, MAX_BYTES);
        const todos = extrairSubdominios(texto, base);
        if (todos.length === 0) {
          return { status: "NO_DATA", message: `Nenhum subdomínio de ${base} em certificados públicos válidos.`, findings: [] };
        }
        const corte = todos.length > MAX_SUBDOMINIOS ? ` (mostrando ${MAX_SUBDOMINIOS} de ${todos.length})` : "";
        return {
          status: "OK",
          message: `${todos.length} subdomínio(s) de ${base} em certificados públicos${corte}. Nenhum deles foi acessado.`,
          ...montarSubdominios(ctx.targetUrl, base, todos),
        };
      } catch (erro) {
        if (ctx.signal?.aborted) throw erro;
        motivo = motivoDeRede(erro);
      }
    }
    return { status: "UNAVAILABLE", message: `Não foi possível consultar o crt.sh: ${motivo}. Tente outro scan mais tarde.`, findings: [] };
  }
}
