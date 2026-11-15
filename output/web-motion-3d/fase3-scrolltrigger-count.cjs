/**
 * Conta ScrollTrigger.getAll() na landing servida pelo Vite DEV (porta 5179).
 * Em dev a página pode importar o mesmo módulo que o app usa (mesma URL com
 * ?v=), sem expor nada em produção. Fluxo: carrega "/", rola até o fim, sai
 * para /login pela navbar e volta (histórico), três vezes. Só leitura.
 * Uso: node fase3-scrolltrigger-count.cjs [rotulo] [reduce]
 */
const { chromium } = require('../../node_modules/playwright');
const BASE = 'http://localhost:5179';
const rotulo = process.argv[2] || 'medicao';
const reduzido = process.argv[3] === 'reduce';

async function contar(page) {
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => /gsap_ScrollTrigger\.js/.test(n) || /gsap\/ScrollTrigger/.test(n));
    if (!url) return { url: null, total: null };
    const mod = await import(url);
    const ST = mod.ScrollTrigger || mod.default;
    return { total: ST.getAll().length };
  });
}

async function rolarAteOFim(page) {
  await page.mouse.move(700, 400);
  for (let i = 0; i < 120; i += 1) {
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(30);
    const fim = await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 2);
    if (fim) break;
  }
  await page.waitForTimeout(800);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reduzido ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(() => sessionStorage.setItem('vx-intro-seen', '1'));
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#como-funciona');
  await page.waitForTimeout(1500);
  const r = { rotulo, reduzido, inicio: await contar(page) };
  await rolarAteOFim(page);
  r.aposRolar = await contar(page);
  r.ciclos = [];
  for (let i = 1; i <= 3; i += 1) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.getByRole('link', { name: 'Entrar' }).first().click();
    await page.waitForURL(/\/login/);
    await page.waitForTimeout(800);
    const noLogin = await contar(page);
    await page.goBack();
    await page.waitForSelector('#como-funciona');
    await page.waitForTimeout(1500);
    const aoVoltar = await contar(page);
    await rolarAteOFim(page);
    r.ciclos.push({ ciclo: i, noLogin: noLogin.total, aoVoltar: aoVoltar.total, aposRolar: (await contar(page)).total });
  }
  r.erros = erros;
  console.log(JSON.stringify(r));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
