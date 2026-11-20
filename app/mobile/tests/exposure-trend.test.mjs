/** Verifica janela e geometria do histórico com contagens fictícias. */
import test from "node:test";
import assert from "node:assert/strict";
import { last30Days, trendGeometry } from "../src/lib/exposure-trend.ts";

test("define 30 dias de calendário incluindo o dia corrente", () => {
  assert.deepEqual(last30Days(new Date("2026-11-19T12:00:00Z")), { from: "2026-10-21T00:00:00.000Z", to: "2026-11-19T12:00:00.000Z" });
});

test("desenha valores reais sem dividir por zero e soma cada série", () => {
  const empty = trendGeometry([]);
  assert.equal(empty.created.total, 0);
  assert.equal(empty.resolved.path, "");
  const zero = trendGeometry([{ criados: 0, resolvidos: 0 }, { criados: 0, resolvidos: 0 }]);
  assert.equal(zero.created.path, "M 0.00 100.00 L 280.00 100.00");
  const series = trendGeometry([{ criados: 0, resolvidos: 1 }, { criados: 2, resolvidos: 0 }, { criados: 1, resolvidos: 2 }]);
  assert.equal(series.created.total, 3);
  assert.equal(series.resolved.total, 3);
  assert.equal(series.created.path, "M 0.00 100.00 L 140.00 8.00 L 280.00 54.00");
  assert.equal(series.resolved.path, "M 0.00 54.00 L 140.00 100.00 L 280.00 8.00");
});

test("a série maior define a mesma escala para resolvidos e novos, inclusive com um único dia", () => {
  const series = trendGeometry([{ criados: 2, resolvidos: 8 }]);
  assert.deepEqual(series.grid.map(({ value }) => value), [9, 6, 3, 0]);
  assert.equal(series.created.coordinates[0].x, 140);
  assert.ok(series.resolved.coordinates[0].y < series.created.coordinates[0].y);
});
