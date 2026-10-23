/**
 * findings-excel.ts
 *
 * O QUE FAZ
 * As partes PURAS da exportação Excel: que parâmetros viajam, que nome o
 * arquivo recebe e o que dizer à pessoa quando a exportação falha. Zero React,
 * zero DOM — quem baixa e avisa é `use-findings-excel-export.ts`.
 *
 * 🎯 O RECORTE É O DA TELA, NÃO O DA PÁGINA
 * Os parâmetros são os mesmos que alimentam a tabela (filtros, busca,
 * ordenação). Só `page` e `pageSize` saem: exportar é levar o recorte INTEIRO,
 * e quem filtra "críticos abertos" na página 3 espera todos eles no arquivo.
 * A filtragem é do servidor — aqui nada é filtrado sobre linhas carregadas.
 *
 * QUEM USA
 * `hooks/use-findings-excel-export.ts`.
 */

import { isAxiosError } from "axios";

/** Os parâmetros da view atual, menos a paginação. Devolve uma CÓPIA: o original é o estado da tela. */
export function paramsDaExportacao(params: URLSearchParams): URLSearchParams {
  const copia = new URLSearchParams(params);
  copia.delete("page");
  copia.delete("pageSize");
  return copia;
}

/** `AAAA-MM-DD_HHmm` no relógio local — só para quando a API não manda o nome. */
function carimbo(agora: Date): string {
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}_${dois(agora.getHours())}${dois(agora.getMinutes())}`;
}

export function nomeDeArquivoPadrao(agora: Date = new Date()): string {
  return `findings_${carimbo(agora)}.xlsx`;
}

/**
 * O nome do arquivo vem do header `Content-Disposition` — é o servidor quem
 * sabe o escopo (`todos`, `filtrado` ou o projeto). Aceita `filename*=UTF-8''`
 * e `filename="..."`.
 *
 * ⚠️ O nome vem de fora, então é saneado antes de virar atributo `download`:
 * sem separadores de caminho, sem caractere de controle, sempre `.xlsx`. Header
 * ausente (CORS mal configurado, proxy) cai num nome gerado aqui — a exportação
 * não deve falhar por causa de um header.
 */
export function nomeDoArquivoDoHeader(contentDisposition: string | undefined, padrao: () => string = nomeDeArquivoPadrao): string {
  if (!contentDisposition) return padrao();

  const estendido = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(contentDisposition);
  const simples = /filename\s*=\s*"?([^";]+)"?/i.exec(contentDisposition);
  let nome: string | undefined;
  try {
    nome = estendido ? decodeURIComponent(estendido[1]!.trim()) : simples?.[1]?.trim();
  } catch {
    nome = simples?.[1]?.trim();
  }
  if (!nome) return padrao();

  // eslint-disable-next-line no-control-regex
  const limpo = nome.replace(/[\u0000-\u001F\u007F]/g, "").replace(/[\\/:*?"<>|]+/g, "_").replace(/^\.+/, "").trim();
  if (!limpo) return padrao();
  return /\.xlsx$/i.test(limpo) ? limpo : `${limpo}.xlsx`;
}

/* ==========================================================================
   Erros
   ========================================================================== */

export interface ErroDeExportacao {
  titulo: string;
  descricao: string;
  /** Repetir resolve? Falha transitória, sim; limite ou permissão, não — oferecer "tentar novamente" seria mentir. */
  podeTentarDeNovo: boolean;
}

const GENERICO: ErroDeExportacao = {
  titulo: "Não foi possível exportar",
  descricao: "A exportação não chegou ao fim. Tente de novo em instantes.",
  podeTentarDeNovo: true,
};

/**
 * Com `responseType: "blob"` o corpo de um erro também chega como Blob — o JSON
 * da API (`{ error, limit, total }`) precisa ser lido de volta para virar mensagem.
 */
async function lerCorpoDeErro(dados: unknown): Promise<{ error?: string; limit?: number; total?: number } | null> {
  try {
    const texto =
      typeof Blob !== "undefined" && dados instanceof Blob
        ? typeof dados.text === "function"
          ? await dados.text()
          : await new Promise<string>((resolve, reject) => {
              const leitor = new FileReader();
              leitor.onload = () => resolve(String(leitor.result));
              leitor.onerror = () => reject(leitor.error);
              leitor.readAsText(dados);
            })
        : typeof dados === "string"
          ? dados
          : JSON.stringify(dados ?? null);
    const json = JSON.parse(texto);
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}

const numero = (n: number) => n.toLocaleString("pt-BR");

/** Traduz o que a API respondeu na mensagem que a pessoa lê. Nunca expõe código HTTP nem corpo cru. */
export async function interpretarErroDeExportacao(erro: unknown): Promise<ErroDeExportacao> {
  if (!isAxiosError(erro) || !erro.response) return GENERICO; // sem resposta: rede caiu, servidor fora

  const { status, data, headers } = erro.response;
  const corpo = await lerCorpoDeErro(data);

  if (status === 422 && corpo?.error === "EXPORT_LIMIT_EXCEEDED" && typeof corpo.total === "number" && typeof corpo.limit === "number") {
    return {
      titulo: "Recorte grande demais para exportar",
      descricao: `O recorte tem ${numero(corpo.total)} findings e o limite por exportação é ${numero(corpo.limit)}. Aplique mais filtros e tente de novo.`,
      podeTentarDeNovo: false,
    };
  }
  if (status === 429) {
    const segundos = Number(headers?.["retry-after"]);
    return {
      titulo: "Muitas exportações seguidas",
      descricao:
        Number.isFinite(segundos) && segundos > 0
          ? `Aguarde ${Math.ceil(segundos)} ${Math.ceil(segundos) === 1 ? "segundo" : "segundos"} e tente de novo.`
          : "Aguarde um instante e tente de novo.",
      podeTentarDeNovo: true,
    };
  }
  if (status === 403 || status === 404) {
    return { titulo: "Sem acesso a este recorte", descricao: "Você não tem permissão para exportar estes findings.", podeTentarDeNovo: false };
  }
  if (status === 400) {
    return { titulo: "Filtro inválido", descricao: "Ajuste os filtros da tabela e tente de novo.", podeTentarDeNovo: false };
  }
  if (status === 409) {
    return { titulo: "Os dados mudaram", descricao: "Os findings mudaram durante a exportação. Tente de novo.", podeTentarDeNovo: true };
  }
  return GENERICO;
}
