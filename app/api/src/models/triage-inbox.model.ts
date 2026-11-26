/**
 * triage-inbox.model.ts
 *
 * O QUE FAZ
 * A caixa de triagem única (ADR-062): os achados que ainda esperam triagem
 * (`triageStatus = NEW`) das três fontes que têm triagem — DAST, SAST/SCA e
 * Threat Intel — numa lista só, na mesma escala de severidade, do mais grave
 * para o mais novo. Tipos, DTO e as regras puras (testadas sem banco).
 *
 * O QUE NÃO FAZ
 * Não tria: a ação continua nos PATCH de cada fonte, com a regra de cada uma.
 * A caixa só junta o que o ator já podia ver e triar em cada tela.
 *
 * QUEM USA
 * `triage-inbox.service.ts` e os testes de unidade.
 */

export type FonteDeTriagem = "DAST" | "CODIGO" | "THREAT_INTEL";
export type SeveridadeDaCaixa = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface ItemDaCaixaDTO {
  fonte: FonteDeTriagem;
  /** Id do achado/casamento: o alvo do PATCH .../triage da fonte. */
  id: string;
  titulo: string;
  severidade: SeveridadeDaCaixa;
  /** Onde o achado está ("loja.technova.com.br · /login", "Portal · semgrep · src/app.js:42"). */
  contexto: string;
  /** Trecho para decidir sem abrir (descrição, CVE, pacote). */
  detalhe: string | null;
  criadoEm: string;
  /** Tela onde o achado vive, para abrir no contexto. */
  link: string;
  /** Só Threat Intel: a empresa do casamento (o PATCH dela pede o escopo). */
  companyId: string | null;
}

export interface CaixaDeTriagemDTO {
  geradoEm: string;
  /** Quantos itens cada fonte devolveu; igual a `limitePorFonte` quando a fonte tem mais do que isso. */
  porFonte: Record<FonteDeTriagem, number>;
  total: number;
  /** O corte por fonte, para a tela dizer "200+" em vez de um número que parece exato. */
  limitePorFonte: number;
  itens: ItemDaCaixaDTO[];
}
/** Tetos de busca por fonte — a caixa olha o trabalho recente, não o histórico inteiro. */
export const LIMITE_DE_SCANS = 30;
export const LIMITE_DE_IMPORTACOES = 60;
export const LIMITE_DE_EMPRESAS = 10;
/**
 * Corte por fonte (os mais graves e recentes). Não há corte global: o filtro por
 * fonte é feito na tela e precisaria dos itens de cada uma — no máximo 3 × 200.
 */
export const LIMITE_POR_FONTE = 200;

const RANK: Record<SeveridadeDaCaixa, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

/** Normaliza a severidade de qualquer fonte para a escala da caixa (desconhecida vira INFO). */
export function severidadeDaCaixa(bruta: string | null | undefined): SeveridadeDaCaixa {
  const s = (bruta ?? "").toUpperCase();
  return s in RANK ? (s as SeveridadeDaCaixa) : "INFO";
}

/** Mais grave primeiro; na mesma severidade, o mais novo (acabou de chegar). */
export function ordenarItens(itens: ItemDaCaixaDTO[]): ItemDaCaixaDTO[] {
  return [...itens].sort(
    (a, b) => RANK[a.severidade] - RANK[b.severidade] || Date.parse(b.criadoEm) - Date.parse(a.criadoEm) || a.id.localeCompare(b.id),
  );
}

/**
 * Das importações visíveis, só a última de cada (projeto, ferramenta): é o
 * estado atual do código. Achado NEW de importação antiga já foi substituído
 * pela nova (que herda a triagem, ADR-052) — não é trabalho pendente.
 */
export function ultimasImportacoes<T extends { id: string; projectId: string; toolName: string; createdAt: string }>(importacoes: T[]): T[] {
  const ultima = new Map<string, T>();
  for (const imp of importacoes) {
    const chave = `${imp.projectId}|${imp.toolName}`;
    const atual = ultima.get(chave);
    if (!atual || Date.parse(imp.createdAt) > Date.parse(atual.createdAt) || (imp.createdAt === atual.createdAt && imp.id > atual.id)) {
      ultima.set(chave, imp);
    }
  }
  return [...ultima.values()];
}

/** O caminho da URL sem o host, para o contexto do DAST caber numa linha. */
export function caminhoDaUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url;
  }
}

/** Texto curto: a caixa mostra uma linha, não a descrição inteira. */
export function resumir(texto: string | null | undefined, limite = 220): string | null {
  if (!texto) return null;
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (!limpo) return null;
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo;
}
