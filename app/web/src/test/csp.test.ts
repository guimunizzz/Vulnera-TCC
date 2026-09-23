/**
 * csp.test.ts
 *
 * A terceira camada de defesa do CP-5 (`config/csp.ts`).
 *
 * 🎯 O QUE ESTE ARQUIVO REALMENTE PROTEGE não é o formato do header: é a
 * honestidade dele. Uma CSP com `'unsafe-inline'` em `script-src`, ou com um
 * hash que não corresponde ao script realmente servido, tem toda a aparência
 * de proteção e nenhuma proteção. Os testes abaixo falham nos dois casos.
 *
 *   CSP-01  script-src é estrita: 'self' + hash, nunca 'unsafe-inline'
 *   CSP-02  o hash cobre o script de tema do index.html REAL
 *   CSP-03  diretivas de contenção presentes (frame-ancestors, object-src…)
 *   CSP-04  connect-src leva a ORIGEM da API, não a URL com caminho
 *   CSP-05  style-src 'unsafe-inline' é a única concessão, e é consciente
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsp, hashDeScript, hashesDosScriptsInline, origemDe } from "../../config/csp";

const RAIZ_WEB = join(__dirname, "..", "..");
const indexHtml = (): string => readFileSync(join(RAIZ_WEB, "index.html"), "utf-8");

/** Extrai o valor de uma diretiva do header montado. */
function diretiva(csp: string, nome: string): string[] {
  const parte = csp.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${nome} `));
  return parte ? parte.slice(nome.length + 1).split(/\s+/) : [];
}

describe("Content-Security-Policy (CP-5)", () => {
  it("CSP-01 script-src é estrita: nada de 'unsafe-inline' nem 'unsafe-eval'", () => {
    const csp = buildCsp({ scriptHashes: hashesDosScriptsInline(indexHtml()) });
    const scriptSrc = diretiva(csp, "script-src");

    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    // Sem curinga: `*` ou `https:` em script-src anularia a diretiva.
    expect(scriptSrc).not.toContain("*");
    expect(scriptSrc).not.toContain("https:");
  });

  it("CSP-02 o hash corresponde ao script de tema do index.html real", () => {
    const html = indexHtml();
    const hashes = hashesDosScriptsInline(html);

    // O index.html tem exatamente um script inline: o que estampa o tema antes
    // do primeiro paint. Se alguém adicionar outro, este teste avisa.
    expect(hashes).toHaveLength(1);

    // E o hash é o do conteúdo REAL, recalculado aqui a partir do arquivo.
    const corpo = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i)![1];
    expect(hashes[0]).toBe(hashDeScript(corpo));
    expect(hashes[0]).toMatch(/^'sha256-[A-Za-z0-9+/]+=*'$/);

    expect(diretiva(buildCsp({ scriptHashes: hashes }), "script-src")).toContain(hashes[0]);
  });

  it("CSP-03 as diretivas de contenção estão presentes", () => {
    const csp = buildCsp();
    expect(diretiva(csp, "default-src")).toEqual(["'self'"]);
    expect(diretiva(csp, "frame-ancestors")).toEqual(["'none'"]); // anti-clickjacking
    expect(diretiva(csp, "object-src")).toEqual(["'none'"]);
    expect(diretiva(csp, "frame-src")).toEqual(["'none'"]);
    expect(diretiva(csp, "base-uri")).toEqual(["'self'"]); // impede sequestro de URL relativa
    expect(diretiva(csp, "form-action")).toEqual(["'self'"]);
  });

  it("CSP-04 connect-src recebe a ORIGEM da API, não a URL com caminho", () => {
    const csp = buildCsp({ apiUrl: "http://localhost:3001/api" });
    const connect = diretiva(csp, "connect-src");
    expect(connect).toContain("'self'");
    expect(connect).toContain("http://localhost:3001");
    expect(connect.join(" ")).not.toContain("/api");

    // URL inválida não vira lixo na política.
    expect(diretiva(buildCsp({ apiUrl: "nao-e-url" }), "connect-src")).toEqual(["'self'"]);
    expect(origemDe(undefined)).toBeNull();
  });

  it("CSP-05 style-src 'unsafe-inline' é a única concessão", () => {
    const csp = buildCsp({ scriptHashes: hashesDosScriptsInline(indexHtml()) });
    // Concessão consciente: o design system usa style={{…}} em dezenas de
    // componentes. Estilo inline não executa JavaScript.
    expect(diretiva(csp, "style-src")).toContain("'unsafe-inline'");

    // E em nenhuma outra diretiva além de style-src.
    const comUnsafe = csp
      .split(";")
      .map((p) => p.trim())
      .filter((p) => p.includes("'unsafe-inline'"))
      .map((p) => p.split(" ")[0]);
    expect(comUnsafe).toEqual(["style-src"]);
  });
});
