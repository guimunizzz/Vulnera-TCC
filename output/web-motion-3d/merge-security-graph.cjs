/**
 * Prova em runtime do merge feat/security-graph → refactor/web-motion-3d no
 * container :8086: abre um scan DAST, a aba CyberGraph em 2D e em 3D, volta
 * ao Dashboard e confere canvas e erros. Só leitura (o único POST é o login).
 */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const OUT = path.join(__dirname, 'merge-security-graph');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('vulnera:theme', 'dark'));
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/429/.test(m.text())) erros.push('console: ' + m.text().slice(0, 200)); });
  const r = {};
  await page.goto('http://localhost:8086/login', { waitUntil: 'networkidle' });
  await page.getByLabel('E-mail').fill('admin@vulnera.local');
  await page.locator('input[type="password"]').fill('admin12345');
  await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await page.waitForURL(/dashboard/);
  await page.locator('a[href="/dast"]:visible').first().click();
  await page.waitForURL(/\/dast$/);
  await page.waitForLoadState('networkidle');
  await page.locator('a[href^="/dast/scans/"]').first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, 'dast-lista.png') });
  // O CyberGraph só existe em scan concluído: abre os scans até achar um.
  const hrefs = await page.locator('a[href^="/dast/scans/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))]);
  r.scans = hrefs.length;
  for (const href of hrefs) {
    await page.goto('http://localhost:8086' + href, { waitUntil: 'networkidle' });
    if (await page.getByRole('tab', { name: 'CyberGraph' }).count()) { r.scan = href; break; }
  }
  if (!r.scan) { console.log(JSON.stringify({ r, erros })); await browser.close(); return; }
  await page.getByRole('tab', { name: 'CyberGraph' }).click();
  await page.waitForTimeout(2500);
  r.canvas2D = await page.locator('canvas').count();
  r.svg2D = await page.locator('.cyber-graph svg, [data-cyber-graph] svg, svg[role="img"]').count();
  await page.screenshot({ path: path.join(OUT, 'cybergraph-2d-dark.png') });
  const botao3D = page.getByRole('button', { name: '3D', exact: true });
  r.botao3D = await botao3D.count();
  if (r.botao3D) {
    await botao3D.click();
    await page.waitForTimeout(4000);
    r.canvas3D = await page.locator('canvas').count();
    await page.screenshot({ path: path.join(OUT, 'cybergraph-3d-dark.png') });
    await page.getByRole('radio', { name: 'Claro' }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, 'cybergraph-3d-light.png') });
  }
  await page.locator('a[href="/dashboard"]:visible').first().click();
  await page.waitForURL(/dashboard/);
  await page.waitForTimeout(2500);
  r.canvasNoDashboard = await page.locator('canvas').count();
  r.atmosferaPronta = await page.locator('canvas[data-dashboard-ambient="true"][data-ready="true"]').count();
  console.log(JSON.stringify({ r, erros }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
