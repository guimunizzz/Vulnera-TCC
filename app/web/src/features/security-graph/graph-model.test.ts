import { describe, expect, it } from "vitest";
import type { DastFinding, DastRisk } from "../../types/dast.types";
import { buildSecurityGraph, contextoDoNo, MAX_GRAPH_NODES } from "./graph-model";

function finding(id: string, risk: DastRisk, normalizedUrl: string): DastFinding {
  return { id, risk, normalizedUrl, title: `F ${id}` } as DastFinding;
}

describe("buildSecurityGraph", () => {
  it("liga Internet → alvo → endpoint → finding e reaproveita o endpoint", () => {
    const grafo = buildSecurityGraph("http://app.local:8080/", [
      finding("a", "LOW", "http://app.local:8080/login"),
      finding("b", "HIGH", "http://app.local:8080/login"),
    ]);
    expect(grafo.nodes.map((n) => n.kind)).toEqual(["INTERNET", "ASSET", "ENDPOINT", "FINDING", "FINDING"]);
    expect(grafo.nodes[1].label).toBe("app.local:8080");
    expect(grafo.nodes[2].label).toBe("/login");
    expect(grafo.edges).toContainEqual({ source: "endpoint:http://app.local:8080/login", target: "finding:b" });
    expect(grafo.truncated).toBe(false);
  });

  it("trunca no teto de nós mantendo os de maior risco", () => {
    const muitos = Array.from({ length: 400 }, (_, i) => finding(`i${i}`, "INFO", "http://x/a"));
    const grafo = buildSecurityGraph("http://x/", [...muitos, finding("alto", "HIGH", "http://x/a")]);
    expect(grafo.nodes.length).toBe(MAX_GRAPH_NODES);
    expect(grafo.nodes.some((n) => n.id === "finding:alto")).toBe(true);
    expect(grafo.truncated).toBe(true);
  });

  it("contexto de um finding acende o caminho até a Internet e nada dos vizinhos", () => {
    const grafo = buildSecurityGraph("http://x/", [finding("a", "HIGH", "http://x/a"), finding("b", "LOW", "http://x/b")]);
    const { nos, arestas } = contextoDoNo(grafo, "finding:a");
    expect([...nos].sort()).toEqual(["asset", "endpoint:http://x/a", "finding:a", "internet"]);
    expect(arestas.has("endpoint:http://x/b->finding:b")).toBe(false);
    expect(arestas.size).toBe(3);
  });

  it("contexto de um endpoint inclui os findings abaixo dele", () => {
    const grafo = buildSecurityGraph("http://x/", [finding("a", "HIGH", "http://x/a"), finding("c", "INFO", "http://x/a")]);
    const { nos } = contextoDoNo(grafo, "endpoint:http://x/a");
    expect(nos.has("finding:a") && nos.has("finding:c") && nos.has("internet")).toBe(true);
  });
});
