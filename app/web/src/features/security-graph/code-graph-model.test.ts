/**
 * Security Graph das importações SAST/SCA (ADR-052): árvore aplicação →
 * código (pasta → arquivo) / dependências (pacote) → achados, filtros, o que
 * começa aberto, o caminho para a busca e o teto de nós.
 */
import { describe, expect, it } from "vitest";
import type { CodeFinding, CodeSeverity } from "../../types/code-import.types";
import { CODE_SEVERITY_ORDER } from "../../types/code-import.types";
import {
  caminhoParaMostrar,
  expandidosIniciais,
  ID_RAIZ,
  ID_SAST,
  ID_SCA,
  idAchado,
  idArquivo,
  idPacote,
  idPasta,
  montarArvoreCodigo,
  montarVisaoCodigo,
  prefixoComum,
} from "./code-graph-model";

let seq = 0;
function achado(over: Partial<CodeFinding>): CodeFinding {
  seq++;
  return {
    id: `f${seq}`, importId: "i", projectId: "p", fingerprint: `fp${seq}`, category: "SAST", ruleId: "regra", title: `Achado ${seq}`,
    severity: "MEDIUM", cweId: null, filePath: null, startLine: null, endLine: null, snippet: null, packageName: null, packageVersion: null,
    purl: null, fixedVersion: null, advisoryId: null, cvssScore: null, cvssVector: null, description: null, recommendation: null, helpUri: null,
    triageStatus: "NEW", triageNote: null, triagedByName: null, triagedAt: null, triageInherited: false, promotedVulnerability: null, ...over,
  };
}

const todas = () => new Set<CodeSeverity>(CODE_SEVERITY_ORDER);
const FILTRO = { severidades: todas(), mostrarFalsosPositivos: false };

const FINDINGS: CodeFinding[] = [
  achado({ id: "eval1", severity: "HIGH", filePath: "/src/app/routes/contributions.js", startLine: 32 }),
  achado({ id: "eval2", severity: "MEDIUM", filePath: "/src/app/routes/contributions.js", startLine: 33 }),
  achado({ id: "idx", severity: "LOW", filePath: "/src/app/routes/index.js", startLine: 72 }),
  achado({ id: "gha", severity: "MEDIUM", filePath: "/src/.github/workflows/ci.yml", startLine: 16 }),
  achado({ id: "fp", severity: "CRITICAL", filePath: "/src/server.js", startLine: 1, triageStatus: "FALSE_POSITIVE" }),
  achado({ id: "bson", category: "SCA", severity: "CRITICAL", ruleId: "CVE-2020-7610", advisoryId: "CVE-2020-7610", packageName: "bson", packageVersion: "1.0.9", fixedVersion: "1.1.4" }),
  achado({ id: "lodash1", category: "SCA", severity: "HIGH", ruleId: "CVE-2021-23337", advisoryId: "CVE-2021-23337", packageName: "lodash", packageVersion: "4.17.15" }),
  achado({ id: "lodash2", category: "SCA", severity: "LOW", ruleId: "CVE-2020-28500", advisoryId: "CVE-2020-28500", packageName: "lodash", packageVersion: "4.17.15" }),
];

describe("Security Graph SAST/SCA — árvore", () => {
  it("prefixo comum some do nome das pastas", () => {
    expect(prefixoComum(["/src/app/a.js", "/src/b.js"])).toBe("/src/");
    expect(prefixoComum(["a.js", "b/c.js"])).toBe("");
    expect(prefixoComum([])).toBe("");
  });

  it("aplicação → código (pasta → arquivo) e dependências (pacote) → achados, com a pior severidade e o total em cada nó", () => {
    const arvore = montarArvoreCodigo("Portal", FINDINGS, FILTRO);
    const no = (id: string) => arvore.todos.find((n) => n.id === id)!;

    expect(no(ID_RAIZ)).toMatchObject({ kind: "APPLICATION", label: "Portal", total: 7, risk: "CRITICAL" });
    expect(no(ID_SAST)).toMatchObject({ kind: "CODE", total: 4, risk: "HIGH", subtitulo: "2 pastas · 4 achados" });
    expect(no(ID_SCA)).toMatchObject({ kind: "CODE", total: 3, risk: "CRITICAL" });
    expect(no(idPasta("app/routes"))).toMatchObject({ kind: "FOLDER", total: 3, risk: "HIGH", subtitulo: "2 arquivos · 3 achados" });
    expect(no(idArquivo("app/routes/contributions.js"))).toMatchObject({ kind: "FILE", label: "contributions.js", total: 2, risk: "HIGH" });
    expect(no(idPacote("lodash@4.17.15"))).toMatchObject({ kind: "PACKAGE", total: 2, risk: "HIGH" });
    expect(no(idPacote("bson@1.0.9")).subtitulo).toBe("1 CVE · corrige em 1.1.4");
    expect(no(idAchado("bson"))).toMatchObject({ kind: "FINDING", label: "CVE-2020-7610", risk: "CRITICAL" });
    expect(no(idAchado("eval1"))).toMatchObject({ kind: "FINDING", risk: "HIGH", subtitulo: "linha 32 · alta" });

    // Ramo mais grave primeiro (dependências com uma crítica), e o pai de cada nó para a busca.
    expect(arvore.raiz.filhos.map((f) => f.no.id)).toEqual([ID_SCA, ID_SAST]);
    expect(arvore.pai.get(idAchado("eval1"))).toBe(idArquivo("app/routes/contributions.js"));
  });

  it("falso-positivo fica fora por padrão e volta com o interruptor; severidade filtra", () => {
    const sem = montarArvoreCodigo("Portal", FINDINGS, FILTRO);
    expect(sem.achados.has(idAchado("fp"))).toBe(false);
    const com = montarArvoreCodigo("Portal", FINDINGS, { ...FILTRO, mostrarFalsosPositivos: true });
    expect(com.achados.has(idAchado("fp"))).toBe(true);
    expect(com.todos.find((n) => n.id === ID_RAIZ)?.total).toBe(8);

    const soCriticas = montarArvoreCodigo("Portal", FINDINGS, { severidades: new Set<CodeSeverity>(["CRITICAL"]), mostrarFalsosPositivos: false });
    expect([...soCriticas.achados.keys()]).toEqual([idAchado("bson")]);
    // Sem achado de código visível, o ramo SAST nem aparece.
    expect(soCriticas.todos.some((n) => n.id === ID_SAST)).toBe(false);
  });
});

describe("Security Graph SAST/SCA — visão", () => {
  it("importação pequena começa toda aberta; recolher um arquivo esconde os achados dele", () => {
    const arvore = montarArvoreCodigo("Portal", FINDINGS, FILTRO);
    const abertos = expandidosIniciais(arvore);
    const visao = montarVisaoCodigo(arvore, abertos);
    expect(visao.nodes).toHaveLength(arvore.todos.length);
    expect(visao.nodes[0].id).toBe(ID_RAIZ);
    expect(visao.edges).toHaveLength(arvore.todos.length - 1);
    expect(visao.truncado).toBe(false);

    const arquivo = idArquivo("app/routes/contributions.js");
    const semArquivo = new Set(abertos);
    semArquivo.delete(arquivo);
    const recolhida = montarVisaoCodigo(arvore, semArquivo);
    expect(recolhida.nodes.some((n) => n.id === idAchado("eval1"))).toBe(false);
    expect(recolhida.nodes.find((n) => n.id === arquivo)).toMatchObject({ expandido: false, total: 2 });
  });

  it("colunas da esquerda para a direita e o pai na altura média dos filhos", () => {
    const arvore = montarArvoreCodigo("Portal", FINDINGS, FILTRO);
    const visao = montarVisaoCodigo(arvore, expandidosIniciais(arvore));
    const x = (id: string) => visao.nodes.find((n) => n.id === id)!.x;
    expect(x(ID_RAIZ)).toBeLessThan(x(ID_SAST));
    expect(x(ID_SAST)).toBeLessThan(x(idPasta("app/routes")));
    expect(x(idPasta("app/routes"))).toBeLessThan(x(idArquivo("app/routes/index.js")));
    expect(x(idArquivo("app/routes/index.js"))).toBeLessThan(x(idAchado("idx")));
    const y = (id: string) => visao.nodes.find((n) => n.id === id)!.y;
    expect(y(idArquivo("app/routes/contributions.js"))).toBe((y(idAchado("eval1")) + y(idAchado("eval2"))) / 2);
  });

  it("importação grande começa recolhida e a busca abre o caminho até o achado", () => {
    const muitos = Array.from({ length: 60 }, (_, i) => achado({ filePath: `/src/mod${i % 12}/arquivo${i}.js`, startLine: i + 1 }));
    const arvore = montarArvoreCodigo("Portal", muitos, FILTRO);
    const abertos = expandidosIniciais(arvore);
    expect(abertos.has(ID_SAST)).toBe(true);
    expect(abertos.has(idPasta("mod0"))).toBe(false); // 12 pastas: mais que 8
    const alvo = idAchado(muitos[5].id);
    expect(montarVisaoCodigo(arvore, abertos).nodes.some((n) => n.id === alvo)).toBe(false);

    const caminho = caminhoParaMostrar(arvore, alvo);
    expect(caminho).toEqual([idArquivo("mod5/arquivo5.js"), idPasta("mod5"), ID_SAST, ID_RAIZ]);
    expect(montarVisaoCodigo(arvore, new Set([...abertos, ...caminho])).nodes.some((n) => n.id === alvo)).toBe(true);
  });

  it("acima de 300 nós o grafo para de crescer e avisa", () => {
    const enormes = Array.from({ length: 400 }, (_, i) => achado({ filePath: "/src/a.js", startLine: i + 1 }));
    const arvore = montarArvoreCodigo("Portal", enormes, FILTRO);
    const tudoAberto = new Set(arvore.todos.map((n) => n.id));
    const visao = montarVisaoCodigo(arvore, tudoAberto);
    expect(visao.truncado).toBe(true);
    expect(visao.nodes.length).toBeLessThanOrEqual(300);
  });
});
