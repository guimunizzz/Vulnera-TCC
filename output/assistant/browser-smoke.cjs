/**
 * Exercita o Assistente Vulnera no navegador com fixtures isoladas.
 * Existe para provar UI, acessibilidade e sessão sem usar Gemini nem gravar dados.
 * Consumidores: validação da entrega e revisão visual da banca.
 */
const { chromium } = require('@playwright/test');
const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const origin = process.env.ASSISTANT_QA_URL || 'http://127.0.0.1:5173';
const output = process.env.ASSISTANT_QA_OUTPUT ? path.resolve(process.env.ASSISTANT_QA_OUTPUT) : __dirname;
const results = [];
const pageErrors = [];
const existingLimitations = [];
const securityViolations = [];
const servedAssets = new Set();
const date = '2026-10-23T12:00:00.000Z';
const company = { id: 'qa-company', name: 'Empresa Ficticia QA', cnpj: null, planId: 'plan-qa', createdAt: date, updatedAt: date };
const application = { id: 'qa-application', name: 'Portal Ficticio', url: 'https://qa.example.invalid', companyId: company.id, environment: 'PROD', criticality: 'MEDIUM', internetFacing: true, dataSensitivity: 'INTERNAL', description: 'Somente fixture de navegador', techStack: null, isActive: true, createdAt: date, updatedAt: date };
const project = { id: 'qa-project', name: 'Projeto Ficticio', applicationId: application.id, companyId: company.id, status: 'IN_REVIEW', analysisType: 'DAST', analysisLevel: 'BASIC', hasRemediation: true, requestedAt: date, startedAt: null, closedAt: null, updatedAt: date, scopeIn: null, scopeOut: null, notes: null, description: null };
const plan = { id: 'plan-qa', name: 'Plano QA', maxApplications: 10, maxProjects: 10, includesRemediation: true, price: 0, isActive: true, createdAt: date };
const subscription = { id: 'subscription-qa', companyId: company.id, planId: plan.id, status: 'ACTIVE', createdAt: date, updatedAt: date, startDate: date, endDate: null };
const reportHtml = '<!doctype html><html lang="pt-BR"><head><title>ZAP fixture</title></head><body><h1>Relatorio ficticio ZAP</h1></body></html>';
const actionIds = ['dashboard', 'projects', 'applications', 'new-analysis', 'findings', 'dast', 'remediation', 'playbooks', 'sla-settings'];
const allowedActions = {
  ADMIN: actionIds,
  CLIENT: ['dashboard', 'projects', 'applications', 'new-analysis', 'playbooks', 'sla-settings'],
  PENTESTER: ['dashboard', 'projects', 'findings', 'dast', 'remediation', 'playbooks'],
};
const actionLabels = {
  dashboard: 'Abrir dashboard', projects: 'Abrir projetos', applications: 'Abrir aplicações',
  'new-analysis': 'Solicitar análise', findings: 'Abrir findings', dast: 'Abrir DAST',
  remediation: 'Abrir remediação', playbooks: 'Abrir playbooks', 'sla-settings': 'Abrir configuração de SLA',
};

async function check(name, callback) {
  if (process.env.ASSISTANT_QA_FILTER && !name.includes(process.env.ASSISTANT_QA_FILTER)) return;
  console.log('START ' + name);
  try { await callback(); results.push({ name, ok: true }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, ok: false, error: error.message }); console.error('FAIL ' + name + ': ' + error.message); }
}

function assistant(page) {
  return {
    root: page.getByTestId('assistant-root'),
    launcher: page.getByTestId('assistant-launcher'),
    mascot: page.getByTestId('assistant-mascot'),
    panel: page.getByRole('dialog', { name: 'Assistente Vulnera', exact: true }),
    input: page.getByRole('textbox', { name: 'Sua pergunta', exact: true }),
    submit: page.getByRole('button', { name: 'Enviar pergunta', exact: true }),
  };
}

async function createPage(browser, { role = 'ADMIN', theme = 'dark', width = 1440, height = 900, reduced = 'reduce', route = '/dashboard', signedIn = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion: reduced });
  const page = await context.newPage();
  page.setDefaultTimeout(12_000);
  const user = { id: 'qa-' + role.toLowerCase(), name: 'Pessoa Ficticia QA', email: 'qa@example.invalid', role, companyId: role === 'CLIENT' ? company.id : null, companyRole: role === 'CLIENT' ? 'OWNER' : null, createdAt: date };
  const requests = [];
  const harness = { page, context, user, requests, delay: 0, source: 'local', responseActionIds: actionIds, message: '1. Cadastre a aplicação.\n2. Use Solicitar análise para escolher o alvo.\n3. Acompanhe o pedido em Projetos.' };
  page.on('pageerror', (error) => pageErrors.push({ role, theme, width, message: error.message }));
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to|violates.*directive/i.test(message.text())) securityViolations.push({ role, theme, width, message: message.text() });
  });
  await page.addInitScript(({ user, theme, signedIn }) => {
    // O HTML ZAP permanece em origem opaca: fixtures de autenticação só pertencem ao pai.
    if (window.top !== window) return;
    if (signedIn) localStorage.setItem('vulnera-auth', JSON.stringify({ state: { user, accessToken: 'qa-browser-fixture', refreshToken: 'qa-browser-fixture' }, version: 0 }));
    localStorage.setItem('vulnera:theme', theme);
  }, { user, theme, signedIn });
  await page.route('**/*', async (intercepted) => {
    const request = intercepted.request();
    const url = new URL(request.url());
    if (!['xhr', 'fetch'].includes(request.resourceType()) || /^\/(src|node_modules|@)/.test(url.pathname)) return intercepted.continue();
    const pathname = url.pathname.replace(/^\/api/, '');
    const headers = { 'access-control-allow-origin': '*' };
    if (request.method() === 'OPTIONS') return intercepted.fulfill({ status: 204, headers: { ...headers, 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (pathname === '/assistant/chat') {
      requests.push({ method: request.method(), body: request.postDataJSON() });
      if (harness.delay) await new Promise((resolve) => setTimeout(resolve, harness.delay));
      return intercepted.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify({ message: harness.message, source: harness.source, actions: [...harness.responseActionIds.map((id) => ({ id, label: 'ROTULO FORJADO' })), { id: 'javascript:alert(1)', label: 'Executar ação proibida' }] }) }).catch(() => {});
    }
    if (pathname.endsWith('/report/html')) return intercepted.fulfill({ status: 200, headers, contentType: 'text/html', body: reportHtml });
    let data = [];
    if (pathname === '/applications') data = [application];
    else if (pathname === '/applications/' + application.id) data = application;
    else if (pathname === '/projects') data = [project];
    else if (pathname === '/projects/' + project.id) data = project;
    else if (pathname === '/companies') data = [company];
    else if (pathname === '/companies/me') data = company;
    else if (pathname === '/users/me') data = harness.user;
    else if (pathname === '/users') data = [harness.user];
    else if (pathname === '/auth/login') data = { user: harness.user, accessToken: 'new-qa-fixture', refreshToken: 'new-qa-fixture' };
    else if (pathname === '/subscriptions/current') data = subscription;
    else if (pathname === '/subscriptions/active') data = [subscription];
    else if (pathname === '/plans') data = [plan];
    else if (pathname === '/vulnerabilities') data = { data: [], pagination: { page: 1, pageSize: 5, total: 0, totalPages: 0 }, facets: { severity: {}, status: {}, company: {}, owasp: {}, assignee: {}, application: {} } };
    else if (pathname === '/dast/scans/status') data = { dockerAvailable: false, activeScans: 0, queuedScans: 0, maxConcurrentScans: 1 };
    return intercepted.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(data) });
  });
  const navigation = await page.goto(origin + route, { waitUntil: 'networkidle' });
  harness.navigationHeaders = navigation ? await navigation.allHeaders() : {};
  const assets = await page.locator('script[src]').evaluateAll((scripts) => scripts.map((script) => script.getAttribute('src')));
  for (const asset of assets) servedAssets.add(asset);
  await page.evaluate(() => document.fonts.ready);
  harness.layoutBaseline = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, viewport: window.innerWidth }));
  return harness;
}

async function boxInside(locator, width, height) {
  const box = await locator.boundingBox();
  assert.ok(box, 'Elemento sem retangulo visivel');
  assert.ok(box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= width + 0.5 && box.y + box.height <= height + 0.5, JSON.stringify(box));
  return box;
}

async function openChat(page) {
  const ui = assistant(page);
  await ui.launcher.click();
  await ui.panel.waitFor();
  return ui;
}

async function send(page, question) {
  const ui = assistant(page);
  await ui.input.fill(question);
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/assistant/chat') && response.request().method() === 'POST'),
    ui.submit.click(),
  ]);
  await ui.panel.getByText('Ajuda local', { exact: true }).first().waitFor();
}

async function main() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [role, theme] of [['ADMIN', 'dark'], ['CLIENT', 'light'], ['PENTESTER', 'system']]) {
      await check(role + ': envio explicito, acoes filtradas, navegacao e origem', async () => {
        const harness = await createPage(browser, { role, theme });
        const { page, context, requests } = harness;
        try {
          const ui = assistant(page);
          if (process.env.ASSISTANT_QA_REQUIRE_CSP === 'true') assert.ok(harness.navigationHeaders['content-security-policy']?.includes('script-src'), 'Bundle servido deve ter CSP');
          assert.equal(await ui.root.count(), 1);
          assert.equal(await ui.launcher.count(), 1);
          await boxInside(ui.mascot, 1440, 900);
          await page.keyboard.press('Tab');
          assert.equal(await page.locator(':focus').getAttribute('href'), '#conteudo');
          await openChat(page);
          await ui.input.fill('Como solicito uma análise?');
          await page.waitForTimeout(250);
          assert.equal(requests.length, 0, 'Abrir/digitar chamou a API');
          await ui.submit.click();
          await ui.panel.getByText('Ajuda local', { exact: true }).first().waitFor();
          assert.equal(requests.length, 1);
          assert.equal(requests[0].body.screen, 'dashboard');
          assert.equal(requests[0].body.history.length, 0);
          assert.deepEqual(Object.keys(requests[0].body).sort(), ['history', 'question', 'screen']);
          for (const id of actionIds) {
            assert.equal(await ui.panel.getByRole('button', { name: actionLabels[id], exact: true }).count(), allowedActions[role].includes(id) ? 1 : 0, 'Acao ' + id + '/' + role);
          }
          assert.equal(await ui.panel.getByText('ROTULO FORJADO', { exact: true }).count(), 0);
          assert.equal(await ui.panel.getByText('Executar ação proibida', { exact: true }).count(), 0);
          await ui.root.evaluate((element) => element.setAttribute('data-qa-instance', 'preserved'));
          await ui.panel.getByRole('button', { name: 'Abrir projetos', exact: true }).click();
          await page.waitForURL('**/projects');
          assert.equal(await ui.root.count(), 1);
          assert.equal(await ui.root.getAttribute('data-qa-instance'), 'preserved');
          assert.equal(requests.length, 1, 'Navegacao enviou mensagem');
          if (!await ui.panel.isVisible()) await openChat(page);
          await ui.panel.getByText(/Cadastre a aplicação/).waitFor();
          harness.responseActionIds = ['projects', 'playbooks'];
          await send(page, 'O que posso fazer nesta tela?');
          assert.equal(requests.at(-1).body.screen, 'projects');
          assert.ok(requests.at(-1).body.history.length >= 2);
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(output, role.toLowerCase() + '-' + theme + '-desktop.png') });
          await page.keyboard.press('Escape');
          await ui.panel.waitFor({ state: 'hidden' });
          assert.equal(await ui.launcher.evaluate((element) => element === document.activeElement), true);
          assert.equal(requests.length, 2);
        } finally { await context.close(); }
      });
    }

    await check('Sugestoes/refoco sem chamadas; trava duplicada e contexto capturado no envio', async () => {
      const harness = await createPage(browser, { route: '/projects?company=nao-enviar&target=https%3A%2F%2Fnao-enviar.invalid' });
      const { page, context, requests } = harness;
      try {
        const ui = await openChat(page);
        await ui.panel.getByRole('button', { name: 'O que posso fazer nesta tela?', exact: true }).click();
        assert.equal(await ui.input.inputValue(), 'O que posso fazer nesta tela?');
        await page.bringToFront();
        await page.waitForTimeout(200);
        assert.equal(requests.length, 0);
        harness.delay = 900;
        await ui.submit.evaluate((button) => { button.click(); button.click(); });
        await page.waitForTimeout(120);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].body.screen, 'projects');
        assert.equal(JSON.stringify(requests[0].body).includes('nao-enviar'), false);
        await page.getByRole('navigation', { name: 'Navegação principal', exact: true }).getByRole('link', { name: 'Dashboard', exact: true }).click();
        await page.waitForURL('**/dashboard');
        await ui.panel.getByText('Ajuda local', { exact: true }).first().waitFor();
        assert.equal(requests.length, 1);
        assert.equal(requests[0].body.screen, 'projects');
      } finally { await context.close(); }
    });

    await check('Movimento autonomo, pausa por hover/foco/manual e resize', async () => {
      const { page, context, requests } = await createPage(browser, { reduced: 'no-preference' });
      try {
        const ui = assistant(page);
        await ui.mascot.waitFor();
        await page.mouse.move(600, 400);
        const first = await ui.mascot.boundingBox();
        await page.waitForTimeout(4200);
        const later = await boxInside(ui.mascot, 1440, 900);
        assert.ok(Math.abs(first.x - later.x) + Math.abs(first.y - later.y) > 1, 'Mascote nao se deslocou');
        // O alvo se move por requisito; force dispensa apenas a espera de estabilidade do driver.
        await ui.launcher.hover({ force: true });
        await page.waitForTimeout(100);
        assert.ok((await ui.mascot.getAttribute('data-pause-reasons')).includes('hover'));
        const stopped = await ui.mascot.boundingBox();
        await page.waitForTimeout(350);
        const hoverBox = await ui.mascot.boundingBox();
        assert.ok(Math.abs(stopped.x - hoverBox.x) + Math.abs(stopped.y - hoverBox.y) < 1);
        await ui.launcher.focus();
        await page.mouse.move(600, 400);
        assert.ok((await ui.mascot.getAttribute('data-pause-reasons')).includes('focus'));
        await page.getByRole('button', { name: 'Pausar movimento', exact: true }).click();
        assert.ok((await ui.mascot.getAttribute('data-pause-reasons')).includes('manual'));
        await page.getByRole('button', { name: 'Retomar movimento', exact: true }).click();
        await page.setViewportSize({ width: 320, height: 568 });
        await page.waitForTimeout(200);
        await boxInside(ui.mascot, 320, 568);
        assert.ok((await ui.mascot.getAttribute('data-pause-reasons')).includes('compact'));
        assert.equal(requests.length, 0);
      } finally { await context.close(); }
    });

    await check('Modal existente bloqueia assistente e preserva foco', async () => {
      const { page, context, requests } = await createPage(browser, { route: '/applications' });
      try {
        const ui = assistant(page);
        await page.getByRole('button', { name: 'Nova aplicação', exact: true }).first().click();
        const modal = page.getByRole('dialog', { name: 'Nova aplicação', exact: true });
        await modal.waitFor();
        await page.waitForTimeout(150);
        assert.ok(await ui.root.evaluate((element) => Boolean(element.closest('[inert]')) || element.hasAttribute('inert')));
        assert.equal(await ui.launcher.isVisible(), false);
        assert.ok((await ui.mascot.getAttribute('data-pause-reasons')).includes('modal'));
        await page.keyboard.press('Tab');
        assert.equal(await modal.evaluate((element) => element.contains(document.activeElement)), true);
        await page.keyboard.press('Escape');
        await modal.waitFor({ state: 'hidden' });
        await ui.launcher.waitFor();
        assert.equal(requests.length, 0);
      } finally { await context.close(); }
    });

    for (const theme of ['dark', 'light']) {
      await check('Painel 320px, rolagem, alvos, reduced motion e print: ' + theme, async () => {
        const { page, context, requests, layoutBaseline } = await createPage(browser, { width: 320, height: 568, theme });
        try {
          const ui = await openChat(page);
          await boxInside(ui.panel, 320, 568);
          assert.ok((await ui.mascot.getAttribute('data-pause-reasons')).includes('reduced'));
          const buttons = await ui.root.getByRole('button').evaluateAll((nodes) => nodes.filter((node) => node.getBoundingClientRect().width > 0).map((node) => ({ name: node.getAttribute('aria-label') || node.textContent, width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
          assert.ok(buttons.every((button) => button.height >= 44 && button.width >= 44), JSON.stringify(buttons));
          for (let index = 0; index < 4; index++) await send(page, 'Explique SLA ' + index);
          assert.equal(requests.length, 4);
          await boxInside(ui.panel, 320, 568);
          await page.screenshot({ path: path.join(output, 'mobile-320-' + theme + '.png') });
          console.log('MOBILE ' + theme + ' ' + JSON.stringify(await ui.panel.getByRole('log').evaluate((element) => ({ scroll: element.scrollHeight, client: element.clientHeight, page: document.documentElement.scrollWidth, viewport: window.innerWidth }))));
          assert.equal(await ui.panel.getByRole('log').evaluate((element) => element.scrollHeight > element.clientHeight), true, 'Historico deve rolar internamente');
          const finalWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          assert.ok(finalWidth <= layoutBaseline.scrollWidth, 'Assistente nao deve aumentar overflow horizontal anterior');
          if (layoutBaseline.scrollWidth > 320) existingLimitations.push({ theme, viewport: 320, before: layoutBaseline.scrollWidth, after: finalWidth, finding: 'Cabecalho Conta preexistente excede largura320; assistente nao aumenta esse overflow.' });
          await page.emulateMedia({ media: 'print' });
          assert.equal(await ui.root.evaluate((element) => getComputedStyle(element).display === 'none'), true);
          await page.emulateMedia({ media: 'screen' });
          await page.getByRole('button', { name: 'Limpar conversa', exact: true }).click();
          assert.equal(await ui.panel.getByText('Ajuda local', { exact: true }).count(), 0);
        } finally { await context.close(); }
      });
    }

    await check('Onboarding e relatorio DAST cobertos, HTML original preservado', async () => {
      const { page, context, requests } = await createPage(browser, { route: '/onboarding' });
      try {
        const ui = assistant(page);
        await ui.launcher.waitFor();
        assert.equal(await ui.root.count(), 1);
        await page.goto(origin + '/dast/scans/qa-scan/report', { waitUntil: 'networkidle' });
        await ui.launcher.waitFor();
        assert.equal(await ui.root.count(), 1);
        const frame = page.getByTitle('Relatório original do OWASP ZAP');
        assert.equal(await frame.getAttribute('srcdoc'), reportHtml);
        assert.equal(await frame.getAttribute('sandbox'), '');
        assert.equal(await page.frameLocator('iframe').getByTestId('assistant-root').count(), 0);
        assert.equal(requests.length, 0);
      } finally { await context.close(); }
    });

    await check('Ausente em paginas publicas e privado sem sessao', async () => {
      const { page, context, requests } = await createPage(browser, { signedIn: false, route: '/login' });
      try {
        for (const route of ['/login', '/register', '/plans', '/']) {
          await page.goto(origin + route, { waitUntil: 'networkidle' });
          assert.equal(await assistant(page).root.count(), 0, route);
        }
        await page.goto(origin + '/dashboard', { waitUntil: 'networkidle' });
        await page.waitForURL('**/login');
        assert.equal(await assistant(page).root.count(), 0);
        assert.equal(requests.length, 0);
      } finally { await context.close(); }
    });

    await check('Logout cancela e descarta resposta tardia', async () => {
      const harness = await createPage(browser);
      const { page, context, requests } = harness;
      try {
        const ui = await openChat(page);
        harness.delay = 3000;
        harness.message = 'RESPOSTA TARDIA DA SESSAO ANTERIOR';
        await ui.input.fill('Explique SLA');
        await ui.submit.click();
        await page.waitForTimeout(100);
        assert.equal(requests.length, 1);
        await page.locator('header').first().locator('button[aria-haspopup="menu"]').click();
        await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
        await page.waitForURL('**/login');
        assert.equal(await assistant(page).root.count(), 0);
        harness.user = { ...harness.user, id: 'new-qa-session', name: 'Outra Pessoa QA' };
        await page.locator('input[name="email"]').fill('new-qa@example.invalid');
        await page.locator('input[name="password"]').fill('Fixture-only-password1!');
        await page.getByRole('button', { name: 'Entrar na plataforma', exact: true }).click();
        await page.waitForURL('**/dashboard');
        await page.waitForTimeout(3200);
        await openChat(page);
        assert.equal(await ui.panel.getByText('RESPOSTA TARDIA DA SESSAO ANTERIOR', { exact: true }).count(), 0);
        assert.equal(await ui.panel.getByText('Explique SLA', { exact: true }).count(), 0);
      } finally { await context.close(); }
    });

    await check('Resposta exibida como texto seguro e fonte Gemini distinta', async () => {
      const harness = await createPage(browser);
      const { page, context } = harness;
      try {
        const ui = await openChat(page);
        harness.source = 'gemini';
        harness.message = '<img src=x onerror="window.qaUnsafe=true"> Texto fixture, nao IA real.';
        await ui.input.fill('Explique VRS');
        await ui.submit.click();
        await ui.panel.getByText('Gemini', { exact: true }).first().waitFor();
        assert.equal(await ui.panel.locator('img').count(), 0);
        assert.equal(await page.evaluate(() => Boolean(window.qaUnsafe)), false);
        await ui.panel.getByText(harness.message, { exact: true }).waitFor();
      } finally { await context.close(); }
    });
  } finally {
    await browser.close();
    const report = { origin, timestamp: new Date().toISOString(), mode: 'Fixtures sinteticas interceptadas somente no navegador; sem Gemini real ou escrita no banco.', passed: results.filter((result) => result.ok).length, total: results.length, pageErrors, securityViolations, servedAssets: [...servedAssets], existingLimitations, results };
    await writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2), 'utf8');
    await writeFile(path.join(output, 'browser-report.md'), '<!-- Evidencias da UI do assistente, consumidas por Rafael e revisores. -->\n# Assistente Vulnera — QA visual\n\n' + report.mode + '\n\nOrigem: `' + origin + '`.\n\n' + results.map((result) => '- ' + (result.ok ? 'PASS' : 'FAIL') + ': ' + result.name + (result.error ? ' — ' + result.error : '')).join('\n') + '\n\nErros de pagina: ' + JSON.stringify(pageErrors) + '\n\nViolacoes CSP: ' + JSON.stringify(securityViolations) + '\n\nAssets servidos: ' + JSON.stringify([...servedAssets]) + '\n\nLimitacoes anteriores: ' + JSON.stringify(existingLimitations) + '\n', 'utf8');
    console.log(report.passed + '/' + report.total + ' checks; page errors: ' + pageErrors.length);
    if (results.some((result) => !result.ok) || pageErrors.length || securityViolations.length) process.exitCode = 1;
  }
}

module.exports = { createPage, assistant, openChat, send };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
