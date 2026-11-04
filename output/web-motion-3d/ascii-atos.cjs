/**
 * Captura os 6 atos da cena ASCII (dev :5179 ou container :8086) nos dois
 * temas, com erros de console e o estado da cena. Iteração visual da Fase 4.
 * Uso: node ascii-atos.cjs <base> <pasta> [largura]
 */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');
const [base = 'http://localhost:5179', pasta = path.join(__dirname, 'ascii-dev'), largura = '1440'] = process.argv.slice(2);
fs.mkdirSync(pasta, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  for (const tema of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: Number(largura), height: 900 } });
    await ctx.addInitScript((t) => localStorage.setItem('vulnera:theme', t), tema);
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error' || /THREE|WebGL|shader/i.test(m.text())) erros.push(m.text().slice(0, 400)); });
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('section[data-ato="5"]', { timeout: 120000 });
    await page.waitForTimeout(3000);
    const estado = await page.evaluate(() => ({ modo: document.querySelector('[data-landing-cena]')?.dataset.landingCena, pronta: document.querySelector('canvas[data-landing-scene]')?.dataset.ready ?? null }));
    for (const ato of [0, 1, 2, 3, 4, 5]) {
      await page.evaluate((a) => { const s = document.querySelector(`section[data-ato="${a}"]`); scrollTo({ top: a === 0 ? 0 : s.getBoundingClientRect().top + scrollY - innerHeight / 2 + innerHeight * (a === 2 ? 0.25 : 0.45), behavior: 'instant' }); }, ato);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(pasta, `${largura}-${tema}-ato${ato}.png`) });
    }
    console.log(tema, JSON.stringify(estado), 'erros:', erros.length ? erros.join(' || ') : 0);
    await ctx.close();
  }
  await browser.close();
})();
