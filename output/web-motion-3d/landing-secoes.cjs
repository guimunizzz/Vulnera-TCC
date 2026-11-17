/** Melhorias A–D das seções da landing no container :8086: título decodificando,
 * loops pausados fora da tela, máscara na Demo e erros de console. Só leitura. */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const OUT = path.join(__dirname, 'landing-secoes');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('console', (m) => m.type() === 'error' && erros.push(m.text().slice(0, 150)));
  await p.goto('http://localhost:8086/', { waitUntil: 'networkidle' });
  const foraNoTopo = await p.locator('section[data-fora-da-tela]').count();
  await p.locator('#como-funciona').scrollIntoViewIfNeeded();
  await p.waitForTimeout(250);
  const decodificando = await p.locator('[data-decodificando]').count();
  await p.screenshot({ path: path.join(OUT, 'como-funciona-decodificando.png') });
  await p.waitForTimeout(1500);
  const depois = await p.locator('[data-decodificando]').count();
  await p.locator('#demo').scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(OUT, 'demo-mascara.png') });
  const heroFora = await p.locator('section').first().getAttribute('data-fora-da-tela');
  console.log({ foraNoTopo, decodificando, depois, heroForaAoRolar: heroFora !== null, erros });
  await b.close();
})();
