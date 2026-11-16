/**
 * Captura a landing em cada ato para o ciclo de autocrítica visual do
 * terreno (ADR-055). Além dos seis atos, tira quadros no meio da virada
 * (progresso ~2,8 a 3,3), que é o momento que precisa "ler" de longe.
 *
 * Uso: node capturar.cjs <base> <pasta> [larguraxaltura] [modo]
 *   modo: normal | reduzido | contraste
 * SO=ato0,ato3 captura só os quadros citados (para os modos em que a cena não roda).
 * Precisa do app no ar (Vite dev ou container web). Só leitura.
 */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const fs = require('node:fs');

const [base = 'http://localhost:5179', pasta = path.join(__dirname, 'capturas'), tamanho = '1440x900', modo = 'normal'] = process.argv.slice(2);
const [largura, altura] = tamanho.split('x').map(Number);
fs.mkdirSync(pasta, { recursive: true });

// Fração do trecho entre o ato k e o k+1 em que cada quadro é tirado.
const QUADROS = [
  ['ato0', 0], ['ato1', 1], ['ato2', 1.5], ['virada-a', 2.85], ['virada-b', 3.05],
  ['ato3', 3.5], ['ato4', 4.1], ['ato4-fim', 4.45], ['ato5', 5],
];

(async () => {
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== '0',
    executablePath: process.env.CHROME || path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  for (const tema of ['dark', 'light']) {
    const ctx = await browser.newContext({
      viewport: { width: largura, height: altura },
      reducedMotion: modo === 'reduzido' ? 'reduce' : 'no-preference',
      deviceScaleFactor: Number(process.env.DPR || 1),
    });
    await ctx.addInitScript(([t, m]) => {
      localStorage.setItem('vulnera:theme', t);
      sessionStorage.setItem('vulnera:boot-visto', '1');
      if (m === 'contraste') localStorage.setItem('vulnera:a11y', JSON.stringify({ altoContraste: true }));
    }, [tema, modo]);
    const page = await ctx.newPage();
    const erros = [];
    page.on('console', (m) => { if (m.type() === 'error' || /THREE|WebGL|shader/i.test(m.text())) erros.push(m.text().slice(0, 600)); });
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForSelector('section[data-ato="5"]', { timeout: 120000 });
    await page.waitForTimeout(3000);
    const estado = await page.evaluate(() => ({
      modo: document.querySelector('[data-landing-cena]')?.dataset.landingCena,
      pronta: document.querySelector('canvas[data-landing-scene]')?.dataset.ready ?? null,
    }));
    const so = process.env.SO ? process.env.SO.split(',') : null;
    for (const [nome, progresso] of QUADROS.filter(([n]) => !so || so.includes(n))) {
      await page.evaluate((p) => {
        const topo = (a) => {
          if (a === 0) return 0;
          const s = document.querySelector(`section[data-ato="${a}"]`);
          return Math.max(0, s.getBoundingClientRect().top + scrollY - innerHeight / 2);
        };
        const a = Math.min(4, Math.floor(p));
        const y = topo(a) + (topo(a + 1) - topo(a)) * (p - a);
        scrollTo({ top: Math.min(y, document.documentElement.scrollHeight - innerHeight), behavior: 'instant' });
      }, progresso);
      await page.waitForTimeout(2200);
      // FORMATO=jpg gera capturas leves, para versionar em docs/evidencias/.
      const jpg = process.env.FORMATO === 'jpg';
      await page.screenshot({
        path: path.join(pasta, `${largura}-${tema}-${modo === 'normal' ? '' : modo + '-'}${nome}.${jpg ? 'jpg' : 'png'}`),
        ...(jpg ? { type: 'jpeg', quality: 82 } : {}),
      });
    }
    console.log(tema, tamanho, modo, JSON.stringify(estado), 'erros:', erros.length ? erros.join(' || ') : 0);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
