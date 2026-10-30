/**
 * Reproduz a edição do contexto por CLIENT com a página e componentes reais.
 * Fixtures HTTP isolam o estado para não editar aplicações do banco de demo.
 * Consumido manualmente para diagnóstico e validação no Chrome.
 */
const { chromium } = require('C:/Users/50786702893/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const phase = process.argv[2] || 'before';
const out = path.join(__dirname,'client-risk-context'); fs.mkdirSync(out,{recursive:true});
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(() => {localStorage.setItem('vulnera:theme','dark'); localStorage.setItem('vulnera-auth',JSON.stringify({state:{accessToken:'fixture',refreshToken:'fixture',user:{id:'owner-a',name:'Cliente Owner',role:'CLIENT',companyId:'company-a',companyRole:'OWNER',email:'owner@example.test',createdAt:'2026-01-01T00:00:00Z'}},version:0}));});
 let application = {id:'app-a',name:'Portal QA',companyId:'company-a',isActive:true,url:'https://example.test',techStack:null,description:null,criticality:'LOW',environment:'DEV',internetFacing:false,dataSensitivity:'PUBLIC',businessOwner:null,technicalOwner:null,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};
 const updates=[]; const errors=[];
 const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
 await page.route(/^http:\/\/localhost:(3017|3001)\//,async route=>{
  if(!['xhr','fetch'].includes(route.request().resourceType()))return route.continue();
  const raw=new URL(route.request().url()).pathname; const p=raw.startsWith('/api/')?raw.slice(4):raw; let data;
  if(route.request().method()==='PUT'&&p==='/applications/app-a'){const input=route.request().postDataJSON();updates.push(input);application={...application,...input};data=application;}
  else if(route.request().method()!=='GET')throw Error('Gravação inesperada');
  else if(p==='/applications')data=[application];
  else if(p==='/companies/me')data={id:'company-a',name:'Empresa A',planId:'plan-a'};
  else if(p==='/subscriptions/current')data={id:'sub-a',planId:'plan-a',status:'ACTIVE'};
  else if(p==='/plans')data=[{id:'plan-a',name:'PRO',maxApplications:5,maxProjects:5}];
  else if(p==='/saved-queries')data=[];
  else throw Error('Rota não prevista: '+p);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://localhost:3017/applications');
 await page.getByRole('button',{name:'Contexto',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 const before = await page.getByLabel('Dono de negócio',{exact:true}).evaluate(e=>({disabled:e.disabled,readOnly:e.readOnly,inert:Boolean(e.closest('[inert]'))}));
 await page.getByLabel('Dono de negócio',{exact:true}).fill('Diretoria Comercial');
 await page.getByLabel('Dono técnico',{exact:true}).fill('Squad Checkout');
 await page.getByRole('switch',{name:'Exposta à internet'}).click();
 await page.screenshot({path:path.join(out,phase+'-form.png'),fullPage:true});
 if(phase==='before'){
  await page.getByLabel('Criticidade',{exact:true}).click();
  await page.waitForTimeout(250);
  const diagnostic=await page.evaluate(()=>({panels:[...document.querySelectorAll('[role="listbox"]')].map(e=>({inert:Boolean(e.closest('[inert]')),zIndex:getComputedStyle(e.parentElement).zIndex,rect:e.getBoundingClientRect().toJSON()})),dialogZ:getComputedStyle(document.querySelector('[role="dialog"]').parentElement).zIndex,active:document.activeElement?.outerHTML.slice(0,240)}));
  await page.screenshot({path:path.join(out,'before-select.png'),fullPage:true});
  fs.writeFileSync(path.join(out,'before.json'),JSON.stringify({inputs:before,diagnostic},null,2));console.log(JSON.stringify({inputs:before,diagnostic}));
 }else{
  for(const label of ['Criticidade','Ambiente','Sensibilidade do dado']) {
   await page.getByLabel(label,{exact:true}).click();
   await page.keyboard.press('End');
   if(label!=='Ambiente') await page.keyboard.press('ArrowUp');
   await page.keyboard.press('Enter');
  }
  await page.getByRole('button',{name:'Salvar contexto',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.deepEqual(updates,[{criticality:'HIGH',environment:'PROD',internetFacing:true,dataSensitivity:'CONFIDENTIAL',businessOwner:'Diretoria Comercial',technicalOwner:'Squad Checkout'}]);
  await page.getByRole('button',{name:'Contexto',exact:true}).click();
  for(const [label,value] of [['Criticidade','HIGH'],['Ambiente','PROD'],['Sensibilidade do dado','CONFIDENTIAL'],['Dono de negócio','Diretoria Comercial'],['Dono técnico','Squad Checkout']]) assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),value);
  assert.equal(await page.getByRole('switch',{name:'Exposta à internet'}).getAttribute('aria-checked'),'true');
  await page.waitForTimeout(350);
  await page.screenshot({path:path.join(out,'after-reopened-dark.png'),fullPage:true});
  await page.getByLabel('Criticidade',{exact:true}).selectOption('LOW');
  assert(await page.getByRole('button',{name:'Salvar contexto',exact:true}).isDisabled(),'Redução ainda exige ADMIN');
  await page.getByLabel('Criticidade',{exact:true}).selectOption('HIGH');
  await page.setViewportSize({width:375,height:900});
  await page.screenshot({path:path.join(out,'after-mobile.png'),fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'after.json'),JSON.stringify({updates,reopened:true,reductionBlocked:true,pageErrors:errors},null,2));console.log(JSON.stringify({updates,reopened:true,reductionBlocked:true,pageErrors:errors}));
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1);});
