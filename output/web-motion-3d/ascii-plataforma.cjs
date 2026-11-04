/**
 * Captura a atmosfera ASCII da área autenticada (Dashboard, Projetos,
 * Findings) nos dois temas, com o estado do canvas e erros de console.
 * Uso: node ascii-plataforma.cjs <base> <pasta>. Só leitura (login demo).
 */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');
const [base = 'http://localhost:5179', pasta = path.join(__dirname, 'ascii-dev')] = process.argv.slice(2);
fs.mkdirSync(pasta, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const tema of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem('vulnera:theme', t), tema);
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/429/.test(m.text())) erros.push(m.text().slice(0, 300)); });
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(base + '/login', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByLabel('E-mail').fill('admin@vulnera.local', { timeout: 120000 });
    await page.locator('input[type="password"]').fill('admin12345');
    await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
    await page.waitForURL(/dashboard/, { timeout: 60000 });
    for (const rota of ['dashboard', 'projects', 'findings']) {
      if (rota !== 'dashboard') {
        await page.waitForTimeout(800);
        await page.locator(`a[href="/${rota}"]:visible`).first().click();
        await page.waitForURL(new RegExp(`/${rota}$`));
      }
      await page.waitForSelector('canvas[data-dashboard-ambient="true"][data-ready="true"]', { timeout: 30000 }).catch(() => {});
      // Captura com os dados na tela, não o esqueleto de carregamento.
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await page.getByText('Carregando dados').first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(pasta, `plataforma-${rota}-${tema}.png`) });
    }
    console.log(tema, 'canvas', await page.locator('canvas').count(), 'pronto', await page.locator('canvas[data-ready="true"]').count(), 'erros', erros.length ? erros.join(' || ') : 0);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
