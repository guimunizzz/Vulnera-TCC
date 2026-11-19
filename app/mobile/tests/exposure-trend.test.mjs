/** Verifica janela e geometria do histórico com contagens fictícias. */
import test from "node:test";
import assert from "node:assert/strict";
import { last30Days, trendGeometry } from "../src/lib/exposure-trend.ts";

test("define 30 dias de calendário incluindo o dia corrente", () => {
  assert.deepEqual(last30Days(new Date("2026-11-19T12:00:00Z")), { from: "2026-10-21T00:00:00.000Z", to: "2026-11-19T12:00:00.000Z" });
});

test("desenha valores reais sem dividir por zero e soma achados", () => {
  const empty = trendGeometry([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.path, "");
  const zero = trendGeometry([{ criados: 0 }, { criados: 0 }]);
  assert.equal(zero.path, "M 0.00 100.00 L 280.00 100.00");
  const series = trendGeometry([{ criados: 0 }, { criados: 2 }, { criados: 1 }]);
  assert.equal(series.total, 3);
  assert.equal(series.maximum, 2);
  assert.equal(series.path, "M 0.00 100.00 L 140.00 8.00 L 280.00 54.00");
});
