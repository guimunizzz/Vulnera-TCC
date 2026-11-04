/**
 * Performance da landing depois da Fase 4 (cena narrativa), com o MESMO
 * protocolo de baseline-perf.cjs: Chrome com janela (GPU real), rolagem por
 * roda do mouse, trace do DevTools, draw calls e quadros renderizados
 * (gl.clear) por canvas. Não há mais intro. Consumido manualmente; só leitura.
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:8086';
const OUT = path.join(__dirname, 'landing-ascii');
const RUNS = Number(process.argv[2] ?? 2);
fs.mkdirSync(OUT, { recursive: true });

// Instrumentação injetada antes de qualquer script da página.
function instrument() {
  const ids = new WeakMap();
  let next = 0;
  window.__draws = {};
  window.__clears = {};
  window.__frames = 0;
  window.__longTasks = [];
  const wrap = (proto) => {
    if (!proto) return;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = proto[name];
      if (!original) continue;
      proto[name] = function (...args) {
        const canvas = this.canvas;
        if (!ids.has(canvas)) ids.set(canvas, `c${next++}`);
        const id = ids.get(canvas);
        canvas.dataset.perfId = id;
        window.__draws[id] = (window.__draws[id] || 0) + 1;
        return original.apply(this, args);
      };
    }
  };
  for (const proto of [window.WebGLRenderingContext && WebGLRenderingContext.prototype, window.WebGL2RenderingContext && WebGL2RenderingContext.prototype]) {
    if (!proto) continue;
    const clear = proto.clear;
    proto.clear = function (mask) {
      const canvas = this.canvas;
      if (!ids.has(canvas)) ids.set(canvas, `c${next++}`);
      window.__clears[ids.get(canvas)] = (window.__clears[ids.get(canvas)] || 0) + 1;
      return clear.call(this, mask);
    };
  }
  wrap(window.WebGLRenderingContext && WebGLRenderingContext.prototype);
  wrap(window.WebGL2RenderingContext && WebGL2RenderingContext.prototype);
  const tick = () => { window.__frames += 1; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks.push({ start: Math.round(e.startTime), duration: Math.round(e.duration) });
    }).observe({ type: 'longtask', buffered: true });
  } catch { /* sem suporte */ }
}

async function snapshot(page) {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll('canvas')).map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.dataset.perfId || null, inViewport: r.bottom > 0 && r.top < innerHeight && r.width > 0, w: c.width, h: c.height };
    });
    return { t: performance.now(), frames: window.__frames, draws: { ...window.__draws }, clears: { ...window.__clears }, scrollY: scrollY, canvases };
  });
}

async function gpuInfo(page) {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'desconhecido', dpr: devicePixelRatio, ua: navigator.userAgent };
  });
}

async function runIntro(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await context.addInitScript(() => localStorage.setItem('vulnera:theme', 'dark'));
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(`${BASE}/`);
  await page.getByRole('button', { name: 'Pular introdução' }).waitFor();
  const start = await snapshot(page);
  await page.getByRole('button', { name: 'Pular introdução' }).waitFor({ state: 'detached', timeout: 20000 });
  const end = await snapshot(page);
  const result = {
    ateBotaoPularMs: Math.round(start.t),
    duracaoIntroMs: Math.round(end.t - start.t),
    introVisivelMs: Date.now() - t0,
    fpsMedio: +(((end.frames - start.frames) * 1000) / (end.t - start.t)).toFixed(1),
    drawsDuranteIntro: end.draws,
    longTasks: await page.evaluate(() => window.__longTasks),
    canvasesAposIntro: end.canvases,
  };
  await context.close();
  return result;
}

async function runScroll(browser, index) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await context.addInitScript(() => { localStorage.setItem('vulnera:theme', 'dark'); sessionStorage.setItem('vx-intro-seen', '1'); });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const gpu = await gpuInfo(page);
  // Traces passam de 50 MB: fora do repositório quando TRACE_DIR é passado.
  const tracePath = path.join(process.env.TRACE_DIR || OUT, `landing-scroll-trace-fase4-${index}.json`);
  await browser.startTracing(page, { path: tracePath, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'blink.user_timing', 'gpu'] });
  await page.evaluate(() => { window.__longTasks = []; });
  await page.mouse.move(720, 450);
  const segments = [];
  let previous = await snapshot(page);
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  // ~100px a cada 60ms: rolagem contínua de cima a baixo.
  while (previous.scrollY < maxScroll - 2) {
    for (let i = 0; i < 8; i += 1) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
    const now = await snapshot(page);
    const hero = now.canvases[0];
    segments.push({
      scrollY: Math.round(now.scrollY),
      fps: +(((now.frames - previous.frames) * 1000) / (now.t - previous.t)).toFixed(1),
      heroNaViewport: hero ? hero.inViewport : null,
      drawsHeroNoTrecho: hero && hero.id ? (now.draws[hero.id] || 0) - (previous.draws[hero.id] || 0) : 0,
    });
    previous = now;
    if (segments.length > 400) break;
  }
  // Parado no rodapé: o hero está fora da viewport. Ele continua desenhando?
  const before = await snapshot(page);
  await page.waitForTimeout(3000);
  const after = await snapshot(page);
  await browser.stopTracing();
  const heroId = after.canvases[0] && after.canvases[0].id;
  const result = {
    gpu,
    maxScroll,
    fpsMedioRolando: +(segments.reduce((s, x) => s + x.fps, 0) / segments.length).toFixed(1),
    fpsMinimoTrecho: Math.min(...segments.map((x) => x.fps)),
    longTasks: await page.evaluate(() => window.__longTasks),
    canvases: after.canvases,
    rodape3s: {
      heroNaViewport: after.canvases[0] ? after.canvases[0].inViewport : null,
      drawsHero: heroId ? (after.draws[heroId] || 0) - (before.draws[heroId] || 0) : 0,
      quadrosRenderizados: heroId ? (after.clears[heroId] || 0) - (before.clears[heroId] || 0) : 0,
      fps: +(((after.frames - before.frames) * 1000) / (after.t - before.t)).toFixed(1),
    },
    trechosForaDaViewportComDraw: segments.filter((x) => x.heroNaViewport === false && x.drawsHeroNoTrecho > 0).length,
    trechosForaDaViewport: segments.filter((x) => x.heroNaViewport === false).length,
    segments,
    trace: path.basename(tracePath),
  };
  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--window-size=1460,1000', '--window-position=0,0'],
  });
  const report = { maquina: 'i7-1165G7 (8 threads), Iris Xe + MX350, 15,7 GB, Windows 11, Chrome 156', startedAt: new Date().toISOString() };
  try {
    report.scroll = [];
    for (let i = 1; i <= RUNS; i += 1) report.scroll.push(await runScroll(browser, i));
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'landing-perf-fase4.json'), JSON.stringify(report, null, 2));
  }
  const { scroll } = report;
  for (const s of scroll) {
    console.log('SCROLL', JSON.stringify({ gpu: s.gpu.renderer, dpr: s.gpu.dpr, maxScroll: s.maxScroll, fpsMedio: s.fpsMedioRolando, fpsMin: s.fpsMinimoTrecho, longTasks: s.longTasks.length, longTaskMax: Math.max(0, ...s.longTasks.map((x) => x.duration)), rodape: s.rodape3s, foraComDraw: `${s.trechosForaDaViewportComDraw}/${s.trechosForaDaViewport}`, canvases: s.canvases.length }));
  }
})().catch((e) => { console.error(e); process.exit(1); });
