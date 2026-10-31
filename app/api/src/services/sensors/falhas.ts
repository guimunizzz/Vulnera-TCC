/**
 * falhas.ts
 *
 * Traduz o erro técnico de rede/TLS de um sensor em uma frase que a pessoa
 * consegue agir sobre ("o domínio não existe", "a porta recusou"), em vez de
 * `ECONNREFUSED`. O código técnico continua no fim, entre parênteses, para quem
 * for investigar.
 */

const MOTIVOS: Record<string, string> = {
  ENOTFOUND: "o domínio não foi encontrado no DNS — confira se o endereço está certo",
  EAI_AGAIN: "o DNS não respondeu a tempo — tente de novo em instantes",
  ECONNREFUSED: "a porta do alvo recusou a conexão — o serviço pode estar parado",
  ECONNRESET: "o alvo encerrou a conexão no meio da resposta",
  EHOSTUNREACH: "o alvo não é alcançável a partir do servidor do Vulnera",
  ENETUNREACH: "a rede do alvo não é alcançável a partir do servidor do Vulnera",
  ETIMEDOUT: "o alvo não respondeu dentro do tempo limite",
  UND_ERR_CONNECT_TIMEOUT: "o alvo não respondeu dentro do tempo limite",
  TimeoutError: "o alvo não respondeu dentro do tempo limite",
  AbortError: "a análise foi interrompida (cancelamento ou tempo máximo do scan)",
  EPROTO: "o endereço não respondeu com TLS — a porta pode estar falando HTTP sem criptografia",
  ERR_SSL_WRONG_VERSION_NUMBER: "o endereço não respondeu com TLS — a porta pode estar falando HTTP sem criptografia",
};

/** Código mais específico disponível: `cause.code` (fetch/undici), `code` (net/tls) ou o nome do erro. */
export function codigoDoErro(erro: unknown): string {
  const e = erro as { code?: string; name?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code ?? e?.name ?? "ERRO_DESCONHECIDO";
}

export function motivoDeRede(erro: unknown): string {
  const codigo = codigoDoErro(erro);
  return `${MOTIVOS[codigo] ?? "falha de rede ao falar com o alvo"} (${codigo})`;
}
