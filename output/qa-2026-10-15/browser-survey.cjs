/**
 * Percorre a stack real por perfil e tamanho de tela sem alterar dados existentes.
 * Existe para encontrar bloqueios de apresentação, falhas visuais e de acessibilidade.
 * Consumidor: relatório de QA de 15/10/2026; não é uma suíte com respostas simuladas.
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const base = 'http://localhost:8086';
const dir = __dirname;
const results = fs.existsSync(path.join(dir,'browser-survey.json')) ? JSON.parse(fs.readFileSync(path.join(dir,'browser-survey.json'),'utf8')) : { startedAt: new Date().toISOString(), pages: [], checks: [], errors: [] };
const accounts = [
  { role:'ADMIN', email:'admin@vulnera.local', password:'admin12345' },
  { role:'OWNER', email:'owner@technova.demo', password:'demo12345' },
  { role:'PENTESTER', email:'bruno.pentester@vulnera.local', password:'senha12345' },
  { role:'MEMBER', email:'fernanda@technova.demo', password:'demo12345' },
];
function save() { fs.writeFileSync(path.join(dir,'browser-survey.json'), JSON.stringify(results,null,2)); }
function check(name, ok, detail) { results.checks.push({name,ok:!!ok,detail}); console.log(JSON.stringify({name,ok:!!ok,detail})); save(); }
async function scan(page, role, route, width) {
  if(results.pages.some(p=>p.role===role&&p.route===route&&p.width===width))return;
  const slug = `${role}-${width}-${route.replace(/[^a-z0-9]/gi,'_') || 'home'}`;
  const errors=[];
  const listener = e=> errors.push(e.message);
  page.on('pageerror',listener);
  const status=[];
  const responseListener=r=>{if(r.status()>=400)status.push({status:r.status(),url:r.url().replace(base,'')});};
  page.on('response',responseListener);
  try {
    await page.setViewportSize({width,height:900});
    await page.goto(`${base}${route}`,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(2200);
    await page.screenshot({path:path.join(dir,`${slug}.png`),fullPage:true,animations:'disabled'});
    const dom=await page.evaluate(()=>({
      title:document.title,url:location.pathname+location.search,
      viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      headings:[...document.querySelectorAll('h1,h2')].map(x=>x.textContent.trim()),
      text:document.body.innerText.slice(0,7000),
      overflow:[...document.querySelectorAll('body *')].filter(x=>{const b=x.getBoundingClientRect();return b.width>0&&(b.right>innerWidth+2||b.left < -2)&&getComputedStyle(x).position!=='fixed'&&getComputedStyle(x).visibility!=='hidden';}).slice(0,12).map(x=>({tag:x.tagName,class:x.className?.toString().slice(0,130),text:x.textContent?.slice(0,100),box:{x:x.getBoundingClientRect().x,width:x.getBoundingClientRect().width}})),
      buttons:[...document.querySelectorAll('button')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({text:x.textContent.trim(),label:x.getAttribute('aria-label'),disabled:x.disabled})),
      links:[...document.querySelectorAll('a[href]')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({text:x.textContent.trim(),href:x.getAttribute('href')}))
    }));
    let accessibility=[];
    try {
      await page.evaluate(fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8'));
      const axe=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
      accessibility=axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.slice(0,6).map(n=>({target:n.target,html:n.html.slice(0,350),summary:n.failureSummary}))}));
    } catch(e){accessibility=[{error:e.message}];}
    const rec={role,route,width,dom,errors,status,accessibility,screenshot:`${slug}.png`};
    results.pages.push(rec);save();
    console.log(JSON.stringify({role,route,width,actual:dom.url,overflow:dom.scrollWidth>width,errors:errors.length,httpErrors:status,a11y:accessibility.map(x=>x.id||'axe-error')}));
  } catch(e){results.errors.push({role,route,width,error:e.message});save();console.log(JSON.stringify({role,route,width,error:e.message}));}
  finally {page.off('pageerror',listener);page.off('response',responseListener);}
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const publicContext=await browser.newContext({locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
  const publicPage=await publicContext.newPage();
  for(const route of ['/','/login','/register','/plans'])for(const width of [1440,375,320])await scan(publicPage,'PUBLIC',route,width);
  await publicPage.goto(`${base}/projects`);
  await publicPage.waitForURL('**/login');check('rota privada sem sessão encaminha ao login',true);
  await publicPage.getByRole('button',{name:'Entrar na plataforma',exact:true}).click();
  check('login vazio impedido por validação nativa',await publicPage.locator('input:invalid').count()>0);
  await publicPage.getByLabel('E-mail').fill('qa-nao-existe@example.test');
  await publicPage.locator('input[name="password"]').fill('senha-invalida');
  await publicPage.getByRole('button',{name:'Entrar na plataforma',exact:true}).click();
  await publicPage.getByRole('alert').waitFor();
  check('login incorreto exibe feedback',await publicPage.getByRole('alert').innerText());
  await publicContext.close();
  for(const account of accounts){
   const context=await browser.newContext({locale:'pt-BR',timezoneId:'America/Sao_Paulo',reducedMotion:'reduce'});
   const page=await context.newPage();page.setDefaultTimeout(10000);
   await page.goto(`${base}/login`);
   await page.getByLabel('E-mail').fill(account.email);await page.locator('input[name="password"]').fill(account.password);
   const loginResponse=page.waitForResponse(r=>r.url().endsWith('/auth/login')&&r.request().method()==='POST');
   await page.getByRole('button',{name:'Entrar na plataforma',exact:true}).click();
   const response=await loginResponse;
   check(`login UI ${account.role}`,response.status()===200,`HTTP ${response.status()}`);
   if(response.status()!==200){await context.close();continue;}
   await page.waitForURL(/\/(dashboard|onboarding)/);
   const auth=await response.json();
   const headers={Authorization:`Bearer ${auth.accessToken}`};
   const get=async route=>{const r=await context.request.get(`http://localhost:3001/api${route}`,{headers});return r.ok()?r.json():null;};
   const projects=await get('/projects');const applications=['ADMIN','OWNER','MEMBER'].includes(account.role)?await get('/applications'):null;
   let routes=['/dashboard','/projects','/playbooks'];
   if(['ADMIN','OWNER','MEMBER'].includes(account.role))routes.push('/applications','/settings/sla');
   if(['ADMIN','PENTESTER'].includes(account.role))routes.push('/findings','/remediation','/dast');
   if(account.role==='ADMIN')routes.push('/admin/subscriptions');
   const projectList=Array.isArray(projects)?projects:projects?.data||[];
   const appList=Array.isArray(applications)?applications:applications?.data||[];
   if(projectList[0])routes.push(`/projects/${projectList[0].id}`);
   if(appList[0])routes.push(`/applications/${appList[0].id}/dashboard`);
   if(auth.user.companyId)routes.push(`/companies/${auth.user.companyId}/maturity`);
   for(const route of routes)for(const width of [1440,375])await scan(page,account.role,route,width);
   if(['OWNER','MEMBER'].includes(account.role))for(const route of ['/dast','/findings','/admin/subscriptions']){
    await page.goto(`${base}${route}`);await page.waitForTimeout(600);
    check(`${account.role} rota restrita ${route}`,!(await page.getByRole('heading',{name:'Findings',exact:true}).count())&&(await page.locator('body').innerText()).includes('403'),(await page.locator('body').innerText()).slice(-600));
   }
   await page.goto(`${base}/dashboard`);await page.reload();await page.waitForTimeout(1200);
   check(`sessão sobrevive recarga ${account.role}`,new URL(page.url()).pathname==='/dashboard');
   const logout=page.getByRole('button',{name:/sair/i});
   if(await logout.count()){await logout.click();await page.waitForURL('**/login');check(`logout UI ${account.role}`,true);}
   await context.close();
  }
 } finally {results.finishedAt=new Date().toISOString();save();await browser.close();}
})().catch(e=>{results.errors.push({fatal:e.stack});save();console.error(e);process.exitCode=1;});
