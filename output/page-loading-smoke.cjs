/**
 * Valida navegação e espera no Chrome contra a web e API de desenvolvimento.
 * Usa a conta demo existente e somente leituras; o 429 artificial isola a
 * recuperação da tela sem alterar limites ou dados. Consumido manualmente.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/50786702893/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const result = { date: '2026-10-01', checks: [], responses: [], pageErrors: [] };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) result.responses.push({ path: url.pathname, query: url.pathname.includes('/metrics/') ? url.search : undefined, status: response.status(), at: Date.now() });
  });
  const check = (description, value) => { assert(value, description); result.checks.push(description); };
  const settled = async () => {
    await page.waitForFunction(() => !document.querySelector('header [role="status"][aria-busy="true"]'), null, { timeout: 25_000 });
    assert.equal(await page.locator('[role="alert"]').filter({ hasText: /Não foi possível|Não conseguimos/ }).count(), 0);
  };
  try {
    await page.goto('http://localhost:8086/login');
    await page.getByLabel(/e-mail/i).fill('admin@vulnera.local');
    await page.locator('input[type="password"]').fill('admin12345');
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.waitForURL('**/dashboard');
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.locator('[aria-busy="true"]').first().waitFor({ state: 'hidden', timeout: 25_000 }).catch(() => {});
    await settled();
    check('Login demo e dashboard carregam', page.url().endsWith('/dashboard'));

    let projectRequests = 0;
    const firstProjectAt = Date.now();
    await page.route('**/api/projects', async (route) => {
      projectRequests += 1;
      if (projectRequests === 1) {
        await route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ code: 'RATE_LIMITED', retryAfterSeconds: 2 }) });
      } else {
        check('Nova tentativa respeita a espera de dois segundos', Date.now() - firstProjectAt >= 2_000);
        await route.continue();
      }
    });
    await page.locator('nav a[href="/projects"]').click();
    await page.getByText('Carregando dados…', { exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
    check('429 mantém spinner e não exibe erro prematuro', await page.getByRole('button', { name: 'Tentar novamente', exact: true }).count() === 0);
    await page.screenshot({ path: path.join(__dirname, 'page-loading-spinner.png') });
    await page.getByRole('table').waitFor({ timeout: 25_000 });
    await settled();
    check('Projetos recupera automaticamente sem clique', projectRequests === 2);
    await page.unroute('**/api/projects');

    await page.locator('nav a[href="/applications"]').click();
    await page.getByRole('table').waitFor();
    await settled();
    const beforeReturn = result.responses.filter((item) => item.path === '/api/projects').length;
    await page.locator('nav a[href="/projects"]').click();
    await page.getByRole('table').waitFor();
    await settled();
    check('Retorno recente aos projetos reaproveita cache', result.responses.filter((item) => item.path === '/api/projects').length === beforeReturn);

    for (const route of ['/findings', '/remediation', '/playbooks', '/dast', '/settings/sla', '/admin/subscriptions']) {
      await page.locator(`nav a[href="${route}"]`).click();
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.locator('[aria-busy="true"]').first().waitFor({ state: 'hidden', timeout: 25_000 }).catch(() => {});
      await settled();
      check(`Navegação ${route} sem erro de carregamento`, new URL(page.url()).pathname === route);
    }
    await page.locator('nav a[href="/applications"]').click();
    await page.getByRole('table').waitFor();
    const panel = page.getByRole('link', { name: 'Painel', exact: true }).first();
    const panelUrl = await panel.getAttribute('href');
    const beforePanel = result.responses.length;
    const summaryReady = page.waitForResponse((response) => response.url().includes('/metrics/summary') && response.status() === 200, { timeout: 25_000 });
    const seriesReady = page.waitForResponse((response) => response.url().includes('/metrics/timeseries') && response.status() === 200, { timeout: 25_000 });
    await panel.click();
    await Promise.all([summaryReady, seriesReady]);
    await page.getByRole('tab', { name: 'Postura atual', exact: true }).waitFor();
    await page.locator('[aria-busy="true"]').first().waitFor({ state: 'hidden', timeout: 25_000 }).catch(() => {});
    await settled();
    const initialMetrics = result.responses.slice(beforePanel).filter((item) => item.path.includes('/metrics/'));
    check('Painel inicial não busca insights nem comparison', initialMetrics.every((item) => !/insights|comparison/.test(item.path)));
    check('Uma única janela de métricas durante a transição', new Set(initialMetrics.map((item) => item.query)).size === 1);
    check('Resumo e série recebem respostas 200', initialMetrics.filter((item) => item.status === 200).length === 2);
    check('Painel de aplicação abre com dados reais', new URL(page.url()).pathname === panelUrl);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.screenshot({ path: path.join(__dirname, 'page-loading-mobile.png'), fullPage: true });
    check('Mobile 375px sem overflow horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check('Sem exceções de JavaScript', result.pageErrors.length === 0);
    result.passed = true;
  } catch (error) {
    result.passed = false;
    result.failure = error.message;
    await page.screenshot({ path: path.join(__dirname, 'page-loading-failure.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    fs.writeFileSync(path.join(__dirname, 'page-loading-smoke-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ passed: result.passed, checks: result.checks, failure: result.failure, pageErrors: result.pageErrors }));
    await browser.close();
  }
})();
