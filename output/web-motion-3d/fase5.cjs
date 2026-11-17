/**
 * Validação da Fase 5 (Dashboard, Aplicações, Projetos) e da gota d'água no
 * container :8086. Para cada papel: as telas que ele pode abrir, nos dois
 * temas, em 1440 e 375 px, com erros de console. Depois: menu "⋯" de
 * Aplicações, filtro por card em Projetos e a gota (clique no fundo) na
 * plataforma e na landing, contando redesenhos durante e depois da onda.
 * Uso: node fase5.cjs. Só leitura (os POSTs são logins demo).
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:8086';
const OUT = path.join(__dirname, 'fase5');
fs.mkdirSync(OUT, { recursive: true });
const PAPEIS = {
  admin: { email: 'admin@vulnera.local', senha: 'admin12345', rotas: ['dashboard', 'applications', 'projects'] },
  client: { email: 'owner@technova.demo', senha: 'demo12345', rotas: ['dashboard', 'applications', 'projects'] },
  pentester: { email: 'bruno.pentester@vulnera.local', senha: 'senha12345', rotas: ['dashboard', 'projects'] },
};

function contarClears() {
  window.__clears = 0;
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    const clear = P.clear;
    P.clear = function (mask) { if (mask & 0x4000) window.__clears += 1; return clear.call(this, mask); };
  }
}

async function redesenhosPorSegundo(page, ms) {
  const antes = await page.evaluate(() => window.__clears);
  await page.waitForTimeout(ms);
  return +((((await page.evaluate(() => window.__clears)) - antes) * 1000) / ms).toFixed(1);
}

async function entrar(page, { email, senha }) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('E-mail').fill(email);
  await page.locator('input[type="password"]').fill(senha);
  await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await page.waitForURL(/dashboard/, { timeout: 30000 });
}

async function irPara(page, rota) {
  await page.goto(`${BASE}/${rota}`, { waitUntil: 'networkidle' });
  await page.getByText('Carregando').first().waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const r = { telas: [], erros: [] };

  for (const [papel, cred] of Object.entries(PAPEIS)) {
    for (const largura of [1440, 375]) {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 900 } });
      await ctx.addInitScript(() => { if (!localStorage.getItem('vulnera:theme')) localStorage.setItem('vulnera:theme', 'dark'); });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => r.erros.push(`${papel}/${largura} pageerror: ${e.message}`));
      page.on('console', (m) => { if (m.type() === 'error' && !/429/.test(m.text())) r.erros.push(`${papel}/${largura} console: ${m.text().slice(0, 200)}`); });
      await entrar(page, cred);
      for (const tema of ['dark', 'light']) {
        await page.evaluate((t) => localStorage.setItem('vulnera:theme', t), tema);
        for (const rota of cred.rotas) {
          await irPara(page, rota);
          const largo = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
          await page.screenshot({ path: path.join(OUT, `${papel}-${rota}-${largura}-${tema}.png`), fullPage: true });
          r.telas.push({ papel, rota, largura, tema, rolagemHorizontal: largo });
        }
      }
      await ctx.close();
    }
  }

  // Interações (ADMIN, 1440, dark).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => localStorage.setItem('vulnera:theme', 'dark'));
  await ctx.addInitScript(contarClears);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => r.erros.push(`interacao pageerror: ${e.message}`));
  await entrar(page, PAPEIS.admin);

  await irPara(page, 'applications');
  await page.getByRole('button', { name: /^Mais ações para / }).first().click();
  r.menuAplicacao = await page.getByRole('menuitem').allInnerTexts();
  await page.screenshot({ path: path.join(OUT, 'interacao-applications-menu.png') });
  await page.keyboard.press('Escape');

  await irPara(page, 'projects');
  await page.getByRole('region', { name: 'Fluxo dos projetos' }).getByRole('button', { name: /Concluídos/ }).click();
  r.filtroProjetos = await page.getByText(/^Mostrando/).innerText();
  await page.screenshot({ path: path.join(OUT, 'interacao-projects-filtro.png') });

  // Gota na plataforma: clique num vão do fundo (abaixo do conteúdo).
  await irPara(page, 'dashboard');
  await page.waitForSelector('canvas[data-dashboard-ambient="true"][data-ready="true"]', { timeout: 20000 });
  r.plataformaParada = await redesenhosPorSegundo(page, 2000);
  const alvo = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth - 40, innerHeight - 40);
    return { tag: el?.tagName, interativo: Boolean(el?.closest('a,button,input,select,textarea')) };
  });
  r.alvoDoClique = alvo;
  await page.mouse.click(innerWidthFallback(1440) - 40, 900 - 40);
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, 'gota-plataforma-0350ms.png') });
  r.plataformaOnda = await redesenhosPorSegundo(page, 1000);
  await page.screenshot({ path: path.join(OUT, 'gota-plataforma-1350ms.png') });
  await page.waitForTimeout(1500);
  r.plataformaDepois = await redesenhosPorSegundo(page, 2000);
  // Clique num botão não faz onda.
  const antesBotao = await page.evaluate(() => window.__clears);
  await page.getByRole('radio', { name: 'Escuro' }).click();
  await page.waitForTimeout(1000);
  r.cliqueNoBotaoRedesenhos = (await page.evaluate(() => window.__clears)) - antesBotao;
  await ctx.close();

  // Gota na landing: clique na margem esquerda.
  const ctxL = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctxL.addInitScript(() => localStorage.setItem('vulnera:theme', 'dark'));
  await ctxL.addInitScript(contarClears);
  const landing = await ctxL.newPage();
  landing.on('pageerror', (e) => r.erros.push(`landing pageerror: ${e.message}`));
  await landing.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await landing.waitForSelector('canvas[data-landing-scene][data-ready="true"]', { timeout: 20000 });
  await landing.waitForTimeout(1200);
  await landing.screenshot({ path: path.join(OUT, 'landing-antes-da-gota.png') });
  r.landingParada = await redesenhosPorSegundo(landing, 2000);
  await landing.mouse.click(200, 640);
  await landing.waitForTimeout(450);
  await landing.screenshot({ path: path.join(OUT, 'gota-landing-0450ms.png') });
  r.landingOnda = await redesenhosPorSegundo(landing, 800);
  await landing.screenshot({ path: path.join(OUT, 'gota-landing-1250ms.png') });
  await landing.waitForTimeout(1800);
  r.landingDepois = await redesenhosPorSegundo(landing, 2000);
  await ctxL.close();

  await browser.close();
  fs.writeFileSync(path.join(OUT, 'fase5.json'), JSON.stringify(r, null, 2));
  const comRolagem = r.telas.filter((t) => t.rolagemHorizontal);
  console.log(JSON.stringify({
    telas: r.telas.length, comRolagemHorizontal: comRolagem, menuAplicacao: r.menuAplicacao, filtroProjetos: r.filtroProjetos,
    alvoDoClique: r.alvoDoClique,
    plataforma: { parada: r.plataformaParada, onda: r.plataformaOnda, depois: r.plataformaDepois, cliqueNoBotao: r.cliqueNoBotaoRedesenhos },
    landing: { parada: r.landingParada, onda: r.landingOnda, depois: r.landingDepois },
    erros: r.erros,
  }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });

function innerWidthFallback(w) { return w; }
