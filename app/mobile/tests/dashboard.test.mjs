/** Confere as distribuições e o recorte do histórico apresentados no Painel. */
import test from "node:test";
import assert from "node:assert/strict";
import { exposureOverview, projectsByStatus } from "../src/lib/dashboard.ts";

test("agrupa todos os projetos nas etapas correspondentes, incluindo contagens vazias", () => {
  assert.deepEqual(projectsByStatus([]), { PENDING: 0, IN_PROGRESS: 0, IN_REVIEW: 0, COMPLETED: 0 });
  const projects = [{ status: "PENDING" }, { status: "COMPLETED" }, { status: "IN_REVIEW" }, { status: "IN_REVIEW" }];
  assert.deepEqual(projectsByStatus(projects), { PENDING: 1, IN_PROGRESS: 0, IN_REVIEW: 2, COMPLETED: 1 });
});

test("consolida o estoque e escolhe para o histórico a aplicação com mais achados abertos", () => {
  const portal = { name: "Portal", totalAbertas: 4, abertas: { CRITICAL: 1, HIGH: 2, MEDIUM: 1, LOW: 0 } };
  const api = { name: "API", totalAbertas: 7, abertas: { CRITICAL: 0, HIGH: 1, MEDIUM: 4, LOW: 2 } };
  const result = exposureOverview([portal, api]);
  assert.equal(result.total, 11);
  assert.deepEqual(result.bySeverity, { CRITICAL: 1, HIGH: 3, MEDIUM: 5, LOW: 2 });
  assert.equal(result.mainApplication, api);
  assert.equal(exposureOverview([]).mainApplication, undefined);
  assert.equal(exposureOverview([]).total, 0);
});
