/**
 * Prepara um tenant de demonstração e registra resultados reais do DAST.
 * Existe para validar a apresentação sem mudar o cenário TechNova existente.
 * Consumidor: mantenedor; usa a API pública local, sem salvar tokens/senhas.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const base = 'http://localhost:3001/api';
const out = path.join(__dirname, 'dast-network');

async function call(route, token, method = 'GET', body) {
  const res = await fetch(base + route, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  await fs.mkdir(out, { recursive: true });
  const admin = await call('/auth/login', null, 'POST', { email: 'admin@vulnera.local', password: 'admin12345' });
  const token = admin.accessToken;
  if (process.argv[2] === 'setup') {
    const email = `dast-lan-${Date.now()}@vulnera.local`;
    const client = await call('/auth/register', null, 'POST', {
      name: 'Responsável Demonstração DAST LAN', email, password: crypto.randomBytes(24).toString('base64url'),
    });
    const plans = await call('/plans');
    const plan = plans.find(p => p.name === 'Enterprise');
    assert(plan, 'Seed Enterprise ausente');
    const company = await call('/companies', client.accessToken, 'POST', { name: 'Demonstração DAST LAN — 09/10/2026', planId: plan.id });
    const subscription = await call('/subscriptions', client.accessToken, 'POST', { planId: plan.id });
    const approved = await call(`/subscriptions/${subscription.id}/approve`, token, 'POST');
    assert.equal(approved.status, 'ACTIVE');
    const setup = { companyId: company.id, companyName: company.name, ownerId: client.user.id, subscriptionId: subscription.id, planName: plan.name, targetUrl: 'http://10.87.169.107:5173/', createdAt: new Date().toISOString() };
    await fs.writeFile(path.join(out, 'setup.json'), JSON.stringify(setup, null, 2));
    console.log(JSON.stringify(setup));
  } else if (process.argv[2] === 'inspect') {
    const id = process.argv[3];
    assert(id, 'Informe scanId');
    const scan = await call(`/dast/scans/${id}`, token);
    const findings = await call(`/dast/scans/${id}/findings`, token);
    const evidence = { scan, findingsCount: findings.length, inspectedAt: new Date().toISOString() };
    if (scan.status === 'COMPLETED') {
      const data = await call(`/dast/scans/${id}/report/data`, token);
      const html = await fetch(`${base}/dast/scans/${id}/report/html`, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
      assert.equal(html.status, 200);
      assert.equal(html.headers.get('content-security-policy'), 'sandbox');
      assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
      await fs.writeFile(path.join(out, `${id}-report-data.json`), JSON.stringify(data, null, 2));
      await fs.writeFile(path.join(out, `${id}-report.html`), await html.text());
      evidence.reportHtml = { status: html.status, csp: html.headers.get('content-security-policy') };
    }
    await fs.writeFile(path.join(out, `${id}-evidence.json`), JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify({ id, status: scan.status, simulated: scan.simulated, progress: scan.progress, phase: scan.phase, durationMs: scan.durationMs, counts: { high: scan.alertsHigh, medium: scan.alertsMedium, low: scan.alertsLow, info: scan.alertsInfo }, findingsCount: findings.length, errorMessage: scan.errorMessage, html: evidence.reportHtml }));
  } else throw new Error('Use setup ou inspect <scanId>');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
