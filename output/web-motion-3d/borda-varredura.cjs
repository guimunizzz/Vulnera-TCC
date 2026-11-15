/** Borda ASCII do plano recomendado e varredura de transição entre seções no :8086 (Chrome com janela, GPU real). Só leitura. */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const OUT = path.join(__dirname, 'borda-varredura');
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => sessionStorage.setItem('vulnera:boot-visto', '1'));
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('console', (m) => m.type() === 'error' && erros.push(m.text().slice(0, 150)));
  await p.goto('http://localhost:8086/', { waitUntil: 'networkidle' });
  await p.waitForSelector('canvas[data-ready="true"]', { timeout: 20000 });
  // Rola de uma seção para a próxima e captura durante a varredura.
  await p.mouse.wheel(0, 900);
  for (const ms of [250, 500, 800]) {
    await p.waitForTimeout(ms === 250 ? 250 : 250);
    await p.screenshot({ path: path.join(OUT, `varredura-${ms}ms.png`) });
  }
  await p.locator('#planos').scrollIntoViewIfNeeded();
  await p.waitForTimeout(2500);
  const card = p.locator('.vx-borda-ascii').first();
  const caixa = await card.boundingBox();
  await p.screenshot({ path: path.join(OUT, 'pricing.png'), clip: { x: caixa.x - 20, y: caixa.y - 20, width: caixa.width + 40, height: caixa.height + 40 } });
  const t1 = await p.locator('.vx-borda-ascii-topo .vx-borda-ascii-faixa').evaluate((e) => getComputedStyle(e).transform);
  await p.waitForTimeout(300);
  const t2 = await p.locator('.vx-borda-ascii-topo .vx-borda-ascii-faixa').evaluate((e) => getComputedStyle(e).transform);
  console.log({ bordas: await p.locator('.vx-borda-ascii').count(), animando: t1 !== t2, erros });
  await b.close();
})();
