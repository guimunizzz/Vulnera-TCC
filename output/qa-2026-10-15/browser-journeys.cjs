/**
 * Exercita cadastro/onboarding, modais, wizard, DAST e relatórios na stack real.
 * Existe para registrar comportamentos que mocks não conseguem demonstrar.
 * Consumidor: QA pré-apresentação; cria somente dados com marcador QA-20261015.
 */
const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');
const dir=__dirname,base='http://localhost:8086';
const marker=`QA-20261015-UI-${Date.now().toString(36)}`;
const result={marker,startedAt:new Date().toISOString(),checks:[],observations:[],errors:[],created:{}};
const save=()=>fs.writeFileSync(path.join(dir,'browser-journeys.json'),JSON.stringify(result,null,2));
const check=(name,ok,detail)=>{const x={name,ok:!!ok,detail};result.checks.push(x);console.log(JSON.stringify(x));save();};
async function shot(p,name){await p.screenshot({path:path.join(dir,`journey-${name}.png`),fullPage:true,animations:'disabled'});}
async function login(p,email,password){await p.goto(`${base}/login`);await p.locator('input[name=email]').fill(email);await p.locator('input[name=password]').fill(password);const wait=p.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');await p.getByRole('button',{name:'Entrar na plataforma',exact:true}).click();const r=await wait;check(`login ${email.split('@')[0]}`,r.status()===200);await p.waitForURL('**/dashboard');return r.json();}
async function flow(name,fn,p){try{await fn();}catch(e){result.errors.push({flow:name,error:e.message});console.log(JSON.stringify({flow:name,error:e.message}));if(p)await shot(p,`${name}-error`).catch(()=>{});save();}}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
 const p=await context.newPage();p.setDefaultTimeout(12000);
 p.on('pageerror',e=>{result.errors.push({page:p.url(),error:e.message});save();});
 await flow('onboarding',async()=>{
  const email=`${marker.toLowerCase()}@example.test`,password='QA-apresentacao-123!';
  await p.goto(`${base}/register`);
  await p.locator('input[name=name]').fill(marker);
  await p.locator('input[name=email]').fill(email);
  await p.locator('input[name=password]').fill(password);
  await p.locator('input[name=password-confirmation]').fill('diferente');
  check('cadastro mostra senhas divergentes',await p.getByRole('alert').innerText());
  await p.locator('input[name=password-confirmation]').fill(password);
  const registering=p.waitForResponse(r=>r.url().endsWith('/auth/register')&&r.request().method()==='POST');
  await p.getByRole('button',{name:'Criar conta',exact:true}).click();
  const register=await registering;check('cadastro UI HTTP 201',register.status()===201);
  await p.waitForURL('**/onboarding');
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  check('onboarding exige nome empresa',(await p.locator('body').innerText()).includes('Informe o nome'));
  await p.getByLabel('Nome da empresa',{exact:true}).fill(`${marker} Empresa`);
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  check('onboarding exige plano',(await p.locator('body').innerText()).includes('Selecione um plano'));
  await p.getByRole('button',{name:/^PRO Até/}).click();
  await p.getByRole('button',{name:'Continuar',exact:true}).click();
  await shot(p,'onboarding-confirmacao');
  const companyWait=p.waitForResponse(r=>r.url().endsWith('/companies')&&r.request().method()==='POST');
  const subWait=p.waitForResponse(r=>r.url().endsWith('/subscriptions')&&r.request().method()==='POST');
  await p.getByRole('button',{name:'Confirmar',exact:true}).click();
  const companyResponse=await companyWait;result.created.company=await companyResponse.json();
  const sub=await subWait;check('onboarding cria empresa e pedido',companyResponse.status()===201&&sub.status()===201,{company:companyResponse.status(),subscription:sub.status()});
  await p.getByRole('button',{name:'Ir para o Dashboard'}).click();await p.waitForURL('**/dashboard');
  const stale=await p.evaluate(()=>JSON.parse(localStorage.getItem('vulnera-auth')).state.user);
  result.observations.push({name:'session-after-onboarding',user:stale});save();
  await p.goto(`${base}/settings/sla`);await p.waitForTimeout(4500);await shot(p,'onboarding-sla-antes-relogin');
  const before={save:await p.getByRole('button',{name:'Salvar política',exact:true}).count(),readonly:(await p.locator('body').innerText()).includes('Política para consulta')};
  const auth=await login(p,email,password);
  await p.goto(`${base}/settings/sla`);await p.waitForTimeout(4000);await shot(p,'onboarding-sla-depois-relogin');
  const after={save:await p.getByRole('button',{name:'Salvar política',exact:true}).count(),companyRole:auth.user.companyRole};
  result.observations.push({name:'onboarding-owner-role-stale',before,after});
  check('OWNER recebe edição SLA imediatamente após onboarding',before.save===1,{before,after});
  result.created.user={id:auth.user.id,email};save();
 });
 await context.close();
 const adminContext=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
 const a=await adminContext.newPage();a.setDefaultTimeout(15000);
 const auth=await login(a,'admin@vulnera.local','admin12345');
 const headers={Authorization:`Bearer ${auth.accessToken}`};
 if(result.created.company?.id){
  await flow('aprovar-assinatura',async()=>{
   await a.waitForTimeout(8000);await a.goto(`${base}/admin/subscriptions`);await a.getByText(`${marker} Empresa`,{exact:true}).waitFor();
   const row=a.locator('tr').filter({hasText:`${marker} Empresa`});
   const approve=a.waitForResponse(r=>r.url().includes('/approve')&&r.request().method()!=='GET');
   await row.getByRole('button',{name:'Aprovar',exact:true}).click();const r=await approve;check('aprovação UI assinatura QA',r.status()===200);await shot(a,'assinatura-aprovada');
  },a);
 }
 await flow('nova-aplicacao-wizard',async()=>{
  const companyId=result.created.company?.id||'cmv9hd79c000fph012iomwajn';
  await a.goto(`${base}/applications`);await a.getByRole('button',{name:'Nova aplicação',exact:true}).first().click();
  const dialog=a.getByRole('dialog',{name:'Nova aplicação'});
  check('ADMIN deve selecionar empresa',await dialog.getByRole('button',{name:'Criar',exact:true}).isDisabled());
  await dialog.getByLabel('Empresa').selectOption(companyId);
  await dialog.getByLabel('Nome',{exact:true}).fill(`${marker} Aplicação`);
  await dialog.getByLabel('URL',{exact:true}).fill('http://localhost:8086/');
  const creating=a.waitForResponse(r=>r.url().endsWith('/applications')&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'Criar',exact:true}).click();const r=await creating;
  check('criar aplicação UI',r.status()===201);result.created.application=await r.json();save();
  await dialog.waitFor({state:'hidden'});await a.getByText(`${marker} Aplicação`,{exact:true}).waitFor();
  check('lista atualiza aplicação sem reload',true);
  const row=a.locator('tr').filter({hasText:`${marker} Aplicação`});
  await row.getByRole('button',{name:'Contexto',exact:true}).click();await a.getByRole('dialog').waitFor();await shot(a,'contexto-aplicacao');
  await a.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
  await a.goto(`${base}/new-analysis?applicationId=${result.created.application.id}`);
  await a.getByRole('button',{name:'Continuar',exact:true}).click();
  await a.getByRole('button',{name:'Continuar',exact:true}).click();
  await a.getByLabel('Nome do projeto').fill(`${marker} Projeto`);
  await a.getByRole('button',{name:'Continuar',exact:true}).click();await shot(a,'wizard-projeto-mobile');
  const creatingProject=a.waitForResponse(r=>r.url().endsWith('/projects')&&r.request().method()==='POST');
  await a.getByRole('button',{name:/Solicitar|Criar projeto|Confirmar/}).click();const projectResponse=await creatingProject;
  check('criar projeto wizard UI',projectResponse.status()===201);result.created.project=await projectResponse.json();save();
 },a);
 await flow('dast-simulado',async()=>{
  await a.goto(`${base}/dast`);await a.getByRole('button',{name:'Novo scan',exact:true}).click();
  const dialog=a.getByRole('dialog');
  check('DAST exige URL',await dialog.getByRole('button',{name:'Gerar demonstração',exact:true}).isDisabled());
  await dialog.getByLabel('URL do alvo').fill('invalido');
  check('DAST invalida URL incorreta',await dialog.getByRole('button',{name:'Gerar demonstração',exact:true}).isDisabled());
  await dialog.getByLabel('URL do alvo').fill(`http://localhost:8086/qa-${marker}`);
  await dialog.getByRole('radio',{name:/Real — análise passiva/}).check();
  await dialog.getByRole('button',{name:'Continuar para confirmação',exact:true}).click();
  check('DAST real exige consentimento',await dialog.getByRole('button',{name:'Confirmar e iniciar scan real',exact:true}).isDisabled());
  await dialog.getByRole('button',{name:'Voltar',exact:true}).click();
  await dialog.getByRole('radio',{name:/Simulado|Demonstração/}).check();
  const creating=a.waitForResponse(r=>r.url().endsWith('/dast/scans')&&r.request().method()==='POST');
  await dialog.getByRole('button',{name:'Gerar demonstração',exact:true}).click();const r=await creating;result.created.scan=await r.json();save();check('DAST simulado criado UI',r.status()===201);
  await a.waitForURL('**/dast/scans/*');await a.waitForTimeout(7000);await shot(a,'dast-simulado');
  check('DAST terminou com selo simulado',(await a.locator('body').innerText()).includes('simulado'));
 },a);
 await flow('logout',async()=>{await a.getByRole('button',{name:'Conta',exact:true}).click();await a.getByRole('menuitem',{name:'Sair',exact:true}).click();await a.waitForURL('**/login');check('logout pela UI',true);await a.goto(`${base}/projects`);await a.waitForURL('**/login');check('logout fecha acesso privado',true);},a);
 await adminContext.close();
 }finally{result.finishedAt=new Date().toISOString();save();await browser.close();}
})().catch(e=>{result.errors.push({fatal:e.stack});save();console.error(e);process.exitCode=1;});
