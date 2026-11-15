/**
 * Validação da Fase 1 (code-splitting por rota) no container :8086.
 * Para ADMIN, PENTESTER e CLIENT: login, prefetch do Dashboard, navegação por
 * todos os links da sidebar, F5 em rota profunda, URL direta, voltar/avançar e
 * rota proibida. "Sem flash" = mesmos nós DOM de cabeçalho e sidebar em toda
 * navegação SPA, e nenhum deles removido (MutationObserver). Só leitura.
 */
const { chromium } = require('../../node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const BASE = 'http://localhost:8086';
const OUT = path.join(__dirname, 'fase1');
fs.mkdirSync(OUT, { recursive: true });
const CONTAS = {
  ADMIN: { email: 'admin@vulnera.local', password: 'admin12345', proibida: null },
  PENTESTER: { email: 'bruno.pentester@vulnera.local', password: 'senha12345', proibida: '/applications' },
  CLIENT: { email: 'owner@technova.demo', password: 'demo12345', proibida: '/findings' },
};
const relatorio = { inicio: new Date().toISOString(), papeis: {} };

async function esperarConteudo(page) {
  await page.waitForFunction(() => {
    const main = document.querySelector('main');
    return main && !main.querySelector('[aria-busy="true"]') && main.innerText.trim().length > 0;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(400);
}

// Marca os nós da moldura e passa a contar remoções.
async function marcarMoldura(page) {
  await page.evaluate(() => {
    window.__header = document.querySelector('header');
    window.__sidebar = document.querySelector('nav[aria-label="Navegação principal"]');
    window.__remocoes = 0;
    window.__fallbacks = 0;
    const alvo = [window.__header, window.__sidebar];
    new MutationObserver((lista) => {
      for (const m of lista) {
        for (const n of m.removedNodes) if (alvo.some((a) => a && (n === a || n.contains(a)))) window.__remocoes += 1;
        for (const n of m.addedNodes) if (n.nodeType === 1 && /Carregando página/.test(n.textContent || '')) window.__fallbacks += 1;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
}

async function molduraIntacta(page) {
  return page.evaluate(() => ({
    mesmoHeader: document.querySelector('header') === window.__header,
    mesmaSidebar: document.querySelector('nav[aria-label="Navegação principal"]') === window.__sidebar,
    remocoes: window.__remocoes,
    fallbacks: window.__fallbacks,
  }));
}

async function erroNaTela(page) {
  return page.evaluate(() => /Não foi possível abrir esta tela/.test(document.body.innerText));
}

async function validarPapel(browser, papel) {
  const conta = CONTAS[papel];
  const r = { navegacao: [], erros: [], requisicoesJs: [] };
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => localStorage.setItem('vulnera:theme', 'dark'));
  const page = await context.newPage();
  page.on('pageerror', (e) => r.erros.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/429/.test(m.text())) r.erros.push(`console: ${m.text()}`); });
  page.on('request', (q) => { if (q.resourceType() === 'script') r.requisicoesJs.push(new URL(q.url()).pathname.replace('/assets/', '')); });

  // 1. Login e prefetch: o chunk do dashboard deve chegar antes do envio.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  r.prefetchDashboardAntesDoLogin = r.requisicoesJs.some((u) => u.startsWith('dashboard-page-'));
  await page.getByLabel('E-mail').fill(conta.email);
  await page.locator('input[type="password"]').fill(conta.password);
  await page.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
  await esperarConteudo(page);
  await marcarMoldura(page);

  // 2. Todos os links da sidebar, por clique (navegação SPA).
  const links = await page.locator('nav[aria-label="Navegação principal"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  for (const href of [...new Set(links)].filter((h) => h && h.startsWith('/'))) {
    await page.waitForTimeout(700);
    await page.locator(`nav[aria-label="Navegação principal"] a[href="${href}"]`).first().click();
    await page.waitForURL((u) => u.pathname === href, { timeout: 15000 });
    await esperarConteudo(page);
    r.navegacao.push({ passo: `clique ${href}`, url: new URL(page.url()).pathname, erro: await erroNaTela(page), ...(await molduraIntacta(page)) });
  }

  // 3. Rota profunda: primeiro projeto da lista.
  await page.locator(`nav[aria-label="Navegação principal"] a[href="/projects"]`).first().click();
  await esperarConteudo(page);
  const projeto = await page.locator('main a[href^="/projects/"]').first().getAttribute('href');
  await page.locator(`main a[href="${projeto}"]`).first().click();
  await page.waitForURL((u) => u.pathname === projeto);
  await esperarConteudo(page);
  r.navegacao.push({ passo: `clique ${projeto}`, url: new URL(page.url()).pathname, erro: await erroNaTela(page), ...(await molduraIntacta(page)) });

  // 4. Voltar e avançar (histórico SPA, sem recarga).
  await page.goBack();
  await page.waitForURL((u) => u.pathname === '/projects');
  await esperarConteudo(page);
  r.navegacao.push({ passo: 'voltar', url: new URL(page.url()).pathname, erro: await erroNaTela(page), ...(await molduraIntacta(page)) });
  await page.goForward();
  await page.waitForURL((u) => u.pathname === projeto);
  await esperarConteudo(page);
  r.navegacao.push({ passo: 'avançar', url: new URL(page.url()).pathname, erro: await erroNaTela(page), ...(await molduraIntacta(page)) });
  await page.screenshot({ path: path.join(OUT, `${papel.toLowerCase()}-projeto.png`) });

  // 5. F5 na rota profunda.
  await page.reload({ waitUntil: 'networkidle' });
  await esperarConteudo(page);
  r.f5 = { url: new URL(page.url()).pathname, esperado: projeto, erro: await erroNaTela(page), temSidebar: await page.locator('nav[aria-label="Navegação principal"]').count() > 0 };

  // 6. URL direta numa aba nova (mesma sessão).
  const nova = await context.newPage();
  nova.on('pageerror', (e) => r.erros.push(`pageerror(aba): ${e.message}`));
  await nova.goto(`${BASE}${projeto}`, { waitUntil: 'networkidle' });
  await esperarConteudo(nova);
  r.urlDireta = { url: new URL(nova.url()).pathname, erro: await erroNaTela(nova), temSidebar: await nova.locator('nav[aria-label="Navegação principal"]').count() > 0 };
  await nova.close();

  // 7. Rota proibida continua redirecionando (ProtectedRoute intacto).
  if (conta.proibida) {
    await page.goto(`${BASE}${conta.proibida}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    r.rotaProibida = { pedida: conta.proibida, final: new URL(page.url()).pathname };
  }
  r.chunksJsDistintos = [...new Set(r.requisicoesJs)].length;
  await context.close();
  return r;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const papel of Object.keys(CONTAS)) relatorio.papeis[papel] = await validarPapel(browser, papel);
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'fase1-navigation.json'), JSON.stringify(relatorio, null, 2));
  }
  for (const [papel, r] of Object.entries(relatorio.papeis)) {
    const falhas = r.navegacao.filter((n) => n.erro || !n.mesmoHeader || !n.mesmaSidebar || n.remocoes > 0);
    console.log(papel, JSON.stringify({
      passos: r.navegacao.length, falhasMoldura: falhas.length, fallbacksVistos: r.navegacao.at(-1).fallbacks,
      prefetch: r.prefetchDashboardAntesDoLogin, f5: r.f5, urlDireta: r.urlDireta, rotaProibida: r.rotaProibida,
      chunksJs: r.chunksJsDistintos, erros: r.erros.length,
    }));
    for (const f of falhas) console.log('  FALHA', JSON.stringify(f));
    for (const e of r.erros) console.log('  ERRO', e);
  }
})().catch((e) => { console.error(e); process.exit(1); });
