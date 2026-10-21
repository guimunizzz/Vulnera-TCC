/**
 * Smoke de contratos da API real consumida pelo mobile, sem alterar dados.
 * Verifica paginação, tenant e leitura de detalhes/evidências/comentários.
 * Consumidor: relatório de validação da refatoração autenticada.
 */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";
const results = [];
async function check(name, run) { await run(); results.push(name); }
async function read(resource, token) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(base + resource, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    if (response.status === 429 && attempt < 2) {
      const value = response.headers.get("retry-after");
      const delay = value && Number.isFinite(Number(value)) ? Number(value) * 1000 : 2000;
      await new Promise((resolve) => setTimeout(resolve, Math.max(1000, delay))); continue;
    }
    assert.equal(response.status, 200, resource); return response.json();
  }
}
const login = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "owner@technova.demo", password: "demo12345" }) });
assert.equal(login.status, 200);
const session = await login.json();
const token = session.accessToken;
await check("login CLIENT", async () => assert.equal(session.user.role, "CLIENT"));
await check("perfil atualizado por /users/me", async () => assert.equal((await read("/users/me", token)).id, session.user.id));
const projects = await read("/projects", token);
await check("lista e isolamento da empresa", async () => { assert.ok(projects.length > 0); assert.ok(projects.every((project) => project.companyId === session.user.companyId)); });
let finding;
for (const project of projects) {
  const detail = await read(`/projects/${project.id}`, token);
  assert.equal(detail.id, project.id); assert.equal(detail.companyId, session.user.companyId);
  const page = await read(`/vulnerabilities?projectId=${project.id}&pageSize=1&page=1&sortBy=createdAt&sortOrder=desc`, token);
  assert.ok(page.data.length <= 1); assert.ok(page.data.every((item) => item.projectId === project.id && item.companyId === session.user.companyId));
  assert.equal(Object.values(page.facets.severity).reduce((sum, count) => sum + count, 0), page.pagination.total);
  if (page.pagination.totalPages > 1) {
    const second = await read(`/vulnerabilities?projectId=${project.id}&pageSize=1&page=2&sortBy=createdAt&sortOrder=desc`, token);
    assert.equal(second.pagination.page, 2); assert.notEqual(second.data[0].id, page.data[0].id);
  }
  if (!finding && page.data.length) finding = page.data[0];
}
results.push("detalhes dos projetos e paginação real", "facetas incluem todas as páginas");
assert.ok(finding);
await check("detalhe de vulnerabilidade", async () => { const detail = await read(`/vulnerabilities/${finding.id}`, token); assert.equal(detail.id, finding.id); assert.equal(detail.companyId, session.user.companyId); assert.equal(typeof detail.description, "string"); });
const evidences = await read(`/vulnerabilities/${finding.id}/evidences`, token);
await check("lista de evidências", async () => assert.ok(Array.isArray(evidences)));
await check("download autenticado de evidência", async () => {
  let evidenceFinding = finding;
  let available = evidences;
  if (!available.length) {
    const candidates = (await read("/vulnerabilities?pageSize=30", token)).data;
    candidates.sort((a, b) => Number(b.title.toLowerCase().includes("sql")) - Number(a.title.toLowerCase().includes("sql")));
    for (const candidate of candidates) {
      available = await read(`/vulnerabilities/${candidate.id}/evidences`, token);
      if (available.length) { evidenceFinding = candidate; break; }
    }
  }
  assert.ok(available.length, "Cenário real contém ao menos uma evidência");
  const resource = `/vulnerabilities/${evidenceFinding.id}/evidences/${available[0].id}`;
  const response = await fetch(base + resource, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(response.status, 200); assert.ok((await response.arrayBuffer()).byteLength > 0);
  assert.equal((await fetch(base + resource)).status, 401);
});
await check("envelope de comentários", async () => { const comments = await read(`/vulnerabilities/${finding.id}/comments?page=1&pageSize=20`, token); assert.ok(Array.isArray(comments.items)); assert.equal(comments.pageSize, 20); assert.ok(comments.total >= comments.items.length); });
await check("autores limitados à empresa", async () => { const users = await read("/users", token); assert.ok(users.every((user) => user.companyId === session.user.companyId)); });
await fetch(base + "/auth/logout", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ refreshToken: session.refreshToken }) });
await writeFile(new URL("./api-smoke-results.json", import.meta.url), JSON.stringify({ date: new Date().toISOString(), passed: results.length, checks: results, projectCount: projects.length }, null, 2));
process.stdout.write(JSON.stringify({ passed: results.length, checks: results, projectCount: projects.length }, null, 2) + "\n");
