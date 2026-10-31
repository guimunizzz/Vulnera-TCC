/**
 * internetdb.sensor.ts
 *
 * Sensor de exposição: resolve o IP do alvo, consulta a InternetDB (Shodan,
 * gratuita, sem chave) e devolve IP, portas abertas, tecnologias (CPEs) e as
 * CVEs que a Shodan associa àquele IP — cada CVE enriquecida com o CVSS do
 * NVD (NIST) via `NvdCveService`.
 *
 * Passivo: nenhum pacote vai ao alvo. Só o DNS dele é resolvido, e quem
 * consulta é a InternetDB, que mostra o que a Shodan já viu publicamente.
 *
 * CVE aqui é POTENCIAL, não validada: a Shodan deduz pela versão anunciada do
 * software, e backport de correção (comum em distros) gera falso positivo.
 * Por isso: confiança "Low", título e descrição dizem "potencial · não
 * validado", e o finding entra em triagem NEW — nunca vira Vulnerability sozinho.
 * Em CDN/hospedagem compartilhada, o IP é do provedor, não só do alvo: a
 * descrição avisa.
 *
 * Status:
 *   OK             — IP público consultado (com ou sem CVEs)
 *   NO_DATA        — a InternetDB não tem registro desse IP
 *   NOT_APPLICABLE — o alvo só resolve para IP privado/local: o IP aparece,
 *                    mas sem portas/CVEs; o resto do scan segue normalmente
 *   UNAVAILABLE    — DNS ou InternetDB falharam
 */

import { BlockList, isIP } from "net";
import { lookup } from "dns/promises";
import { computeFingerprint, normalizeUrl, type CandidateFinding } from "../dast-findings.service";
import { motivoDeRede } from "./falhas";
import { riscoPorCvss, severidadeCvss, type CveInfo, type NvdCveService } from "./nvd-cve.service";
import type { ObservedAsset, Sensor, SensorContext, SensorResult } from "./sensor.types";

const INTERNETDB_URL = "https://internetdb.shodan.io";
const TIMEOUT_MS = 10_000;
/** Um IP de provedor grande pode trazer centenas de CVEs; acima disso vira ruído. */
const MAX_CVES = 150;

export interface DadosInternetDb {
  ip: string;
  ports: number[];
  cpes: string[];
  hostnames: string[];
  tags: string[];
  vulns: string[];
}

const PRIVADOS = new BlockList();
for (const [rede, prefixo] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) {
  PRIVADOS.addSubnet(rede, prefixo, "ipv4");
}

/** IPv4 roteável na internet. IPv6 fica de fora: a InternetDB só indexa IPv4. */
export function ipv4Publico(ip: string): boolean {
  return isIP(ip) === 4 && !PRIVADOS.check(ip, "ipv4");
}

/** "cpe:/a:apache:http_server:2.4.7" → "apache http_server 2.4.7". */
export function nomeDoCpe(cpe: string): string {
  const [, , fornecedor, produto, versao] = cpe.split(":");
  if (!produto) return cpe;
  const nome = fornecedor && fornecedor !== produto ? `${fornecedor} ${produto}` : produto;
  return versao ? `${nome} ${versao}` : nome;
}

/** Monta ativos e findings a partir da InternetDB + NVD. PURA. */
export function montarExposicao(
  targetUrl: string,
  dados: DadosInternetDb,
  cves: Map<string, CveInfo>,
): { assets: ObservedAsset[]; findings: CandidateFinding[] } {
  const assets: ObservedAsset[] = [
    { kind: "IP", value: dados.ip, parentValue: null, metadata: { publico: true, hostnames: dados.hostnames, tags: dados.tags } },
    ...dados.ports.map((p) => ({ kind: "PORT" as const, value: `${dados.ip}:${p}`, parentValue: dados.ip, metadata: { porta: p } })),
    ...dados.cpes.map((cpe) => ({ kind: "TECHNOLOGY" as const, value: nomeDoCpe(cpe), parentValue: dados.ip, metadata: { cpe, fonte: "InternetDB" } })),
  ];

  const normalizedUrl = normalizeUrl(targetUrl);
  const contexto = [
    `IP ${dados.ip}`,
    dados.ports.length ? `portas ${dados.ports.join(", ")}` : null,
    dados.cpes.length ? `software ${dados.cpes.map(nomeDoCpe).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const findings = dados.vulns.slice(0, MAX_CVES).map((id): CandidateFinding => {
    const info = cves.get(id);
    const nota = info?.cvssScore ?? null;
    const pluginId = `sensor:internetdb:${id}`;
    const cvss =
      nota !== null
        ? `CVSS ${info?.cvssVersion ?? ""} ${nota.toFixed(1)} (${severidadeCvss(nota)})`.replace("  ", " ")
        : info
          ? "o NVD ainda não publicou CVSS para esta CVE"
          : "CVSS pendente (não consultado no NVD neste scan)";
    return {
      fingerprint: computeFingerprint(pluginId, normalizedUrl, null),
      pluginId,
      title: `${id} — potencial · não validado`,
      risk: riscoPorCvss(nota),
      confidence: "Low",
      cweId: info?.cweId ?? null,
      wascId: null,
      url: targetUrl,
      normalizedUrl,
      param: null,
      evidence: `InternetDB (Shodan): ${contexto}. ${cvss}.`,
      description:
        `Potencial, não validado: a InternetDB associa a ${id} ao IP ${dados.ip} pela versão do software exposto; ` +
        "nenhum teste foi feito no alvo. Versões com correção aplicada por backport e IPs compartilhados (CDN, " +
        "hospedagem) geram falso positivo." +
        (info?.description ? `\n\nNVD (NIST): ${info.description}` : ""),
      solution:
        "Confirme a versão instalada no servidor. Se ela for afetada, aplique a correção do fornecedor (veja as " +
        "referências do NVD). Se já estiver corrigida ou o IP não for só deste alvo, marque como falso positivo na triagem.",
      reference: [`https://nvd.nist.gov/vuln/detail/${id}`, ...(info?.references ?? [])].join(" "),
      sensorKey: "internetdb",
      cveId: id,
      cvssScore: nota,
      cvssVersion: info?.cvssVersion ?? null,
      cvssVector: info?.cvssVector ?? null,
    };
  });

  return { assets, findings };
}

/** Demonstração: IP de documentação (RFC 5737) e CVEs reais do Apache 2.4.49, com o CVSS publicado pelo NVD. */
function demonstracao(): { dados: DadosInternetDb; cves: Map<string, CveInfo> } {
  const cve = (id: string, nota: number, vetor: string, cwe: string, descricao: string): CveInfo => ({
    id,
    description: descricao,
    cvssScore: nota,
    cvssVersion: "3.1",
    cvssVector: vetor,
    cweId: cwe,
    publishedAt: null,
    references: [],
  });
  const cves = [
    cve("CVE-2021-42013", 9.8, "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "22", "Path traversal e execução remota no Apache HTTP Server 2.4.49/2.4.50 (correção incompleta da CVE-2021-41773)."),
    cve("CVE-2021-41773", 7.5, "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N", "22", "Path traversal no Apache HTTP Server 2.4.49."),
    cve("CVE-2021-40438", 9.0, "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:H/A:H", "918", "SSRF no mod_proxy do Apache HTTP Server até 2.4.48."),
    cve("CVE-2021-34798", 7.5, "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", "476", "Requisição malformada causa NULL dereference no Apache HTTP Server até 2.4.48."),
  ];
  return {
    dados: {
      ip: "203.0.113.10",
      ports: [22, 80, 443],
      cpes: ["cpe:/a:apache:http_server:2.4.49", "cpe:/a:openbsd:openssh:8.2"],
      hostnames: [],
      tags: ["demonstração"],
      vulns: cves.map((c) => c.id),
    },
    cves: new Map(cves.map((c) => [c.id, c])),
  };
}

type Resolver = (host: string) => Promise<string[]>;
const resolverPadrao: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

export class InternetDbSensor implements Sensor {
  readonly key = "internetdb" as const;

  constructor(
    private readonly nvd: Pick<NvdCveService, "enriquecer">,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly resolver: Resolver = resolverPadrao,
  ) {}

  async run(ctx: SensorContext): Promise<SensorResult> {
    if (ctx.simulated) {
      const { dados, cves } = demonstracao();
      return {
        status: "OK",
        message: `Resultado simulado (scan de demonstração): nenhuma consulta foi feita; IP de documentação e CVSS copiados do NVD. ${resumo(dados, null, [])}`,
        ...montarExposicao(ctx.targetUrl, dados, cves),
      };
    }

    const host = new URL(ctx.targetUrl).hostname.replace(/^\[|\]$/g, "");
    let enderecos: string[];
    try {
      enderecos = isIP(host) ? [host] : await this.resolver(host);
    } catch (erro) {
      return { status: "UNAVAILABLE", message: `Não foi possível resolver o IP de ${host}: ${motivoDeRede(erro)}.`, findings: [] };
    }

    const ip = enderecos.find(ipv4Publico);
    if (!ip) {
      const visto = enderecos[0] ?? host;
      return {
        status: "NOT_APPLICABLE",
        message:
          `IP público indisponível: ${host} resolve para ${enderecos.join(", ") || "nenhum endereço"} (rede privada, local ou só IPv6). ` +
          "Portas e CVEs não foram consultadas; o restante do scan seguiu normalmente.",
        findings: [],
        assets: [{ kind: "IP", value: visto, parentValue: null, metadata: { publico: false } }],
      };
    }

    let resposta: Response;
    try {
      resposta = await this.fetchImpl(`${INTERNETDB_URL}/${ip}`, {
        headers: { "user-agent": "Vulnera-DAST/internetdb" },
        signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), ...(ctx.signal ? [ctx.signal] : [])]),
      });
    } catch (erro) {
      return {
        status: "UNAVAILABLE",
        message: `A InternetDB (Shodan) não respondeu: ${motivoDeRede(erro)}.`,
        findings: [],
        assets: [{ kind: "IP", value: ip, parentValue: null, metadata: { publico: true } }],
      };
    }

    if (resposta.status === 404) {
      await resposta.body?.cancel().catch(() => undefined);
      return {
        status: "NO_DATA",
        message: `A InternetDB não tem registro do IP ${ip}: nenhuma porta ou CVE conhecida publicamente (não significa que o IP esteja seguro).`,
        findings: [],
        assets: [{ kind: "IP", value: ip, parentValue: null, metadata: { publico: true } }],
      };
    }
    if (!resposta.ok) {
      await resposta.body?.cancel().catch(() => undefined);
      return {
        status: "UNAVAILABLE",
        message: `A InternetDB (Shodan) respondeu HTTP ${resposta.status}; portas e CVEs não foram consultadas.`,
        findings: [],
        assets: [{ kind: "IP", value: ip, parentValue: null, metadata: { publico: true } }],
      };
    }

    const bruto = (await resposta.json()) as Partial<DadosInternetDb>;
    const dados: DadosInternetDb = {
      ip,
      ports: (bruto.ports ?? []).filter((p) => Number.isInteger(p)).sort((a, b) => a - b),
      cpes: (bruto.cpes ?? []).filter((c) => typeof c === "string"),
      hostnames: (bruto.hostnames ?? []).filter((h) => typeof h === "string").slice(0, 20),
      tags: (bruto.tags ?? []).filter((t) => typeof t === "string"),
      vulns: (bruto.vulns ?? []).filter((v) => typeof v === "string"),
    };

    const { infos, pendentes, interrupcao } = await this.nvd.enriquecer(dados.vulns.slice(0, MAX_CVES), {
      signal: ctx.signal,
      pulso: ctx.pulso,
      cpes: dados.cpes,
    });
    const avisoNvd = interrupcao ? ` ${pendentes.length} CVE(s) ficaram com CVSS pendente: ${interrupcao}.` : "";
    return {
      status: "OK",
      message: resumo(dados, infos.size, pendentes) + avisoNvd,
      ...montarExposicao(ctx.targetUrl, dados, infos),
    };
  }
}

/** `comCvss` null = demonstração (nada foi consultado no NVD). */
function resumo(dados: DadosInternetDb, comCvss: number | null, pendentes: string[]): string {
  const cves = Math.min(dados.vulns.length, MAX_CVES);
  const corte = dados.vulns.length > MAX_CVES ? ` (de ${dados.vulns.length}; só as ${MAX_CVES} primeiras entram)` : "";
  return (
    `IP ${dados.ip} · ${dados.ports.length} porta(s) aberta(s)${dados.ports.length ? ` (${dados.ports.join(", ")})` : ""} · ` +
    `${cves} CVE(s) potencial(is)${corte}` +
    (cves && comCvss !== null ? `, ${comCvss} com dados do NVD${pendentes.length ? `, ${pendentes.length} pendente(s)` : ""}` : "") +
    "."
  );
}
