// Exercita fluxos adicionais da API em recursos QA e sessões próprias.
// Existe para aprofundar maturidade, SLA e aceite sem editar a demonstração; consumido pelo relatório.
const fs=require('fs'),path=require('path');
const out=path.dirname(__filename),mode=process.argv[2]||'nonadmin';
const mainEvidence=JSON.parse(fs.readFileSync(path.join(out,mode==='admin'?'api-flows-extra-nonadmin.json':'api-flows-results.json'),'utf8'));
const resources=mainEvidence.resources, marker=mainEvidence.marker, results=[],tokens={}, last={};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const save=()=>fs.writeFileSync(path.join(out,`api-flows-extra-${mode}.json`),JSON.stringify({marker,mode,resources,results},null,2));
function check(id,pass,detail){results.push({id,type:'assertion',pass,detail});save();console.log(`${pass?'PASS':'FAIL'} ${id}`);}
async function req(id,method,url,actor,body,expected=200,scope){
  const key=`${actor}:${scope||'normal'}`,gap=scope==='expensive'?6500:scope==='report'?21000:1600;
  await sleep(Math.max(0,gap-(Date.now()-(last[key]||0))));
  const headers={'Content-Type':'application/json'};
  if(actor)headers.Authorization=`Bearer ${tokens[actor]}`;
  const init={method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})};
  let r=await fetch('http://localhost:3001/api'+url,init),retries=0;
  while(r.status===429&&retries++<3){await sleep((Number(r.headers.get('retry-after'))+1||7)*1000);r=await fetch('http://localhost:3001/api'+url,init);}
  const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data=raw}
  last[key]=Date.now();const pass=(Array.isArray(expected)?expected:[expected]).includes(r.status);
  results.push({id,method,url,actor:actor||'anonymous',status:r.status,expected,pass,retries,...(r.status>=400?{response:data}:{}),...(r.status>=500&&!url.includes('/auth/')?{request:body}:{})});
  save();console.log(`${pass?'PASS':'FAIL'} ${id} ${r.status}`);return data;
}
async function login(actor,email,key){
 const seed=fs.readFileSync('app/api/prisma/seed.ts','utf8');
 const passwords=Object.fromEntries([...seed.matchAll(/const\s+(\w+)\s*=\s*await bcrypt\.hash\("([^"]+)"/g)].map(m=>[m[1],m[2]]));
 const d=await req(`login-${actor}`,'POST','/auth/login',null,{email,password:passwords[key]},200);
 tokens[actor]=d.accessToken;return d;
}
async function nonadmin(){
 const auth=await login('pentester','bruno.pentester@vulnera.local','senhaDemo');
 const owner=await login('demoOwner','owner@technova.demo','ownerHash');
 await login('demoMember','fernanda@technova.demo','clientMemberHash');
 const rotated=await req('refresh-rotation','POST','/auth/refresh',null,{refreshToken:auth.refreshToken},200);
 check('refresh-token-changed',rotated.refreshToken!==auth.refreshToken,'Refresh returns a different token');tokens.pentester=rotated.accessToken;
 await req('refresh-old-rejected','POST','/auth/refresh',null,{refreshToken:auth.refreshToken},401);
 await req('logout-own-new-session','POST','/auth/logout',null,{refreshToken:rotated.refreshToken},204);
 await req('refresh-logout-rejected','POST','/auth/refresh',null,{refreshToken:rotated.refreshToken},401);
 await req('logout-idempotent','POST','/auth/logout',null,{refreshToken:rotated.refreshToken},204);
 const company=resources.tenantA.companyId,app=resources.tenantA.applicationId,proj=resources.tenantA.projectId;
 const mine=await req('client-users-scoped-list','GET','/users','demoOwner');
 check('client-users-scope',mine.every(u=>u.companyId===resources.demoOwner.companyId),'CLIENT /users returns own tenant only; 200 is intended');
 const findings=await req('client-findings-scope','GET','/vulnerabilities?pageSize=100','demoOwner',undefined,200,'expensive');
 check('client-findings-exclude-qa',findings.data.every(v=>v.companyId===resources.demoOwner.companyId),'Demo tenant list excludes QA tenants; response uses data[]');
 const all=await req('pentester-findings-scope','GET','/vulnerabilities?pageSize=100','pentester',undefined,200,'expensive');
 check('pentester-list-has-qa',all.data.some(v=>v.id===resources.tenantA.vulnerabilityId),'Assigned QA finding appears in pentester list');
 const validBody={projectId:proj,title:`${marker} Aceite e SLA`,description:`${marker} Finding para aceite e SLA, sem exploração real`,owaspCategory:'A05',cvssVector:'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N'};
 const v=await req('create-risk-finding','POST','/vulnerabilities','pentester',validBody,201);resources.tenantA.riskFindingId=v.id;
 check('sla-present',!!v.sla?.dueAt&&v.sla.state==='ON_TRACK',`SLA DTO state ${v.sla?.state}; deadline ${v.sla?.dueAt}`);
 await req('assignee-invalid-tenant','POST',`/vulnerabilities/${v.id}/assign`,'pentester',{assignedTo:resources.demoOwner.id},422);
 const assigned=await req('assignee-qa-owner','POST',`/vulnerabilities/${v.id}/assign`,'pentester',{assignedTo:resources.tenantA.userId},200);
 check('assignee-persisted',assigned.assignedTo===resources.tenantA.userId,'Assignment stays in QA tenant');
 const acceptance=await req('risk-request','POST',`/vulnerabilities/${v.id}/risk-acceptances`,'pentester',{reason:`${marker} razão técnica detalhada para teste`,businessJustification:`${marker} justificativa de negócio para QA isolado`,requestedExpiresAt:new Date(Date.now()+7*864e5).toISOString()},201);
 resources.tenantA.acceptanceId=acceptance.id;
 await req('risk-duplicate-denied','POST',`/vulnerabilities/${v.id}/risk-acceptances`,'pentester',{reason:`${marker} razão técnica detalhada para teste`,businessJustification:`${marker} justificativa de negócio para QA isolado`},409);
 await req('risk-pentester-decision-denied','POST',`/risk-acceptances/${acceptance.id}/approve`,'pentester',{expiresAt:new Date(Date.now()+3*864e5).toISOString()},403);
 await req('risk-foreign-client-denied','GET',`/vulnerabilities/${v.id}/risk-acceptances`,'demoOwner',undefined,403);
 await req('finding-client-evidence-read-denied','GET',`/vulnerabilities/${v.id}/evidences`,'demoOwner',undefined,403);
 await req('playbook-pentester-create-no-company','POST','/playbooks','pentester',{title:`${marker} Novo playbook`,owaspCategory:'A05',summary:'Resumo de teste'},422);
 const books=await req('playbook-catalog','GET','/playbooks','pentester');
 const system=books.find(b=>b.isSystem);resources.systemPlaybookId=system?.id;
 if(system){await req('playbook-pentester-clone-no-company','POST',`/playbooks/${system.id}/clone`,'pentester',{title:`${marker} Clone`},422);await req('playbook-system-edit-denied','PUT',`/playbooks/${system.id}`,'pentester',{title:`${marker} Impossível`},403);}
 await req('playbook-category-with-company','GET',`/playbooks/for-category/A05?companyId=${company}`,'pentester');
 await req('playbook-category-invalid','GET',`/playbooks/for-category/INVALID?companyId=${company}`,'pentester',undefined,400);
 await req('saved-pentester-company-denied','POST','/saved-queries','pentester',{name:`${marker} Compartilhada`,queryString:'severity=HIGH',scope:'COMPANY'},403);
 const saved=await req('saved-pentester-private','POST','/saved-queries','pentester',{name:`${marker} Privada`,queryString:`status=OPEN&projectId=${proj}`,scope:'PRIVATE',pinned:true},201);
 resources.pentester.savedQueryId=saved.id;
 await req('saved-duplicate-canonical-denied','POST','/saved-queries','pentester',{name:`${marker} Duplicada`,queryString:`projectId=${proj}&status=OPEN`,scope:'PRIVATE'},409);
 if(saved.id){await req('saved-rename','PUT',`/saved-queries/${saved.id}`,'pentester',{name:`${marker} Abertas do QA`,pinned:false},200);await req('saved-foreign-read-hidden','GET',`/saved-queries/${saved.id}`,'demoOwner',undefined,404);}
 await req('metrics-summary','GET',`/applications/${resources.demoOwner.companyId==='never'?'none':(await req('demo-applications','GET','/applications','demoOwner'))[0].id}/metrics/summary`,'demoOwner',undefined,200,'expensive');
 await req('maturity-pentester-qa-empty','GET',`/maturity/assessments/${company}/latest`,'pentester',undefined,404);
 await req('sla-pentester-denied','GET',`/companies/${company}/sla-policy`,'pentester',undefined,403);
 await req('member-sla-update-denied','PUT',`/companies/${resources.demoOwner.companyId}/sla-policy`,'demoMember',{criticalDays:1,highDays:7,mediumDays:30,lowDays:90},403);
 await req('maturity-client-create-denied','POST','/maturity/assessments','demoOwner',{companyId:resources.demoOwner.companyId},403);
 check('demo-auth-session-projection',owner.user.companyRole==='OWNER','Owner identity available after login');
 save();
}
async function admin(){
 await login('admin','admin@vulnera.local','adminHash');
 await login('pentester','bruno.pentester@vulnera.local','senhaDemo');
 const company=resources.tenantA.companyId,proj=resources.tenantA.projectId,v=resources.tenantA.riskFindingId;
 const prior=await req('sla-before','GET',`/vulnerabilities/${v}`,'admin');
 await req('sla-invalid-fraction','PUT',`/companies/${company}/sla-policy`,'admin',{criticalDays:1.5,highDays:7,mediumDays:30,lowDays:90},400);
 await req('sla-policy-create','PUT',`/companies/${company}/sla-policy`,'admin',{name:`${marker} Política QA`,criticalDays:2,highDays:10,mediumDays:35,lowDays:95},200);
 const unchanged=await req('sla-policy-does-not-reapply','GET',`/vulnerabilities/${v}`,'admin');
 check('sla-save-keeps-existing-deadline',unchanged.sla.dueAt===prior.sla.dueAt,'Saving policy preserves existing finding deadline');
 await req('sla-history','GET',`/companies/${company}/sla-policy/history`,'admin');
 await req('risk-admin-approve','POST',`/risk-acceptances/${resources.tenantA.acceptanceId}/approve`,'admin',{expiresAt:new Date(Date.now()+3*864e5).toISOString(),reviewNote:`${marker} revisão aprovada somente no tenant QA`},200);
 const accepted=await req('risk-detail-after-approve','GET',`/vulnerabilities/${v}`,'admin');
 check('risk-keeps-finding-open',accepted.status==='OPEN'&&accepted.sla.state==='ACCEPTED',`Finding ${accepted.status}, SLA ${accepted.sla.state}`);
 await req('risk-revoke','POST',`/risk-acceptances/${resources.tenantA.acceptanceId}/revoke`,'admin',{reason:`${marker} Revogação de QA para testar fim da pausa`},200);
 const revoked=await req('risk-detail-after-revoke','GET',`/vulnerabilities/${v}`,'admin');
 check('risk-revoke-preserves-open',revoked.status==='OPEN'&&revoked.sla.state!=='ACCEPTED'&&revoked.sla.pausedMs>0,`Finding ${revoked.status}, SLA ${revoked.sla.state}, pause ${revoked.sla.pausedMs}`);
 const catalog=await req('maturity-catalog-admin','GET','/maturity/catalog','admin');
 const controls=catalog.flatMap(d=>d.controls);
 const assessment=await req('maturity-create','POST','/maturity/assessments','admin',{companyId:company},201);resources.tenantA.assessmentId=assessment.id;
 await req('maturity-invalid-score','POST',`/maturity/assessments/${assessment.id}/scores`,'admin',{scores:[{controlId:controls[0].id,score:6}]},400);
 await req('maturity-partial-batch-error','POST',`/maturity/assessments/${assessment.id}/scores`,'admin',{scores:[{controlId:controls[0].id,score:4},{controlId:controls[1].id,score:6}]},400);
 const partial=await req('maturity-after-rejected-batch','GET',`/maturity/assessments/${company}/latest`,'admin');
 check('maturity-rejected-batch-atomic',(partial.scores?.length||0)===0,{scoreCount:partial.scores?.length,overallScore:partial.overallScore,level:partial.level});
 const valid=await req('maturity-valid-batch','POST',`/maturity/assessments/${assessment.id}/scores`,'admin',{scores:[{controlId:controls[0].id,score:4,notes:`${marker} Resposta de QA`},{controlId:controls[1].id,score:2}]},200);
 check('maturity-average',valid.overallScore===3&&valid.level==='INTERMEDIATE',`Average ${valid.overallScore}, level ${valid.level}`);
 await req('maturity-assigned-pentester-read','GET',`/maturity/assessments/${company}/latest`,'pentester');
 await req('project-report-early-denied','GET',`/projects/${proj}/report-data`,'admin',undefined,422,'report');
 await req('project-transition-progress','POST',`/projects/${proj}/transition`,'admin',{toStatus:'IN_PROGRESS'},200);
 await req('project-transition-review','POST',`/projects/${proj}/transition`,'admin',{toStatus:'IN_REVIEW'},200);
 const report=await req('project-report-ready','GET',`/projects/${proj}/report-data`,'admin',undefined,200,'report');
 check('report-consolidation',report.project?.id===proj&&report.vulnerabilities?.some(x=>x.id===v)&&report.maturity?.overallScore===3,'Consolidated report contains QA finding and maturity');
 const meta=await req('report-executive-metadata','POST','/reports','admin',{projectId:proj,type:'EXECUTIVE'},201,'report');resources.tenantA.executiveReportId=meta.id;
 await req('report-invalid-type','POST','/reports','admin',{projectId:proj,type:'INVALID'},400,'report');
  save();
}
async function boundary(){
 const crypto=require('crypto');
 const identity=await req('register-boundary-client','POST','/auth/register',null,{name:`${marker} Boundary owner`,email:`${marker.toLowerCase()}-boundary@qa.invalid`,password:crypto.randomBytes(24).toString('base64url')},201);
 tokens.boundary=identity.accessToken;resources.boundary={userId:identity.user.id,email:identity.user.email};
 const company=await req('boundary-company-create','POST','/companies','boundary',{name:`${marker} Boundary company`,planId:resources.plan.id},201);resources.boundary.companyId=company.id;
 const injectedName=`${marker} Nome alterado pela relação Company`;
 await req('company-nested-user-update-should-reject','PUT',`/companies/${company.id}`,'boundary',{users:{update:{where:{id:identity.user.id},data:{name:injectedName}}}},400);
 const after=await req('boundary-read-own-user','GET','/users/me','boundary');
 check('company-dto-blocks-nested-user-write',after.name!==injectedName,{nameBefore:identity.user.name,nameAfter:after.name,role:after.role,companyRole:after.companyRole});
 await req('boundary-restore-own-user-name','PATCH',`/users/${identity.user.id}`,'boundary',{name:identity.user.name},200);
 save();
}
(mode==='admin'?admin():mode==='boundary'?boundary():nonadmin()).then(()=>{save();console.log(JSON.stringify({done:true,mode,cases:results.length,failed:results.filter(x=>!x.pass).map(x=>x.id)},null,2))}).catch(e=>{save();console.error('QA_EXTRA_ABORT',e.message);process.exitCode=1});
