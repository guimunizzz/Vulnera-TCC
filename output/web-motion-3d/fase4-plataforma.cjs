/**
 * Revalidação da atmosfera da área autenticada depois da troca para o campo
 * ASCII (Fase 4), com o mesmo protocolo da Fase 2 (fase2-scene.cjs). Aqui o
 * "fps" medido é o de redesenhos: com render sob demanda, ~4/s (tiques).
 * Validação original da Fase 2 (kit de cena three.js) no container :8086.
 * Instrumenta o WebGL para provar, sem depender de pixel: cores enviadas à GPU
 * vindas dos tokens --color-ambient-* nos dois temas, troca de tema com a cena
 * montada, orçamento de 30 fps, 1 canvas em 3 ciclos Dashboard → Findings →
 * Dashboard e pausa de Findings. Captura telas para comparar ao baseline.
 * Consumido manualmente; só leitura (o único POST é o login demo).
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:8086';
const OUT = path.join(__dirname, 'fase4-plataforma');
fs.mkdirSync(OUT, { recursive: true });
// Valores lineares (espaço de trabalho do three) dos tokens resolvidos.
const ESPERADO = {
  dark: { ink: [0.3663, 0.2582, 0.9473], muted: [0.3419, 0.3712, 0.4072] },
  light: { ink: [0.1046, 0.0242, 0.4621], muted: [0.0887, 0.107, 0.1301] },
};
// Hex aproximados que existiam antes (dashboard-scene-palette.ts), em linear.
const ANTIGO = { neutralDark: '8290a8', neutralLight: '526078' };

function instrumentar() {
  window.__cores = [];
  window.__clearsDeCor = [];
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const u3f = P.uniform3f;
    P.uniform3f = function (loc, r, g, b) { window.__cores.push([r, g, b]); return u3f.call(this, loc, r, g, b); };
    const clear = P.clear;
    P.clear = function (mask) { if (mask & 0x4000) window.__clearsDeCor.push(performance.now()); return clear.call(this, mask); };
  }
}

const perto = (a, b, tol = 0.004) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

// Com um único material, o three só reenvia o uniform quando o valor muda
// (cache por programa): as cores chegam à GPU na montagem e em cada troca de
// tema. Por isso o registro é zerado ANTES da ação, não depois.
async function zerarCores(page) {
  await page.evaluate(() => { window.__cores = []; });
}
async function coresRecentes(page) {
  await page.waitForTimeout(800);
  return page.evaluate(() => window.__cores);
}

async function fpsDaCena(page, ms = 3000) {
  await page.evaluate(() => { window.__clearsDeCor = []; });
  await page.waitForTimeout(ms);
  const n = await page.evaluate(() => window.__clearsDeCor.length);
  return +(n * 1000 / ms).toFixed(1);
}

async function esperarCena(page) {
  await page.waitForSelector('canvas[data-dashboard-ambient="true"][data-ready="true"]', { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function canvasCount(page) {
  return page.locator('canvas[data-dashboard-ambient="true"]').count();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const r = { inicio: new Date().toISOString(), erros: [], temas: {}, ciclos: [] };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => { if (!localStorage.getItem('vulnera:theme')) localStorage.setItem('vulnera:theme', 'dark'); });
  await context.addInitScript(instrumentar);
  const page = await context.newPage();
  page.on('pageerror', (e) => r.erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/429/.test(m.text())) r.erros.push(`console: ${m.text()}`); });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('E-mail').fill('admin@vulnera.local');
  await page.locator('input[type="password"]').fill('admin12345');
  await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await page.waitForURL(/dashboard/);
  await esperarCena(page);

  // 1. Cores e fps no dark; troca para light COM a cena montada.
  for (const tema of ['dark', 'light']) {
    if (tema === 'light') {
      const antes = await page.evaluateHandle(() => document.querySelector('canvas[data-dashboard-ambient="true"]'));
      await zerarCores(page);
      await page.getByRole('radio', { name: 'Claro' }).click();
      await page.waitForTimeout(300);
      r.temas.mesmoCanvasAposTroca = await page.evaluate((c) => c === document.querySelector('canvas[data-dashboard-ambient="true"]'), antes);
    }
    const cores = await coresRecentes(page);
    r.temas[tema] = {
      dataTheme: await page.evaluate(() => document.documentElement.getAttribute('data-theme')),
      inkEnviado: cores.some((c) => perto(c, ESPERADO[tema].ink)),
      mutedEnviado: cores.some((c) => perto(c, ESPERADO[tema].muted)),
      corDoOutroTema: cores.some((c) => perto(c, ESPERADO[tema === 'dark' ? 'light' : 'dark'].ink)),
      fpsDashboard: await fpsDaCena(page),
    };
    await page.screenshot({ path: path.join(OUT, `dashboard-1440-${tema}.png`), fullPage: true });
  }
  r.antigoNeutro = ANTIGO;

  // 2. Findings nos dois temas (mesmo canvas do layout).
  await page.locator('a[href="/findings"]:visible').first().click();
  await page.waitForURL(/\/findings$/);
  await esperarCena(page);
  await page.screenshot({ path: path.join(OUT, 'findings-1440-light.png'), fullPage: true });
  await zerarCores(page);
  await page.getByRole('radio', { name: 'Escuro' }).click();
  await page.waitForTimeout(600);
  r.findingsDarkInk = (await coresRecentes(page)).some((c) => perto(c, ESPERADO.dark.ink));
  await page.screenshot({ path: path.join(OUT, 'findings-1440-dark.png'), fullPage: true });

  // 3. Pausa de Findings (vulnera:ambient-pause) desmonta e retoma o canvas.
  await page.getByRole('button', { name: 'Pausar animações' }).click();
  await page.waitForTimeout(500);
  r.pausa = { canvasPausado: await canvasCount(page) };
  await page.getByRole('button', { name: 'Retomar animações' }).click();
  await esperarCena(page);
  r.pausa.canvasRetomado = await canvasCount(page);

  // 4. Três ciclos Dashboard → Findings → Dashboard.
  for (let i = 1; i <= 3; i += 1) {
    await page.waitForTimeout(600);
    await page.locator('a[href="/dashboard"]:visible').first().click();
    await page.waitForURL(/dashboard/);
    await esperarCena(page);
    const noDashboard = await canvasCount(page);
    await page.waitForTimeout(600);
    await page.locator('a[href="/findings"]:visible').first().click();
    await page.waitForURL(/\/findings$/);
    await esperarCena(page);
    const noFindings = await canvasCount(page);
    r.ciclos.push({ ciclo: i, noDashboard, noFindings });
  }
  await page.locator('a[href="/dashboard"]:visible').first().click();
  await esperarCena(page);
  r.ciclos.push({ final: 'dashboard', canvas: await canvasCount(page), totalCanvasNaPagina: await page.locator('canvas').count() });

  // 5. Movimento reduzido: o gate nem baixa o chunk de three; fica o fallback.
  const reduzido = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const pr = await reduzido.newPage();
  await pr.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await pr.getByLabel('E-mail').fill('admin@vulnera.local');
  await pr.locator('input[type="password"]').fill('admin12345');
  await pr.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await pr.waitForURL(/dashboard/);
  await pr.waitForLoadState('networkidle');
  await pr.waitForTimeout(1500);
  r.reduzido = {
    canvas: await pr.locator('canvas').count(),
    fallback: await pr.locator('.dashboard-atmosphere-fallback').count(),
    chunkDeThree: await pr.evaluate(() => performance.getEntriesByType('resource').some((e) => /use-dashboard-scene|dashboard-ambient-canvas|palette-/.test(e.name))),
  };
  await reduzido.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'fase4-plataforma.json'), JSON.stringify(r, null, 2));
  console.log(JSON.stringify({ temas: r.temas, findingsDarkInk: r.findingsDarkInk, pausa: r.pausa, ciclos: r.ciclos, reduzido: r.reduzido, erros: r.erros }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
