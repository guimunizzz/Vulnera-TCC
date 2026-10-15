/**
 * Confere a composição central do acesso web e as interações já existentes.
 * Existe para verificar responsividade, animações e foco no Chrome local;
 * o relatório desta revisão consome as capturas e as medidas produzidas.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium, expect } = require("@playwright/test");
if (process.argv.includes('--performance')) { await import('./auth-performance.mjs'); process.exit(0); }
const optimizedAuthMode = process.argv.includes('--optimized-auth');
const brandFieldsMode = optimizedAuthMode || process.argv.includes('--brand-fields');
const registerMode = brandFieldsMode || process.argv.includes('--register');
const output = new URL(optimizedAuthMode ? "./web-auth-performance/" : brandFieldsMode ? "./web-auth-brand-fields/" : registerMode ? "./web-register-centered/" : "./web-login-centered/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
page.setDefaultTimeout(20000);
const checks = [], errors = [], measurements = [];
page.on("pageerror", error => errors.push(error.message));
async function check(name, run) {
  await run(); checks.push(name); console.log(`OK ${name}`);
}
async function settle(title) {
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeFocused();
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.vx-login-header').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
}
async function capture(name) {
  await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true, animations: "disabled" });
}
const brand = page.getByRole("link", { name: "Vulnera — página inicial" });
const email = page.getByRole("textbox", { name: "E-mail", exact: true });
const password = page.locator('input[name="password"]');
const submit = page.getByRole("button", { name: "Entrar na plataforma", exact: true });
try {
  await page.goto("http://127.0.0.1:3000/login");
  await settle("Entrar");
  await check("logo dentro do card, sem rodapé e login inteiro em telas de 568px ou mais", async () => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
      await page.setViewportSize(viewport);
      const geometry = await page.evaluate(() => {
        const rect = selector => { const { x, y, width, height, bottom } = document.querySelector(selector).getBoundingClientRect(); return { x, y, width, height, bottom }; };
        return { page: rect('.vx-login'), card: rect('.vx-auth-card'), brand: rect('.vx-login-brand'), panel: rect('.vx-login-panel'), stage: rect('.vx-login-stage'), email: rect('input[name="email"]'), width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight };
      });
      measurements.push({ viewport, geometry });
      assert.ok(geometry.brand.bottom < geometry.email.y);
      assert.ok(geometry.brand.y > geometry.card.y && geometry.brand.bottom < geometry.card.bottom);
      // O projeto reserva 10px para a barra de rolagem mesmo sem overflow.
      for (const item of [geometry.brand, geometry.panel]) assert.ok(Math.abs(item.x + item.width / 2 - (geometry.page.x + geometry.page.width / 2)) < 1);
      assert.ok(geometry.scroll <= viewport.width, `Overflow em ${viewport.width}`);
      assert.ok(geometry.brand.y >= 0);
      await expect(page.locator('.vx-login-footer')).toHaveCount(0);
      await expect(page.getByText('Gestão de vulnerabilidades', { exact: true })).toHaveCount(0);
      if (viewport.height >= 568) {
        assert.ok(geometry.scrollHeight <= viewport.height, `Login não cabe: ${geometry.scrollHeight} em ${viewport.height}`);
        const middle = (geometry.card.y + geometry.card.bottom) / 2;
        assert.ok(Math.abs(middle - viewport.height / 2) < 2, `Centro vertical deslocado: ${middle}`);
      }
      await capture(`login-${viewport.width}x${viewport.height}`);
    }
  });
  if (registerMode) {
    if (brandFieldsMode) {
      await check('login e cadastro mostram somente logo e campos, mantendo título acessível e foco', async () => {
        for (const [path, title] of [['login', 'Entrar'], ['register', 'Criar conta']]) {
          await page.goto(`http://127.0.0.1:3000/${path}`); await settle(title);
          const layout = await page.evaluate(() => {
            const heading = document.querySelector('h1');
            const { width, height } = heading.getBoundingClientRect();
            const style = getComputedStyle(heading);
            return { heading: { width, height, position: style.position, clip: style.clip }, gap: document.querySelector('.vx-login-field label').getBoundingClientRect().top - document.querySelector('.vx-login-header').getBoundingClientRect().bottom };
          });
          assert.deepEqual(layout.heading, { width: 1, height: 1, position: 'absolute', clip: 'rect(0px, 0px, 0px, 0px)' });
          assert.ok(layout.gap >= 7.9 && layout.gap <= 28, `Respiro inesperado: ${layout.gap}`);
          await expect(page.getByRole('form', { name: title, exact: true })).toBeVisible();
          await page.keyboard.press('Tab');
          await expect(page.getByRole('textbox', { name: path === 'login' ? 'E-mail' : 'Nome', exact: true })).toBeFocused();
        }
      });
    }
    await page.goto('http://127.0.0.1:3000/register'); await settle('Criar conta');
    await check('cadastro centralizado cabe inteiro em 320×568 com quatro campos de 44px', async () => {
      for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 640 }, { width: 320, height: 568 }, { width: 568, height: 320 }]) {
        await page.setViewportSize(viewport);
        const geometry = await page.evaluate(() => {
          const rect = selector => { const { x, y, width, height, bottom } = document.querySelector(selector).getBoundingClientRect(); return { x, y, width, height, bottom }; };
          const heading = getComputedStyle(document.querySelector('#register-title'));
          return { page: rect('.vx-login'), card: rect('.vx-auth-card'), brand: rect('.vx-login-brand'), form: rect('.vx-login-form'), heading: { size: heading.fontSize, align: heading.textAlign }, fields: [...document.querySelectorAll('input, button[type="submit"], .vx-login-register a')].map(element => ({ name: element.name || element.textContent.trim(), height: element.getBoundingClientRect().height })), width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight };
        });
        measurements.push({ route: 'register', viewport, geometry });
        assert.ok(geometry.brand.y > geometry.card.y && geometry.brand.bottom < geometry.form.y);
        assert.ok(Math.abs(geometry.card.x + geometry.card.width / 2 - (geometry.page.x + geometry.page.width / 2)) < 1);
        assert.ok(geometry.scroll <= viewport.width);
        if (!brandFieldsMode) assert.deepEqual(geometry.heading, { size: '24px', align: 'center' });
        for (const control of geometry.fields) assert.ok(control.height >= 43.9, `Alvo pequeno: ${control.name}`);
        if (viewport.height >= 568) {
          assert.ok(geometry.scrollHeight <= viewport.height, `Cadastro não cabe: ${geometry.scrollHeight} em ${viewport.height}`);
          assert.ok(Math.abs((geometry.card.y + geometry.card.bottom) / 2 - viewport.height / 2) < 2);
        }
        await expect(page.getByText('Mínimo de 8 caracteres.', { exact: true })).toBeVisible();
        await expect(page.locator('.vx-login-footer')).toHaveCount(0);
        await capture(`register-${viewport.width}x${viewport.height}`);
      }
    });
    await check('barra final e maiúsculas mantêm o cadastro compacto', async () => {
      await page.setViewportSize({ width: 320, height: 568 });
      for (const path of ['/register/', '/REGISTER']) {
        await page.goto(`http://127.0.0.1:3000${path}`); await settle('Criar conta');
        await expect(page.locator('main')).toHaveClass('vx-login vx-register');
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
      }
    });
    await check('validação de senha e erro da API continuam acessíveis, sem cadastro real', async () => {
      await page.goto('http://127.0.0.1:3000/register'); await settle('Criar conta');
      const confirmation = page.locator('input[name="password-confirmation"]');
      const registerSubmit = page.getByRole('button', { name: 'Criar conta', exact: true });
      let registerRequests = 0;
      await page.route('**/auth/register', route => {
        registerRequests++;
        assert.deepEqual(route.request().postDataJSON(), { name: 'Pessoa QA', email: 'qa@example.com', password: 'segura-qa-123' });
        return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'USER_ALREADY_EXISTS' }) });
      });
      await expect(password).toHaveAttribute('minlength', '8');
      for (const input of [password, confirmation]) await expect(input).toHaveAttribute('autocomplete', 'new-password');
      const hint = await password.evaluate(element => element.getAttribute('aria-describedby').split(/\s+/).map(id => document.getElementById(id)?.textContent).join(' '));
      assert.match(hint, /Mínimo de 8 caracteres/);
      await page.getByRole('textbox', { name: 'Nome', exact: true }).fill('Pessoa QA');
      await email.fill('qa@example.com'); await password.fill('segura-qa-123'); await confirmation.fill('diferente-qa-456');
      await expect(confirmation).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByRole('alert')).toHaveText('As senhas não coincidem.');
      await registerSubmit.click(); assert.equal(registerRequests, 0);
      await capture('register-password-error-320x568');
      await confirmation.fill('segura-qa-123');
      await expect(confirmation).not.toHaveAttribute('aria-invalid', 'true');
      await registerSubmit.click();
      await expect(page.getByText('Não foi possível criar a conta', { exact: true })).toBeVisible();
      assert.equal(registerRequests, 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await capture('register-api-error-320x568');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://127.0.0.1:3000/login'); await settle('Entrar');
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  // Nova carga depois das capturas restaura as animações pausadas pelo screenshot.
  await page.reload(); await settle("Entrar");
  await check("cursor, deriva e sinais mantêm as animações da web", async () => {
    const motion = await page.evaluate(() => {
      const animation = selector => { const style = getComputedStyle(document.querySelector(selector)); return [style.animationName, style.animationDuration]; };
      return { cursor: animation('.vx-login-cursor'), drift: animation('.vx-login-circuit'), signal: animation('.vx-login-signals path'), pulses: [...document.querySelectorAll('animateMotion')].map(node => node.getAttribute('dur')) };
    });
    assert.deepEqual(motion.cursor, ['vx-login-cursor', '3s']);
    assert.deepEqual(motion.drift, ['vx-login-drift', '22s']);
    assert.deepEqual(motion.signal, ['vx-login-signal', '14s']);
    assert.deepEqual(motion.pulses, ['14s', '17s', '20s']);
  });
  await check("ponteiro continua revelando o fundo interativo", async () => {
    await page.mouse.move(90, 140);
    await expect(page.locator('.vx-login')).toHaveAttribute('data-reveal-active', 'true');
    await expect(page.locator('.vx-login-background')).toHaveCSS('opacity', '1');
    const x = await page.locator('.vx-login-background').evaluate(element => element.style.getPropertyValue('--login-mouse-x') || element.parentElement.style.getPropertyValue('--login-mouse-x'));
    assert.equal(x, '90px');
  });
  if (optimizedAuthMode) {
    await check('coordenadas do mouse ficam isoladas do formulário e do SVG estático', async () => {
      const before = await page.evaluate(() => ['input', '.vx-login-circuit'].map(selector => getComputedStyle(document.querySelector(selector)).getPropertyValue('--login-mouse-x')));
      await page.mouse.move(120, 150);
      await expect.poll(() => page.locator('.vx-login-glow').evaluate(element => element.style.getPropertyValue('--login-mouse-x'))).toBe('120px');
      await page.mouse.move(240, 180);
      await expect.poll(() => page.locator('.vx-login-background').evaluate(element => element.style.getPropertyValue('--login-mouse-x'))).toBe('240px');
      const after = await page.evaluate(() => ['input', '.vx-login-circuit'].map(selector => getComputedStyle(document.querySelector(selector)).getPropertyValue('--login-mouse-x')));
      assert.deepEqual(after, before);
      assert.equal(await page.locator('main').evaluate(element => element.style.getPropertyValue('--login-mouse-x')), '');
    });
    await check('fundo invisível pausa após o fade e retoma do mesmo ponto', async () => {
      await page.mouse.move(-5, -5);
      await expect(page.locator('main')).toHaveAttribute('data-background-running', 'false');
      await expect(page.locator('.vx-login-circuit')).toHaveCSS('animation-play-state', 'paused');
      const first = await page.locator('svg.vx-login-circuit').evaluate(element => ({ time: element.getCurrentTime(), paused: element.animationsPaused() }));
      assert.equal(first.paused, true);
      await page.waitForTimeout(100);
      const stopped = await page.locator('svg.vx-login-circuit').evaluate(element => element.getCurrentTime());
      assert.ok(Math.abs(first.time - stopped) < .02);
      await page.mouse.move(100, 140);
      await expect(page.locator('main')).toHaveAttribute('data-background-running', 'true');
      await expect(page.locator('.vx-login-circuit')).toHaveCSS('animation-play-state', 'running');
      await page.waitForTimeout(100);
      const resumed = await page.locator('svg.vx-login-circuit').evaluate(element => ({ time: element.getCurrentTime(), paused: element.animationsPaused() }));
      assert.equal(resumed.paused, false);
      assert.ok(resumed.time > stopped + .04 && resumed.time < stopped + 1);
    });
    await check('ocultação simulada da aba pausa cursor, glitch e SMIL sem gravar coordenadas', async () => {
      await page.getByRole('link', { name: 'Criar uma conta', exact: true }).hover();
      await expect(page.locator('.vx-label-top')).toHaveCSS('animation-play-state', 'running');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await expect(page.locator('main')).toHaveAttribute('data-background-running', 'false');
      await expect(page.locator('.vx-login-cursor')).toHaveCSS('animation-play-state', 'paused');
      await expect(page.locator('.vx-label-top')).toHaveCSS('animation-play-state', 'paused');
      assert.ok(await page.locator('svg.vx-login-circuit').evaluate(element => element.animationsPaused()));
      const before = await page.locator('.vx-login-background').getAttribute('style');
      await page.mouse.move(100, 110); await page.waitForTimeout(40);
      assert.equal(await page.locator('.vx-login-background').getAttribute('style'), before);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
      await page.mouse.move(110, 120);
      await expect(page.locator('main')).toHaveAttribute('data-background-running', 'true');
    });
    await check('toque mantém o fundo visível animado sem deslocar a revelação', async () => {
      const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
      mobile.on('pageerror', error => errors.push(error.message));
      try {
        await mobile.goto('http://127.0.0.1:3000/register');
        await expect(mobile.getByRole('heading', { name: 'Criar conta', exact: true })).toBeFocused();
        assert.ok(await mobile.evaluate(() => matchMedia('(hover: none)').matches));
        await expect(mobile.locator('main')).toHaveAttribute('data-background-running', 'true');
        await expect(mobile.locator('.vx-login-background')).toHaveCSS('opacity', '0.32');
        await mobile.getByRole('textbox', { name: 'E-mail', exact: true }).tap();
        assert.equal(await mobile.locator('.vx-login-background').evaluate(element => element.style.getPropertyValue('--login-mouse-x')), '');
        assert.equal(await mobile.locator('svg.vx-login-circuit').evaluate(element => element.animationsPaused()), false);
        await mobile.screenshot({ path: fileURLToPath(new URL('touch-register-390x844.png', output)), animations: 'disabled' });
      } finally { await mobile.close(); }
    });
    await check('revelação acompanha o ponteiro após rolar um formulário alto', async () => {
      await page.setViewportSize({ width: 568, height: 320 });
      await page.goto('http://127.0.0.1:3000/register'); await settle('Criar conta');
      await page.evaluate(() => scrollTo(0, 200)); await page.mouse.move(80, 120);
      await expect.poll(() => page.locator('.vx-login-background').evaluate(element => Number.parseFloat(element.style.getPropertyValue('--login-mouse-y')))).toBe(await page.locator('main').evaluate(element => 120 - element.getBoundingClientRect().top));
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('http://127.0.0.1:3000/login'); await settle('Entrar');
    });
  }
  await check("teclado e efeito de foco continuam funcionando", async () => {
    await expect(password).toHaveAccessibleName('Senha');
    await brand.focus(); await page.keyboard.press('Tab'); await expect(email).toBeFocused();
    await expect(email).toHaveCSS('border-top-color', 'rgb(182, 156, 255)');
    await page.keyboard.press('Tab'); await expect(password).toBeFocused();
    await password.fill('senha-apenas-para-qa');
    await page.getByRole('button', { name: 'Mostrar senha' }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ocultar senha' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });
  await check("decode do botão e glitch do link preservados", async () => {
    await submit.hover();
    await expect(submit.locator('.vx-label')).toHaveAttribute('data-decoding', 'true');
    const link = page.getByRole('link', { name: 'Criar uma conta', exact: true });
    await link.hover();
    await expect(link.locator('.vx-label-top')).toHaveCSS('animation-name', 'vx-label-top');
  });
  await check("login/cadastro mantém logo, fundo, deslize e foco no título", async () => {
    const logoHandle = await brand.elementHandle();
    const backgroundHandle = await page.locator('.vx-login-background').elementHandle();
    await page.getByRole('link', { name: 'Criar uma conta', exact: true }).click();
    await page.waitForFunction(() => {
      const element = document.querySelector('.vx-auth-transition');
      return element && Math.abs(new DOMMatrix(getComputedStyle(element).transform).m41) > .1;
    });
    await settle('Criar conta');
    assert.ok(await logoHandle.evaluate(element => element.isSameNode(document.querySelector('.vx-login-brand'))));
    assert.ok(await backgroundHandle.evaluate(element => element.isSameNode(document.querySelector('.vx-login-background'))));
    await page.setViewportSize({ width: 320, height: 568 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Criar conta', exact: true }).scrollIntoViewIfNeeded();
    await capture('register-320x568');
    await page.getByRole('link', { name: 'Entrar', exact: true }).click();
    await settle('Entrar');
  });
  await check("erro de autenticação aparece sem sobreposição", async () => {
    await page.route('**/auth/login', route => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'INVALID_CREDENTIALS' }) }));
    await email.fill('qa@example.com'); await password.fill('incorreta-apenas-qa');
    await submit.click();
    await expect(page.getByText('Não foi possível entrar', { exact: true })).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await capture('login-error-320x568');
  });
  await check("movimento reduzido e navegação continuam acessíveis", async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:3000/login'); await settle('Entrar');
    await expect(page.locator('.vx-login-cursor')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.vx-login-circuit')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.vx-login-pulses')).toHaveCSS('display', 'none');
    await page.getByRole('link', { name: 'Criar uma conta', exact: true }).click(); await settle('Criar conta');
    await page.getByRole('link', { name: 'Entrar', exact: true }).click(); await settle('Entrar');
    await submit.hover(); await expect(submit.locator('.vx-label')).not.toHaveAttribute('data-decoding', 'true');
    if (optimizedAuthMode) {
      await expect(page.locator('main')).toHaveAttribute('data-background-running', 'false');
      assert.ok(await page.locator('svg.vx-login-circuit').evaluate(element => element.animationsPaused()));
      const before = await page.locator('.vx-login-background').getAttribute('style');
      for (let step = 0; step < 15; step++) await page.mouse.move(30 + step * 5, 40 + step * 4);
      assert.equal(await page.locator('.vx-login-background').getAttribute('style'), before);
      await expect(page.locator('.vx-login-glow')).toHaveCSS('opacity', '0');
    }
  });
  await check("sem exceções JavaScript", async () => assert.deepEqual(errors, []));
  console.log(`${checks.length}/${checks.length} verificações aprovadas`);
} catch (error) {
  console.error(error);
  await capture('failure');
  throw error;
} finally {
  await writeFile(new URL('smoke-results.json', output), JSON.stringify({ checks, errors, measurements }, null, 2));
  await browser.close();
}
