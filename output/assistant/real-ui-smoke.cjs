/**
 * Confere login e duas orientações pela UI/API locais reais, sem interceptar respostas.
 * Existe para complementar a matriz isolada sem submeter formulários de negócio ou chamar Gemini.
 * Consumidores: revisão da integração local e roteiro da apresentação.
 */
const { chromium } = require('@playwright/test');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const origin = process.env.ASSISTANT_REAL_UI_URL || 'http://localhost:8086';
const output = path.join(__dirname, 'production');
const result = { origin, timestamp: new Date().toISOString(), fixtures: false, configuredMode: 'local', geminiLiveValidated: false, loginAttempts: 0, questions: [], pageErrors: [], businessFormsSubmitted: 0 };

async function main() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  try {
    await page.goto(origin + '/login', { waitUntil: 'networkidle' });
    await page.locator('input[name="email"]').fill('owner@technova.demo');
    // Credenciais fictícias já versionadas em docs/DEMO.md; não vêm de arquivos .env.
    await page.locator('input[name="password"]').fill('demo12345');
    result.loginAttempts += 1;
    const [login] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith('/auth/login') && response.request().method() === 'POST'),
      page.getByRole('button', { name: 'Entrar na plataforma', exact: true }).click(),
    ]);
    result.loginStatus = login.status();
    if (login.status() !== 200) {
      result.outcome = 'Login de demo indisponivel; nenhuma repeticao nem pergunta realizada.';
      return;
    }
    await page.waitForURL('**/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await page.getByTestId('assistant-launcher').click();
    const panel = page.getByRole('dialog', { name: 'Assistente Vulnera', exact: true });
    await panel.waitFor();

    async function ask(question, expectedScreen) {
      if (result.questions.length >= 2) throw new Error('Teto de duas perguntas reais');
      await panel.getByRole('textbox', { name: 'Sua pergunta', exact: true }).fill(question);
      const [response] = await Promise.all([
        page.waitForResponse((response) => response.url().endsWith('/assistant/chat') && response.request().method() === 'POST'),
        panel.getByRole('button', { name: 'Enviar pergunta', exact: true }).click(),
      ]);
      const record = { question, screen: response.request().postDataJSON().screen, status: response.status() };
      result.questions.push(record);
      assert.equal(response.status(), 200);
      const body = await response.json();
      record.source = body.source;
      record.actions = body.actions.map((action) => action.id);
      assert.equal(body.source, 'local');
      assert.equal(record.screen, expectedScreen);
      assert.ok(body.message.length > 30);
      await panel.locator('.assistant-source').nth(result.questions.length - 1).waitFor();
      assert.equal(await panel.locator('.assistant-source').nth(result.questions.length - 1).textContent(), 'Ajuda local');
    }

    await ask('Como solicito uma análise?', 'dashboard');
    await panel.getByRole('button', { name: 'Solicitar análise', exact: true }).click();
    await page.waitForURL('**/new-analysis');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await ask('O que posso fazer nesta tela?', 'new-analysis');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(output, 'real-client-local.png') });
    assert.equal(result.pageErrors.length, 0);
    result.outcome = 'Login CLIENT, duas respostas Ajuda local e atalho real aprovados, sem fixtures.';
    await page.getByRole('button', { name: 'Fechar assistente', exact: true }).click();
    await page.locator('header').first().locator('button[aria-haspopup="menu"]').click();
    await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
    await page.waitForURL('**/login');
    result.loggedOut = true;
  } catch (error) {
    result.error = error.message;
    result.outcome = 'Integracao real local com ressalva; consultar evidencia.';
    await page.screenshot({ path: path.join(output, 'real-client-local-failure.png') }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
    await writeFile(path.join(output, 'real-ui-results.json'), JSON.stringify(result, null, 2), 'utf8');
    console.log(JSON.stringify({ loginAttempts: result.loginAttempts, loginStatus: result.loginStatus, questions: result.questions, outcome: result.outcome, error: result.error }));
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
