/**
 * owasp-parser.util.test.ts (unit)
 *
 * O parser do conteúdo oficial da OWASP (CP-5). Funções puras: nada de rede,
 * nada de banco.
 *
 * 🎯 ESTES TESTES RODAM CONTRA O SNAPSHOT REAL em `prisma/seeds/owasp/`, não
 * contra fixtures inventadas. É de propósito: o valor do parser é casar com o
 * Markdown que a OWASP publica de verdade, e um fixture escrito por mim
 * provaria apenas que o parser casa comigo mesmo. Como o snapshot é o MESMO
 * arquivo que alimenta o seed offline, uma regressão aqui é exatamente a
 * regressão que apareceria na demo.
 *
 *   OWASP-P-01  as dez categorias do snapshot parseiam com conteúdo real
 *   OWASP-P-02  o A10 é o caso difícil: headings divergentes da tradução
 *   OWASP-P-03  título sai limpo do ícone e do atributo do MkDocs
 *   OWASP-P-04  CWEs: só número, sem repetição, ordenado
 *   OWASP-P-05  referências: só https, sem repetição
 *   OWASP-P-06  seção ausente vira null — nunca lança
 *   OWASP-P-07  IndexTopTen mapeia categoria → Cheat Sheets com URL absoluta
 *   OWASP-P-08  o snapshot bate com o MANIFEST (sha256) — conteúdo não editado à mão
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OWASP_TOP10_2021,
  extrairCwes,
  extrairReferencias,
  extrairTitulo,
  parseIndexTopTen,
  parseOwaspCategory,
} from "../../src/utils/owasp-parser.util";

const DIR = join(__dirname, "..", "..", "prisma", "seeds", "owasp");
const ler = (nome: string): string => readFileSync(join(DIR, nome), "utf-8");

interface Manifest {
  sourceVersion: string;
  files: Array<{ url: string; file: string; sha256: string; bytes: number }>;
}

/**
 * O MANIFEST é gerado sobre bytes LF, independentemente do sistema que
 * executa a suíte. O checkout Windows pode materializar o mesmo Markdown em
 * CRLF por `core.autocrlf`; normalizar apenas finais de linha preserva o
 * conteúdo semântico e evita que a verificação de integridade dependa do SO.
 */
function conteudoCanonicoParaHash(conteudo: string): string {
  return conteudo.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

describe("owasp-parser.util (CP-5)", () => {
  // Se o snapshot não existir, o problema é de setup, não do parser — e a
  // mensagem tem de dizer isso, senão dez testes falham por um motivo só.
  beforeAll(() => {
    if (!existsSync(join(DIR, "MANIFEST.json"))) {
      throw new Error("Snapshot da OWASP ausente. Rode: npm run sync:owasp-playbooks -- --snapshot");
    }
  });

  it("OWASP-P-01 parseia as dez categorias do snapshot oficial com conteúdo real", () => {
    let comLinks = 0;
    for (const cat of OWASP_TOP10_2021) {
      const parsed = parseOwaspCategory(ler(cat.file), cat.category);

      expect(parsed.category).toBe(cat.category);
      expect(parsed.title).toContain(`${cat.category}:2021`);
      // Conteúdo "presente" aqui significa texto de verdade, não string vazia.
      expect(parsed.overview!.length).toBeGreaterThan(100);
      expect(parsed.description!.length).toBeGreaterThan(100);
      expect(parsed.howToPrevent!.length).toBeGreaterThan(100);
      expect(parsed.exampleScenarios!.length).toBeGreaterThan(100);
      expect(parsed.cweIds.length).toBeGreaterThan(0);
      comLinks += parsed.references.length > 0 ? 1 : 0;
    }

    // ⚠️ REALIDADE DA FONTE, NÃO DEFEITO DO PARSER: na tradução pt-BR o A06
    // lista as referências como TEXTO, sem link ("OWASP Dependency Check", sem
    // URL). Não há URL a extrair, e inventar uma seria falsificar a fonte — o
    // A06 recebe seus links pelas Cheat Sheets do IndexTopTen (provado no teste
    // de integração do catálogo, PB-SEED-01).
    expect(comLinks).toBeGreaterThanOrEqual(9);
  });

  it("OWASP-P-02 lida com a tradução divergente do A10 (Previnir/Cenário/mapeadas)", () => {
    // O A10 pt-BR usa "## Como Previnir" (sic), "## Cenário de exemplo de um
    // ataque" e "## Lista de CWEs mapeadas" — as outras nove usam outra
    // redação. Casar por assinatura é o que impede o A10 de entrar no catálogo
    // sem remediação, que foi o bug encontrado no primeiro seed real.
    const bruto = ler("A10_2021-Server-Side_Request_Forgery_(SSRF).md");
    expect(bruto).toContain("## Como Previnir");

    const parsed = parseOwaspCategory(bruto, "A10");
    expect(parsed.howToPrevent).toBeTruthy();
    expect(parsed.howToPrevent!.length).toBeGreaterThan(500);
    expect(parsed.exampleScenarios).toBeTruthy();
    expect(parsed.cweIds).toContain("918"); // CWE-918 é a do SSRF
  });

  it("OWASP-P-03 limpa o ícone e o atributo do MkDocs do título", () => {
    const linha = '# A03:2021 – Injeção    ![icon](assets/x.png){: style="height:80px" align="right"}';
    expect(extrairTitulo(linha, "fallback")).toBe("A03:2021 – Injeção");

    for (const cat of OWASP_TOP10_2021) {
      const titulo = parseOwaspCategory(ler(cat.file), cat.category).title;
      expect(titulo).not.toContain("![");
      expect(titulo).not.toContain("{:");
      expect(titulo).toBe(titulo.trim());
    }
  });

  it("OWASP-P-04 extrai CWEs como número, sem repetição e ordenado", () => {
    const texto = "- [CWE-89 SQL Injection](x)\n- [CWE-79 XSS](y)\n- CWE-89 de novo\n- CWE 1236";
    expect(extrairCwes(texto)).toEqual(["79", "89", "1236"]);
    expect(extrairCwes(null)).toEqual([]);
    expect(extrairCwes("nenhum aqui")).toEqual([]);
  });

  it("OWASP-P-05 extrai só referências https, sem repetição", () => {
    const texto = [
      "- [Segura](https://owasp.org/a)",
      "- [Insegura](http://owasp.org/b)",
      "- [Script](javascript:alert(1))",
      "- [Repetida](https://owasp.org/a)",
    ].join("\n");
    const refs = extrairReferencias(texto);
    expect(refs).toEqual([{ title: "Segura", url: "https://owasp.org/a" }]);

    // E no conteúdo real: nenhuma referência importada fora de https.
    for (const cat of OWASP_TOP10_2021) {
      for (const r of parseOwaspCategory(ler(cat.file), cat.category).references) {
        expect(r.url.startsWith("https://")).toBe(true);
      }
    }
  });

  it("OWASP-P-06 seção ausente vira null e nunca lança", () => {
    const parcial = "# A01:2021 – Só título\n\n## Visão Geral\nUm resumo qualquer.\n";
    const parsed = parseOwaspCategory(parcial, "A01");
    expect(parsed.overview).toBe("Um resumo qualquer.");
    expect(parsed.howToPrevent).toBeNull();
    expect(parsed.cweIds).toEqual([]);
    expect(() => parseOwaspCategory("", "A01")).not.toThrow();
    expect(parseOwaspCategory("", "A01").title).toBe("A01:2021");
  });

  it("OWASP-P-07 mapeia categoria → Cheat Sheets com URL absoluta e https", () => {
    const mapa = parseIndexTopTen(ler("IndexTopTen.md"));
    // Dez, não onze: o arquivo tem também um "A11:2021 – Next Steps", que não
    // é categoria do Top 10 e não pode virar playbook.
    expect(mapa.size).toBe(10);
    expect(mapa.has("A11")).toBe(false);
    for (const cat of OWASP_TOP10_2021) {
      const folhas = mapa.get(cat.category);
      expect(folhas && folhas.length).toBeGreaterThan(0);
      for (const f of folhas!) {
        expect(f.url.startsWith("https://")).toBe(true);
        expect(f.title.length).toBeGreaterThan(0);
      }
    }
    // Os links do arquivo são relativos; têm de virar o site oficial das folhas.
    const a03 = mapa.get("A03")!;
    expect(a03.some((f) => f.url.includes("cheatsheetseries.owasp.org"))).toBe(true);
  });

  it("OWASP-P-08 o snapshot confere com o MANIFEST (não foi editado à mão)", () => {
    const manifest = JSON.parse(ler("MANIFEST.json")) as Manifest;
    expect(manifest.files).toHaveLength(11); // 10 categorias + IndexTopTen
    for (const arquivo of manifest.files) {
      const conteudo = ler(arquivo.file);
      const canonico = conteudoCanonicoParaHash(conteudo);
      const sha = createHash("sha256").update(canonico, "utf-8").digest("hex");
      expect(sha).toBe(arquivo.sha256);
      // O tamanho do manifesto também é canônico (UTF-8 + LF), e torna
      // explícito que a normalização não mascara alterações de conteúdo.
      expect(Buffer.byteLength(canonico, "utf-8")).toBe(arquivo.bytes);
      expect(arquivo.url.startsWith("https://raw.githubusercontent.com/OWASP/")).toBe(true);
    }
  });
});
