/**
 * markdown.ts
 *
 * Converte o Markdown de um playbook (CP-5) em HTML seguro para a tela.
 * Quem usa: `components/playbooks/playbook-viewer.tsx` e o bloco "Como
 * corrigir" do detalhe do finding.
 *
 * ==========================================================================
 * POR QUE marked + DOMPurify, E NÃO UM SANITIZADOR PRÓPRIO
 * ==========================================================================
 * Porque escrever um sanitizador de HTML é um problema conhecido por ser
 * difícil e por falhar em silêncio: o `mXSS` explora justamente a diferença
 * entre como a sua regex lê a marcação e como o parser do navegador a lê. O
 * DOMPurify resolve isso da única forma correta — parseando com o próprio
 * navegador e removendo o que não estiver na allow-list.
 *
 * A DEFESA TEM TRÊS CAMADAS INDEPENDENTES:
 *   1. ESCRITA      a API sanitiza antes de gravar (`markdown-sanitize.util.ts`)
 *   2. AQUI         marked sem HTML bruto + DOMPurify com allow-list restritiva
 *   3. NAVEGADOR    CSP com `script-src` sem 'unsafe-inline' (`config/csp.ts`)
 *
 * Nenhuma delas é suficiente sozinha, e é por isso que existem as três: um
 * playbook gravado antes de a camada 1 existir passa pela 2; um furo na 2 é
 * contido pela 3.
 *
 * ==========================================================================
 * DECISÕES DESTE ARQUIVO
 * ==========================================================================
 * HTML BRUTO É ESCAPADO, NÃO REMOVIDO. Um playbook precisa poder MOSTRAR
 * `<script>alert(1)</script>` como exemplo do ataque. Sumir com o trecho
 * mutilaria o conteúdo; escapar mostra o texto literal, que é o que se quer.
 * A ÚNICA exceção é `<br>` — o Markdown oficial da OWASP a usa dentro de
 * listas, ela não carrega atributo nem conteúdo, e escapá-la fazia
 * "&lt;br&gt;" aparecer no meio da instrução de correção.
 *
 * LINK EXTERNO SÓ https. Um `href` que não seja https (ou âncora interna) vira
 * link morto: uma referência de segurança que chega por canal não autenticado
 * é uma contradição. Todo link externo sai com `rel="noopener noreferrer"` —
 * sem `noopener`, a página de destino recebe `window.opener` e pode reescrever
 * a aba de origem (tabnabbing).
 */

import DOMPurify from "dompurify";
import { marked } from "marked";

/** Escapa HTML bruto embutido no Markdown — preserva o texto, remove o poder. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

marked.use({
  gfm: true,
  // `breaks: false` é o comportamento padrão do Markdown: quebra simples não
  // vira <br>. O conteúdo da OWASP conta com isso nos parágrafos longos.
  breaks: false,
  renderer: {
    html(token: { text?: string; raw?: string }) {
      const bruto = String(token.text ?? token.raw ?? "");
      // `<br>` é a ÚNICA tag bruta preservada, e por um motivo concreto: o
      // Markdown oficial da OWASP a usa dentro de listas (o A03 tem duas), e
      // escapá-la faz "&lt;br&gt;" aparecer como texto no meio da instrução de
      // correção — foi o que a captura de evidência mostrou. Ela não carrega
      // atributo nem conteúdo, então não é vetor; e o DOMPurify já a tem na
      // allow-list. Qualquer outra tag continua virando texto.
      if (/^\s*<br\s*\/?>\s*$/i.test(bruto)) return "<br>";
      return escaparHtml(bruto);
    },
  },
});

/** As tags que um playbook precisa — e só elas. */
const TAGS_PERMITIDAS = [
  "p", "br", "hr",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "strong", "em", "del", "code", "pre",
  "blockquote", "a",
  "table", "thead", "tbody", "tr", "th", "td",
  "span",
];

/** Atributos permitidos. Nada de `style`, `id` ou `on*`. */
const ATRIBUTOS_PERMITIDOS = ["href", "title", "class", "align", "colspan", "rowspan"];

/** `https://` ou âncora interna (`#secao`). Nada mais vira link clicável. */
function ehHrefSeguro(href: string): boolean {
  if (href.startsWith("#")) return true;
  try {
    return new URL(href).protocol === "https:";
  } catch {
    return false;
  }
}

let hookRegistrado = false;

/**
 * Registrado uma vez por sessão (o DOMPurify é um singleton de módulo).
 * Roda DEPOIS da sanitização de atributos, quando o `href` já é o que de fato
 * iria para o DOM — checar antes deixaria passar variações de escape.
 */
function registrarHook(): void {
  if (hookRegistrado) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (!(node instanceof Element) || node.tagName !== "A") return;
    const href = node.getAttribute("href") ?? "";
    if (!ehHrefSeguro(href)) {
      node.removeAttribute("href");
      return;
    }
    if (href.startsWith("#")) return;
    // Link externo abre em outra aba SEM entregar window.opener à página de destino.
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  });
  hookRegistrado = true;
}

/**
 * Markdown de playbook → HTML seguro para `dangerouslySetInnerHTML`.
 *
 * O nome dessa prop do React é um aviso legítimo, e ele continua valendo: o
 * HTML aqui é seguro porque passou por ESTA função, não porque veio da API.
 */
export function renderPlaybookMarkdown(markdown: string | null | undefined): string {
  if (!markdown) return "";
  registrarHook();

  const html = marked.parse(markdown, { async: false }) as string;

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TAGS_PERMITIDAS,
    ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
    // `target` é adicionado pelo hook acima; sem isto o DOMPurify o removeria.
    ADD_ATTR: ["target"],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    // Sem isto, `<a><svg>` e afins poderiam ressuscitar por caminhos de namespace.
    USE_PROFILES: { html: true },
  });
}

/** Resumo em texto puro (tooltip, `<title>`, prévia de lista). */
export function markdownParaTexto(markdown: string | null | undefined, limite = 240): string {
  if (!markdown) return "";
  const texto = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
}
