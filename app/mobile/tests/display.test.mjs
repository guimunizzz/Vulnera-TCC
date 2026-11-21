/** Confere que a busca de projetos aceita grafias equivalentes do português. */
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSearchText } from "../src/lib/display.ts";

test("encontra nomes com acentos, caixa e espaços diferentes sem mudar o título exibido", () => {
  const name = "Auditoria — Aplicação Pública";
  assert.ok(normalizeSearchText(name).includes(normalizeSearchText("  APLICACAO  publica ")));
  assert.equal(normalizeSearchText("Aplicac\u0327a\u0303o"), "aplicacao");
  assert.equal(normalizeSearchText("   "), "");
});
