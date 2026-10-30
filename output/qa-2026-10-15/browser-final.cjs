/**
 * Repete cenários em janela isolada e registra falhas funcionais e visuais finais.
 * Existe para separar defeitos do produto de erros do roteiro e dos limites sob carga.
 * Consumidor: relatório consolidado de QA; usa exclusivamente registros QA em gravações.
 */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const dir=__dirname,base='http://localhost:8086';
const prev=JSON.parse(fs.readFileSync(path.join(dir,'browser-journeys.json'),'utf8')),deep=JSON.parse(fs.readFileSync(path.join(dir,'browser-deep.json'),'utf8'));
const R={startedAt:new Date().toISOString(),checks:[],errors:[],http:[],observations:[],created:{}};const save=()=>fs.writeFileSync(path.join(dir,'browser-final.json'),JSON.stringify(R,null,2));
const check=(name,ok,detail)=>{const row={name,ok:!!ok,detail};R.checks.push(row);console.log(JSON.stringify(row));save();};
async function shot(p,name){await p.screenshot({path:path.join(dir,`final-${name}.png`),fullPage:true,animations:'disabled'});}
async function flow(name,fn,p){try{await fn();}catch(e){R.errors.push({flow:name,error:e.message});console.log(JSON.stringify({flow:name,error:e.message}));await shot(p,name+'-error').catch(()=>{});save();}}
async function login(p,email,password){await p.goto(base+'/login');await p.locator('input[name=email]').fill(email);await p.locator('input[name=password]').fill(password);const response=p.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');await p.getByRole('button',{name:'Entrar na plataforma',exact:true}).click();const r=await response;await p.waitForURL('**/dashboard');return r.json();}
async function audit(p,name){await p.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8'));const data=await p.evaluate(async()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,violations:(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.slice(0,10).map(n=>({target:n.target,html:n.html.slice(0,350),summary:n.failureSummary}))}))}));R.observations.push({name,...data});save();}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'}),p=await ctx.newPage();p.setDefaultTimeout(18000);
  p.on('response',async r=>{if(r.url().includes('/api/')&&r.status()>=400){R.http.push({status:r.status(),method:r.request().method(),url:r.url(),body:(await r.text().catch(()=>'' )).slice(0,400)});save();}});
  p.on('pageerror',e=>{R.errors.push({page:p.url(),error:e.message});save();});
  const auth=await login(p,'admin@vulnera.local','admin12345');await p.waitForTimeout(14000);await shot(p,'dashboard-admin-isolado');check('dashboard ADMIN estabiliza sem reload',(await p.locator('body').innerText()).includes('Empresas')||!(await p.locator('body').innerText()).includes('Carregando dashboard'));
  await flow('aplicacao-wizard',async()=>{
   await p.goto(base+'/applications');await p.getByRole('button',{name:'Nova aplicação',exact:true}).first().click();const d=p.getByRole('dialog',{name:'Nova aplicação'});
   await d.getByLabel('Empresa').selectOption(prev.created.company.id);await d.getByLabel('Nome',{exact:true}).fill(prev.marker+' Aplicação final');await d.getByLabel('URL',{exact:true}).fill('http://localhost:8086/');
   const wait=p.waitForResponse(r=>r.url().endsWith('/applications')&&r.request().method()==='POST');await d.getByRole('button',{name:'Criar',exact:true}).click();const response=await wait;R.created.application=await response.json();save();check('criação aplicação UI isolada',response.status()===201,{status:response.status(),body:R.created.application});if(!R.created.application.id)return;
   await d.waitFor({state:'hidden'});await p.waitForTimeout(3000);await p.goto(base+'/new-analysis?applicationId='+R.created.application.id);await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.locator('#project-name').fill(prev.marker+' Projeto final');await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.setViewportSize({width:375,height:812});await shot(p,'wizard-mobile');await audit(p,'wizard-mobile');
   const waitProject=p.waitForResponse(r=>r.url().endsWith('/projects')&&r.request().method()==='POST');await p.getByRole('button',{name:'Criar projeto',exact:true}).click();const responseProject=await waitProject;R.created.project=await responseProject.json();save();check('wizard projeto UI isolado',responseProject.status()===201,{status:responseProject.status()});await p.setViewportSize({width:1440,height:900});
  },p);
  const findingId=deep.created.finding.id,projectId=deep.created.finding.projectId;
  await flow('finding-reteste',async()=>{
   await p.waitForTimeout(10000);await p.goto(base+`/findings/${findingId}/edit`);await p.locator('#finding-impact').waitFor();await p.locator('#finding-impact').fill('');await p.locator('#finding-recommendation').fill('');await p.waitForTimeout(5000);
   const wait=p.waitForResponse(r=>r.url().endsWith('/vulnerabilities/'+findingId)&&r.request().method()==='PUT');await p.getByRole('button',{name:'Salvar alterações',exact:true}).click();const response=await wait;const body=await response.json();check('limpeza impacto/recomendação com HTTP200 persiste',response.status()===200&&!body.impact&&!body.recommendation,{status:response.status(),impact:body.impact,recommendation:body.recommendation,payload:response.request().postDataJSON()});
   await p.reload();await p.locator('#finding-impact').waitFor();await p.waitForTimeout(6500);const downloadWait=p.waitForEvent('download');await p.getByRole('button',{name:'Baixar',exact:true}).first().click();const dl=await downloadWait;await dl.saveAs(path.join(dir,'evidencia-baixada.txt'));check('download de evidência UI isolado',fs.readFileSync(path.join(dir,'evidencia-baixada.txt'),'utf8').includes('Evidência artificial'));
   await p.waitForTimeout(2500);const invalidWait=p.waitForResponse(r=>r.url().includes('/evidences')&&r.request().method()==='POST');await p.locator('input[type=file]').setInputFiles({name:'QA-20261015-invalido.exe',mimeType:'application/octet-stream',buffer:Buffer.from('Texto inofensivo de QA.')});const invalid=await invalidWait;check('arquivo inválido recebe recusa tratada',invalid.status()===400,{status:invalid.status()});
   await p.waitForTimeout(2500);await p.getByPlaceholder('Escreva um comentário...').fill(prev.marker+' Comentário final QA');const cw=p.waitForResponse(r=>r.url().includes('/comments')&&r.request().method()==='POST');await p.getByRole('button',{name:'Comentar',exact:true}).click();const cr=await cw;check('comentário UI isolado',cr.status()===201);await p.getByText(prev.marker+' Comentário final QA',{exact:true}).waitFor();await audit(p,'finding-edit');
  },p);
  await flow('pdfs',async()=>{
   await p.waitForTimeout(16000);await p.goto(base+'/projects/'+projectId);await p.getByRole('button',{name:'Relatórios',exact:true}).click();await p.waitForTimeout(5000);
   for(const [name,file] of [['Gerar PDF Executivo','executivo.pdf'],['Gerar PDF Técnico','tecnico.pdf']]){await flow(file,async()=>{const wait=p.waitForEvent('download');await p.getByRole('button',{name,exact:true}).click();const dl=await wait;await dl.saveAs(path.join(dir,file));check('download '+file,fs.statSync(path.join(dir,file)).size>1000);},p);await p.waitForTimeout(7000);}
   await p.setViewportSize({width:375,height:812});await shot(p,'relatorios-mobile');const data=await p.locator('table').last().evaluate(e=>({right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width,parentWidth:e.parentElement.clientWidth,parentOverflow:getComputedStyle(e.parentElement).overflowX,last:e.querySelector('tbody tr td:last-child')?.textContent}));check('histórico relatório acessível em mobile',data.right<=375||['auto','scroll'].includes(data.parentOverflow),data);await audit(p,'relatorios-mobile');await p.setViewportSize({width:1440,height:900});
  },p);
  await flow('busca-salva',async()=>{
   await p.goto(base+'/findings?q=QA-20261015&severity=CRITICAL');await p.getByRole('button',{name:'Salvar esta busca',exact:true}).click();await p.getByLabel('Nome da busca').fill(prev.marker+' Busca');await p.getByLabel('Fixar na barra lateral').check();const wait=p.waitForResponse(r=>r.url().endsWith('/saved-queries')&&r.request().method()==='POST');await p.getByRole('button',{name:'Salvar',exact:true}).click();const response=await wait;check('busca salva UI com pin',response.status()===201);await p.waitForTimeout(3500);check('busca fixada aparece sidebar',await p.getByRole('link',{name:prev.marker+' Busca',exact:true}).count()===1);await shot(p,'busca-salva');
  },p);await ctx.close();
  const rolesCtx=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR',reducedMotion:'reduce'}),b=await rolesCtx.newPage();b.setDefaultTimeout(15000);await login(b,'bruno.pentester@vulnera.local','senha12345');await b.waitForTimeout(9000);
  await flow('links-pentester',async()=>{await b.goto(base+'/findings/'+findingId);const breadcrumb=b.locator('a[href*="/applications/"][href$="/dashboard"]').first();await breadcrumb.waitFor();await shot(b,'finding-pentester');await breadcrumb.click();await b.waitForURL('**/dashboard');check('breadcrumb aplicação PENTESTER abre destino permitido',false,{actual:new URL(b.url()).pathname});
   await b.goto(base+'/projects/'+projectId);await b.getByRole('button',{name:'Relatórios',exact:true}).click();await b.waitForTimeout(2500);await shot(b,'autor-relatorio-pentester');const text=await b.locator('table').last().innerText();check('histórico mostra nome do autor para PENTESTER',!text.includes('cmue2b9em0003pxogpar7imm9'),{text});
  },b);await rolesCtx.close();
  const pubctx=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR',reducedMotion:'reduce'}),q=await pubctx.newPage();q.setDefaultTimeout(12000);
  await flow('landing',async()=>{
   await q.goto(base+'/');await q.getByRole('button',{name:/SKIP INTRO/}).click();await q.getByRole('heading',{level:1}).waitFor();
   for(const width of [1440,768,375,320]){await q.setViewportSize({width,height:900});await q.evaluate(()=>scrollTo(0,0));await q.waitForTimeout(1500);await shot(q,'landing-'+width);await audit(q,'landing-'+width);}
   await q.setViewportSize({width:1440,height:900});await q.locator('#planos').scrollIntoViewIfNeeded();await q.waitForTimeout(1000);await q.screenshot({path:path.join(dir,'final-landing-planos.png')});check('landing não anuncia IA fora do escopo',!(await q.locator('#planos').innerText()).includes('Sugestões por IA'));
   const plansResponse=await q.request.get('http://localhost:3001/api/plans');const plans=await plansResponse.json();R.observations.push({name:'plans-api',plans});save();
   for(const route of ['/login','/register','/plans']){await q.goto(base+route);await q.waitForTimeout(800);await audit(q,'public-'+route.slice(1));}
  },q);await pubctx.close();
 }finally{R.finishedAt=new Date().toISOString();save();await browser.close();}
})().catch(e=>{R.errors.push({fatal:e.stack});save();console.error(e);process.exitCode=1;});
