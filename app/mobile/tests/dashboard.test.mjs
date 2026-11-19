/** Verifica indicadores e prioridades do painel com dados fictícios, sem depender da API. */
import test from "node:test";
import assert from "node:assert/strict";
import { exposureOverview, projectOverview } from "../src/lib/dashboard.ts";

test("calcula a proporção de projetos concluídos sem inventar percentual para lista vazia", () => {
  assert.deepEqual(projectOverview([]), { total: 0, completed: 0, active: 0, percent: null });
  const projects = [{ status: "COMPLETED" }, { status: "IN_REVIEW" }, { status: "PENDING" }];
  assert.deepEqual(projectOverview(projects), { total: 3, completed: 1, active: 1, percent: 33 });
});

test("ordena achados mais graves, remove repetidos e contabiliza críticas", () => {
  const item = (id, severityFinal) => ({ id, title: id, severityFinal });
  const result = exposureOverview([
    { name: "Portal", totalAbertas: 5, abertas: { CRITICAL: 1 }, principais: [item("alta", "HIGH"), item("critica", "CRITICAL")] },
    { name: "API", totalAbertas: 2, abertas: { CRITICAL: 1 }, principais: [item("critica", "CRITICAL"), item("media", "MEDIUM")] },
  ]);
  assert.equal(result.open, 7);
  assert.equal(result.critical, 2);
  assert.deepEqual(result.priorities.map((item) => item.id), ["critica", "alta", "media"]);
});
