/**
 * Regressões do cliente HTTP real com transporte controlado e sessão isolada.
 * Verifica renovação concorrente, queda de rede e troca de conta durante refresh.
 * Consumidor: QA da integração mobile; nenhum dado simulado entra no app.
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
const axios = require("axios");
const source = await readFile(new URL("../src/api/client.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const passed = [];
const reply = (config, data, status = 200) => ({ config, data, status, statusText: String(status), headers: {} });
function unauthorized(config) { return new axios.AxiosError("UNAUTHORIZED", "ERR_BAD_REQUEST", config, {}, reply(config, {}, 401)); }
function load(adapter) {
  const state = { accessToken: "old-access", refreshToken: "old-refresh", clears: 0, tokenWrites: 0,
    clearAuth() { state.clears++; state.accessToken = null; state.refreshToken = null; },
    setTokens(access, refresh) { state.tokenWrites++; state.accessToken = access; state.refreshToken = refresh; },
  };
  axios.defaults.adapter = adapter;
  const module = { exports: {} };
  new Function("require", "module", "exports", "__DEV__", javascript)((name) => name === "../store/auth.store" ? { useAuthStore: { getState: () => state } } : require(name), module, module.exports, true);
  return { client: module.exports.apiClient, state };
}
async function check(name, run) { await run(); passed.push(name); }
const originalAdapter = axios.defaults.adapter;
process.env.EXPO_PUBLIC_API_URL = "http://local-test/api";
try {
  await check("401 concorrentes renovam apenas uma vez", async () => {
    let refreshes = 0;
    const { client, state } = load(async (config) => {
      if (config.url.endsWith("/auth/refresh")) { refreshes++; await new Promise((resolve) => setTimeout(resolve, 20)); return reply(config, { accessToken: "new-access", refreshToken: "new-refresh" }); }
      if (config.headers.Authorization !== "Bearer new-access") throw unauthorized(config);
      return reply(config, []);
    });
    await Promise.all([client.get("/projects"), client.get("/users/me")]);
    assert.equal(refreshes, 1); assert.equal(state.tokenWrites, 1); assert.equal(state.clears, 0);
  });
  await check("queda de rede no refresh preserva a sessão", async () => {
    const { client, state } = load(async (config) => { if (config.url.endsWith("/auth/refresh")) throw new axios.AxiosError("Network Error", "ERR_NETWORK", config); throw unauthorized(config); });
    await assert.rejects(client.get("/projects")); assert.equal(state.clears, 0); assert.equal(state.refreshToken, "old-refresh");
  });
  await check("refresh recusado encerra somente a sessão correspondente", async () => {
    const { client, state } = load(async (config) => { throw unauthorized(config); });
    await assert.rejects(client.get("/projects")); assert.equal(state.clears, 1);
  });
  for (const fail of [false, true]) await check(fail ? "refresh antigo recusado não limpa a nova conta" : "refresh antigo não sobrescreve a nova conta", async () => {
    let started;
    const barrier = new Promise((resolve) => { started = resolve; });
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const { client, state } = load(async (config) => {
      if (config.url.endsWith("/auth/refresh")) { started(); await pending; if (fail) throw unauthorized(config); return reply(config, { accessToken: "late-access", refreshToken: "late-refresh" }); }
      throw unauthorized(config);
    });
    const request = client.get("/projects");
    const rejection = assert.rejects(request);
    await barrier; state.accessToken = "other-access"; state.refreshToken = "other-refresh"; release();
    await rejection; assert.equal(state.accessToken, "other-access"); assert.equal(state.tokenWrites, 0); assert.equal(state.clears, 0);
  });
  await check("429 aguarda Retry-After e erros de permissão não repetem", async () => {
    const source = await readFile(new URL("../src/lib/query-client.ts", import.meta.url), "utf8");
    const module = { exports: {} };
    const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    new Function("require", "module", "exports", javascript)(require, module, module.exports);
    const options = module.exports.queryClient.getDefaultOptions().queries;
    const config = {};
    const error = new axios.AxiosError("limit", "ERR_BAD_REQUEST", config, {}, { ...reply(config, {}, 429), headers: { "retry-after": "2" } });
    assert.equal(options.retryDelay(0, error), 2000); assert.equal(options.retry(0, error), true); assert.equal(options.retry(1, error), false);
    error.response.status = 403; assert.equal(options.retry(0, error), false);
  });
} finally { axios.defaults.adapter = originalAdapter; }
await writeFile(new URL("./client-smoke-results.json", import.meta.url), JSON.stringify({ passed: passed.length, checks: passed }, null, 2));
process.stdout.write(JSON.stringify({ passed: passed.length, checks: passed }, null, 2) + "\n");
