/** Captura rodapé da landing e tabelas da plataforma (Findings, Aplicações, Projetos, Remediação, DAST) no :8086. Só leitura. */
const { chromium } = require('../../node_modules/playwright');
const path = require('node:path');
const OUT = path.join(__dirname, 'detalhes', process.argv[2] ?? 'antes');
require('node:fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => sessionStorage.setItem('vulnera:boot-visto', '1'));
  const p = await ctx.newPage();
  await p.goto('http://localhost:8086/', { waitUntil: 'networkidle' });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, 'landing-rodape.png') });
  await p.goto('http://localhost:8086/login', { waitUntil: 'networkidle' });
  await p.getByLabel('E-mail').fill('admin@vulnera.local');
  await p.locator('input[type="password"]').fill('admin12345');
  await p.getByRole('button', { name: /Entrar na plataforma/ }).click();
  await p.waitForURL(/dashboard/);
  for (const rota of ['findings', 'applications', 'projects', 'remediation', 'dast']) {
    await p.goto(`http://localhost:8086/${rota}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1500);
    const tabela = p.locator('table').first();
    if (await tabela.count()) await tabela.scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(OUT, `${rota}.png`) });
  }
  await b.close();
})();
