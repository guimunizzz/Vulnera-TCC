/**
 * Validação da Fase 4 (landing narrativa) no container :8086 (build de produção).
 * Matriz 1440/768/375 × dark/light × movimento reduzido on/off, mais WebGL
 * desabilitado no Chrome. Para cada caso: modo (cena/pôster), canvas, erros,
 * captura dos 6 atos e a fração da tela livre da superfície (onde a cena
 * aparece) — a medida usada na decisão para telas estreitas. Depois: canvas
 * ao sair para /login e um vídeo da rolagem. Só leitura.
 * Versão ASCII (pôster em <pre>, não mais SVG); as capturas da versão de
 * pontos, descartada, ficaram em landing/.
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:8086';
const OUT = path.join(__dirname, 'landing-ascii');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function irParaAto(page, ato) {
  await page.evaluate((a) => {
    const s = document.querySelector(`section[data-ato="${a}"]`);
    // Um pouco depois do marco do ato, para o estado já ter assentado.
    const alvo = a === 0 ? 0 : s.getBoundingClientRect().top + scrollY - innerHeight / 2 + innerHeight * 0.45;
    scrollTo({ top: alvo, behavior: 'instant' });
  }, ato);
  await page.waitForTimeout(1400);
}

// Fração da viewport NÃO coberta pelas superfícies (inset de 24 px incluído).
async function areaLivre(page) {
  return page.evaluate(() => {
    const w = innerWidth;
    const h = innerHeight;
    const passo = 8;
    let livres = 0;
    let total = 0;
    const caixas = Array.from(document.querySelectorAll('.vx-superficie')).map((el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - 24, t: r.top - 24, r: r.right + 24, b: r.bottom + 24 };
    });
    for (let y = 0; y < h; y += passo) {
      for (let x = 0; x < w; x += passo) {
        total += 1;
        if (!caixas.some((c) => x >= c.l && x <= c.r && y >= c.t && y <= c.b)) livres += 1;
      }
    }
    return +(livres / total).toFixed(3);
  });
}

async function caso(browser, { largura, tema, reduzido, rotulo }) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, reducedMotion: reduzido ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((t) => localStorage.setItem('vulnera:theme', t), tema);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const estado = await page.evaluate(() => ({
    modo: document.querySelector('[data-landing-cena]')?.dataset.landingCena,
    canvas: document.querySelectorAll('canvas').length,
    pronta: document.querySelector('canvas[data-landing-scene]')?.dataset.ready ?? null,
    posterVisivel: getComputedStyle(document.querySelector('[data-landing-poster]')).opacity,
    introPresente: !!document.querySelector('[aria-label="Pular introdução"]'),
  }));
  const livre = [];
  for (let ato = 0; ato <= 5; ato += 1) {
    await irParaAto(page, ato);
    livre.push(await areaLivre(page));
    await page.screenshot({ path: path.join(OUT, `${rotulo}-ato${ato}.png`) });
  }
  const atoDoPoster = await page.evaluate(() => document.querySelector('[data-landing-poster]')?.dataset.atoAtual);
  await ctx.close();
  return { rotulo, largura, tema, reduzido, ...estado, atoDoPosterNoFim: atoDoPoster, areaLivrePorAto: livre, erros };
}

(async () => {
  const resultado = { casos: [] };
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  for (const largura of [1440, 768, 375]) {
    for (const tema of ['dark', 'light']) {
      for (const reduzido of [false, true]) {
        resultado.casos.push(await caso(browser, { largura, tema, reduzido, rotulo: `${largura}-${tema}-${reduzido ? 'reduce' : 'normal'}` }));
      }
    }
  }

  fs.writeFileSync(path.join(OUT, 'fase4-landing-matrix.json'), JSON.stringify(resultado, null, 2));

  // Sair para /login: nenhum canvas pode sobrar.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const antes = await page.locator('canvas').count();
  // Rolagem completa e contínua para o vídeo.
  await page.mouse.move(720, 450);
  for (let i = 0; i < 200; i += 1) {
    await page.mouse.wheel(0, 60);
    await page.waitForTimeout(40);
    if (await page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 2)) break;
  }
  await page.waitForTimeout(1000);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('link', { name: 'Entrar' }).first().click();
  await page.waitForURL(/\/login/);
  await page.waitForTimeout(1000);
  resultado.saidaParaLogin = { canvasNaLanding: antes, canvasNoLogin: await page.locator('canvas').count() };
  const video = await page.video().path();
  await ctx.close();
  fs.renameSync(video, path.join(OUT, 'rolagem-1440-dark.webm'));
  await browser.close();

  // WebGL desabilitado no navegador: a cena falha ao montar e o pôster fica.
  const semWebgl = await chromium.launch({ headless: true, executablePath: CHROME, args: ['--disable-3d-apis'] });
  resultado.casos.push(await caso(semWebgl, { largura: 1440, tema: 'dark', reduzido: false, rotulo: '1440-dark-sem-webgl' }));
  await semWebgl.close();

  fs.writeFileSync(path.join(OUT, 'fase4-landing-matrix.json'), JSON.stringify(resultado, null, 2));
  for (const c of resultado.casos) {
    console.log(c.rotulo.padEnd(24), `modo=${c.modo} canvas=${c.canvas} pronta=${c.pronta} poster=${c.posterVisivel} intro=${c.introPresente} atoFinal=${c.atoDoPosterNoFim} livre=${c.areaLivrePorAto.join('/')} erros=${c.erros.length}`);
  }
  console.log('saida', JSON.stringify(resultado.saidaParaLogin));
})().catch((e) => { console.error(e); process.exit(1); });
