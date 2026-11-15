/**
 * Atmosfera da área autenticada depois do redesenho "com vida" (ondas ASCII,
 * aurora, brilho, hover, varredura) no container :8086. Captura: Dashboard
 * parado nos dois temas, no meio da varredura de entrada, com o ponteiro
 * sobre um vão, e a transição para Findings. Conta erros e confere que o
 * clique NÃO gera gota na plataforma. Uso: node atmosfera-viva.cjs. Só leitura.
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const OUT = path.join(__dirname, 'atmosfera-viva');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const erros = [];
  for (const tema of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem('vulnera:theme', t), tema);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => erros.push(`${tema} pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error' && !/429/.test(m.text())) erros.push(`${tema} console: ${m.text().slice(0, 200)}`); });
    await page.goto('http://localhost:8086/login', { waitUntil: 'networkidle' });
    await page.getByLabel('E-mail').fill('admin@vulnera.local');
    await page.locator('input[type="password"]').fill('admin12345');
    await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
    await page.waitForURL(/dashboard/);
    await page.waitForSelector('canvas[data-dashboard-ambient="true"][data-ready="true"]', { timeout: 20000 });
    if (tema === 'dark') {
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(OUT, `dashboard-varredura-${tema}.png`) });
    }
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `dashboard-${tema}.png`) });
    if (tema === 'dark') {
      // Hover sobre o vão abaixo do conteúdo.
      for (let i = 0; i <= 10; i += 1) { await page.mouse.move(700 + i * 30, 840); await page.waitForTimeout(40); }
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, 'dashboard-hover-dark.png') });
      // Clique no fundo não pode gerar gota (nem erro).
      await page.mouse.click(1000, 860);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(OUT, 'dashboard-clique-sem-gota-dark.png') });
      // Transição de página.
      await page.locator('a[href="/findings"]:visible').first().click();
      await page.waitForURL(/\/findings$/);
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, 'transicao-findings-dark.png') });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, 'findings-dark.png') });
    }
    console.log(tema, 'canvas', await page.locator('canvas').count());
    await ctx.close();
  }
  await browser.close();
  console.log('erros', erros.length ? erros.join(' || ') : 0);
})().catch((e) => { console.error(e); process.exit(1); });
