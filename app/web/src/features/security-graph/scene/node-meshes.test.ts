import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { DastFinding } from "../../../types/dast.types";
import { buildSecurityGraph } from "../graph-model";
import { posicoesDoGrafo } from "./graph-scene";
import { KitDeMalhas } from "./node-meshes";
import { GRAPH_PALETTE } from "./palette";

// Geometria e material não precisam de WebGL: dá para conferir a fábrica em jsdom.
const findings = [
  { id: "a", risk: "HIGH", normalizedUrl: "http://x/a", title: "A" },
  { id: "b", risk: "INFO", normalizedUrl: "http://x/a", title: "B" },
  { id: "c", risk: "LOW", normalizedUrl: "http://x/c", title: "C" },
] as DastFinding[];

describe("KitDeMalhas", () => {
  it("cria um objeto com alvo de raycast para cada tipo de nó e compartilha materiais", () => {
    const kit = new KitDeMalhas(GRAPH_PALETTE.dark);
    const grafo = buildSecurityGraph("http://x/", findings);
    const visuais = grafo.nodes.map((node) => kit.criar(node));
    for (const visual of visuais) {
      expect(visual.raiz.userData.nodeId).toBe(visual.node.id);
      expect(visual.alvos.length).toBeGreaterThan(0);
      expect(() => visual.animar(1.5)).not.toThrow();
    }
    const a = visuais.find((v) => v.node.risk === "HIGH")!;
    const outroHigh = kit.criar({ id: "finding:z", kind: "FINDING", label: "Z", risk: "HIGH" });
    expect(outroHigh.alvos[0].material).toBe(a.alvos[0].material);
    // Só o HIGH ganha halo pulsante.
    expect(a.raiz.children[0].children.length).toBe(2);
    expect(() => kit.dispose()).not.toThrow();
  });

  it("esmaecido devolve um clone translúcido e reaproveita o cache", () => {
    const kit = new KitDeMalhas(GRAPH_PALETTE.light);
    const original = new THREE.MeshStandardMaterial();
    const dim = kit.esmaecido(original);
    expect(dim).not.toBe(original);
    expect(dim.transparent).toBe(true);
    expect(dim.opacity).toBeLessThan(0.5);
    expect(kit.esmaecido(original)).toBe(dim);
    kit.dispose();
  });
});

describe("posicoesDoGrafo", () => {
  it("posiciona todos os nós em camadas da esquerda para a direita, sem coincidir", () => {
    const grafo = buildSecurityGraph("http://x/", findings);
    const pos = posicoesDoGrafo(grafo);
    expect(pos.size).toBe(grafo.nodes.length);
    expect(pos.get("internet")!.x).toBeLessThan(pos.get("asset")!.x);
    expect(pos.get("asset")!.x).toBeLessThan(pos.get("endpoint:http://x/a")!.x);
    expect(pos.get("endpoint:http://x/a")!.x).toBeLessThan(pos.get("finding:a")!.x);
    expect(pos.get("finding:a")!.distanceTo(pos.get("finding:b")!)).toBeGreaterThan(0.2);
  });

  it("não deixa dois nós no mesmo lugar do plano da câmera, onde os nomes se sobreporiam", () => {
    const muitos = Array.from({ length: 40 }, (_, i) => ({
      id: `f${i}`,
      risk: "LOW",
      normalizedUrl: `http://x/e${i % 7}`,
      title: `F${i}`,
    })) as DastFinding[];
    const pos = [...posicoesDoGrafo(buildSecurityGraph("http://x/", muitos)).values()];
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = i + 1; j < pos.length; j += 1) {
        const juntos = Math.abs(pos[i].x - pos[j].x) < 1 && Math.abs(pos[i].y - pos[j].y) < 0.6;
        expect(juntos).toBe(false);
      }
    }
  });
});
