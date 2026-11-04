/**
 * Exercita o endpoint HTTP local compilado, com JWTs sintéticos dos três perfis.
 * Não usa Google nem dados de negócio; consumido pela validação reproduzível da entrega.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const base = process.env.ASSISTANT_QA_API || 'http://127.0.0.1:3002/api';
const records = [];
const forbidden = { CLIENT: ['findings', 'dast', 'remediation'], PENTESTER: ['applications', 'new-analysis', 'sla-settings'], ADMIN: [] };
async function request(role, body, method = 'POST') {
  const headers = { 'Content-Type': 'application/json' };
  if (role) headers.Authorization = 'Bearer ' + jwt.sign({ userId: 'assistant-qa-' + role, role }, 'assistant_test_access_0123456789_abcdef', { expiresIn: '15m' });
  const response = await fetch(base + '/assistant/chat', { method, headers, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20_000) });
  return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : null };
}
(async () => {
  const common = { question: 'Como solicito uma an\u00e1lise?', screen: 'dashboard', history: [] };
  assert.equal((await request(null, common)).status, 401); records.push({ case: 'authentication', pass: true });
  assert.equal((await request('CLIENT', { ...common, role: 'ADMIN' })).status, 400); records.push({ case: 'forged-role', pass: true });
  assert.equal((await request('CLIENT', common, 'GET')).status, 404); records.push({ case: 'no-generation-on-get', pass: true });
  for (const role of ['ADMIN', 'CLIENT', 'PENTESTER']) {
    for (const [question, screen] of [[common.question, 'dashboard'], ['O que posso fazer nesta tela?', 'projects'], ['Qual a diferen\u00e7a entre CVSS e VRS?', 'finding-detail']]) {
      const { status, data } = await request(role, { question, screen, history: [] });
      assert.equal(status, 200); assert.equal(data.source, 'local'); assert.ok(data.message.length > 20);
      assert.ok(data.actions.every(action => !forbidden[role].includes(action.id)));
      records.push({ case: role + ':' + screen, pass: true, status, source: data.source, actions: data.actions.map(action => action.id) });
    }
  }
  const unknown = await request('CLIENT', { ...common, question: 'Qual a capital da Noruega?' });
  assert.equal(unknown.status, 200); assert.equal(unknown.data.source, 'local');
  records.push({ case: 'out-of-help', pass: true });
  fs.writeFileSync(path.join(__dirname, 'live-local-results.json'), JSON.stringify({ base, googleCalls: 0, checks: records }, null, 2));
  console.log(records.length + '/' + records.length + ' verificacoes HTTP locais aprovadas; Google nao chamado.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
