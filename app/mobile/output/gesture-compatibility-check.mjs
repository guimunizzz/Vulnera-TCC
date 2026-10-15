/**
 * Confere a versão nativa dos gestos e a resolução efetiva do stack.
 * Detecta a incompatibilidade de ABI que o export web não consegue reproduzir.
 * Consumidor: correção do crash installUIRuntimeBindings no Expo Go.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
const require = createRequire(new URL("../package.json", import.meta.url));
const semver = require("semver");
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const manifest = await readJson(new URL("../package.json", import.meta.url));
const lock = await readJson(new URL("../package-lock.json", import.meta.url));
const sdk = await readJson(require.resolve("expo/bundledNativeModules.json"));
const name = "react-native-gesture-handler", recommended = sdk[name];
const checks = [], resolutions = [];
assert.equal(manifest.dependencies[name], recommended);
checks.push("Dependência explícita usa a faixa nativa do SDK instalado");
for (const consumer of ["expo-router/js-stack", "react-native-drawer-layout"]) {
  const path = require.resolve(`${name}/package.json`, { paths: [dirname(require.resolve(consumer))] });
  const pkg = await readJson(path);
  assert.ok(semver.satisfies(pkg.version, recommended), `${consumer} resolveu ${pkg.version}; esperado ${recommended}`);
  resolutions.push({ consumer, version: pkg.version, path });
}
checks.push("Stack e drawer resolvem a versão compatível com Expo Go");
assert.equal(lock.packages[""].dependencies[name], recommended);
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (path.endsWith(`node_modules/${name}`)) {
    assert.ok(semver.satisfies(pkg.version, recommended), `Lockfile mantém versão incompatível em ${path}`);
  }
}
checks.push("Lockfile preserva a matriz nativa sem Gesture Handler 3.x");
await writeFile(new URL("./gesture-compatibility-results.json", import.meta.url), JSON.stringify({ passed: checks.length, checks, recommended, resolutions, physicalDevice: "pendente; não executado nesta estação Windows" }, null, 2));
for (const check of checks) process.stdout.write(`OK ${check}\n`);
