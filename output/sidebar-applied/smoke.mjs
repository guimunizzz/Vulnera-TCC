/**
 * Confere a barra lateral real após a aplicação da prévia aprovada.
 * Usa dados isolados no navegador para validar papéis, navegação e acessibilidade
 * sem tocar na API real. Consumidores: Rafael e a revisão visual do frontend.
 */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const out = path.dirname(fileURLToPath(import.meta.url));
const origin = 'http://127.0.0.1:5173';
const date = '2026-10-16T12:00:00.000Z';
const company = { id:'preview-company',name:'TechNova Solutions',planId:'plan-1',cnpj:null,createdAt:date,updatedAt:date };
const application = { id:'app-1',name:'Portal do Cliente',url:'https://portal.technova.demo',companyId:company.id,criticality:'HIGH',environment:'PROD',internetFacing:true,dataSensitivity:'CONFIDENTIAL',isActive:true,createdAt:date,updatedAt:date };
const project = { id:'project-1',name:'Pentest Web — Portal do Cliente',applicationId:application.id,companyId:company.id,status:'IN_REVIEW',requestedAt:date,hasRemediation:true,analysisType:'DAST',analysisLevel:'INTERMEDIATE',startedAt:null,closedAt:null,scopeIn:null,scopeOut:null,notes:null,updatedAt:date };
const query = { id:'saved-1',name:'Críticos em produção — revisão prioritária da equipe',description:'Busca de demonstração',queryString:'severity=CRITICAL&status=OPEN',scope:'COMPANY',companyId:company.id,ownerId:'preview-admin',pinned:true,isOwner:true,filtros:[],createdAt:date,updatedAt:date };
const facets = { severity:{CRITICAL:3,HIGH:8},status:{OPEN:11},company:{[company.id]:11},owasp:{} };
const expected = {
  ADMIN: ['/dashboard','/applications','/projects','/findings','/remediation','/dast','/playbooks','/settings/sla','/admin/subscriptions'],
  CLIENT: ['/dashboard','/applications','/projects','/playbooks','/settings/sla'],
  PENTESTER: ['/dashboard','/projects','/findings','/remediation','/dast','/playbooks'],
};
const checks = [];
const errors = [];
const contrasts = [];
await mkdir(out,{recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});

async function createPage(role='ADMIN', theme='dark', viewport={width:1440,height:1000}, pinned=false) {
  const ctx = await browser.newContext({viewport,deviceScaleFactor:1,colorScheme:theme,reducedMotion:'reduce'});
  const page = await ctx.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  const user = { id:`preview-${role.toLowerCase()}`,name:role==='ADMIN'?'Vulnera Admin':`Pessoa ${role}`,email:'preview@vulnera.demo',role,companyId:role==='CLIENT'?company.id:null,createdAt:date };
  await page.addInitScript(({user,theme})=>{
    localStorage.setItem('vulnera-auth',JSON.stringify({state:{user,accessToken:'isolated-preview',refreshToken:'isolated-preview'},version:0}));
    localStorage.setItem('vulnera:theme',theme);
  },{user,theme});
  await page.route('**/*',async route=>{
    const req=route.request();const url=new URL(req.url());
    if(!['xhr','fetch'].includes(req.resourceType())||url.pathname.startsWith('/src/')||url.pathname.startsWith('/node_modules/'))return route.continue();
    const pathname=url.pathname.replace(/^\/api/,'');
    let body=[];
    if(pathname==='/applications')body=[application];
    else if(pathname==='/applications/app-1')body=application;
    else if(pathname==='/projects')body=[project];
    else if(pathname==='/projects/project-1')body=project;
    else if(pathname==='/companies')body=[company];
    else if(pathname==='/companies/me')body=company;
    else if(pathname==='/saved-queries')body=pinned?[query]:[];
    else if(pathname==='/subscriptions/active')body=[{id:'sub-1',companyId:company.id,status:'ACTIVE'}];
    else if(pathname==='/subscriptions/current')body={id:'sub-1',companyId:company.id,planId:'plan-1',status:'ACTIVE'};
    else if(pathname==='/plans')body=[{id:'plan-1',name:'Essencial',maxApplications:10}];
    else if(pathname==='/vulnerabilities')body={data:[],pagination:{page:1,pageSize:5,total:url.searchParams.has('severity')?3:11,totalPages:1},facets};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body),headers:{'access-control-allow-origin':'*'}});
  });
  await page.goto(`${origin}/dashboard`,{waitUntil:'networkidle'});
  await page.getByRole('heading',{level:1}).waitFor();
  await page.evaluate(()=>document.fonts.ready);
  return {page,ctx};
}

async function checkContrast(page,theme) {
  const result=await page.locator('.app-sidebar').first().evaluate(nav=>{
    const ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
    const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);};
    const lum=color=>rgb(color).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const ratio=(fg,bg)=>{const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
    const active=nav.querySelector('[aria-current="page"]');
    const normal=nav.querySelector('a:not([aria-current])');
    const caption=nav.querySelector('h2');
    const bg=getComputedStyle(nav).backgroundColor;
    return {active:ratio(getComputedStyle(active).color,getComputedStyle(active).backgroundColor),normal:ratio(getComputedStyle(normal).color,bg),caption:ratio(getComputedStyle(caption).color,bg)};
  });
  Object.entries(result).forEach(([key,value])=>assert.ok(value>=4.5,`${theme}/${key}: contraste ${value}`));
  contrasts.push({theme,...result});
}

try {
  for(const role of ['ADMIN','CLIENT','PENTESTER']) {
    const {page,ctx}=await createPage(role);
    const nav=page.getByRole('navigation',{name:'Navegação principal'});
    assert.deepEqual(await nav.getByRole('link').evaluateAll(links=>links.map(a=>a.getAttribute('href'))),expected[role]);
    assert.equal(await nav.getByRole('heading',{name:'Administração',exact:true}).count(),role==='PENTESTER'?0:1);
    assert.equal(await nav.getByRole('img',{name:'Vulnera Security'}).count(),1);
    const targets=await nav.getByRole('link').evaluateAll(links=>links.map(a=>a.getBoundingClientRect().height));
    assert.ok(targets.every(height=>height>=44));
    if(role==='ADMIN') {
      assert.equal((await nav.boundingBox()).width,216);
      await checkContrast(page,'dark');
      await page.screenshot({path:path.join(out,'desktop-dark.png')});
      await nav.screenshot({path:path.join(out,'sidebar-dark.png')});
      await nav.getByRole('link',{name:'Projetos',exact:true}).click();
      await page.getByRole('heading',{name:'Projetos',exact:true}).waitFor();
      assert.equal(await nav.getByRole('link',{name:/^Projetos/}).getAttribute('aria-current'),'page');
      await page.goto(`${origin}/projects/project-1`,{waitUntil:'networkidle'});
      await page.getByRole('heading',{level:1,name:project.name}).waitFor();
      assert.equal(await nav.getByRole('link',{name:/^Projetos/}).getAttribute('aria-current'),'page');
      checks.push('Item ativo acompanha clique e detalhe aninhado');
      await nav.getByRole('link',{name:'Aplicações',exact:true}).focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').getAttribute('href'),'/projects');
      assert.equal(await page.locator(':focus').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
      checks.push('Ordem de teclado e foco visível');
    }
    checks.push(`Links e grupos preservados para ${role}; alvos de 44px`);
    await ctx.close();
  }
  {
    const {page,ctx}=await createPage('ADMIN','light');
    await checkContrast(page,'light');
    await page.screenshot({path:path.join(out,'desktop-light.png')});
    await page.getByRole('navigation',{name:'Navegação principal'}).screenshot({path:path.join(out,'sidebar-light.png')});
    checks.push('Temas claro/escuro com contraste de texto ≥4,5:1');
    await ctx.close();
  }
  {
    const {page,ctx}=await createPage('ADMIN','dark',{width:1440,height:500},true);
    const scroll=page.locator('.app-sidebar-scroll').first();
    assert.ok(await scroll.evaluate(el=>el.scrollHeight>el.clientHeight));
    const watchlist=page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:/Críticos em produção/});
    await watchlist.scrollIntoViewIfNeeded();
    const bounds=await watchlist.boundingBox();
    assert.ok(bounds.y>=0&&bounds.y+bounds.height<=500);
    assert.ok((await watchlist.getAttribute('href')).includes(query.queryString));
    await page.getByRole('navigation',{name:'Navegação principal'}).screenshot({path:path.join(out,'sidebar-short-watchlist.png')});
    checks.push('Watchlist longa alcançável com rolagem em altura de 500px');
    await ctx.close();
  }
  for(const width of [320,390]) {
    const {page,ctx}=await createPage('ADMIN','dark',{width,height:568},true);
    const open=page.getByRole('button',{name:'Abrir navegação',exact:true});
    await open.click();
    const dialog=page.getByRole('dialog',{name:'Navegação',exact:true});
    await dialog.waitFor();
    await page.waitForFunction(()=>{
      const panel=document.querySelector('[role="dialog"]');
      return panel&&getComputedStyle(panel).opacity==='1';
    });
    const nav=dialog.getByRole('navigation',{name:'Navegação principal'});
    assert.equal(await nav.getByRole('heading',{name:'Operação',exact:true}).count(),1);
    assert.equal(await nav.getByRole('link').count(),10);
    const bounds=await nav.boundingBox();
    assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
    await page.screenshot({path:path.join(out,`mobile-${width}.png`)});
    await nav.getByRole('link',{name:'Projetos',exact:true}).click();
    await page.getByRole('heading',{name:'Projetos',exact:true}).waitFor();
    await dialog.waitFor({state:'hidden'});
    assert.equal(await open.getAttribute('aria-expanded'),'false');
    await open.click();
    await dialog.waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    checks.push(`Drawer ${width}px: sem overflow, navega, fecha no clique e Escape`);
    await ctx.close();
  }
  assert.deepEqual(errors,[]);
  checks.push('Zero erros de página');
  const report=`<!-- Evidências da validação da barra lateral; consumidas por Rafael e revisores. -->\n# Barra lateral aplicada — 2026-10-16\n\n${checks.map(c=>`- ✅ ${c}`).join('\n')}\n\n## Contraste medido no navegador\n\n${contrasts.map(c=>`- ${c.theme}: ativo ${c.active.toFixed(2)}:1; normal ${c.normal.toFixed(2)}:1; legenda ${c.caption.toFixed(2)}:1.`).join('\n')}\n\nDados sintéticos interceptados somente no navegador. Nenhuma chamada à API real ou gravação no banco. Mudanças de produto restritas a sidebar.tsx/sidebar.css.\n`;
  await writeFile(path.join(out,'report.md'),report,'utf8');
  process.stdout.write(`${checks.length}/${checks.length} verificações aprovadas. Contrastes: ${JSON.stringify(contrasts)}\n`);
} finally {await browser.close();}
