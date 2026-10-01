/**
 * owasp-parser.util.ts
 *
 * Extrai o conteúdo de uma categoria do OWASP Top 10 a partir do Markdown
 * OFICIAL publicado pela própria OWASP no GitHub. Funções PURAS: recebem
 * texto, devolvem estrutura. Nada de rede aqui — quem busca é o
 * `owasp-sync.service.ts`, e essa separação é o que permite testar o parser
 * com fixtures em vez de depender do GitHub numa suíte de testes.
 *
 * ==========================================================================
 * AS FONTES (docs/DECISIONS.md D5)
 * ==========================================================================
 * Não existe API estruturada da OWASP — e não é preciso. O conteúdo é
 * Markdown versionado, com estrutura de seções estável:
 *
 *   OWASP/Top10 → 2021/docs/pt-BR/A0X_2021-*.md
 *     ## Fatores | ## Visão Geral | ## Descrição | ## Como Prevenir
 *     ## Exemplos de Cenários de Ataque | ## Referências
 *     ## Lista dos CWEs Mapeados
 *
 *   OWASP/CheatSheetSeries → IndexTopTen.md
 *     ## [A03:2021 – Injection](url)
 *     - [Nome da Cheat Sheet](cheatsheets/Arquivo.md)
 *
 * ⚠️ O `IndexTopTen.md` é o que torna o mapeamento categoria→cheat sheet
 * DETERMINÍSTICO. Sem ele seria preciso adivinhar quais folhas pertencem a
 * cada categoria — ou seja, inventar um mapeamento e chamá-lo de OWASP.
 *
 * ⚠️ OS TÍTULOS DE SEÇÃO VARIAM ENTRE OS IDIOMAS. A tradução pt-BR usa
 * "Descrição"/"Como Prevenir"; o original usa "Description"/"How to Prevent".
 * O parser aceita os dois conjuntos, e uma seção ausente vira `null` em vez de
 * derrubar a importação inteira — um arquivo com heading faltando não pode
 * custar as outras nove categorias (D5: falha parcial não destrói o catálogo).
 */

/** As dez categorias do Top 10 2021. `sourceKey` é a chave estável do sync. */
export const OWASP_TOP10_2021 = [
  { category: "A01", sourceKey: "A01_2021", file: "A01_2021-Broken_Access_Control.md", slug: "A01_2021-Broken_Access_Control" },
  { category: "A02", sourceKey: "A02_2021", file: "A02_2021-Cryptographic_Failures.md", slug: "A02_2021-Cryptographic_Failures" },
  { category: "A03", sourceKey: "A03_2021", file: "A03_2021-Injection.md", slug: "A03_2021-Injection" },
  { category: "A04", sourceKey: "A04_2021", file: "A04_2021-Insecure_Design.md", slug: "A04_2021-Insecure_Design" },
  { category: "A05", sourceKey: "A05_2021", file: "A05_2021-Security_Misconfiguration.md", slug: "A05_2021-Security_Misconfiguration" },
  { category: "A06", sourceKey: "A06_2021", file: "A06_2021-Vulnerable_and_Outdated_Components.md", slug: "A06_2021-Vulnerable_and_Outdated_Components" },
  { category: "A07", sourceKey: "A07_2021", file: "A07_2021-Identification_and_Authentication_Failures.md", slug: "A07_2021-Identification_and_Authentication_Failures" },
  { category: "A08", sourceKey: "A08_2021", file: "A08_2021-Software_and_Data_Integrity_Failures.md", slug: "A08_2021-Software_and_Data_Integrity_Failures" },
  { category: "A09", sourceKey: "A09_2021", file: "A09_2021-Security_Logging_and_Monitoring_Failures.md", slug: "A09_2021-Security_Logging_and_Monitoring_Failures" },
  { category: "A10", sourceKey: "A10_2021", file: "A10_2021-Server-Side_Request_Forgery_(SSRF).md", slug: "A10_2021-Server-Side_Request_Forgery_(SSRF)" },
] as const;

export type OwaspCategoryCode = (typeof OWASP_TOP10_2021)[number]["category"];

/** Licença das fontes — aparece no produto, não só no banco (D5). */
export const OWASP_LICENSE = "CC BY-SA 4.0";
export const OWASP_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

export interface OwaspReference {
  title: string;
  url: string;
}

export interface ParsedOwaspCategory {
  category: string;
  title: string;
  /** "Visão Geral" — o resumo curto da categoria. */
  overview: string | null;
  /** "Descrição" — a causa raiz. */
  description: string | null;
  /** "Como Prevenir" — a remediação. */
  howToPrevent: string | null;
  /** "Exemplos de Cenários de Ataque". */
  exampleScenarios: string | null;
  /** CWEs do "Lista dos CWEs Mapeados", só os números ("79", "89"). */
  cweIds: string[];
  references: OwaspReference[];
}

/** Aceita o heading em pt-BR e em inglês — a mesma seção, dois idiomas. */
const SECOES = {
  overview: ["Visão Geral", "Visao Geral", "Overview"],
  description: ["Descrição", "Descricao", "Description"],
  howToPrevent: ["Como Prevenir", "How to Prevent"],
  exampleScenarios: ["Exemplos de Cenários de Ataque", "Exemplos de Cenarios de Ataque", "Example Attack Scenarios"],
  references: ["Referências", "Referencias", "References"],
  cwes: ["Lista dos CWEs Mapeados", "Lista de CWEs Mapeados", "List of Mapped CWEs"],
} as const;

/** Normaliza para comparar heading sem depender de acento ou caixa. */
function chave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Quebra o documento em seções de nível 2 (`## Título`).
 * Devolve um mapa normalizado → conteúdo bruto.
 */
function fatiarSecoes(markdown: string): Map<string, string> {
  const secoes = new Map<string, string>();
  // `^## ` em multiline: só headings de nível 2; `###` fica dentro do corpo.
  const partes = markdown.split(/^##\s+/m);
  for (const parte of partes.slice(1)) {
    const quebra = parte.indexOf("\n");
    if (quebra === -1) continue;
    const titulo = parte.slice(0, quebra).trim();
    secoes.set(chave(titulo), parte.slice(quebra + 1).trim());
  }
  return secoes;
}

/**
 * Assinaturas tolerantes, usadas quando o heading não bate exatamente.
 *
 * ⚠️ A TRADUÇÃO pt-BR NÃO É UNIFORME. Verificado no snapshot oficial: nove
 * categorias usam "Como Prevenir", "Exemplos de Cenários de Ataque" e "Lista
 * dos CWEs Mapeados"; o A10 usa "Como Previnir" (sic), "Cenário de exemplo de
 * um ataque" e "Lista de CWEs mapeadas".
 *
 * Listar essas três exceções como sinônimos resolveria HOJE e quebraria na
 * próxima revisão da tradução — e quebraria em silêncio, com o A10 entrando
 * sem remediação. Casar por assinatura (as palavras que importam, singular ou
 * plural, com ou sem o erro de grafia) sobrevive a variação de redação.
 */
const PADROES = {
  overview: /^(visao geral|overview)$/,
  description: /^(descricao|description)$/,
  // "prevenir" e "previnir"; "how to prevent"
  howToPrevent: /^(como prev[ei]nir|how to prevent)$/,
  // "exemplos de cenarios de ataque" e "cenario de exemplo de um ataque"
  exampleScenarios: /(cenario.*ataque|example attack scenario)/,
  references: /^(referencias|references)$/,
  // "lista dos cwes mapeados" e "lista de cwes mapeadas"
  cwes: /(cwes? mapead|mapped cwes)/,
} as const;

/**
 * Acha uma seção: primeiro por título exato (determinístico), depois pela
 * assinatura. Ausente vira `null` — nunca lança (D5).
 */
function buscarSecao(
  secoes: Map<string, string>,
  nomes: readonly string[],
  padrao?: RegExp,
): string | null {
  for (const nome of nomes) {
    const v = secoes.get(chave(nome));
    if (v) return v;
  }
  if (!padrao) return null;
  for (const [titulo, conteudo] of secoes) {
    if (padrao.test(titulo) && conteudo) return conteudo;
  }
  return null;
}

/**
 * Números de CWE de um bloco `- [CWE-79 Improper Neutralization...](url)`.
 * Só o número: o nome varia entre traduções e o número não.
 * Ordenado numericamente e sem repetição — a saída é estável entre execuções,
 * o que é o que torna o sync idempotente de verdade.
 */
export function extrairCwes(texto: string | null): string[] {
  if (!texto) return [];
  const encontrados = new Set<string>();
  for (const m of texto.matchAll(/CWE[-\s]?(\d{1,5})/gi)) encontrados.add(m[1]!);
  return Array.from(encontrados).sort((a, b) => Number(a) - Number(b));
}

/**
 * Links `- [Título](url)` de um bloco de referências.
 * Só `https://` entra: um link `javascript:` ou `data:` vindo de conteúdo
 * externo não tem por que chegar ao banco, quanto mais à tela.
 */
export function extrairReferencias(texto: string | null): OwaspReference[] {
  if (!texto) return [];
  const saida: OwaspReference[] = [];
  const vistos = new Set<string>();
  for (const m of texto.matchAll(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g)) {
    const url = m[2]!;
    if (vistos.has(url)) continue;
    vistos.add(url);
    saida.push({ title: m[1]!.trim(), url });
  }
  return saida;
}

/** O título da categoria — o `# A03:2021 – Injection` do topo do arquivo. */
export function extrairTitulo(markdown: string, fallback: string): string {
  const m = markdown.match(/^#\s+(.+)$/m);
  if (!m) return fallback;
  // O heading oficial traz o ícone da categoria e um atributo de estilo do
  // MkDocs no fim da linha:
  //   # A03:2021 – Injeção    ![icon](assets/...png){: style="height:80px"...}
  // Sem limpar isso, o título do playbook na tela viraria a marcação crua.
  const limpo = m[1]!
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\{:[^}]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return limpo || fallback;
}

/**
 * Converte o Markdown de UMA categoria na estrutura do playbook.
 * Seção ausente vira `null`; nunca lança (D5: falha parcial não destrói o
 * catálogo — uma categoria incompleta é melhor que nenhuma).
 */
export function parseOwaspCategory(markdown: string, category: string): ParsedOwaspCategory {
  const secoes = fatiarSecoes(markdown);
  const referencias = buscarSecao(secoes, SECOES.references, PADROES.references);
  const cwes = buscarSecao(secoes, SECOES.cwes, PADROES.cwes);
  return {
    category,
    title: extrairTitulo(markdown, `${category}:2021`),
    overview: buscarSecao(secoes, SECOES.overview, PADROES.overview),
    description: buscarSecao(secoes, SECOES.description, PADROES.description),
    howToPrevent: buscarSecao(secoes, SECOES.howToPrevent, PADROES.howToPrevent),
    exampleScenarios: buscarSecao(secoes, SECOES.exampleScenarios, PADROES.exampleScenarios),
    cweIds: extrairCwes(cwes),
    references: extrairReferencias(referencias),
  };
}

/**
 * O mapeamento OFICIAL categoria → Cheat Sheets, do `IndexTopTen.md`.
 *
 * Formato esperado:
 *   ## [A03:2021 – Injection](https://owasp.org/Top10/A03_2021-Injection/)
 *   - [SQL Injection Prevention Cheat Sheet](cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.md)
 *
 * Os links são RELATIVOS no arquivo; viram absolutos para o site oficial das
 * Cheat Sheets, que é onde a pessoa vai querer clicar. A v1 guarda o LINK,
 * não o conteúdo das ~122 folhas (D5).
 */
export function parseIndexTopTen(markdown: string): Map<string, OwaspReference[]> {
  const saida = new Map<string, OwaspReference[]>();
  // ⚠️ O IndexTopTen.md tem ONZE seções: as dez categorias e um
  // "A11:2021 – Next Steps", que NÃO é categoria do Top 10. Sem este filtro,
  // um "A11" entraria no mapa e o catálogo teria uma categoria que a OWASP
  // não publica.
  const conhecidas = new Set<string>(OWASP_TOP10_2021.map((c) => c.category));
  const partes = markdown.split(/^##\s+/m);
  for (const parte of partes.slice(1)) {
    const cabecalho = parte.slice(0, parte.indexOf("\n"));
    const categoria = cabecalho.match(/A(\d{2}):?\s*2021/i);
    if (!categoria) continue;
    if (!conhecidas.has(`A${categoria[1]}`)) continue;
    const codigo = `A${categoria[1]}`;
    const folhas: OwaspReference[] = [];
    for (const m of parte.matchAll(/-\s*\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      const bruto = m[2]!;
      const url = bruto.startsWith("http")
        ? bruto
        : `https://cheatsheetseries.owasp.org/cheatsheets/${bruto.replace(/^.*\//, "").replace(/\.md$/, ".html")}`;
      if (!url.startsWith("https://")) continue;
      folhas.push({ title: m[1]!.trim(), url });
    }
    if (folhas.length > 0) saida.set(codigo, folhas);
  }
  return saida;
}
