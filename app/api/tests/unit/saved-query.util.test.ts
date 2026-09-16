/**
 * saved-query.util.test.ts (unit)
 *
 * A canonização da query de uma busca salva (CP-6). Funções puras.
 *
 * O teste que mais importa aqui é o SQ-U-08: ele prende este utilitário ao
 * `vulnerability.controller.ts`. Sem ele, a falha típica da feature seria
 * silenciosa — alguém acrescenta um filtro na listagem, esquece de acrescentar
 * aqui, e a partir daí toda busca salva com esse filtro o PERDE ao ser salva,
 * passando a devolver mais findings do que a pessoa pediu.
 *
 *   SQ-U-01  a ordem dos parâmetros não muda a busca (canônica é única)
 *   SQ-U-02  parâmetro desconhecido é descartado, com motivo
 *   SQ-U-03  valor inválido é descartado; o resto da busca sobrevive
 *   SQ-U-04  page e pageSize são removidos de propósito
 *   SQ-U-05  lista: duplicata some, ordem é estável, teto é respeitado
 *   SQ-U-06  busca vazia e busca gigante são recusadas
 *   SQ-U-07  mesmaQuery compara pela forma canônica
 *   SQ-U-08  o vocabulário aceito bate com o do vulnerability.controller.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PARAMETROS_SUPORTADOS,
  SAVED_QUERY_MAX_LENGTH,
  canonicalizarQuery,
  mesmaQuery,
  resumirQuery,
} from "../../src/utils/saved-query.util";

const canon = (q: string): string => canonicalizarQuery(q).queryString;

describe("saved-query.util (CP-6)", () => {
  it("SQ-U-01 a ordem dos parâmetros não muda a busca canônica", () => {
    const a = canon("status=OPEN&severity=HIGH");
    const b = canon("severity=HIGH&status=OPEN");
    expect(a).toBe(b);
    // E a ordem dos VALORES dentro de um campo também não.
    expect(canon("severity=HIGH,CRITICAL")).toBe(canon("severity=CRITICAL,HIGH"));
    // A string canônica tem os campos na ordem declarada em PARAMETROS.
    expect(a).toBe("severity=HIGH&status=OPEN");
  });

  it("SQ-U-02 descarta parâmetro desconhecido e diz por quê", () => {
    const r = canonicalizarQuery("severity=HIGH&foo=bar&<script>=1");
    expect(r.queryString).toBe("severity=HIGH");
    expect(r.descartados.map((d) => d.param)).toContain("foo");
    expect(r.descartados.every((d) => d.motivo.length > 0)).toBe(true);
    // O lixo não entra na string salva de forma alguma.
    expect(r.queryString).not.toContain("script");
    expect(r.queryString).not.toContain("foo");
  });

  it("SQ-U-03 descarta valor inválido sem derrubar a busca inteira", () => {
    const r = canonicalizarQuery("severity=HIGH,URGENTE&status=OPEN&projectId=curto");
    // O filtro válido sobreviveu; um projeto apagado não pode custar o atalho todo.
    expect(r.queryString).toBe("severity=HIGH&status=OPEN");
    expect(r.descartados.map((d) => d.param)).toEqual(
      expect.arrayContaining(["severity=URGENTE", "projectId=curto"]),
    );

    // Datas, VRS e ordenação seguem a mesma regra.
    expect(canon("createdFrom=2026-01-01&vrsMin=10&vrsMax=90&sortBy=vrsScore&sortOrder=asc")).toBe(
      "vrsMin=10&vrsMax=90&createdFrom=2026-01-01&sortBy=vrsScore&sortOrder=asc",
    );
    expect(canonicalizarQuery("severity=HIGH&vrsMin=200").descartados[0]!.param).toBe("vrsMin=200");
    expect(canonicalizarQuery("severity=HIGH&sortBy=senha").descartados[0]!.param).toBe("sortBy=senha");
  });

  it("SQ-U-04 remove page e pageSize", () => {
    // Busca salva sempre abre na primeira página: guardar "página 7" congela um
    // recorte que dependia do total de resultados de quando foi salva.
    const r = canonicalizarQuery("status=OPEN&page=7&pageSize=100");
    expect(r.queryString).toBe("status=OPEN");
    // E some em silêncio — não é descarte por erro, é decisão de produto.
    expect(r.descartados).toHaveLength(0);
  });

  it("SQ-U-05 lista: sem duplicata, ordem estável, teto respeitado", () => {
    expect(canon("status=OPEN,OPEN,FIXED")).toBe("status=FIXED,OPEN");

    const muitos = Array.from({ length: 60 }, () => "A03").join(",");
    const r = canonicalizarQuery(`owaspCategory=${muitos}`);
    expect(r.queryString).toBe("owaspCategory=A03"); // duplicatas colapsam antes do teto

    // Campo de valor único com dois valores: o primeiro vence, o segundo é relatado.
    const unico = canonicalizarQuery("vrsMin=10&vrsMin=20");
    expect(unico.queryString).toBe("vrsMin=10");
    expect(unico.descartados[0]!.motivo).toContain("um valor só");
  });

  it("SQ-U-06 recusa busca vazia e busca grande demais", () => {
    expect(() => canonicalizarQuery("")).toThrow("EMPTY_QUERY");
    expect(() => canonicalizarQuery("foo=bar")).toThrow("EMPTY_QUERY"); // tudo descartado
    expect(() => canonicalizarQuery("?")).toThrow("EMPTY_QUERY");
    expect(() => canonicalizarQuery(`search=${"a".repeat(SAVED_QUERY_MAX_LENGTH * 3)}`)).toThrow("QUERY_TOO_LONG");
    expect(() => canonicalizarQuery(null as unknown as string)).toThrow("INVALID_QUERY");

    // `?` e `#` no começo são tolerados — é como a URL chega da barra do navegador.
    expect(canon("?status=OPEN")).toBe("status=OPEN");
  });

  it("SQ-U-07 mesmaQuery compara pela forma canônica", () => {
    expect(mesmaQuery("status=OPEN&severity=HIGH", "severity=HIGH&status=OPEN")).toBe(true);
    expect(mesmaQuery("status=OPEN&page=3", "status=OPEN")).toBe(true);
    expect(mesmaQuery("status=OPEN", "status=FIXED")).toBe(false);
    expect(mesmaQuery("", "status=OPEN")).toBe(false); // inválida nunca é igual a nada

    // resumirQuery devolve o que a tela usa para descrever o atalho.
    expect(resumirQuery("severity=HIGH,CRITICAL&status=OPEN")).toEqual([
      { campo: "severity", valores: ["HIGH", "CRITICAL"] },
      { campo: "status", valores: ["OPEN"] },
    ]);
  });

  it("SQ-U-07b guarda o filtro por responsável, inclusive o \"sem dono\"", () => {
    // "sem dono e estourado" é uma das watchlists mais úteis do produto; se o
    // `none` fosse descartado aqui, o atalho salvo passaria a devolver TODOS os
    // findings estourados, com ou sem responsável.
    expect(canon("assignedTo=none&slaState=BREACHED")).toBe("slaState=BREACHED&assignedTo=none");
    expect(canon("assignedTo=cmu3hjv620091bruceawf6xs0")).toBe("assignedTo=cmu3hjv620091bruceawf6xs0");
    expect(canonicalizarQuery("severity=HIGH&assignedTo=x").descartados[0]!.param).toBe("assignedTo=x");
  });

  it("SQ-U-08 o vocabulário aceito acompanha o vulnerability.controller.ts", () => {
    // 🎯 Este teste existe para falhar quando alguém acrescentar um filtro na
    // listagem e esquecer de acrescentá-lo aqui. O sintoma sem ele seria mudo:
    // buscas salvas perderiam o filtro novo e passariam a devolver demais.
    const controller = readFileSync(
      join(__dirname, "..", "..", "src", "controllers", "vulnerability.controller.ts"),
      "utf-8",
    );

    // Os parâmetros que o controller lê de `q.` dentro do método list.
    const trecho = controller.slice(controller.indexOf("async list("), controller.indexOf("const resultado"));
    const lidos = new Set<string>();
    for (const m of trecho.matchAll(/\bq\.([A-Za-z]+)\b/g)) lidos.add(m[1]!);
    for (const m of trecho.matchAll(/\bq\["([A-Za-z]+)\[\]"\]/g)) lidos.add(m[1]!);

    // `page`/`pageSize` são descartados de propósito (SQ-U-04).
    const esperados = [...lidos].filter((p) => !["page", "pageSize"].includes(p));
    expect(esperados.length).toBeGreaterThan(10); // a extração achou mesmo algo

    const faltando = esperados.filter((p) => !PARAMETROS_SUPORTADOS.includes(p));
    expect(faltando).toEqual([]);
  });
});
