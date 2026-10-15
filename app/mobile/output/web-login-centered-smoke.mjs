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
const output = new URL("./web-login-centered/", import.meta.url);
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
    const x = await page.locator('.vx-login').evaluate(element => element.style.getPropertyValue('--login-mouse-x'));
    assert.equal(x, '90px');
  });
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
