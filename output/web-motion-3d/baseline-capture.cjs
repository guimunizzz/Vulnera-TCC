/**
 * Baseline visual da Fase 0 do refactor web-motion-3d.
 * Captura a landing (cada seção) e Dashboard/Aplicações/Projetos em 1440/768/375
 * px nos temas dark e light, servidos pelo container em http://localhost:8086.
 * Consumido manualmente na Fase 0; só faz leituras (o único POST é o login demo).
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:8086';
const OUT = path.join(__dirname, 'baseline');
const WIDTHS = [1440, 768, 375];
const THEMES = ['dark', 'light'];
const ACCOUNTS = {
  admin: { email: 'admin@vulnera.local', password: 'admin12345' },
  client: { email: 'owner@technova.demo', password: 'demo12345' },
};
fs.mkdirSync(OUT, { recursive: true });

const report = { startedAt: new Date().toISOString(), landing: [], app: [], errors: [] };

async function newContext(browser, width, theme) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'no-preference' });
  await context.addInitScript((t) => {
    localStorage.setItem('vulnera:theme', t);
    sessionStorage.setItem('vx-intro-seen', '1');
  }, theme);
  return context;
}

function watch(page, label) {
  page.on('pageerror', (e) => report.errors.push({ label, type: 'pageerror', text: e.message }));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push({ label, type: 'console', text: m.text() }); });
}

async function captureLanding(browser, width, theme) {
  const context = await newContext(browser, width, theme);
  const page = await context.newPage();
  const label = `landing-${width}-${theme}`;
  watch(page, label);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('section');
  await page.waitForTimeout(1500);
  const count = await page.locator('.vx-landing section').count();
  for (let i = 0; i < count; i += 1) {
    const section = page.locator('.vx-landing section').nth(i);
    const name = await section.evaluate((el, idx) => el.id || ['hero', 'problema'][idx] || `secao-${idx}`, i);
    await section.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    // Reveal/ScrollTrigger disparam uma vez; espera a entrada terminar.
    await page.waitForTimeout(1600);
    const file = `landing-${String(i).padStart(2, '0')}-${name}-${width}-${theme}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    report.landing.push({ file, width, theme, canvases: await page.locator('canvas').count() });
  }
  await context.close();
}

async function login(page, account) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('E-mail').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20000 });
}

async function captureApp(browser, role, widths, theme) {
  const context = await newContext(browser, widths[0], theme);
  const page = await context.newPage();
  watch(page, `app-${role}-${theme}`);
  await login(page, ACCOUNTS[role]);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['dashboard', 'applications', 'projects']) {
      // Espaça as recargas: o rate limiter (ADR-040) responde 429 em rajadas.
      await page.waitForTimeout(2500);
      await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2000);
      const estado = await page.evaluate(() => ({ ocupado: !!document.querySelector('[aria-busy="true"]'), erro: /Tentar novamente/.test(document.body.innerText) }));
      const file = `app-${role}-${route}-${width}-${theme}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true });
      report.app.push({ file, role, route, width, theme, canvases: await page.locator('canvas').count(), url: page.url(), ...estado });
    }
  }
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const somenteApp = process.argv.includes('--app');
    for (const theme of THEMES) {
      if (!somenteApp) for (const width of WIDTHS) await captureLanding(browser, width, theme);
      await captureApp(browser, 'admin', WIDTHS, theme);
      await captureApp(browser, 'client', [1440], theme);
    }
  } finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(OUT, process.argv.includes('--app') ? 'baseline-report-app.json' : 'baseline-report.json'), JSON.stringify(report, null, 2));
  }
  console.log(`landing=${report.landing.length} app=${report.app.length} errors=${report.errors.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
