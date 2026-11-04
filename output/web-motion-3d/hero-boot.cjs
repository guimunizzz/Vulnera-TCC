/** Boot do hero no :8086: 1ª visita, recarregar, movimento reduzido, pular por tecla, âncora. Só leitura. */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const OUT = path.join(__dirname, 'hero-boot');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const r = {};
  const erros = [];
  const novaPagina = async (opts = {}) => {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => erros.push(e.message));
    return p;
  };
  let p = await novaPagina();
  await p.goto('http://localhost:8086/');
  await p.waitForSelector('.vx-boot', { timeout: 5000 });
  await p.waitForTimeout(450);
  await p.screenshot({ path: path.join(OUT, 'boot-meio.png') });
  r.bootNaPrimeira = await p.locator('.vx-boot').count();
  await p.waitForTimeout(1500);
  r.bootDepoisDe2s = await p.locator('.vx-boot').count();
  r.tituloVisivel = await p.getByRole('heading', { level: 1 }).isVisible();
  await p.screenshot({ path: path.join(OUT, 'depois.png') });
  await p.reload();
  await p.waitForTimeout(600);
  r.bootAoRecarregar = await p.locator('.vx-boot').count();

  p = await novaPagina();
  await p.goto('http://localhost:8086/');
  await p.waitForSelector('.vx-boot');
  const t0 = Date.now();
  await p.keyboard.press('Space');
  await p.waitForSelector('.vx-boot', { state: 'detached' });
  r.pularMs = Date.now() - t0;

  p = await novaPagina({ reducedMotion: 'reduce' });
  await p.goto('http://localhost:8086/');
  await p.waitForTimeout(500);
  r.bootComReduce = await p.locator('.vx-boot').count();

  p = await novaPagina();
  await p.goto('http://localhost:8086/#demo');
  await p.waitForTimeout(500);
  r.bootComAncora = await p.locator('.vx-boot').count();

  console.log(r, 'erros', erros);
  await b.close();
})();
