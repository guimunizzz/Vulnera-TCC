/**
 * Renderiza três estilos para cada uma das duas marcas na Home real.
 * Preserva o conteúdo e captura apenas a Home para uma escolha visual informada.
 * Consumidor: revisão da logo; dados de demonstração ficam isolados no navegador.
 */
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { installNavigationFixtures } from "./install-navigation-fixtures.mjs";
const require = createRequire(new URL("../../../package.json", import.meta.url));
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const { user } = await installNavigationFixtures(page);
const variants = [
  { name: "1 · Assinatura compacta", caption: "Marca direta, sem moldura. SECURITY em segundo plano." },
  { name: "2 · Cápsula glass", caption: "Marca sobre vidro grafite, com uma borda roxa discreta." },
  { name: "3 · Assinatura editorial", caption: "Nome maior, mais espaço e um pequeno detalhe roxo." },
];
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const localPath = name => new URL(`./${name}`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
try {
  await page.goto("http://localhost:8087", { waitUntil: "networkidle" });
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("isolated-preview");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByText("5 no total", { exact: true }).waitFor();
  await pause(1000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await pause(300);
  if (process.argv.includes("--settings")) {
    await page.getByRole("tab", { name: "Minha conta", exact: true }).click();
    await page.getByText("Seu perfil", { exact: true }).waitFor();
    await pause(400);
    const measurements = [];
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const brand = await page.getByRole("img", { name: "Vulnera Security", exact: true }).boundingBox();
      const title = await page.getByText("MINHA CONTA", { exact: true }).boundingBox();
      assert.ok(brand && title && brand.x + brand.width + 12 <= title.x + 0.5 && title.width > 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: localPath(`settings-logo-aplicada-${width}.png`) });
      measurements.push({ width, brand, title });
    }
    await page.getByRole("tab", { name: "Projetos", exact: true }).click();
    await page.getByRole("img", { name: "Vulnera Security", exact: true }).waitFor();
    await page.getByRole("button", { name: /Abrir projeto/ }).first().click();
    await page.getByText("VISÃO DO PROJETO", { exact: true }).filter({ visible: true }).waitFor();
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await page.getByRole("img", { name: "Vulnera Security", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await writeFile(new URL("./settings-logo-applied-results.json", import.meta.url), JSON.stringify({ measurements, homeBrand: true, projectBack: true, errors, api: "fixtures somente no navegador" }, null, 2));
    process.stdout.write("OK logo de Configurações em 320/390 px, Home e retorno do projeto\n");
  } else if (process.argv.includes("--applied")) {
    const measurements = [];
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const brand = await page.getByRole("img", { name: "Vulnera Security", exact: true }).boundingBox();
      const avatar = await page.getByRole("button", { name: "Abrir minha conta", exact: true }).boundingBox();
      assert.ok(brand && avatar && brand.x + brand.width + 12 <= avatar.x);
      assert.ok(avatar.width >= 48 && avatar.height >= 48);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: localPath(`home-logo-aplicada-${width}.png`) });
      measurements.push({ width, brand, avatar });
    }
    await page.getByRole("button", { name: "Abrir minha conta", exact: true }).click();
    await page.getByText("Seu perfil", { exact: true }).waitFor();
    await page.getByRole("tab", { name: "Projetos", exact: true }).click();
    await page.getByRole("img", { name: "Vulnera Security", exact: true }).waitFor();
    assert.deepEqual(errors, []);
    await writeFile(new URL("./home-logo-applied-results.json", import.meta.url), JSON.stringify({ measurements, avatarNavigation: true, errors, api: "fixtures somente no navegador" }, null, 2));
    process.stdout.write("OK logo aplicada em 320/390 px e navegação pelo avatar\n");
  } else {
  await page.evaluate(() => {
    const avatar = document.querySelector('[aria-label="Abrir minha conta"]');
    const header = avatar.parentElement;
    header.dataset.logoPreview = "header";
    window.originalLogoHeader = header.innerHTML;
    window.originalHeaderStyle = header.getAttribute("style");
  });
  const screenshots = [];
  const choices = [];
  let originalContentBounds;
  for (const source of ["web", "mark"]) {
  for (let index = 0; index < variants.length; index++) {
    await page.evaluate(({ index, source }) => {
      const header = document.querySelector('[data-logo-preview="header"]');
      header.innerHTML = window.originalLogoHeader;
      const avatar = header.querySelector('[aria-label="Abrir minha conta"]');
      [...header.children].filter(child => child !== avatar).forEach(child => child.remove());
      const brand = document.createElement("div");
      brand.setAttribute("aria-label", "Vulnera Security");
      brand.dataset.logoPreview = "brand";
      const glass = index === 1;
      const editorial = index === 2;
      brand.style.cssText = `display:flex;align-items:center;gap:10px;box-sizing:border-box;flex-shrink:0;${glass ? "height:48px;padding:6px 13px;border:1px solid rgba(167,139,250,.19);border-radius:17px;background:linear-gradient(120deg,rgba(167,139,250,.07),rgba(255,255,255,.025));backdrop-filter:blur(18px);box-shadow:inset 0 1px rgba(255,255,255,.07);" : ""}`;
      const mark = source === "mark" ? `<svg width="${editorial ? 34 : 28}" height="${editorial ? 34 : 28}" viewBox="0 0 100 100" fill="none" aria-hidden="true"><polyline points="10,10 40,45 50,85" stroke="#a78bfa" stroke-width="7" stroke-linecap="square" stroke-linejoin="miter"/><polyline points="90,10 60,45 50,85" stroke="#a78bfa" stroke-width="7" stroke-linecap="square" stroke-linejoin="miter"/></svg>` : "";
      brand.innerHTML = `${mark}<div style="display:flex;flex-direction:column;gap:${editorial ? 5 : 4}px"><div style="display:flex;align-items:center;gap:4px;font-family:JetBrainsMono_400Regular,monospace;font-size:${editorial ? 18 : 15}px;line-height:20px;font-weight:700;letter-spacing:${editorial ? 2.4 : 1.8}px;color:#f2f2f5">VULNERA${source === "web" ? '<span style="display:inline-block;width:3px;height:13px;background:#a78bfa;border-radius:1px" aria-hidden="true"></span>' : ""}</div><div style="display:flex;align-items:center;gap:6px">${editorial ? '<span style="width:14px;height:1px;background:#a78bfa" aria-hidden="true"></span>' : ""}<span style="font-family:JetBrainsMono_400Regular,monospace;font-size:${editorial ? 8 : 7}px;line-height:10px;letter-spacing:${editorial ? 3.4 : 3}px;color:#9da1ab">SECURITY</span></div></div>`;
      header.insertBefore(brand, avatar);
      header.style.justifyContent = "space-between";
      header.style.gap = "12px";
    }, { index, source });
    await pause(180);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const brand = await page.locator('[data-logo-preview="brand"]').boundingBox();
      const avatar = await page.getByRole("button", { name: "Abrir minha conta", exact: true }).boundingBox();
      assert.ok(brand && avatar && brand.x + brand.width + 12 <= avatar.x + 0.5);
      assert.ok(avatar.width >= 48 && avatar.height >= 48);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    const contentBounds = await page.getByText("Seus projetos", { exact: true }).boundingBox();
    if (!originalContentBounds) originalContentBounds = contentBounds;
    else assert.deepEqual(contentBounds, originalContentBounds, "A adaptação não deve deslocar o conteúdo da Home");
    const number = screenshots.length + 1;
    const file = `home-logo-opcao-${number}.png`;
    await page.screenshot({ path: localPath(file) });
    screenshots.push(`data:image/png;base64,${(await readFile(localPath(file))).toString("base64")}`);
    choices.push({ source, name: `${number} · ${variants[index].name.split(" · ")[1]}`, caption: variants[index].caption });
    process.stdout.write(`OK opção ${number}, 320/390 px\n`);
  }
  }
  assert.deepEqual(errors, []);
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Comparativo de logos — Home mobile</title><style>*{box-sizing:border-box}body{margin:0;padding:30px;background:#111215;color:#f0f1f4;font-family:Arial,sans-serif}h1{font-size:25px;letter-spacing:-.5px;margin:0 0 7px}p{margin:0;color:#a5a8b1;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,390px);gap:32px 24px;margin-top:25px}.card{width:390px}h2{font-size:17px;margin:0 0 8px}.source{color:#bda4f4;font-size:11px;letter-spacing:1px;margin-bottom:10px}.caption{height:39px;font-size:12px;line-height:17px;max-width:370px}.screen{display:block;width:390px;height:844px;border-radius:22px;outline:1px solid #33353c;margin-top:10px}.footer{margin-top:20px;font-size:12px}</style><h1>VULNERA · Duas marcas, três estilos</h1><p>Somente a marca no topo muda · mesma Home, escala e barra inferior</p><div class="grid">${choices.map((variant,index)=>`<div class="card"><p class="source">${variant.source === "web" ? "MARCA DA HOME WEB" : "SÍMBOLO V DO LOGIN MOBILE"}</p><h2>${variant.name}</h2><p class="caption">${variant.caption}</p><img class="screen" src="${screenshots[index]}" alt="Home com ${variant.name}"></div>`).join("")}</div><p class="footer">Prévia para escolha · seis capturas da Home · dados isolados de demonstração</p></html>`;
  await writeFile(new URL("./comparativo-logos-home.html", import.meta.url), html);
  const comparison = await browser.newPage({ viewport: { width: 1278, height: 1036 }, deviceScaleFactor: 1 });
  await comparison.setContent(html, { waitUntil: "load" });
  await comparison.screenshot({ path: localPath("comparativo-logos-home.png"), fullPage: true });
  await writeFile(new URL("./home-logo-comparison-results.json", import.meta.url), JSON.stringify({ choices, widths: [320,390], errors, api: "fixtures somente no navegador", appChanged: false }, null, 2));
  }
} finally { await browser.close(); }
