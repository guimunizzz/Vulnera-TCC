/**
 * Quadros da rolagem da landing (container :8086, 1440×900, dark) para o GIF
 * da Fase 4. A cena é dirigida pelo scroll, então cada passo de rolagem é um
 * quadro determinístico. Uso: node fase4-gif.cjs <pasta-dos-quadros> e depois
 * python fase4-gif.py <pasta-dos-quadros> <saida.gif>. Só leitura.
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const [pasta] = process.argv.slice(2);
fs.mkdirSync(pasta, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('vulnera:theme', 'dark'));
  const page = await ctx.newPage();
  await page.goto('http://localhost:8086/', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas[data-landing-scene][data-ready="true"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const quadros = 90;
  for (let i = 0; i <= quadros; i += 1) {
    await page.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), Math.round((total * i) / quadros));
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(pasta, `q${String(i).padStart(3, '0')}.png`) });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
