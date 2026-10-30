/**
 * Testa gravações e downloads reais em registros QA, além dos casos de regressão visual.
 * Existe para confirmar achados da exploração com requests e passos reproduzíveis.
 * Consumidor: relatório pré-apresentação; mantém histórico e não apaga dados.
 */
const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');
const dir=__dirname,base='http://localhost:8086',previous=JSON.parse(fs.readFileSync(path.join(dir,'browser-journeys.json'),'utf8'));
const marker=previous.marker;
const R={startedAt:new Date().toISOString(),checks:[],observations:[],errors:[],created:{}};
const save=()=>fs.writeFileSync(path.join(dir,'browser-deep.json'),JSON.stringify(R,null,2));
function check(name,ok,detail){const row={name,ok:!!ok,detail};R.checks.push(row);console.log(JSON.stringify(row));save();}
async function shot(p,name){await p.screenshot({path:path.join(dir,`deep-${name}.png`),fullPage:true,animations:'disabled'});}
async function flow(name,fn,p){try{await fn();}catch(e){R.errors.push({flow:name,error:e.message});console.log(JSON.stringify({flow:name,error:e.message}));await shot(p,`${name}-error`).catch(()=>{});save();}}
async function login(p,email,password){await p.goto(base+'/login');await p.locator('input[name=email]').fill(email);await p.locator('input[name=password]').fill(password);const response=p.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');await p.getByRole('button',{name:'Entrar na plataforma',exact:true}).click();const r=await response;if(r.status()!==200)throw Error('login HTTP '+r.status());await p.waitForURL('**/dashboard');return r.json();}
async function audit(p,name){await p.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8'));const d=await p.evaluate(async()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,violations:(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,html:n.html.slice(0,400)}))}))}));R.observations.push({name,...d});save();}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
 const p=await ctx.newPage();p.setDefaultTimeout(15000);
 const auth=await login(p,'admin@vulnera.local','admin12345');const headers={Authorization:`Bearer ${auth.accessToken}`};
 const api=async(route,method='GET',data)=>{for(let i=0;i<5;i++){const r=await ctx.request.fetch('http://localhost:3001/api'+route,{method,data,headers});if(r.status()===429){await p.waitForTimeout(Number(r.headers()['retry-after']||2)*1000+150);continue;}return r;}throw Error('429 persistente '+route);};
 await flow('aprovar',async()=>{
  await p.goto(base+'/admin/subscriptions');const row=p.locator('tr').filter({hasText:previous.created.company.name});await row.getByRole('button',{name:'Aprovar',exact:true}).click();
  const d=p.getByRole('dialog');await d.getByRole('button',{name:'Cancelar',exact:true}).click();check('cancelar aprovação mantém pedido',await row.count()===1);
  await row.getByRole('button',{name:'Aprovar',exact:true}).click();const wait=p.waitForResponse(r=>r.url().includes('/approve')&&r.request().method()==='POST');await d.getByRole('button',{name:'Confirmar',exact:true}).click();const response=await wait;
  check('aprovar assinatura por confirmação UI',response.status()===200);await row.waitFor({state:'hidden'});check('assinatura aprovada sai da fila',true);
 },p);
 await flow('aplicacao-wizard',async()=>{
  await p.goto(base+'/applications');await p.getByRole('button',{name:'Nova aplicação',exact:true}).first().click();const d=p.getByRole('dialog',{name:'Nova aplicação'});
  await d.getByLabel('Empresa').selectOption(previous.created.company.id);
  await d.getByLabel('Nome',{exact:true}).fill(marker+' Aplicação');await d.getByLabel('URL',{exact:true}).fill('http://localhost:8086/');
  const creating=p.waitForResponse(r=>r.url().endsWith('/applications')&&r.request().method()==='POST');await d.getByRole('button',{name:'Criar',exact:true}).click();const response=await creating;
  check('criar aplicação por UI após assinatura ativa',response.status()===201);R.created.application=await response.json();save();if(!R.created.application.id)return;
  await d.waitFor({state:'hidden'});await p.getByText(marker+' Aplicação',{exact:true}).waitFor();check('aplicação na lista sem reload',true);
  const row=p.locator('tr').filter({hasText:marker+' Aplicação'});await row.getByRole('button',{name:'Contexto',exact:true}).click();await p.getByRole('dialog').waitFor();await audit(p,'modal-contexto');await shot(p,'modal-contexto');
  await p.keyboard.press('Escape');check('Escape fecha modal',await p.getByRole('dialog').count()===0);
  await p.goto(base+`/new-analysis?applicationId=${R.created.application.id}`);
  await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.locator('#project-name').fill(marker+' Projeto');
  await p.getByRole('button',{name:'Continuar',exact:true}).click();await p.setViewportSize({width:375,height:812});await shot(p,'wizard-mobile');await audit(p,'wizard-mobile');
  const creatingProject=p.waitForResponse(r=>r.url().endsWith('/projects')&&r.request().method()==='POST');await p.getByRole('button',{name:'Criar projeto',exact:true}).click();const pr=await creatingProject;R.created.project=await pr.json();save();check('wizard cria projeto por UI',pr.status()===201);
  await p.setViewportSize({width:1440,height:900});
 },p);
 const projectId=R.created.project?.id||'cmv9hdb8i000pph01zb0tb5c4';
 await flow('finding',async()=>{
  await p.goto(base+`/projects/${projectId}/findings/new`);await p.locator('#finding-title').fill(marker+' SQL Injection no parâmetro de pesquisa com impacto no acesso aos dados confidenciais dos clientes');
  await p.locator('#finding-owasp').selectOption('A03');await p.locator('#finding-vector').fill('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
  await p.locator('#finding-description').fill('Registro de QA para validação da apresentação, sem vulnerabilidade real.');await p.locator('#finding-impact').fill('Impacto QA preenchido');await p.locator('#finding-recommendation').fill('Recomendação QA preenchida');
  check('CVSS calcula 9.8 em tempo real',(await p.locator('body').innerText()).includes('9.8'));
  const creating=p.waitForResponse(r=>r.url().endsWith('/vulnerabilities')&&r.request().method()==='POST');await p.getByRole('button',{name:'Criar finding',exact:true}).click();const vr=await creating;R.created.finding=await vr.json();save();check('criar finding via UI',vr.status()===201);if(!R.created.finding.id)return;
  await p.waitForURL('**/findings/*');await p.goto(base+`/findings/${R.created.finding.id}/edit`);await p.locator('#finding-impact').waitFor();await p.locator('#finding-impact').fill('');await p.locator('#finding-recommendation').fill('');
  const updating=p.waitForResponse(r=>r.url().endsWith('/vulnerabilities/'+R.created.finding.id)&&r.request().method()==='PUT');await p.getByRole('button',{name:'Salvar alterações',exact:true}).click();const ur=await updating;
  const data=await (await api('/vulnerabilities/'+R.created.finding.id)).json();
  check('limpar Impacto/Recomendação persiste em finding',data.impact===null&&data.recommendation===null,{status:ur.status(),impact:data.impact,recommendation:data.recommendation,payload:ur.request().postDataJSON()});
  await p.reload();await p.locator('#finding-impact').waitFor();await shot(p,'finding-campos-reaparecem');
  const uploader=p.getByText('Arraste arquivos aqui ou clique para selecionar',{exact:false});const semantics=await uploader.evaluate(e=>({tag:e.tagName,tabIndex:e.tabIndex,role:e.getAttribute('role'),inputDisplay:getComputedStyle(e.querySelector('input')).display}));
  check('upload acessível por teclado',semantics.tabIndex>=0,semantics);
  const uploadWait=p.waitForResponse(r=>r.url().includes('/evidences')&&r.request().method()==='POST');await p.locator('input[type=file]').setInputFiles({name:marker+'.txt',mimeType:'text/plain',buffer:Buffer.from('Evidência artificial de QA para teste de apresentação.\n')});const er=await uploadWait;check('upload TXT real',er.status()===201);await p.getByText('Enviado',{exact:true}).waitFor();
  const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Baixar',exact:true}).first().click();const download=await dl;await download.saveAs(path.join(dir,'evidencia-baixada.txt'));check('download preserva conteúdo TXT',fs.readFileSync(path.join(dir,'evidencia-baixada.txt'),'utf8').includes('Evidência artificial'));
  const invalidWait=p.waitForResponse(r=>r.url().includes('/evidences')&&r.request().method()==='POST');await p.locator('input[type=file]').setInputFiles({name:marker+'.exe',mimeType:'application/octet-stream',buffer:Buffer.from('Arquivo de texto inofensivo para testar bloqueio de extensão.')});const invalid=await invalidWait;check('upload formato inválido é bloqueado',invalid.status()===400,{status:invalid.status()});
  await p.getByPlaceholder('Escreva um comentário...').fill(marker+' Comentário QA');const commentWait=p.waitForResponse(r=>r.url().includes('/comments')&&r.request().method()==='POST');await p.getByRole('button',{name:'Comentar',exact:true}).click();const cr=await commentWait;check('comentário real UI',cr.status()===201);await p.getByText(marker+' Comentário QA',{exact:true}).waitFor();await audit(p,'finding-edit');
 },p);
 await flow('relatorios',async()=>{
  let project=await (await api('/projects/'+projectId)).json();for(const status of ['IN_PROGRESS','IN_REVIEW']){if(project.status==='PENDING'&&status==='IN_PROGRESS'||project.status==='IN_PROGRESS'&&status==='IN_REVIEW'){const r=await api(`/projects/${projectId}/transition`,'POST',{toStatus:status});check('preparação projeto QA '+status,r.status()===200);project=await r.json();}}
  await p.goto(base+'/projects/'+projectId);await p.getByRole('button',{name:'Relatórios',exact:true}).click();
  for(const [name,file] of [['Gerar PDF Executivo','executivo.pdf'],['Gerar PDF Técnico','tecnico.pdf']]){const wait=p.waitForEvent('download');await p.getByRole('button',{name,exact:true}).click();const download=await wait;await download.saveAs(path.join(dir,file));check('download '+file,fs.statSync(path.join(dir,file)).size>1000);await p.waitForTimeout(1800);}
  await p.setViewportSize({width:375,height:812});await shot(p,'historico-relatorios-mobile');
  const table=await p.locator('table').last().evaluate(e=>{const b=e.getBoundingClientRect(),parent=e.parentElement,ps=getComputedStyle(parent);return{tableWidth:b.width,right:b.right,viewport:innerWidth,parentWidth:parent.clientWidth,parentScroll:parent.scrollWidth,parentOverflow:ps.overflowX,lastCell:e.querySelector('tbody tr td:last-child')?.textContent}});
  check('histórico relatórios cabe ou permite rolagem mobile',table.right<=375||['auto','scroll'].includes(table.parentOverflow),table);await audit(p,'historico-relatorios-mobile');await p.setViewportSize({width:1440,height:900});
 },p);
 await flow('dast-detalhe',async()=>{
  const scanId=previous.created.scan.id;await p.goto(base+'/dast/scans/'+scanId);await p.getByText('RESULTADO SIMULADO',{exact:false}).waitFor();check('DAST demo concluído com aviso',(await p.locator('body').innerText()).includes('fictícios'));
  await p.getByLabel('Filtrar por risco').selectOption('HIGH');await p.getByRole('button',{name:'Detalhes',exact:true}).first().click();check('demo bloqueia promoção',await p.getByRole('button',{name:'Promover para vulnerabilidade',exact:true}).isDisabled());
  await audit(p,'dast-expandido');const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Baixar PDF',exact:true}).click();await (await dl).saveAs(path.join(dir,'dast.pdf'));check('download DAST PDF',fs.statSync(path.join(dir,'dast.pdf')).size>1000);
  await p.setViewportSize({width:375,height:812});await shot(p,'dast-mobile');await audit(p,'dast-mobile');await p.setViewportSize({width:1440,height:900});
 },p);
 await flow('logout',async()=>{
  const trigger=p.locator('header button[aria-haspopup="menu"]');await trigger.click();await p.getByRole('menuitem',{name:'Sair',exact:true}).click();await p.waitForURL('**/login');check('logout UI e guarda de rota',true);await p.goto(base+'/projects');await p.waitForURL('**/login');check('acesso privado encerrado após logout',true);
 },p);
 await ctx.close();
 }finally{R.finishedAt=new Date().toISOString();save();await browser.close();}
})().catch(e=>{R.errors.push({fatal:e.stack});save();console.error(e);process.exitCode=1;});
