/**
 * Valida a issue 19 pelo navegador e HTTP reais na stack temporária de teste.
 * Existe para provar seleção, vínculo, isolamento e teclado além dos mocks.
 * Consumidor: orquestrador, com API :3019, Web :8089 e vulnera_test exclusivo.
 */
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.env.TEMP, 'issue19-playwright-core'));
const outputDir = __dirname;
const password = 'Issue19Smoke123!';
const marker = `issue19-${Date.now()}`;
const checks = [];
function check(name, value) { assert.ok(value, name); checks.push(name); }
function databaseScript(code) {
  const raw = execFileSync('docker', ['exec', 'vulnera-issue19-api', './node_modules/.bin/tsx', '-e', code], { encoding: 'utf8' });
  return JSON.parse(raw.trim().split('\n').at(-1));
}
const databasePrelude = `const {prisma}=require('/app/src/database/prisma.database.ts'); const {EnvVar}=require('/app/src/config/EnvVar.ts'); const {EnvKeys}=require('/app/src/config/enum/EnvKeys.ts'); if(new URL(EnvVar.get(EnvKeys.DATABASE_URL)).pathname!=='/vulnera_test') throw Error('Banco de teste obrigatorio');`;
const fixtures = databaseScript(`${databasePrelude}
(async()=>{const {hashPassword}=require('/app/src/utils/hash.util.ts');
const plan=await prisma.plan.create({data:{name:'${marker}',maxApplications:10,maxProjects:2,includesRemediation:false,price:0}});
const a=await prisma.company.create({data:{name:'${marker} A',planId:plan.id}});
const b=await prisma.company.create({data:{name:'${marker} B',planId:plan.id}});
await prisma.subscription.createMany({data:[a,b].map(c=>({companyId:c.id,planId:plan.id,status:'ACTIVE',startDate:new Date()}))});
const hashed=await hashPassword('${password}');
const users=[];for(const [kind,role,companyId,companyRole] of [['global','ADMIN',null,null],['linked','ADMIN',a.id,null],['client','CLIENT',a.id,'OWNER']]) {
users.push(await prisma.user.create({data:{name:kind,email:'${marker}-'+kind+'@smoke.test',password:hashed,role,companyId,companyRole}}));}
console.log(JSON.stringify({planId:plan.id,a,b,users:users.map(u=>({id:u.id,email:u.email,role:u.role,companyId:u.companyId}))}));await prisma.$disconnect();})().catch(e=>{console.error(e.message);process.exit(1)});`);

async function login(page, user) {
  await page.goto('http://localhost:8089/login');
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill(password);
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/auth/login') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  const response = await responsePromise;
  check(`Login ${user.role}/${user.email.split('@')[0]}`, response.status() === 200);
  const auth = await response.json();
  await page.waitForURL('**/dashboard');
  return auth;
}
async function openForm(page) {
  await page.getByRole('button', { name: 'Nova aplicação', exact: true }).first().click();
  await page.getByRole('dialog', { name: 'Nova aplicação', exact: true }).waitFor();
}
async function create(page, name, target, keyboard = false) {
  await openForm(page);
  const dialog = page.getByRole('dialog', { name: 'Nova aplicação', exact: true });
  if (target) {
    const selector = dialog.getByLabel('Empresa');
    check('ADMIN inicia sem empresa selecionada', await selector.inputValue() === '');
    check('ADMIN sem seleção tem criação bloqueada', await dialog.getByRole('button', { name: 'Criar', exact: true }).isDisabled());
    await page.waitForFunction(id => {
      const el = document.getElementById('app-company');
      return el && !el.disabled && [...el.options].some(o => o.value === id);
    }, target);
    if (keyboard) {
      await selector.focus();
      const count = await selector.locator('option').count();
      await selector.press('Home');
      // Home pode pular o placeholder disabled; conferimos o valor real.
      for (let i = 0; i < count && await selector.inputValue() !== target; i++) await selector.press('ArrowDown');
    } else await selector.selectOption(target);
    check('Seleção efetiva é empresa B', await selector.inputValue() === target);
  } else check('CLIENT sem seletor de empresa', await dialog.getByLabel('Empresa').count() === 0);
  await dialog.getByLabel('Nome', { exact: true }).fill(name);
  await dialog.getByLabel('URL', { exact: true }).fill('https://issue19.example.test');
  if (keyboard) {
    await dialog.getByLabel('Empresa').focus();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      check(`Foco permanece no modal ${i + 1}`, await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')));
    }
    await page.screenshot({ path: path.join(outputDir, 'issue-19-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    check('Mobile sem transbordamento horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.screenshot({ path: path.join(outputDir, 'issue-19-mobile.png'), fullPage: true });
  }
  const responsePromise = page.waitForResponse(r => r.url().endsWith('/applications') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();
  const response = await responsePromise;
  const payload = response.request().postDataJSON();
  const created = await response.json();
  check('POST real retorna 201', response.status() === 201);
  check('Payload segue o papel', target ? payload.companyId === target : !Object.hasOwn(payload, 'companyId'));
  check('Resposta pertence à empresa efetiva', created.companyId === (target ?? fixtures.a.id));
  await dialog.waitFor({ state: 'hidden' });
  await page.getByText(name, { exact: true }).waitFor();
  check('Nova aplicação aparece após atualização da lista', true);
  await openForm(page);
  check('Nome limpo ao reabrir após sucesso', await page.getByLabel('Nome', { exact: true }).inputValue() === '');
  if (target) check('Seleção limpa após sucesso', await page.getByLabel('Empresa').inputValue() === '');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  return created;
}

(async () => {
  let browser;
  const associations = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    for (const [index, user] of fixtures.users.entries()) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const auth = await login(page, user);
      if (index === 0) check('ADMIN global tem companyId null', auth.user.companyId === null);
      const companyRequests = [];
      page.on('request', r => companyRequests.push(r.url()));
      await page.goto('http://localhost:8089/applications');
      await page.getByRole('heading', { name: 'Aplicações', exact: true }).waitFor();
      const created = await create(page, `${marker}-app-${index}`, user.role === 'ADMIN' ? fixtures.b.id : undefined, index === 0);
      associations.push({ id: created.id, companyId: created.companyId });
      if (user.role === 'ADMIN') {
        check('ADMIN não consulta assinatura pessoal', !companyRequests.some(u => u.endsWith('/subscriptions/current')));
        check('ADMIN não mostra capacidade empresarial global', await page.getByRole('progressbar', { name: 'Capacidade de aplicações do plano' }).count() === 0);
      } else {
        check('CLIENT não consulta empresas globais', !companyRequests.some(u => u.endsWith('/companies')));
        const forged = await fetch('http://localhost:3019/api/applications', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.accessToken}` }, body: JSON.stringify({ name: `${marker}-forged`, companyId: fixtures.b.id }) });
        check('CLIENT com alvo forjado permanece na empresa A', forged.status === 201 && (await forged.json()).companyId === fixtures.a.id);
      }
      await context.close();
    }
    const persisted = databaseScript(`${databasePrelude} (async()=>{console.log(JSON.stringify(await prisma.application.findMany({where:{id:{in:${JSON.stringify(associations.map(a => a.id))}}},select:{id:true,companyId:true}})));await prisma.$disconnect();})();`);
    check('Banco confirma os três vínculos reais', associations.every(a => persisted.some(p => p.id === a.id && p.companyId === a.companyId)));
    fs.writeFileSync(path.join(outputDir, 'issue-19-smoke-result.json'), JSON.stringify({ checks, associations, databaseVerified: true }, null, 2));
    console.log(JSON.stringify({ passed: checks.length, associations, databaseVerified: true }));
  } finally {
    if (browser) await browser.close();
    databaseScript(`${databasePrelude} (async()=>{const ids=${JSON.stringify([fixtures.a.id, fixtures.b.id])};await prisma.application.deleteMany({where:{companyId:{in:ids}}});await prisma.refreshToken.deleteMany({where:{userId:{in:${JSON.stringify(fixtures.users.map(u => u.id))}}}});await prisma.user.deleteMany({where:{id:{in:${JSON.stringify(fixtures.users.map(u => u.id))}}}});await prisma.subscription.deleteMany({where:{companyId:{in:ids}}});await prisma.company.deleteMany({where:{id:{in:ids}}});await prisma.plan.delete({where:{id:'${fixtures.planId}'}});console.log(JSON.stringify({cleaned:true}));await prisma.$disconnect();})();`);
  }
})().catch(error => { console.error(error.stack); process.exit(1); });
