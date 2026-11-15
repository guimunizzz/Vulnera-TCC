/**
 * Diagnóstico: durante a rolagem da landing, quem chama gl.clear e quantas
 * vezes por quadro? Conta contextos WebGL criados, clears por contexto e por
 * alvo (tela × render target) e quadros de RAF. Só leitura.
 */
const { chromium } = require('../../node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--window-size=1460,1000'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    window.__d = { contextos: 0, telas: 0, alvos: 0, quadros: 0, pilhas: {} };
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (tipo, ...resto) {
      const c = get.call(this, tipo, ...resto);
      if (c && /webgl/.test(tipo) && !c.__contado) { c.__contado = true; window.__d.contextos += 1; }
      return c;
    };
    for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const clear = P.clear;
      P.clear = function (mask) {
        if (mask & 0x4000) {
          const fb = this.getParameter(this.FRAMEBUFFER_BINDING);
          if (fb) window.__d.alvos += 1; else window.__d.telas += 1;
          const pilha = (new Error().stack || '').split('\n').slice(2, 6).join(' | ').replace(/https?:\/\/[^)]*\//g, '');
          window.__d.pilhas[pilha] = (window.__d.pilhas[pilha] || 0) + 1;
        }
        return clear.call(this, mask);
      };
    }
    let ant = 0; const q = (agora) => { window.__d.quadros += 1; if (ant && window.__d.intervalos) window.__d.intervalos.push(agora - ant); ant = agora; requestAnimationFrame(q); };
    requestAnimationFrame(q);
  });
  const page = await ctx.newPage();
  await page.goto('http://localhost:8086/', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas[data-landing-scene][data-ready="true"]');
  if (process.env.CSS_EXTRA) await page.addStyleTag({ content: process.env.CSS_EXTRA });
  await page.waitForTimeout(1500);
  const zerar = () => page.evaluate(() => { Object.assign(window.__d, { telas: 0, alvos: 0, quadros: 0, pilhas: {}, t0: performance.now(), intervalos: [] }); });
  await zerar();
  await page.waitForTimeout(2000);
  console.log('PARADO', JSON.stringify(await page.evaluate(() => ({ ...window.__d, pilhas: undefined }))));
  if (process.env.SEGUNDA_PASSAGEM) {
    await page.mouse.move(720, 450);
    for (let i = 0; i < 40; i += 1) { await page.mouse.wheel(0, 60); await page.waitForTimeout(50); }
    await page.waitForTimeout(800);
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(800);
  }
  await zerar();
  await page.mouse.move(720, 450);
  for (let i = 0; i < 40; i += 1) { await page.mouse.wheel(0, 60); await page.waitForTimeout(50); }
  const d = await page.evaluate(() => { const s = performance.now() - window.__d.t0; const iv = window.__d.intervalos; return { ...window.__d, segundos: +(s / 1000).toFixed(2), fps: +(window.__d.quadros / (s / 1000)).toFixed(1), acima25ms: iv.filter((x) => x > 25).length, maiorMs: Math.round(Math.max(...iv)), intervalos: undefined }; });
  console.log('ROLANDO', JSON.stringify({ ...d, pilhas: undefined }));
  console.log(Object.entries(d.pilhas).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${v}x ${k}`).join('\n'));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
