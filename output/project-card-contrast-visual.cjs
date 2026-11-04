/**
 * Confere visualmente os cards do projeto no navegador com fixtures locais.
 * Existe para comparar superfícies antes/depois sem depender de API ou banco.
 * Consumido manualmente nesta validação; não altera registros do Vulnera.
 */
const { chromium } = require('C:/Users/50786702893/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const phase = process.argv[2] || 'before';
const out = path.join(__dirname, 'project-card-contrast');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' });
  await context.addInitScript(() => {
    if (!localStorage.getItem('vulnera:theme')) localStorage.setItem('vulnera:theme', 'dark');
    localStorage.setItem('vulnera-auth', JSON.stringify({ state: { accessToken: 'visual-fixture', refreshToken: 'visual-fixture', user: { id: 'admin-visual', name: 'Administrador Demo', email: 'admin@example.test', role: 'ADMIN', companyId: null, createdAt: '2026-09-01T12:00:00Z' } }, version: 0 }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let empty = false;
  await page.route(/^http:\/\/localhost:3016\//, async route => {
    if (!['xhr', 'fetch'].includes(route.request().resourceType())) return route.continue();
    assert.equal(route.request().method(), 'GET', 'Validação visual só faz leituras');
    const urlPath = new URL(route.request().url()).pathname;
    const pathname = urlPath.startsWith('/api/') ? urlPath : `/api${urlPath}`;
    let data;
    if (pathname === '/api/projects/visual-project') data = { id: 'visual-project', name: 'Avaliação de segurança — Portal TechNova', description: 'Projeto demonstrativo de validação visual.', applicationId: 'visual-app', companyId: 'visual-company', analysisType: 'COMBO', analysisLevel: 'ADVANCED', hasRemediation: true, scopeIn: 'Portal web, autenticação e endpoints públicos da aplicação.', scopeOut: 'Infraestrutura de terceiros e sistemas fora do domínio autorizado.', status: 'IN_PROGRESS', requestedAt: '2026-09-10T12:00:00Z', startedAt: '2026-09-12T12:00:00Z', closedAt: null, updatedAt: '2026-09-12T12:00:00Z', notes: null };
    else if (pathname.endsWith('/members')) data = empty ? [] : [{ id: 'member-visual', projectId: 'visual-project', userId: 'pentester-visual', assignedAt: '2026-09-12T12:00:00Z' }];
    else if (pathname === '/api/users') data = [{ id: 'pentester-visual', name: 'Bruno Martins', email: 'bruno@example.test', role: 'PENTESTER', companyId: null }];
    else if (pathname === '/api/companies') data = [{ id: 'visual-company', name: 'TechNova' }];
    else if (pathname === '/api/saved-queries') data = [];
    else if (pathname === '/api/applications/visual-app') data = { id: 'visual-app', name: 'Portal TechNova', companyId: 'visual-company', isActive: true };
    else if (pathname === '/api/vulnerabilities') data = { data: [], pagination: { total: 0, page: 1, pageSize: 1, totalPages: 0 }, facets: { severity: {}, status: {}, owasp: {}, company: {} } };
    else throw new Error(`Rota não prevista: ${pathname}`);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto(`http://localhost:${phase === 'before' ? 3015 : 3016}/projects/visual-project`);
  await page.getByRole('heading', { name: 'Metadados', exact: true }).waitFor();
  await page.getByText('Bruno Martins', { exact: true }).waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(out, `${phase}-dark-desktop.png`), fullPage: true });
  const metrics = await page.evaluate(() => {
    const rgb = color => { const c = document.createElement('canvas'); c.width = c.height = 1; const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data]; };
    const lum = color => rgb(color).slice(0, 3).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a,v,i) => a + v * [0.2126,0.7152,0.0722][i], 0);
    const contrast = (a,b) => (Math.max(lum(a),lum(b)) + 0.05)/(Math.min(lum(a),lum(b)) + 0.05);
    return [...document.querySelectorAll('h2')].filter(h => ['Metadados','Pentesters atribuídos'].includes(h.textContent)).map(h => {
      const card = h.closest('section') || h.parentElement;
      const style = getComputedStyle(card);
      const muted = card.querySelector('.text-fg-muted');
      const primary = card.querySelector('dd') || card.querySelector('li span');
      return { title: h.textContent, background: style.backgroundColor, alpha: rgb(style.backgroundColor)[3], border: style.borderColor, primaryColor: primary && getComputedStyle(primary).color, mutedColor: muted && getComputedStyle(muted).color, primaryContrast: primary && contrast(getComputedStyle(primary).color,style.backgroundColor), mutedContrast: muted && contrast(getComputedStyle(muted).color,style.backgroundColor) };
    });
  });
  if (phase === 'after') {
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(metrics.length, 2);
    for (const card of metrics) { assert.equal(card.alpha, 255); assert(card.primaryContrast >= 4.5); if (card.mutedContrast) assert(card.mutedContrast >= 4.5); }
    assert.equal(await page.locator('.operations-backdrop').count(), 1);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.screenshot({ path: path.join(out, 'after-dark-mobile.png'), fullPage: true });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Sem overflow horizontal');
    await page.setViewportSize({ width: 1440, height: 1000 });
    empty = true;
    await page.reload();
    await page.getByText('Nenhum pentester atribuído ainda.', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, 'after-dark-empty.png'), fullPage: true });
    await page.evaluate(() => { localStorage.setItem('vulnera:theme','light'); });
    await page.reload();
    await page.getByRole('heading', { name: 'Metadados', exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.screenshot({ path: path.join(out, 'after-light-desktop.png'), fullPage: true });
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, `${phase}-metrics.json`), JSON.stringify({ phase, fixture: true, metrics, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ phase, metrics, pageErrors: errors }));
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
