import { describe, expect, it } from "vitest";
import type { DastFinding, DastRisk } from "../../types/dast.types";
import { COLUNA_X, idDoGrupo, montarVisao2D } from "./graph-2d-layout";
import { buildSecurityGraph, caminhoAte } from "./graph-model";
import { descreverNo, grupoDoFinding } from "./node-detail";

function finding(id: string, risk: DastRisk, normalizedUrl: string): DastFinding {
  return { id, risk, normalizedUrl, title: `F ${id}` } as DastFinding;
}

const FINDINGS = [
  finding("a", "LOW", "http://x/login"),
  finding("b", "HIGH", "http://x/login"),
  finding("c", "MEDIUM", "http://x/api"),
];
const grafo = buildSecurityGraph("http://x/", FINDINGS);
const porNo = new Map(FINDINGS.map((f) => [`finding:${f.id}`, f]));
const LOGIN = "endpoint:http://x/login";

describe("montarVisao2D", () => {
  it("agrupa os findings de cada endpoint num nó só, com o pior risco e a contagem", () => {
    const visao = montarVisao2D(grafo, new Set());
    expect(visao.nodes.map((n) => n.kind)).toEqual(["INTERNET", "ASSET", "ENDPOINT", "GROUP", "ENDPOINT", "GROUP"]);
    const grupo = visao.nodes.find((n) => n.id === idDoGrupo(LOGIN));
    expect(grupo).toMatchObject({ total: 2, risk: "HIGH", expandido: false, x: COLUNA_X.GROUP });
    // Endpoint mais perigoso no topo.
    expect(visao.nodes[2].id).toBe(LOGIN);
    expect(visao.nodes.some((n) => n.kind === "FINDING")).toBe(false);
  });

  it("expandir um grupo põe os findings dele numa coluna própria, ligados ao grupo", () => {
    const visao = montarVisao2D(grafo, new Set([idDoGrupo(LOGIN)]));
    const findings = visao.nodes.filter((n) => n.kind === "FINDING");
    expect(findings.map((n) => n.id).sort()).toEqual(["finding:a", "finding:b"]);
    expect(findings.every((n) => n.x === COLUNA_X.FINDING)).toBe(true);
    expect(visao.edges).toContainEqual({ source: idDoGrupo(LOGIN), target: "finding:b" });
    // Os dois findings ocupam linhas diferentes e o grupo fica no meio deles.
    const grupo = visao.nodes.find((n) => n.id === idDoGrupo(LOGIN));
    expect(grupo?.y).toBe((findings[0].y + findings[1].y) / 2);
  });

  it("nó arrastado usa a posição salva e o resto mantém o padrão, sem mudar o tamanho do layout", () => {
    const padrao = montarVisao2D(grafo, new Set());
    const visao = montarVisao2D(grafo, new Set(), new Map([[LOGIN, { x: 10, y: 20 }]]));
    expect(visao.nodes.find((n) => n.id === LOGIN)).toMatchObject({ x: 10, y: 20 });
    expect(visao.nodes.find((n) => n.id === "asset")).toEqual(padrao.nodes.find((n) => n.id === "asset"));
    expect([visao.largura, visao.altura]).toEqual([padrao.largura, padrao.altura]);
  });

  it("grafo sem findings ainda mostra Internet e alvo", () => {
    const visao = montarVisao2D(buildSecurityGraph("http://x/", []), new Set());
    expect(visao.nodes.map((n) => n.kind)).toEqual(["INTERNET", "ASSET"]);
    expect(visao.altura).toBeGreaterThan(0);
  });
});

describe("caminho e detalhe do nó", () => {
  it("caminhoAte devolve a exposição em ordem, da Internet ao nó", () => {
    expect(caminhoAte(grafo, "finding:b").map((n) => n.id)).toEqual(["internet", "asset", LOGIN, "finding:b"]);
  });

  it("detalhe de um finding traz o próprio finding e o caminho", () => {
    const detalhe = descreverNo(grafo, porNo, "finding:b");
    expect(detalhe).toMatchObject({ kind: "FINDING", risk: "HIGH", label: "F b" });
    expect(detalhe?.finding?.id).toBe("b");
    expect(detalhe?.caminho).toHaveLength(4);
  });

  it("detalhe de um grupo herda o caminho do endpoint e lista os findings do pior para o melhor", () => {
    const detalhe = descreverNo(grafo, porNo, idDoGrupo(LOGIN));
    expect(detalhe?.kind).toBe("GROUP");
    expect(detalhe?.url).toBe("http://x/login");
    expect(detalhe?.findings.map((f) => f.id)).toEqual(["b", "a"]);
    expect(detalhe?.caminho.map((p) => p.kind)).toEqual(["INTERNET", "ASSET", "ENDPOINT", "GROUP"]);
  });

  it("a Internet não herda severidade, e um id desconhecido não vira detalhe", () => {
    expect(descreverNo(grafo, porNo, "internet")?.risk).toBeUndefined();
    expect(descreverNo(grafo, porNo, "finding:nao-existe")).toBeNull();
  });

  it("grupoDoFinding acha o grupo que precisa abrir para mostrar o finding", () => {
    expect(grupoDoFinding(grafo, "finding:a")).toBe(idDoGrupo(LOGIN));
  });
});
