// Executa QA HTTP da stack local sem tocar registros de demonstração.
// Existe para registrar fluxos e falhas reproduzíveis; consumido pelo relatório da apresentação.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const base = 'http://localhost:3001/api';
const out = path.dirname(__filename);
const marker = `QA-20261015-${Date.now().toString(36)}`;
const results = [];
const resources = {marker, accounts:[]};
const tokens = {};
const lastScopes = {};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function save() {fs.writeFileSync(path.join(out,'api-flows-results.json'),JSON.stringify({marker,base,resources,results},null,2));}
function check(id, pass, detail) {results.push({id,type:'assertion',pass,detail});save();}
async function req(id, method, endpoint, actor, body, expected=200, scope) {
  const pace = scope === 'report' ? 20500 : scope === 'expensive' ? 6300 : 1350;
  const key = `${actor || 'anon'}:${scope || 'normal'}`;
  await wait(Math.max(0,pace-(Date.now()-(lastScopes[key]||0))));
  const started=Date.now();
  const headers = {'Content-Type':'application/json'};
  if (actor) headers.Authorization=`Bearer ${tokens[actor] || actor}`;
  let response = await fetch(base+endpoint,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});
  let retries=0;
  while(response.status===429 && retries++<3) {const seconds=Number(response.headers.get('retry-after'))||6;await wait((seconds+1)*1000);response=await fetch(base+endpoint,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});}
  const raw = await response.text();
  let data;try {data=JSON.parse(raw);}catch {data=raw;}
  lastScopes[key]=Date.now();
  const pass=(Array.isArray(expected)?expected:[expected]).includes(response.status);
  results.push({id,method,endpoint,actor:actor?actor in tokens?actor:'invalid-token':'anonymous',status:response.status,expected,pass,durationMs:Date.now()-started,retries,...(response.status>=400?{response:data}:{}),...(response.status>=500?{request:body}:{}),contentType:response.headers.get('content-type')});
  save();
  console.log(`${pass?'PASS':'FAIL'} ${id} ${response.status} ${endpoint}`);
  return data;
}
async function main() {
  const seed=fs.readFileSync('app/api/prisma/seed.ts','utf8');
  const hashes=[...seed.matchAll(/(?:const\s+)(\w+)\s*=\s*await bcrypt\.hash\("([^"]+)"/g)];
  const secrets=Object.fromEntries(hashes.map(m=>[m[1],m[2]]));
  const creds={admin:['admin@vulnera.local',secrets.adminHash],pentester:['bruno.pentester@vulnera.local',secrets.senhaDemo],pentester2:['camila.pentester@vulnera.local',secrets.senhaDemo],demoOwner:['owner@technova.demo',secrets.ownerHash],demoMember:['fernanda@technova.demo',secrets.clientMemberHash]};
  await req('health','GET','/health',null,undefined,200);
  const plans=await req('plans-public','GET','/plans',null,undefined,200);
  resources.plan=plans.filter(p=>p.isActive).sort((a,b)=>b.maxApplications-a.maxApplications)[0];
  for(const [actor,[email,password]] of Object.entries(creds)) {
    const data=await req(`login-${actor}`,'POST','/auth/login',null,{email,password},200);
    if(!data.accessToken) throw new Error(`Missing token for ${actor}`);
    tokens[actor]=data.accessToken;resources[actor]={id:data.user.id,role:data.user.role,companyId:data.user.companyId};
    check(`no-password-${actor}`,!('password' in data.user)&&!('passwordHash' in data.user),'Auth user projection omits password/hash');
  }
  for (const actor of ['tenantA','tenantB']) {
    const email=`${marker.toLowerCase()}-${actor.toLowerCase()}@qa.invalid`;
    const data=await req(`register-${actor}`,'POST','/auth/register',null,{name:`${marker} ${actor}`,email,password:crypto.randomBytes(24).toString('base64url'),role:'ADMIN'},201);
    tokens[actor]=data.accessToken;
    resources.accounts.push({id:data.user.id,email,role:data.user.role});
    check(`register-role-${actor}`,data.user.role==='CLIENT','Role sent in registration does not elevate privileges');
    resources[actor]={userId:data.user.id};
    const company=await req(`company-create-${actor}`,'POST','/companies',actor,{name:`${marker} ${actor}`,planId:resources.plan.id},201);
    resources[actor].companyId=company.id;
    const sub=await req(`subscription-request-${actor}`,'POST','/subscriptions',actor,{planId:resources.plan.id},201);
    resources[actor].subscriptionId=sub.id;
    await req(`subscription-approve-${actor}`,'POST',`/subscriptions/${sub.id}/approve`,'admin',{},200);
    const app=await req(`application-create-${actor}`,'POST','/applications',actor,{name:`${marker} App ${actor}`,url:'http://localhost:8086/',environment:'HOMOL',criticality:'MEDIUM',dataSensitivity:'INTERNAL',internetFacing:false,description:`${marker} Dados descartáveis de QA`,companyId:resources.demoOwner.companyId},201);
    resources[actor].applicationId=app.id;
    check(`tenant-injection-${actor}`,app.companyId===company.id,'Client-supplied companyId does not select demo tenant');
    const project=await req(`project-create-${actor}`,'POST','/projects',actor,{name:`${marker} Projeto ${actor}`,applicationId:app.id,analysisType:'COMBO',analysisLevel:'BASIC',hasRemediation:true},201);
    resources[actor].projectId=project.id;
    check(`project-inheritance-${actor}`,project.companyId===company.id&&project.applicationId===app.id,'Project inherits tenant/application');
    if(!project.id)throw new Error('Cannot continue without QA project');
  }
  await req('assign-pentester','POST',`/projects/${resources.tenantA.projectId}/members`,'admin',{userId:resources.pentester.id},201);
  const members=await req('assigned-member-name','GET',`/projects/${resources.tenantA.projectId}/members`,'tenantA',undefined,200);
  check('member-name-present',members.every(m=>typeof m.userName==='string'&&m.userName.length>0),'Assigned pentester has human-readable userName');
  const vulnBody={projectId:resources.tenantA.projectId,title:`${marker} Finding de QA`,description:`${marker} Validação funcional sem exploração real`,owaspCategory:'A03',cvssVector:'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N',impact:'Impacto simulado de QA',recommendation:'Recomendação simulada de QA'};
  const vuln=await req('vulnerability-create','POST','/vulnerabilities','pentester',vulnBody,201);
  resources.tenantA.vulnerabilityId=vuln.id;
  check('cvss-derived',vuln.cvssScore===5.4&&vuln.severityFinal==='MEDIUM',`Derived CVSS ${vuln.cvssScore}/${vuln.severityFinal}`);
  if(!vuln.id)throw new Error('No QA vulnerability');
  save();console.log('RESOURCES_READY '+JSON.stringify(resources));
  const id=vuln.id, proj=resources.tenantA.projectId, app=resources.tenantA.applicationId, company=resources.tenantA.companyId;
  await req('unauthenticated-user','GET','/users/me',null,undefined,401);
  await req('invalid-bearer','GET','/users/me','bogus',undefined,401);
  await req('anonymous-project','GET',`/projects/${proj}`,null,undefined,401);
  await req('tenant-isolation-application','GET',`/applications/${app}`,'tenantB',undefined,403);
  await req('tenant-isolation-project','GET',`/projects/${proj}`,'tenantB',undefined,403);
  await req('tenant-isolation-vulnerability','GET',`/vulnerabilities/${id}`,'tenantB',undefined,403);
  await req('tenant-isolation-comments','GET',`/vulnerabilities/${id}/comments`,'tenantB',undefined,403);
  await req('tenant-isolation-evidence','GET',`/vulnerabilities/${id}/evidences`,'tenantB',undefined,403);
  await req('tenant-isolation-project-members','GET',`/projects/${proj}/members`,'tenantB',undefined,403);
  await req('tenant-isolation-report','GET',`/projects/${proj}/report-data`,'tenantB',undefined,403,'report');
  await req('tenant-isolation-sla','GET',`/companies/${company}/sla-policy`,'tenantB',undefined,403);
  await req('tenant-isolation-maturity','GET',`/maturity/assessments/${company}/latest`,'tenantB',undefined,403);
  const appsB=await req('tenant-list-applications','GET','/applications','tenantB',undefined,200);
  check('tenant-list-no-leak',appsB.every(a=>a.companyId===resources.tenantB.companyId),'All listed applications belong to caller tenant');
  const vulnsB=await req('tenant-list-vulnerabilities','GET','/vulnerabilities','tenantB',undefined,200,'expensive');
  check('tenant-findings-empty',vulnsB.data?.length===0,'Fresh tenant B must see no findings from A/demo');
  await req('client-company-list-denied','GET','/companies','tenantA',undefined,403);
  const tenantUsers=await req('client-users-scoped-list','GET','/users','tenantA',undefined,200);
  check('client-users-scope',tenantUsers.every(u=>u.companyId===company),'CLIENT sees users from own tenant');
  await req('client-other-user-denied','GET',`/users/${resources.pentester.id}`,'tenantA',undefined,403);
  await req('client-dast-denied','GET','/dast/scans','tenantA',undefined,403);
  await req('client-subscriptions-list-denied','GET','/subscriptions/pending','tenantA',undefined,403);
  await req('client-playbook-create-denied','POST','/playbooks','tenantA',{title:`${marker} unauthorized`},403);
  await req('pentester-application-list-denied','GET','/applications','pentester',undefined,403);
  await req('pentester-unassigned-project-denied','GET',`/projects/${resources.tenantB.projectId}`,'pentester',undefined,403);
  await req('pentester-assigned-project','GET',`/projects/${proj}`,'pentester',undefined,200);
  await req('pentester-assigned-vulnerability','GET',`/vulnerabilities/${id}`,'pentester',undefined,200);
  await req('pentester2-unassigned-vulnerability','GET',`/vulnerabilities/${id}`,'pentester2',undefined,403);
  await req('tenant-cross-write-app','PUT',`/applications/${app}`,'tenantB',{name:`${marker} Forbidden cross-tenant`},403);
  await req('tenant-cross-write-project','PUT',`/projects/${proj}`,'tenantB',{name:`${marker} Forbidden cross-tenant`},403);
  await req('tenant-cross-write-vulnerability','PUT',`/vulnerabilities/${id}`,'tenantB',{title:`${marker} Forbidden cross-tenant`},403);
  await req('client-create-vuln-denied','POST','/vulnerabilities','tenantA',vulnBody,403);
  await req('duplicate-project-denied','POST','/projects','tenantA',{applicationId:app,name:`${marker} Duplicate`},409);
  await req('duplicate-assignment-denied','POST',`/projects/${proj}/members`,'admin',{userId:resources.pentester.id},409);
  await req('client-risk-increase','PUT',`/applications/${app}`,'tenantA',{environment:'PROD',criticality:'HIGH',internetFacing:true,dataSensitivity:'CONFIDENTIAL',businessOwner:`${marker} Negócio`,technicalOwner:`${marker} Técnico`},200);
  await req('client-risk-reduction-denied','PUT',`/applications/${app}`,'tenantA',{criticality:'LOW'},403);
  await req('client-risk-invalid-enum','PUT',`/applications/${app}`,'tenantA',{environment:'WHATEVER'},400);
  await req('app-blank-name-validation','PUT',`/applications/${app}`,'tenantA',{name:'   '},400);
  await req('app-restore-name','PUT',`/applications/${app}`,'tenantA',{name:`${marker} App tenantA`},200);
  await req('app-description-type','PUT',`/applications/${app}`,'tenantA',{description:{test:true}},400);
  await req('app-url-invalid','PUT',`/applications/${app}`,'tenantA',{url:'javascript:alert(1)'},400);
  await req('project-blank-name-validation','PUT',`/projects/${proj}`,'admin',{name:'   '},400);
  await req('project-description-type','PUT',`/projects/${proj}`,'admin',{description:{test:true}},400);
  await req('login-type-email','POST','/auth/login',null,{email:{bad:true},password:'qa-not-a-password'},400);
  await req('login-type-password','POST','/auth/login',null,{email:'qa-invalid@qa.invalid',password:{bad:true}},[400,401]);
  await req('login-missing','POST','/auth/login',null,{},400);
  await req('refresh-invalid','POST','/auth/refresh',null,{refreshToken:'qa-invalid'},401);
  await req('user-update-invalid-email','PATCH',`/users/${resources.tenantA.userId}`,'tenantA',{email:'not-an-email'},400);
  await req('user-restore-email','PATCH',`/users/${resources.tenantA.userId}`,'tenantA',{email:resources.accounts[0].email},200);
  await req('user-update-empty-name','PATCH',`/users/${resources.tenantA.userId}`,'tenantA',{name:''},400);
  await req('user-restore-name','PATCH',`/users/${resources.tenantA.userId}`,'tenantA',{name:`${marker} tenantA`},200);
  for(const [label,q]of Object.entries({badSeverity:'severity=INVALID',badStatus:'status=INVALID',badVrs:'vrsMin=90&vrsMax=20',decimalPage:'page=1.5',decimalSize:'pageSize=1.5',infinitePage:'page=Infinity'})) {
    await req(`finding-filter-${label}`,'GET',`/vulnerabilities?${q}`,'tenantA',undefined,400,'expensive');
  }
  const filtered=await req('finding-search-marker','GET',`/vulnerabilities?search=${marker}&severity=MEDIUM&status=OPEN`,'tenantA',undefined,200,'expensive');
  check('finding-search-result',filtered.data?.length===1&&filtered.data[0].id===id,'Combined filters return own marker finding');
  await req('finding-client-comment','POST',`/vulnerabilities/${id}/comments`,'tenantA',{content:`${marker} Comentário do cliente para a apresentação`},201);
  await req('finding-empty-comment','POST',`/vulnerabilities/${id}/comments`,'tenantA',{content:'   '},400);
  await req('finding-comment-pagination','GET',`/vulnerabilities/${id}/comments?page=1.5`,'tenantA',undefined,400);
  await req('finding-transition-invalid','POST',`/vulnerabilities/${id}/transition`,'pentester',{toStatus:'CLOSED'},400);
  await req('finding-transition-progress','POST',`/vulnerabilities/${id}/transition`,'pentester',{toStatus:'IN_PROGRESS'},200);
  await req('finding-transition-fixed','POST',`/vulnerabilities/${id}/transition`,'pentester',{toStatus:'FIXED'},200);
  await req('finding-transition-closed','POST',`/vulnerabilities/${id}/transition`,'pentester',{toStatus:'CLOSED'},200);
  await req('finding-audit-log','GET',`/vulnerabilities/${id}/audit-log`,'tenantA',undefined,200);
  await req('finding-report-data-early-denied','GET',`/projects/${proj}/report-data`,'tenantA',undefined,422,'report');
  await req('finding-report-list','GET',`/reports?projectId=${proj}`,'tenantA',undefined,200,'report');
  await req('maturity-catalog','GET','/maturity/catalog','tenantA',undefined,200);
  await req('playbooks-catalog','GET','/playbooks','tenantA',undefined,200);
  await req('playbooks-category','GET',`/playbooks/for-category/A03?companyId=${company}`,'tenantA',undefined,200);
  await req('dast-status','GET','/dast/scans/status','pentester',undefined,200);
  await req('dast-list','GET','/dast/scans','pentester',undefined,200);
  const saved=await req('saved-query-create','POST','/saved-queries','tenantA',{name:`${marker} Médias abertas`,queryString:'status=OPEN&severity=MEDIUM',scope:'COMPANY'},201);
  resources.tenantA.savedQueryId=saved.id;
  await req('saved-query-list','GET','/saved-queries','tenantA',undefined,200);
  if(saved.id)await req('saved-query-cross-tenant-denied','GET',`/saved-queries/${saved.id}`,'tenantB',undefined,404);
  await req('saved-query-invalid','POST','/saved-queries','tenantA',{name:`${marker} Inválida`,queryString:'secret=anything',scope:'PRIVATE'},400);
  save();
}
main().then(()=>{save();console.log(JSON.stringify({finished:true,cases:results.length,failed:results.filter(r=>!r.pass).map(r=>r.id),resources},null,2));}).catch(e=>{save();console.error('QA_ABORTED',e.message);process.exitCode=1;});
