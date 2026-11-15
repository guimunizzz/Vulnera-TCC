/**
 * ssl.sensor.ts
 *
 * Sensor passivo do certificado SSL/TLS: UM handshake TLS com o host do alvo
 * (sem enviar requisição HTTP nenhuma) e avaliação do que o servidor apresenta —
 * validade, expiração próxima, cadeia confiável, nome do host, versão do
 * protocolo e tamanho da chave.
 *
 * Por que aceita protocolos e cifras antigos na conexão: o objetivo é MEDIR. Com
 * o mínimo padrão do Node (TLS 1.2), um servidor ainda em TLS 1.0 derrubaria o
 * handshake e a tela diria "indisponível", escondendo justamente o achado. A
 * conexão é fechada logo após o handshake; nenhum dado é enviado ao alvo.
 *
 * Alvo em http:// não tem certificado: o sensor devolve OK com o achado
 * "alvo sem HTTPS" (dado real, deduzido do endereço autorizado). Não tenta a
 * porta 443 por conta própria — só fala com o endereço que a pessoa autorizou.
 *
 * `avaliarTls` é PURA (testável sem rede); `SslSensor` só faz o handshake.
 */

import * as tls from "tls";
import type { PeerCertificate } from "tls";
import { DastRisk } from "@prisma/client";
import { computeFingerprint, normalizeUrl, type CandidateFinding } from "../dast-findings.service";
import { motivoDeRede } from "./falhas";
import type { Sensor, SensorContext, SensorResult } from "./sensor.types";

const TIMEOUT_MS = 10_000;
const DIA_MS = 24 * 60 * 60 * 1000;
/** Com menos de 30 dias a renovação já devia ter acontecido (Let's Encrypt renova com 30). */
const DIAS_AVISO_EXPIRACAO = 30;
const PROTOCOLOS_OBSOLETOS = new Set(["SSLv3", "TLSv1", "TLSv1.1"]);
const CHAVE_RSA_MINIMA = 2048;

/** O que o handshake revela; montado pelo sensor ou pelo teste. */
export interface InfoTls {
  host: string;
  protocolo: string | null;
  cifra: string | null;
  autorizado: boolean;
  erroDeAutorizacao: string | null;
  certificado: Pick<PeerCertificate, "subject" | "issuer" | "valid_from" | "valid_to" | "subjectaltname" | "bits" | "asn1Curve"> | null;
  /** Resultado de `tls.checkServerIdentity`: null quando o nome bate. */
  erroDeNome: string | null;
}

interface Regra {
  id: string;
  titulo: string;
  risco: DastRisk;
  cwe: string;
  descricao: string;
  solucao: string;
}

const REGRAS = {
  semHttps: {
    id: "sem-https",
    titulo: "Alvo sem HTTPS",
    risco: DastRisk.MEDIUM,
    cwe: "319",
    descricao: "O endereço autorizado é servido em HTTP: senhas, cookies de sessão e dados trafegam sem criptografia e podem ser lidos ou alterados no caminho.",
    solucao: "Sirva a aplicação por HTTPS com certificado válido e redirecione o HTTP para HTTPS (com HSTS).",
  },
  expirado: {
    id: "certificado-expirado",
    titulo: "Certificado expirado",
    risco: DastRisk.HIGH,
    cwe: "298",
    descricao: "O certificado já passou da data de validade: navegadores bloqueiam o acesso e o canal deixa de provar a identidade do servidor.",
    solucao: "Renove o certificado imediatamente e automatize a renovação (ex.: ACME/Let's Encrypt).",
  },
  aindaNaoValido: {
    id: "certificado-ainda-nao-valido",
    titulo: "Certificado ainda não válido",
    risco: DastRisk.HIGH,
    cwe: "298",
    descricao: "A data de início de validade do certificado está no futuro (relógio do servidor errado ou certificado instalado cedo demais).",
    solucao: "Confira o relógio do servidor e o certificado instalado.",
  },
  expiraEmBreve: {
    id: "certificado-expira-em-breve",
    titulo: "Certificado expira em breve",
    risco: DastRisk.LOW,
    cwe: "298",
    descricao: "O certificado expira em menos de 30 dias. Se a renovação não acontecer, o site fica inacessível.",
    solucao: "Renove o certificado e confirme que a renovação automática está funcionando.",
  },
  naoConfiavel: {
    id: "certificado-nao-confiavel",
    titulo: "Certificado não confiável",
    risco: DastRisk.MEDIUM,
    cwe: "295",
    descricao: "A cadeia do certificado não chega a uma autoridade confiável (autoassinado, cadeia incompleta ou AC desconhecida). O usuário recebe alerta e fica treinado a ignorar alertas.",
    solucao: "Use um certificado emitido por uma autoridade pública e envie a cadeia intermediária completa.",
  },
  nomeDivergente: {
    id: "certificado-nome-divergente",
    titulo: "Certificado não cobre o host",
    risco: DastRisk.MEDIUM,
    cwe: "297",
    descricao: "O certificado apresentado não lista o nome do host acessado no CN/SAN: o navegador alerta e um atacante pode se passar pelo site com mais facilidade.",
    solucao: "Emita o certificado com o nome do host (ou um curinga válido) no Subject Alternative Name.",
  },
  protocoloObsoleto: {
    id: "tls-obsoleto",
    titulo: "Protocolo TLS obsoleto",
    risco: DastRisk.MEDIUM,
    cwe: "327",
    descricao: "O servidor negociou uma versão de protocolo considerada insegura (SSLv3, TLS 1.0 ou 1.1), descontinuada pelos navegadores.",
    solucao: "Desative SSLv3, TLS 1.0 e 1.1; mantenha só TLS 1.2 e 1.3.",
  },
  chaveFraca: {
    id: "chave-fraca",
    titulo: "Chave do certificado fraca",
    risco: DastRisk.MEDIUM,
    cwe: "326",
    descricao: "A chave RSA do certificado tem menos de 2048 bits, abaixo do mínimo atual.",
    solucao: "Reemita o certificado com RSA de 2048+ bits ou ECDSA (P-256).",
  },
} satisfies Record<string, Regra>;

const REFERENCIA = "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/09-Testing_for_Weak_Cryptography/01-Testing_for_Weak_Transport_Layer_Security";

function finding(regra: Regra, url: string, evidencia: string): CandidateFinding {
  const pluginId = `sensor:ssl:${regra.id}`;
  const normalizedUrl = normalizeUrl(url);
  return {
    fingerprint: computeFingerprint(pluginId, normalizedUrl, null),
    pluginId,
    title: regra.titulo,
    risk: regra.risco,
    confidence: "High",
    cweId: regra.cwe,
    wascId: null,
    url,
    normalizedUrl,
    param: null,
    evidence: evidencia,
    description: regra.descricao,
    solution: regra.solucao,
    reference: REFERENCIA,
    sensorKey: "ssl",
  };
}

const nomeDe = (campo: PeerCertificate["subject"] | undefined): string => {
  const valor = campo?.CN ?? campo?.O;
  return Array.isArray(valor) ? valor.join(", ") : (valor ?? "?");
};

/** Linha de resumo do certificado: vai para a mensagem do sensor (chip e painel do alvo). */
export function resumoDoCertificado(info: InfoTls, agora = new Date()): string {
  const c = info.certificado;
  if (!c) return `Sem certificado apresentado por ${info.host}.`;
  const fim = new Date(c.valid_to);
  const dias = Math.floor((fim.getTime() - agora.getTime()) / DIA_MS);
  const validade = Number.isNaN(fim.getTime()) ? "validade ilegível" : `válido até ${fim.toISOString().slice(0, 10)} (${dias} dias)`;
  return [`CN=${nomeDe(c.subject)}`, `emitido por ${nomeDe(c.issuer)}`, validade, info.protocolo, info.cifra].filter(Boolean).join(" · ");
}

/** Erros de cadeia que NÃO são "data" nem "nome" (esses têm regra própria). */
const ERROS_DE_DATA = new Set(["CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID"]);
const ERROS_DE_NOME = new Set(["ERR_TLS_CERT_ALTNAME_INVALID", "HOSTNAME_MISMATCH"]);

export function avaliarTls(url: string, info: InfoTls, agora = new Date()): CandidateFinding[] {
  const achados: CandidateFinding[] = [];
  const c = info.certificado;
  const resumo = resumoDoCertificado(info, agora);

  if (c) {
    const inicio = new Date(c.valid_from);
    const fim = new Date(c.valid_to);
    const diasRestantes = Math.floor((fim.getTime() - agora.getTime()) / DIA_MS);
    if (fim.getTime() < agora.getTime()) achados.push(finding(REGRAS.expirado, url, `Expirou em ${c.valid_to}. ${resumo}`));
    else if (inicio.getTime() > agora.getTime()) achados.push(finding(REGRAS.aindaNaoValido, url, `Válido só a partir de ${c.valid_from}. ${resumo}`));
    else if (diasRestantes < DIAS_AVISO_EXPIRACAO) {
      achados.push({ ...finding(REGRAS.expiraEmBreve, url, `Expira em ${diasRestantes} dias (${c.valid_to}). ${resumo}`), title: `Certificado expira em ${diasRestantes} dias` });
    }

    // Só bits de RSA: em curva elíptica (asn1Curve) 256 bits já é forte.
    if (!c.asn1Curve && typeof c.bits === "number" && c.bits > 0 && c.bits < CHAVE_RSA_MINIMA) {
      achados.push(finding(REGRAS.chaveFraca, url, `Chave RSA de ${c.bits} bits. ${resumo}`));
    }
  }

  if (!info.autorizado && info.erroDeAutorizacao && !ERROS_DE_DATA.has(info.erroDeAutorizacao) && !ERROS_DE_NOME.has(info.erroDeAutorizacao)) {
    achados.push(finding(REGRAS.naoConfiavel, url, `Validação da cadeia falhou: ${info.erroDeAutorizacao}. ${resumo}`));
  }

  if (info.erroDeNome) {
    achados.push(finding(REGRAS.nomeDivergente, url, `${info.erroDeNome} Nomes no certificado: ${c?.subjectaltname ?? `CN=${nomeDe(c?.subject)}`}.`));
  }

  if (info.protocolo && PROTOCOLOS_OBSOLETOS.has(info.protocolo)) {
    achados.push(finding(REGRAS.protocoloObsoleto, url, `Protocolo negociado: ${info.protocolo}. ${resumo}`));
  }

  return achados;
}

export function avaliarSemHttps(url: string): CandidateFinding[] {
  return [finding(REGRAS.semHttps, url, `O alvo autorizado usa ${new URL(url).protocol.replace(":", "").toUpperCase()}: ${url}`)];
}

/** Handshake TLS real: devolve o que o servidor apresentou e fecha a conexão. */
export type ConectarTls = (host: string, porta: number, signal?: AbortSignal) => Promise<InfoTls>;

export const conectarTls: ConectarTls = (host, porta, signal) =>
  new Promise((resolver, rejeitar) => {
    const ehIp = /^[\d.]+$|:/.test(host);
    const socket = tls.connect({
      host,
      port: porta,
      // SNI só com nome: IP em SNI é proibido pela RFC 6066.
      servername: ehIp ? undefined : host,
      // Intencional: o sensor PRECISA ver certificados ruins para relatá-los (com true, um
      // autoassinado viraria "indisponível"). A conexão não transporta dado nenhum: fecha
      // logo após o handshake, e a validade da cadeia é lida de `socket.authorized`.
      rejectUnauthorized: false,
      minVersion: "TLSv1",
      ciphers: "DEFAULT:@SECLEVEL=0",
      timeout: TIMEOUT_MS,
    });
    const encerrar = () => socket.destroy();
    signal?.addEventListener("abort", () => {
      encerrar();
      rejeitar(Object.assign(new Error("abortado"), { name: "AbortError" }));
    });
    socket.once("timeout", () => {
      encerrar();
      rejeitar(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
    });
    socket.once("error", (erro) => {
      encerrar();
      rejeitar(erro);
    });
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      const temCert = !!cert && Object.keys(cert).length > 0;
      const erroDeNome = temCert && !ehIp ? (tls.checkServerIdentity(host, cert)?.message ?? null) : null;
      const autorizacao = socket.authorizationError;
      const info: InfoTls = {
        host,
        protocolo: socket.getProtocol(),
        cifra: socket.getCipher()?.name ?? null,
        autorizado: socket.authorized,
        erroDeAutorizacao: autorizacao ? String((autorizacao as Error & { code?: string }).code ?? autorizacao) : null,
        certificado: temCert ? cert : null,
        erroDeNome,
      };
      socket.end();
      resolver(info);
    });
  });

/** Resposta fixa do scan de DEMONSTRAÇÃO (nunca usada como fallback do modo real). */
function infoSimulada(host: string, agora: Date): InfoTls {
  return {
    host,
    protocolo: "TLSv1.2",
    cifra: "ECDHE-RSA-AES128-GCM-SHA256",
    autorizado: true,
    erroDeAutorizacao: null,
    certificado: {
      subject: { CN: host } as PeerCertificate["subject"],
      issuer: { CN: "AC Simulada de Demonstração" } as PeerCertificate["issuer"],
      valid_from: new Date(agora.getTime() - 340 * DIA_MS).toUTCString(),
      valid_to: new Date(agora.getTime() + 12 * DIA_MS).toUTCString(),
      subjectaltname: `DNS:${host}`,
      bits: 2048,
      asn1Curve: undefined as unknown as string,
    },
    erroDeNome: null,
  };
}

export class SslSensor implements Sensor {
  readonly key = "ssl" as const;

  constructor(private readonly conectar: ConectarTls = conectarTls) {}

  async run(ctx: SensorContext): Promise<SensorResult> {
    const url = new URL(ctx.targetUrl);
    if (url.protocol !== "https:") {
      return {
        status: "OK",
        message: "Alvo em HTTP: não há certificado para avaliar, e o tráfego não é criptografado.",
        findings: avaliarSemHttps(ctx.targetUrl),
      };
    }
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const porta = Number(url.port || 443);

    if (ctx.simulated) {
      const info = infoSimulada(host, new Date());
      return {
        status: "OK",
        message: `Resultado simulado (scan de demonstração): nenhuma conexão foi feita ao alvo. ${resumoDoCertificado(info)}`,
        findings: avaliarTls(ctx.targetUrl, info),
      };
    }

    try {
      const info = await this.conectar(host, porta, ctx.signal);
      return { status: "OK", message: resumoDoCertificado(info), findings: avaliarTls(ctx.targetUrl, info) };
    } catch (erro) {
      return { status: "UNAVAILABLE", message: `Não foi possível ler o certificado de ${host}:${porta}: ${motivoDeRede(erro)}.`, findings: [] };
    }
  }
}
