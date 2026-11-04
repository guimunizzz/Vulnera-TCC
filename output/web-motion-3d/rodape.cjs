/** Captura o fim da landing (chamada final + rodapé) no :8086. Só leitura. Uso: node rodape.cjs <rotulo> */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => sessionStorage.setItem('vulnera:boot-visto', '1'));
  const p = await ctx.newPage();
  await p.goto('http://localhost:8086/', { waitUntil: 'networkidle' });
  await p.locator('footer').last().scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  await p.keyboard.press('End');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(__dirname, 'detalhes', `rodape-${process.argv[2] ?? 'antes'}.png`) });
  await b.close();
})();
