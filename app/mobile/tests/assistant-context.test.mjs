/** Valida a normalização de telas e destinos permitidos da Vuvu sem usar dados pessoais. */
import test from "node:test";
import assert from "node:assert/strict";
import { assistantActions, assistantScreen } from "../src/lib/assistant-context.ts";

test("envia somente nomes fechados de telas, sem identificadores de rota", () => {
  assert.equal(assistantScreen('/home/project/segredo'), 'project-detail');
  assert.equal(assistantScreen('/home/finding/segredo'), 'finding-detail');
  assert.equal(assistantScreen('/security'), 'exposure-graph');
  assert.equal(assistantScreen('/reports/segredo'), 'project-detail');
  assert.equal(assistantScreen('/dashboard'), 'dashboard');
  assert.ok(!Object.values(assistantActions).some((value) => value.path.includes('segredo')));
  assert.equal(Object.hasOwn(assistantActions, 'delete'), false);
});
