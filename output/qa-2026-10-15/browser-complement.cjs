/**
 * Conclui casos que precisaram corrigir seletores ou aguardar buckets da API.
 * Existe para não contabilizar limitações do roteiro como defeitos de produto.
 * Consumidor: relatório final, com navegador real e dados QA já criados.
 */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const dir=__dirname,base='http://localhost:8086',deep=JSON.parse(fs.readFileSync(path.join(dir,'browser-deep.json'),'utf8'));
const R={checks:[],observations:[],errors:[],http:[]};const save=()=>fs.writeFileSync(path.join(dir,'browser-complement.json'),JSON.stringify(R,null,2));
const check=(name,ok,detail)=>{R.checks.push({name,ok:!!ok,detail});console.log(JSON.stringify({name,ok:!!ok,detail}));save();};
async function shot(p,name,full=true){await p.screenshot({path:path.join(dir,'complement-'+name+'.png'),fullPage:full,animations:'disabled'});}
async function audit(p,name){await p.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8'));const data=await p.evaluate(async()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,violations:(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.slice(0,8).map(n=>({target:n.target,html:n.html.slice(0,350),summary:n.failureSummary}))}))}));R.observations.push({name,...data});save();}
async function flow(name,fn,p){try{await fn();}catch(e){R.errors.push({flow:name,error:e.message});console.log(JSON.stringify({flow:name,error:e.message}));await shot(p,name+'-error').catch(()=>{});save();}}
async function login(p,email,password){await p.goto(base+'/login');await p.locator('input[name=email]').fill(email);await p.locator('input[name=password]').fill(password);await p.getByRole('button',{name:'Entrar na plataforma',exact:true}).click();await p.waitForURL('**/dashboard');}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR',reducedMotion:'reduce'}),p=await context.newPage();p.setDefaultTimeout(20000);
 p.on('response',async r=>{if(r.url().includes('/api/')&&r.status()>=400){R.http.push({url:r.url(),status:r.status(),method:r.request().method(),text:(await r.text().catch(()=>'' )).slice(0,300)});save();}});
 await login(p,'admin@vulnera.local','admin12345');await p.waitForTimeout(9000);
 await flow('technical-pdf',async()=>{await p.goto(base+'/projects/'+deep.created.finding.projectId);await p.getByRole('button',{name:'Relatórios',exact:true}).click();await p.waitForTimeout(26000);const wait=p.waitForEvent('download');await p.getByRole('button',{name:'Gerar PDF Técnico',exact:true}).click();const dl=await wait;await dl.saveAs(path.join(dir,'tecnico.pdf'));check('PDF Técnico funciona após recompor limite',fs.statSync(path.join(dir,'tecnico.pdf')).size>1000);},p);
 await flow('binary-and-watchlist',async()=>{
  await p.goto(base+'/findings/'+deep.created.finding.id+'/edit');await p.locator('input[type=file]').waitFor({state:'attached'});await p.waitForTimeout(4000);
  const w=p.waitForResponse(r=>r.url().includes('/evidences')&&r.request().method()==='POST');await p.locator('input[type=file]').setInputFiles({name:'QA-20261015-binary.exe',mimeType:'application/octet-stream',buffer:Buffer.from([0x4d,0x5a,0x90,0,0,0,0,0,0])});const resp=await w;check('upload bytes binários inválidos recusado',resp.status()===400,{status:resp.status(),body:await resp.json()});
  await p.goto(base+'/findings?q=QA-20261015&severity=CRITICAL');await p.getByRole('button',{name:'Salvar esta busca',exact:true}).click();await p.getByLabel('Nome da busca').fill('QA-20261015 Busca UI final');const checkbox=p.getByLabel('Fixar na barra lateral');await checkbox.focus();await checkbox.press('Space');check('checkbox pin funciona por teclado',await checkbox.isChecked());
  const sw=p.waitForResponse(r=>r.url().endsWith('/saved-queries')&&r.request().method()==='POST');await p.getByRole('button',{name:'Salvar',exact:true}).click();const sr=await sw;check('busca salva UI',sr.status()===201);await p.waitForTimeout(2000);check('pin aparece na navegação',await p.getByRole('link',{name:'QA-20261015 Busca UI final',exact:true}).count()===1);
  await p.waitForTimeout(7000);const csvWait=p.waitForEvent('download');await p.getByRole('button',{name:/Exportar.*CSV/}).click();const csv=await csvWait;await csv.saveAs(path.join(dir,'findings.csv'));check('CSV filtrado por UI',fs.readFileSync(path.join(dir,'findings.csv'),'utf8').includes('QA-20261015'));await p.getByRole('radio',{name:'Claro',exact:true}).click();await shot(p,'findings-claro');await audit(p,'findings-claro');
 },p);await context.close();
 const bruno=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),b=await bruno.newPage();b.setDefaultTimeout(15000);await login(b,'bruno.pentester@vulnera.local','senha12345');await b.waitForTimeout(7000);
 await flow('pentester-navigation',async()=>{await b.goto(base+'/findings/'+deep.created.finding.id);await b.locator('a[href*="/applications/"][href$="/dashboard"]').first().click();await b.waitForTimeout(1200);check('breadcrumb PENTESTER não leva a rota bloqueada',!new URL(b.url()).pathname.endsWith('/dashboard')||new URL(b.url()).pathname!=='/dashboard',{actual:new URL(b.url()).pathname});
  await b.goto(base+'/playbooks');await b.getByRole('button',{name:'Duplicar e adaptar',exact:true}).first().click();await b.waitForTimeout(1400);const body=await b.locator('body').innerText();R.observations.push({name:'pentester-playbook-copy',text:body.slice(-1800)});await shot(b,'pentester-playbook');save();
 },b);await bruno.close();
 const owner=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'}),o=await owner.newPage();o.setDefaultTimeout(15000);await login(o,'owner@technova.demo','demo12345');await o.waitForTimeout(7000);
 await flow('client-remediation-link',async()=>{await o.goto(base+'/projects/cmue2batp002qpxoguguo6t9q');await o.getByRole('button',{name:'Findings',exact:true}).click();const link=o.locator('a[href^="/findings/"]').first();await link.click();const remediation=o.getByRole('link',{name:'quadro de remediação',exact:true});await remediation.waitFor();await remediation.click();await o.waitForTimeout(1000);check('CLIENT recebe link remediação autorizado',new URL(o.url()).pathname==='/remediation',{actual:new URL(o.url()).pathname});},o);await owner.close();
 const pub=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR',reducedMotion:'reduce'}),q=await pub.newPage();q.setDefaultTimeout(20000);
 await flow('public-visual',async()=>{
  await q.goto(base+'/');await q.getByRole('heading',{level:1}).waitFor();await q.waitForTimeout(1200);
  for(const width of [1440,768,375,320]){await q.setViewportSize({width,height:900});await q.evaluate(()=>scrollTo(0,0));await q.waitForTimeout(1000);await shot(q,'landing-'+width,false);await audit(q,'landing-'+width);}
  await q.setViewportSize({width:1440,height:900});await q.locator('#planos').scrollIntoViewIfNeeded();await q.waitForTimeout(1000);await shot(q,'landing-planos',false);check('landing não promete IA fora de escopo',!(await q.locator('#planos').innerText()).includes('Sugestões por IA'));
  const apiPlans=await (await q.request.get('http://localhost:3001/api/plans')).json();R.observations.push({name:'api-plans',plans:apiPlans,landing:(await q.locator('#planos').innerText())});save();
  await q.getByRole('button',{name:/Posso mudar de plano/}).click().catch(()=>{});await shot(q,'landing-faq',false);
  for(const route of ['/login','/register','/plans']){await q.goto(base+route);await q.waitForTimeout(800);await audit(q,'public'+route);}
 },q);await pub.close();
 }finally{R.finishedAt=new Date().toISOString();save();await browser.close();}})().catch(e=>{R.errors.push({fatal:e.stack});save();console.error(e);process.exitCode=1;});
