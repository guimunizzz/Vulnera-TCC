/** Captura Problema e Diferenciais no :8086 (rolando devagar, esperando as entradas). Só leitura. */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:8086/', { waitUntil: 'networkidle' });
  for (const [sel, nome] of [['section[data-ato="1"]', 'problema'], ['#recursos', 'recursos'], ['section:has-text("// DIFERENCIAIS")', 'diferenciais'], ['#demo', 'demo']]) {
    const s = p.locator(sel).first();
    await s.scrollIntoViewIfNeeded();
    await p.mouse.wheel(0, 200); await p.waitForTimeout(400); await p.mouse.wheel(0, -200);
    await p.waitForTimeout(2500);
    await s.screenshot({ path: path.join(__dirname, 'landing-secoes', `${nome}-agora.png`) });
    console.log(nome, await s.getAttribute('id'));
  }
  await b.close();
})();
