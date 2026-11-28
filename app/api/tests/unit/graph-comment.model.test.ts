/**
 * graph-comment.model.test.ts — validação do comentário de nó (ADR-061).
 *
 *   GCM-U01  corpo válido é normalizado (trim, controle removido, rótulo curto)
 *   GCM-U02  grafo, nó e texto obrigatórios; limites de tamanho
 *   GCM-U03  scan DAST exige escopo; o link leva ao grafo com o nó na URL
 */

import { linkDoComentario, TAMANHO_MAXIMO_DO_COMENTARIO, validarNovoComentario } from "../../src/models/graph-comment.model";

describe("validarNovoComentario", () => {
  it("GCM-U01 — normaliza o corpo válido", () => {
    const entrada = validarNovoComentario({
      grafo: "EXPOSURE",
      noId: "  app:abc  ",
      texto: "  Esta API sai do ar em março\u0007  ",
      rotulo: "Portal\n  de   pagamentos",
    });
    expect(entrada).toEqual({ grafo: "EXPOSURE", escopo: null, noId: "app:abc", texto: "Esta API sai do ar em março", rotulo: "Portal de pagamentos" });
  });

  it("GCM-U02 — campos obrigatórios e limites", () => {
    expect(() => validarNovoComentario({ grafo: "OUTRO", noId: "a", texto: "b" })).toThrow("INVALID_GRAPH_KIND");
    expect(() => validarNovoComentario({ grafo: "EXPOSURE", texto: "b" })).toThrow("MISSING_NODE_ID");
    expect(() => validarNovoComentario({ grafo: "EXPOSURE", noId: "x".repeat(201), texto: "b" })).toThrow("INVALID_NODE_ID");
    expect(() => validarNovoComentario({ grafo: "EXPOSURE", noId: "a\u0000b", texto: "b" })).toThrow("INVALID_NODE_ID");
    expect(() => validarNovoComentario({ grafo: "EXPOSURE", noId: "a", texto: "   " })).toThrow("MISSING_COMMENT_BODY");
    expect(() => validarNovoComentario({ grafo: "EXPOSURE", noId: "a", texto: "\u0001\u0002" })).toThrow("MISSING_COMMENT_BODY");
    expect(() => validarNovoComentario({ grafo: "EXPOSURE", noId: "a", texto: "x".repeat(TAMANHO_MAXIMO_DO_COMENTARIO + 1) })).toThrow("INVALID_COMMENT_BODY");
    // Chamadas seguidas não herdam estado de regex.
    expect(validarNovoComentario({ grafo: "EXPOSURE", noId: "a", texto: "b" }).noId).toBe("a");
    expect(validarNovoComentario({ grafo: "EXPOSURE", noId: "a", texto: "b" }).noId).toBe("a");
  });

  it("GCM-U03 — scan DAST exige escopo; link do comentário", () => {
    expect(() => validarNovoComentario({ grafo: "DAST_SCAN", noId: "a", texto: "b" })).toThrow("MISSING_SCOPE");
    expect(linkDoComentario("EXPOSURE", "company-1", "app:x y")).toBe("/exposure-graph?no=app%3Ax%20y");
    expect(linkDoComentario("DAST_SCAN", "scan-1", "asset:1")).toBe("/dast/scans/scan-1?no=asset%3A1");
  });
});
