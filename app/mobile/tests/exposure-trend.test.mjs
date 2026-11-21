/** Verifica as semanas de calendário e a escala comum do histórico semanal. */
import test from "node:test";
import assert from "node:assert/strict";
import { lastFourWeeks, weeklyActivity } from "../src/lib/exposure-trend.ts";

test("usa quatro semanas completas em UTC e exclui a semana em andamento", () => {
  assert.deepEqual(lastFourWeeks(new Date("2026-11-21T12:00:00Z")), {
    from: "2026-10-19T00:00:00.000Z",
    to: "2026-11-15T23:59:59.999Z",
    weekStarts: ["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"],
  });
  const rollover = lastFourWeeks(new Date("2027-01-04T00:00:00Z"));
  assert.equal(rollover.from, "2026-12-07T00:00:00.000Z");
  assert.equal(rollover.to, "2027-01-03T23:59:59.999Z");
});

test("ordena as semanas pedidas, soma as séries e compartilha o mesmo máximo", () => {
  const weeks = ["2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"];
  const points = weeks.map((periodo, index) => ({ periodo, criados: index, resolvidos: index * 2 })).reverse();
  const activity = weeklyActivity(weeks, points);
  assert.deepEqual(activity.weeks.map((week) => week.periodo), weeks);
  assert.equal(activity.created, 6);
  assert.equal(activity.resolved, 12);
  assert.equal(activity.max, 6);
});

test("separa uma semana ausente de um zero confirmado no histórico", () => {
  const week = "2026-11-09";
  assert.equal(weeklyActivity([week], []), null);
  assert.equal(weeklyActivity([week], [{ periodo: week, criados: 0, resolvidos: 0 }]).max, 1);
});
