/**
 * config/csp.ts
 *
 * Monta a Content-Security-Policy que o `vite preview` envia — o mesmo modo
 * que o Dockerfile usa para servir o web (ADR-022) e o mesmo alvo que o OWASP
 * ZAP escaneia na porta 8086.
 *
 * ==========================================================================
 * POR QUE ESTE ARQUIVO EXISTE (CP-5)
 * ==========================================================================
 * O catálogo de remediação renderiza MARKDOWN DE TERCEIROS: conteúdo da OWASP
 * e conteúdo escrito por usuários de outras empresas. Isso é a maior
 * superfície de XSS armazenado do produto, e a resposta são três camadas
 * independentes:
 *
 *   1. ESCRITA      `markdown-sanitize.util.ts` na API — o perigoso não entra.
 *   2. RENDERIZAÇÃO `lib/markdown.ts` — marked sem HTML bruto + DOMPurify.
 *   3. NAVEGADOR    esta CSP — se as duas primeiras falharem, o script não roda.
 *
 * ==========================================================================
 * ⚠️ ESTA CSP É APLICADA DE VERDADE — E É POR ISSO QUE ELA É ASSIM
 * ==========================================================================
 * Uma política escrita para impressionar, que quebrasse a aplicação e fosse
 * removida na véspera da demo, valeria zero. Então:
 *
 *   `script-src 'self' + hash`   NADA de 'unsafe-inline' aqui: é justamente o
 *                                que impediria um `<script>` injetado de
 *                                rodar. O único inline do produto é o script
 *                                de tema do index.html, e ele entra pelo HASH
 *                                do conteúdo REALMENTE SERVIDO — recalculado a
 *                                cada boot, nunca copiado à mão.
 *   `style-src 'unsafe-inline'`  CONCESSÃO CONSCIENTE. O design system usa
 *                                `style={{…}}` em dezenas de componentes.
 *                                Estilo inline não executa JavaScript; o custo
 *                                real é permitir exfiltração por CSS, muito
 *                                abaixo do ganho de manter script-src estrita.
 *   `connect-src`                só a própria origem e a da API.
 *   `frame-ancestors 'none'`     anti-clickjacking, agora no padrão moderno
 *                                (o X-Frame-Options segue junto por herança).
 *   `object-src 'none'`          não há plugin nenhum no produto.
 *
 * NO SERVIDOR DE DESENVOLVIMENTO NÃO SE APLICA CSP, de propósito: o
 * `@vitejs/plugin-react` injeta um preâmbulo inline de Fast Refresh que muda a
 * cada boot. Fingir cobrir o dev exigiria 'unsafe-inline' em script-src — ou
 * seja, uma CSP que não protege, com aparência de proteção.
 */

import { createHash } from "node:crypto";

/** O hash CSP de um trecho de script inline: `'sha256-<base64>'`. */
export function hashDeScript(conteudo: string): string {
  // O parser HTML normaliza CRLF para LF antes de executar o script. Fazer o
  // hash dos bytes crus bloquearia o tema no primeiro paint em checkout Windows.
  const interpretadoPeloNavegador = conteudo.replace(/\r\n?/g, "\n");
  return `'sha256-${createHash("sha256").update(interpretadoPeloNavegador, "utf-8").digest("base64")}'`;
}

/**
 * Hashes de TODOS os scripts inline de um HTML.
 *
 * Lê o HTML servido em vez de guardar o hash numa constante: um hash colado à
 * mão vira mentira silenciosa no dia em que alguém editar o script de tema — a
 * página continuaria abrindo, só que sem tema, e ninguém ligaria a causa ao
 * efeito.
 */
export function hashesDosScriptsInline(html: string): string[] {
  const hashes: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const corpo = m[1] ?? "";
    if (corpo.trim()) hashes.push(hashDeScript(corpo));
  }
  return hashes;
}

/** A origem de uma URL de API (`http://host:3001/api` → `http://host:3001`). */
export function origemDe(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export interface OpcoesCsp {
  /** VITE_API_URL — entra em `connect-src` como ORIGEM, não como caminho. */
  apiUrl?: string;
  /** Hashes dos scripts inline do HTML realmente servido. */
  scriptHashes?: string[];
}

/** Monta o valor do header `Content-Security-Policy`. */
export function buildCsp({ apiUrl, scriptHashes = [] }: OpcoesCsp = {}): string {
  const apiOrigem = origemDe(apiUrl);

  // A API pode estar em http (localhost na demo); o navegador bloquearia a
  // chamada de qualquer forma se a página fosse https. Declarar a origem exata
  // é melhor que abrir `http:` inteiro.
  const connect = ["'self'", apiOrigem].filter(Boolean) as string[];

  const diretivas: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["base-uri", ["'self'"]],
    ["object-src", ["'none'"]],
    ["frame-ancestors", ["'none'"]],
    ["form-action", ["'self'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'", "data:"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["script-src", ["'self'", ...scriptHashes]],
    ["connect-src", connect],
    // O produto não embute nada e não abre worker de outra origem.
    ["worker-src", ["'self'", "blob:"]],
    ["frame-src", ["'none'"]],
  ];

  return diretivas.map(([nome, valores]) => `${nome} ${valores.join(" ")}`).join("; ");
}
