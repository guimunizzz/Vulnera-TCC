/**
 * Confere a API Docker com contas fictícias já documentadas em docs/DEMO.md.
 * Não cria registros de negócio nem usa Gemini; valida login, perfil e orientação local.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://localhost:3001/api';
const accounts = [
  ['ADMIN', 'admin@vulnera.local', 'admin12345'],
  ['CLIENT', 'owner@technova.demo', 'demo12345'],
  ['PENTESTER', 'bruno.pentester@vulnera.local', 'senha12345'],
];
const forbidden = { CLIENT: ['findings', 'dast', 'remediation'], PENTESTER: ['applications', 'new-analysis', 'sla-settings'], ADMIN: [] };
async function post(route, body, token) {
  const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const raw = await response.text();
  return { status: response.status, data: raw ? JSON.parse(raw) : null };
}
(async () => {
  const results = [];
  for (const [role, email, password] of accounts) {
    const login = await post('/auth/login', { email, password });
    if (login.status !== 200) { results.push({ role, loginStatus: login.status, pass: false }); continue; }
    assert.equal(login.data.user.role, role);
    const checks = [];
    for (const [question, screen] of [['Como solicito uma an\u00e1lise?', 'dashboard'], ['Qual a diferen\u00e7a entre CVSS e VRS?', 'finding-detail']]) {
      const response = await post('/assistant/chat', { question, screen, history: [] }, login.data.accessToken);
      assert.equal(response.status, 200); assert.equal(response.data.source, 'local');
      assert.ok(response.data.message.length > 20);
      assert.ok(response.data.actions.every(action => !forbidden[role].includes(action.id)));
      checks.push({ screen, status: response.status, source: response.data.source, actions: response.data.actions.map(action => action.id) });
    }
    const logout = await post('/auth/logout', { refreshToken: login.data.refreshToken }, login.data.accessToken);
    results.push({ role, pass: true, loginStatus: login.status, logoutStatus: logout.status, checks });
  }
  fs.writeFileSync(path.join(__dirname, 'production-local-results.json'), JSON.stringify({ base, googleCalls: 0, realLogin: true, fixtureAccountsAlreadyExisting: true, results }, null, 2));
  console.log(results.filter(result => result.pass).length + '/3 perfis reais da demonstracao aprovados (API local, 6 perguntas, sem Google).');
  if (results.some(result => !result.pass)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
