/** Valida categorias compartilhadas da rede mobile com dados fictícios; executado por node --test. */
import test from "node:test";
import assert from "node:assert/strict";
import { sharedCategories } from "../src/lib/exposure-graph.ts";

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
