/**
 * Merge de `dev` (menu de acessibilidade) na refactor/web-motion-3d, no
 * container :8086. Prova que as opções do menu chegam às cenas do refactor:
 *   - landing: cena WebGL monta; "Reduzir animações" troca para o pôster;
 *     "Alto contraste" tira cena E pôster;
 *   - plataforma: atmosfera monta; cada uma das duas opções a desmonta, e
 *     desligar devolve o canvas;
 *   - texto a 200%: Dashboard, Aplicações e Projetos sem rolagem horizontal.
 * Uso: node merge-dev.cjs. Só leitura (não cria dado).
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const OUT = path.join(__dirname, 'merge-dev');
fs.mkdirSync(OUT, { recursive: true });

const resultado = [];
const ok = (nome, cond, extra = '') => resultado.push(`${cond ? 'OK  ' : 'FALHA'} ${nome}${extra ? ` (${extra})` : ''}`);

async function abrirMenu(page) {
  await page.getByRole('button', { name: /^Acessibilidade/ }).first().click();
  const painel = page.getByRole('dialog', { name: 'Acessibilidade' });
  await painel.waitFor();
  return painel;
}
async function fecharMenu(page) { await page.keyboard.press('Escape'); }
async function alternar(page, rotulo) {
  const painel = await abrirMenu(page);
  await painel.getByRole('switch', { name: rotulo }).click();
  await fecharMenu(page);
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('limpo')) { localStorage.removeItem('vulnera:a11y'); sessionStorage.setItem('limpo', '1'); } } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/429/.test(m.text())) erros.push(`console: ${m.text().slice(0, 200)}`); });

  // ---------- Landing ----------
  await page.goto('http://localhost:8086/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-landing-cena="webgl"] canvas', { timeout: 20000 });
  ok('landing: cena WebGL monta', (await page.locator('[data-landing-cena] canvas').count()) === 1);
  ok('landing: botão de acessibilidade na barra', await page.getByRole('button', { name: /^Acessibilidade/ }).isVisible());

  await alternar(page, 'Reduzir animações');
  ok('landing + reduzir: sem canvas', (await page.locator('[data-landing-cena] canvas').count()) === 0);
  ok('landing + reduzir: pôster visível', await page.locator('.vx-poster').isVisible());
  await page.screenshot({ path: path.join(OUT, 'landing-reduzir.png') });
  await alternar(page, 'Reduzir animações');
  await page.waitForSelector('[data-landing-cena="webgl"] canvas', { timeout: 20000 });
  ok('landing: desligar reduzir devolve a cena', (await page.locator('[data-landing-cena] canvas').count()) === 1);

  await alternar(page, 'Alto contraste');
  ok('landing + alto contraste: sem canvas', (await page.locator('[data-landing-cena] canvas').count()) === 0);
  ok('landing + alto contraste: pôster oculto', !(await page.locator('.vx-poster').isVisible()));
  await page.screenshot({ path: path.join(OUT, 'landing-alto-contraste.png') });
  await alternar(page, 'Alto contraste');

  // ---------- Plataforma ----------
  await page.goto('http://localhost:8086/login', { waitUntil: 'networkidle' });
  await page.getByLabel('E-mail').fill('admin@vulnera.local');
  await page.locator('input[type="password"]').fill('admin12345');
  await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await page.waitForURL(/dashboard/);
  const atmosfera = 'canvas[data-dashboard-ambient="true"]';
  await page.waitForSelector(`${atmosfera}[data-ready="true"]`, { timeout: 20000 });
  ok('plataforma: atmosfera monta', (await page.locator(atmosfera).count()) === 1);

  await alternar(page, 'Reduzir animações');
  ok('plataforma + reduzir: sem canvas', (await page.locator(atmosfera).count()) === 0);
  await alternar(page, 'Reduzir animações');
  await page.waitForSelector(`${atmosfera}[data-ready="true"]`, { timeout: 20000 });
  ok('plataforma: desligar reduzir devolve o canvas', (await page.locator(atmosfera).count()) === 1);

  await alternar(page, 'Alto contraste');
  ok('plataforma + alto contraste: sem canvas', (await page.locator(atmosfera).count()) === 0);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(OUT, 'dashboard-alto-contraste.png') });
  await alternar(page, 'Alto contraste');
  await page.waitForSelector(`${atmosfera}[data-ready="true"]`, { timeout: 20000 });

  // ---------- Texto a 200% ----------
  const painel = await abrirMenu(page);
  for (let i = 0; i < 5; i += 1) await painel.getByRole('button', { name: 'Aumentar texto' }).click();
  await fecharMenu(page);
  for (const [rota, nome] of [['/dashboard', 'dashboard'], ['/applications', 'aplicacoes'], ['/projects', 'projetos']]) {
    await page.goto(`http://localhost:8086${rota}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok(`200%: ${rota} sem rolagem horizontal`, sw <= cw, `${sw}/${cw}`);
    await page.screenshot({ path: path.join(OUT, `${nome}-texto-200.png`) });
  }
  const escala = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
  ok('200%: raiz em 32px', escala === '32px', escala);
  const p2 = await abrirMenu(page);
  await p2.getByRole('button', { name: 'Restaurar padrão' }).click();
  await fecharMenu(page);

  await ctx.close();
  await browser.close();
  console.log(resultado.join('\n'));
  console.log('erros', erros.length ? erros.join(' || ') : 0);
  fs.writeFileSync(path.join(OUT, 'resultado.txt'), `${resultado.join('\n')}\nerros ${erros.length ? erros.join(' || ') : 0}\n`);
})().catch((e) => { console.error(e); process.exit(1); });
