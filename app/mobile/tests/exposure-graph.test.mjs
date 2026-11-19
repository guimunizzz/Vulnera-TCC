/** Valida categorias compartilhadas da rede mobile com dados fictícios; executado por node --test. */
import test from "node:test";
import assert from "node:assert/strict";
import { graphLayout, sharedCategories } from "../src/lib/exposure-graph.ts";

test("agrega uma categoria compartilhada e conserva sua pior severidade", () => {
  const applications = [
    { id: "a", name: "Portal", categorias: [{ owaspCategory: "A01", abertas: 2, piorSeveridade: "HIGH" }, { owaspCategory: "A03", abertas: 1, piorSeveridade: "LOW" }] },
    { id: "b", name: "API", categorias: [{ owaspCategory: "A01", abertas: 3, piorSeveridade: "CRITICAL" }] },
    { id: "c", name: "Sem achados", categorias: [] },
  ];
  const result = sharedCategories(applications);
  assert.deepEqual(result.map((item) => item.code), ["A01", "A03"]);
  assert.equal(result[0].total, 5);
  assert.equal(result[0].severity, "CRITICAL");
  assert.deepEqual(result[0].applications.map((item) => item.id), ["b", "a"]);
  assert.deepEqual(sharedCategories([]), []);
});

test("encaixa os nós em ambas as disposições, inclusive sem categorias", () => {
  for (const layout of ["columns", "rows"]) {
    for (const categoryCount of [0, 1, 6]) {
      const graph = graphLayout(layout, 4, categoryCount);
      assert.equal(graph.applications.length, 4);
      assert.equal(graph.categories.length, categoryCount);
      const axis = layout === "columns" ? "x" : "y";
      const spreadAxis = axis === "x" ? "y" : "x";
      const layer = graph.applications[0][axis];
      assert.ok(graph.company[axis] < layer);
      assert.ok(graph.applications.every((node) => node[axis] === layer));
      assert.ok(graph.categories.every((node) => node[axis] > layer));
      for (const group of [graph.applications, graph.categories]) {
        assert.ok(group.every((node, index) => !index || node[spreadAxis] - group[index - 1][spreadAxis] >= (axis === "x" ? 76 : 116)));
      }
      for (const { x, y } of [graph.company, ...graph.applications, ...graph.categories]) {
        assert.ok(x >= 58 && x <= graph.width - 58);
        assert.ok(y >= 38 && y <= graph.height - 38);
      }
    }
  }
});
