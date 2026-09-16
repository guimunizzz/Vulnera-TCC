/**
 * owasp-sync.service.ts
 *
 * Importa o catálogo OFICIAL da OWASP para os System Playbooks (CP-5).
 *
 * ==========================================================================
 * NÃO EXISTE ENDPOINT HTTP PARA ISTO (docs/DECISIONS.md D5)
 * ==========================================================================
 * O sync roda por CLI: `npm run sync:owasp-playbooks`. Um `fetch` ao GitHub
 * dentro de um request transformaria indisponibilidade do GitHub em
 * indisponibilidade do Vulnera — e daria a qualquer ADMIN um gatilho de
 * tráfego externo a partir da aplicação.
 *
 * ==========================================================================
 * SSRF: AS URLS SÃO CONSTANTES, NÃO CONFIGURAÇÃO
 * ==========================================================================
 * Nada aqui aceita URL de usuário, de env var ou de parâmetro. As fontes são
 * as quatro constantes abaixo, sob `raw.githubusercontent.com/OWASP/…`, e
 * `assertFonteOficial()` confere host e caminho ANTES de cada busca — mesmo
 * espírito do `validateTargetUrl` do `zap-runner.service.ts`.
 *
 * Mais defesas, porque conteúdo externo entra no produto:
 *   - só https, host e organização em allow-list;
 *   - redirect NÃO seguido (`redirect: "manual"`): um 302 para outro host é
 *     exatamente como se contorna uma allow-list;
 *   - timeout curto e teto de tamanho de resposta;
 *   - sanitização do Markdown antes de gravar — fonte oficial não é fonte
 *     confiável;
 *   - `sourceVersion` gravado, para uma mudança inesperada ser detectável.
 *
 * FALHA PARCIAL NÃO DESTRÓI O CATÁLOGO: cada categoria é independente; se
 * três falharem, as outras sete entram e o relatório diz quais não.
 *
 * NUNCA TOCA CUSTOM: só escreve por `upsertSystem`, cuja chave é
 * `[source, sourceKey]` — e `sourceKey` não existe em playbook de tenant.
 */

import type { RemediationPlaybookRepository } from "../repositories/remediation-playbook.repository";
import {
  OWASP_TOP10_2021,
  parseIndexTopTen,
  parseOwaspCategory,
  type OwaspReference,
  type ParsedOwaspCategory,
} from "../utils/owasp-parser.util";
import { sanitizeMarkdown } from "../utils/markdown-sanitize.util";

/* ==========================================================================
   Fontes — CONSTANTES. Não vêm de env, não vêm de parâmetro.
   ========================================================================== */

const HOST_PERMITIDO = "raw.githubusercontent.com";
const PREFIXOS_PERMITIDOS = [
  "https://raw.githubusercontent.com/OWASP/Top10/",
  "https://raw.githubusercontent.com/OWASP/CheatSheetSeries/",
];

/** pt-BR é o idioma do produto (D5); o `sourceUrl` aponta para o site oficial. */
const BASE_TOP10 = "https://raw.githubusercontent.com/OWASP/Top10/master/2021/docs/pt-BR";
const INDEX_TOP_TEN = "https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/IndexTopTen.md";
const SITE_TOP10 = "https://owasp.org/Top10";

const TIMEOUT_MS = 15_000;
/** Teto por resposta: o maior arquivo do Top 10 tem ~30 KB. 2 MB é folga com limite. */
const MAX_BYTES = 2 * 1024 * 1024;

export interface SyncResult {
  created: number;
  updated: number;
  failed: Array<{ category: string; reason: string }>;
  sourceVersion: string;
}

/** Barra qualquer URL que não seja das fontes oficiais. */
function assertFonteOficial(url: string): void {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error("INVALID_SOURCE_URL");
  }
  if (u.protocol !== "https:") throw new Error("INVALID_SOURCE_URL");
  if (u.hostname !== HOST_PERMITIDO) throw new Error("SOURCE_HOST_NOT_ALLOWED");
  if (!PREFIXOS_PERMITIDOS.some((p) => url.startsWith(p))) throw new Error("SOURCE_HOST_NOT_ALLOWED");
}

/**
 * Busca um arquivo de texto de uma fonte oficial.
 * `redirect: "manual"` de propósito: seguir um 302 para host arbitrário é
 * justamente como uma allow-list de host é contornada.
 */
async function buscarTexto(url: string): Promise<string> {
  assertFonteOficial(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: { Accept: "text/plain", "User-Agent": "Vulnera-OWASP-Sync" },
    });
    if (res.status >= 300 && res.status < 400) throw new Error("SOURCE_REDIRECT_REFUSED");
    if (!res.ok) throw new Error(`SOURCE_HTTP_${res.status}`);

    const tamanho = Number(res.headers.get("content-length") ?? 0);
    if (tamanho > MAX_BYTES) throw new Error("SOURCE_TOO_LARGE");

    const texto = await res.text();
    if (texto.length > MAX_BYTES) throw new Error("SOURCE_TOO_LARGE");
    return texto;
  } finally {
    clearTimeout(timer);
  }
}

export class OwaspSyncService {
  constructor(private readonly repository: RemediationPlaybookRepository) {}

  /**
   * Importa as dez categorias. Idempotente: rodar de novo produz o mesmo
   * estado (upsert por `[source, sourceKey]`).
   *
   * `buscar` é injetável para os testes exercitarem o pipeline inteiro —
   * parse, sanitização e gravação — sem tocar a rede.
   */
  async sync(
    opcoes: { buscar?: (url: string) => Promise<string>; sourceVersion?: string; dryRun?: boolean } = {},
  ): Promise<SyncResult> {
    const buscar = opcoes.buscar ?? buscarTexto;
    const sourceVersion = opcoes.sourceVersion ?? `2021@${new Date().toISOString().slice(0, 10)}`;
    const resultado: SyncResult = { created: 0, updated: 0, failed: [], sourceVersion };

    // O mapeamento oficial categoria → Cheat Sheets. Se ele falhar, o sync
    // continua sem os links: perder as folhas é aceitável, perder as dez
    // categorias não.
    let cheatSheets = new Map<string, OwaspReference[]>();
    try {
      cheatSheets = parseIndexTopTen(await buscar(INDEX_TOP_TEN));
    } catch {
      resultado.failed.push({ category: "IndexTopTen", reason: "não foi possível obter o mapeamento de Cheat Sheets" });
    }

    for (const cat of OWASP_TOP10_2021) {
      try {
        const markdown = await buscar(`${BASE_TOP10}/${encodeURIComponent(cat.file)}`);
        const parsed = parseOwaspCategory(markdown, cat.category);
        const existente = await this.existePorChave(cat.sourceKey);
        // --dry-run do CLI: baixa e parseia (é aí que os erros aparecem), sem gravar.
        if (!opcoes.dryRun) {
          await this.gravar(cat.sourceKey, cat.slug, parsed, cheatSheets.get(cat.category) ?? [], sourceVersion);
        }
        if (existente) resultado.updated++;
        else resultado.created++;
      } catch (e) {
        resultado.failed.push({ category: cat.category, reason: (e as Error).message });
      }
    }

    return resultado;
  }

  /**
   * Grava UMA categoria como System Playbook. Público para o seed offline
   * reutilizar exatamente o mesmo caminho de escrita — o catálogo semeado e o
   * sincronizado têm de ser indistinguíveis.
   */
  async gravar(
    sourceKey: string,
    slug: string,
    parsed: ParsedOwaspCategory,
    cheatSheets: OwaspReference[],
    sourceVersion: string,
  ): Promise<void> {
    // 🎯 Fonte oficial NÃO é fonte confiável: sanitiza igual ao conteúdo de usuário.
    const limpo = (v: string | null) => (v == null ? null : sanitizeMarkdown(v).value || null);

    const referencias = [...parsed.references, ...cheatSheets].slice(0, 50);

    await this.repository.upsertSystem(sourceKey, "OWASP_TOP10", {
      title: parsed.title,
      summary: limpo(parsed.overview),
      owaspCategory: parsed.category,
      cweIds: JSON.stringify(parsed.cweIds),
      rootCause: limpo(parsed.description),
      remediation: limpo(parsed.howToPrevent),
      validationSteps: null, // o Top 10 não traz passos de validação por categoria
      secureExample: limpo(parsed.exampleScenarios),
      compensatingControls: null,
      references: JSON.stringify(referencias),
      source: "OWASP_TOP10",
      sourceUrl: `${SITE_TOP10}/${slug}/`,
      sourceVersion,
      sourceKey,
      isSystem: true,
      companyId: null, // invariante: isSystem = true ⟺ companyId null
      createdBy: null,
    });
  }

  private async existePorChave(sourceKey: string): Promise<boolean> {
    const todos = await this.repository.list({ companyId: null, todasAsEmpresas: true, apenasSystem: true });
    return todos.some((p) => p.sourceKey === sourceKey);
  }
}

/**
 * Buscador oficial, exportado para o CLI de snapshot
 * (`npm run sync:owasp-playbooks -- --snapshot`) reusar a MESMA allow-list.
 * Reimplementar o fetch lá seria criar uma segunda porta sem as defesas.
 */
export { buscarTexto as fetchFonteOficial };

/** As URLs oficiais, para o snapshot saber o que baixar e o seed o que mapear. */
export const OWASP_SOURCES = { BASE_TOP10, INDEX_TOP_TEN, SITE_TOP10 };

/** Exportado para teste: a allow-list é parte do contrato de segurança. */
export const __testing = { assertFonteOficial, BASE_TOP10, INDEX_TOP_TEN };
