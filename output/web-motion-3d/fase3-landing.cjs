/**
 * Validação da Fase 3 (setup GSAP) no container :8086 (build de produção).
 * Rola a landing inteira em normal e reduzido (1440 e 375), mede os estados
 * finais das animações migradas, alterna o movimento reduzido com a página
 * aberta e captura as seções animadas para comparar ao baseline. Só leitura.
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const BASE = 'http://localhost:8086';
const OUT = path.join(__dirname, 'fase3');
fs.mkdirSync(OUT, { recursive: true });

async function rolarAteOFim(page) {
  await page.mouse.move(200, 400);
  for (let i = 0; i < 160; i += 1) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(35);
    if (await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 2)) break;
  }
  await page.waitForTimeout(1200);
}

async function estados(page) {
  return page.evaluate(() => {
    const barra = document.querySelector('[class*="z-[45]"]');
    const titulo = [...document.querySelectorAll('h2')].find((h) => /dormir tranquilo/.test(h.textContent))?.closest('div[style]') ?? null;
    const t = titulo ? getComputedStyle(titulo) : null;
    return {
      score: document.querySelector('.vx-mat-score')?.textContent,
      pontos: [...document.querySelectorAll('.vx-mat-dot')].map((c) => c.getAttribute('r')),
      barras: [...document.querySelectorAll('.vx-mat-bar')].map((b) => `${b.style.width}=${b.dataset.w}`),
      // O GSAP aplica fill-opacity como estilo; o atributo do JSX segue "0".
      areaRadar: getComputedStyle(document.querySelector('#maturidade path[stroke-linejoin]')).fillOpacity,
      barraProgresso: barra ? getComputedStyle(barra).transform : null,
      tituloFinal: t ? { opacity: t.opacity, transform: t.transform } : null,
    };
  });
}

async function capturar(page, seletor, arquivo) {
  await page.locator(seletor).evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, arquivo) });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const resultado = { execucoes: [] };
  for (const reduzido of [false, true]) {
    for (const largura of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, reducedMotion: reduzido ? 'reduce' : 'no-preference' });
      await ctx.addInitScript(() => { sessionStorage.setItem('vx-intro-seen', '1'); localStorage.setItem('vulnera:theme', 'dark'); });
      const page = await ctx.newPage();
      const erros = [];
      page.on('pageerror', (e) => erros.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
      await page.waitForSelector('#como-funciona');
      await page.waitForTimeout(1200);
      const topo = await estados(page);
      await rolarAteOFim(page);
      const fim = await estados(page);
      const modo = reduzido ? 'reduce' : 'normal';
      await capturar(page, '#como-funciona', `como-funciona-${largura}-${modo}.png`);
      await capturar(page, '#maturidade', `maturidade-${largura}-${modo}.png`);
      // Chamada final centralizada: fim do trecho do scrub.
      await page.locator('h2:has-text("dormir tranquilo")').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await page.waitForTimeout(1200);
      const centro = await estados(page);
      await page.screenshot({ path: path.join(OUT, `chamada-final-${largura}-${modo}.png`) });
      resultado.execucoes.push({ modo, largura, barraNoTopo: topo.barraProgresso, fim, tituloCentralizado: centro.tituloFinal, erros });
      await ctx.close();
    }
  }
  // Troca do movimento reduzido com a página aberta: o matchMedia do GSAP refaz.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => sessionStorage.setItem('vx-intro-seen', '1'));
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#como-funciona');
  await page.locator('h2:has-text("dormir tranquilo")').evaluate((el) => el.scrollIntoView({ block: 'end', behavior: 'instant' }));
  await page.waitForTimeout(1200);
  const antes = (await estados(page)).tituloFinal;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(1200);
  const depois = (await estados(page)).tituloFinal;
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(1200);
  const deVolta = (await estados(page)).tituloFinal;
  resultado.trocaAoVivo = { antes, depois, deVolta };
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'fase3-landing.json'), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
