/**
 * Captura cada seção da landing, tela a tela, para revisar ritmo vertical,
 * tipografia e alinhamento (ciclo de autocrítica visual, ADR-054).
 *
 * Uso: node secoes.cjs [base] [pasta] [larguraxaltura] [tema]
 * Precisa do app no ar. Só leitura.
 */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');

const [base = 'http://localhost:5179', pasta = path.join(__dirname, 'secoes'), tamanho = '1440x900', tema = 'dark'] = process.argv.slice(2);
const [largura, altura] = tamanho.split('x').map(Number);
fs.mkdirSync(pasta, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME || path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura } });
  await ctx.addInitScript((t) => {
    localStorage.setItem('vulnera:theme', t);
    sessionStorage.setItem('vulnera:boot-visto', '1');
  }, tema);
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('section[data-ato="5"]', { timeout: 120000 });
  await page.waitForTimeout(2500);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  let n = 0;
  for (let y = 0; y < total - altura * 0.3; y += Math.round(altura * 0.85)) {
    await page.evaluate((top) => scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(pasta, `${largura}-${tema}-${String(n).padStart(2, '0')}.png`) });
    n += 1;
  }
  console.log(tamanho, tema, n, 'telas');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
