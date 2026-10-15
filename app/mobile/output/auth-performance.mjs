/**
 * Mede o custo das telas de acesso antes/depois da otimização no Chrome local.
 * Existe para comparar estilo, script e trabalho em repouso com o mesmo roteiro;
 * o relatório desta tarefa consome os números, sem prometer FPS em outro aparelho.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium, expect } = require('@playwright/test');
const phase = process.argv.includes('--baseline') ? 'baseline' : 'optimized';
const output = new URL('./web-auth-performance/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const samples = [];
const keys = ['TaskDuration', 'ScriptDuration', 'RecalcStyleDuration', 'LayoutDuration', 'RecalcStyleCount', 'LayoutCount'];
async function metrics() { return Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value])); }
async function observe() {
  await page.evaluate(() => {
    const counters = { main: 0, background: 0, glow: 0 };
    const observer = new MutationObserver(records => {
      for (const record of records) {
        const element = record.target;
        if (element.matches('.vx-login')) counters.main++;
        else if (element.matches('.vx-login-background')) counters.background++;
        else if (element.matches('.vx-login-glow')) counters.glow++;
      }
    });
    observer.observe(document.querySelector('main'), { attributes: true, attributeFilter: ['style'], subtree: true });
    window.__authPerformance = { counters, observer };
  });
}
async function take(name, run) {
  await observe();
  const before = await metrics();
  await run();
  const after = await metrics();
  const state = await page.evaluate(() => {
    const element = document.querySelector('.vx-login-circuit');
    const result = { updates: window.__authPerformance.counters, running: getComputedStyle(element).animationPlayState, smilPaused: element.animationsPaused(), fieldCoordinate: getComputedStyle(document.querySelector('input')).getPropertyValue('--login-mouse-x'), mainCoordinate: document.querySelector('main').style.getPropertyValue('--login-mouse-x') };
    window.__authPerformance.observer.disconnect(); delete window.__authPerformance;
    return result;
  });
  const delta = Object.fromEntries(keys.map(key => [key, +(after[key] - before[key]).toFixed(6)]));
  samples.push({ name, delta, state });
  console.log(JSON.stringify({ phase, name, delta, state }));
}
try {
  await page.goto('http://127.0.0.1:3000/login');
  await expect(page.getByRole('heading', { name: 'Entrar', exact: true })).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(60, 80);
  await page.mouse.move(-5, -5);
  await expect(page.locator('.vx-login-background')).toHaveCSS('opacity', '0');
  for (let round = 0; round < 3; round++) {
    await take(`idle-${round}`, () => page.waitForTimeout(2000));
    await take(`pointer-${round}`, async () => {
      for (let step = 0; step < 150; step++) await page.mouse.move(70 + step * 8, 120 + Math.sin(step / 11) * 90);
    });
    await page.mouse.move(-5, -5);
    await expect(page.locator('.vx-login-background')).toHaveCSS('opacity', '0');
  }
  const email = page.getByRole('textbox', { name: 'E-mail', exact: true });
  await email.focus();
  await take('typing', async () => { await email.pressSequentially('pessoa.com.sobrenome@empresa.exemplo.com', { delay: 20 }); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await take('reduced-pointer', async () => {
    for (let step = 0; step < 60; step++) await page.mouse.move(80 + step * 12, 120 + Math.sin(step / 9) * 60);
  });
  const median = name => {
    const rows = samples.filter(sample => sample.name.startsWith(`${name}-`));
    return Object.fromEntries(keys.map(key => [key, rows.map(row => row.delta[key]).sort((a, b) => a - b)[Math.floor(rows.length / 2)]]));
  };
  const report = { phase, viewport: '1440x900', pointerEvents: 150, idleSeconds: 2, samples, median: { idle: median('idle'), pointer: median('pointer') } };
  await writeFile(new URL(`${phase}.json`, output), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ phase, median: report.median }));
} finally { await browser.close(); }
