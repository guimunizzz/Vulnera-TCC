/**
 * Fluidez do fundo ASCII (landing e plataforma) no container :8086, em Chrome
 * COM janela (GPU real). Mede, por trecho: desenhos da cena por segundo
 * (gl.clear de cor) e o intervalo entre quadros do navegador (RAF) — média,
 * p95 e a fração de quadros acima de 25 ms (engasgo perceptível).
 * Trechos: parado, rolando (landing), depois de um clique (gota).
 * Uso: node fluidez.cjs <rotulo>. Só leitura (o POST é o login demo).
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = 'http://localhost:8086';
const rotulo = process.argv[2] ?? 'medicao';
const OUT = path.join(__dirname, 'fluidez');
fs.mkdirSync(OUT, { recursive: true });

function instrumentar() {
  window.__clears = 0;
  window.__quadros = [];
  window.__longas = [];
  try {
    new PerformanceObserver((lista) => lista.getEntries().forEach((e) => window.__longas.push(Math.round(e.duration))))
      .observe({ type: 'longtask', buffered: false });
  } catch { /* sem suporte: fica vazio */ }
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const clear = P.clear;
    P.clear = function (mask) { if (mask & 0x4000) window.__clears += 1; return clear.call(this, mask); };
  }
  let anterior = 0;
  const medir = (agora) => { if (anterior) window.__quadros.push(agora - anterior); anterior = agora; requestAnimationFrame(medir); };
  requestAnimationFrame(medir);
}

async function trecho(page, ms, acao) {
  await page.evaluate(() => { window.__clears = 0; window.__quadros = []; window.__longas = []; });
  const inicio = Date.now();
  if (acao) await acao();
  const resto = ms - (Date.now() - inicio);
  if (resto > 0) await page.waitForTimeout(resto);
  ms = Date.now() - inicio;
  const { clears, quadros, longas } = await page.evaluate(() => ({ clears: window.__clears, quadros: window.__quadros, longas: window.__longas }));
  const ordenados = [...quadros].sort((a, b) => a - b);
  const media = quadros.reduce((s, q) => s + q, 0) / Math.max(1, quadros.length);
  return {
    // Duas passadas por quadro (células + tela): ~120 clears/s = 60 quadros/s.
    quadrosDaCenaPorSegundo: +((clears * 1000) / ms / 2).toFixed(1),
    fpsNavegador: +(1000 / media).toFixed(1),
    p95ms: +(ordenados[Math.floor(ordenados.length * 0.95)] ?? 0).toFixed(1),
    engasgos: +(quadros.filter((q) => q > 25).length / Math.max(1, quadros.length)).toFixed(3),
    tarefasLongas: longas.length,
    tarefaLongaMaxMs: Math.max(0, ...longas),
  };
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--window-size=1460,1000', '--window-position=0,0'],
  });
  const r = { rotulo, quando: new Date().toISOString() };

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('vulnera:theme', 'dark'));
  await ctx.addInitScript(instrumentar);
  const landing = await ctx.newPage();
  await landing.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await landing.waitForSelector('canvas[data-landing-scene][data-ready="true"]', { timeout: 20000 });
  await landing.waitForTimeout(1500);
  r.landingParada = await trecho(landing, 3000);
  await landing.mouse.move(720, 450);
  r.landingRolando = await trecho(landing, 3000, async () => {
    for (let i = 0; i < 45; i += 1) { await landing.mouse.wheel(0, 60); await landing.waitForTimeout(60); }
  });
  await landing.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await landing.waitForTimeout(800);
  r.landingGota = await trecho(landing, 2000, () => landing.mouse.click(200, 640));

  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('E-mail').fill('admin@vulnera.local');
  await page.locator('input[type="password"]').fill('admin12345');
  await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await page.waitForURL(/dashboard/);
  await page.waitForSelector('canvas[data-dashboard-ambient="true"][data-ready="true"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  r.plataformaParada = await trecho(page, 3000);
  r.plataformaGota = await trecho(page, 2000, () => page.mouse.click(1400, 860));
  await page.goto(`${BASE}/findings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.mouse.move(800, 500);
  r.plataformaRolando = await trecho(page, 3000, async () => {
    for (let i = 0; i < 40; i += 1) { await page.mouse.wheel(0, 60); await page.waitForTimeout(50); }
  });

  await browser.close();
  fs.writeFileSync(path.join(OUT, `${rotulo}.json`), JSON.stringify(r, null, 2));
  console.log(JSON.stringify(r, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
