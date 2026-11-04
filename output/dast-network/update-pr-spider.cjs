// Atualiza a PR existente com a autenticação Git local, sem persistir/exibir segredos.
// Existe como alternativa ao conector sem escrita e é consumido pelo mantenedor.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
async function main() {
  const raw = execFileSync('git', ['credential', 'fill'], {
    input:'protocol=https\nhost=github.com\n\n', encoding:'utf8',
    env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'},stdio:['pipe','pipe','pipe'],
  });
  const credential = Object.fromEntries(raw.trim().split(/\r?\n/).map(line => {
    const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)];
  }));
  if (!credential.password) throw Error('Credencial Git existente indisponível');
  const response=await fetch('https://api.github.com/repos/guimunizzz/Vulnera-TCC/pulls/58', {
    method:'PATCH',headers:{Authorization:`Bearer ${credential.password}`,Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'Vulnera-DAST-delivery'},
    body:JSON.stringify({title:'fix: completar DAST com Spider e permitir alvos internos',body:fs.readFileSync('output/dast-network/pr-spider-body.md','utf8')}),
  });
  const result=await response.json();
  if (!response.ok) throw Error(`GitHub ${response.status}: ${result.message}`);
  const snapshot={number:result.number,url:result.html_url,draft:result.draft,head:result.head.sha};
  fs.writeFileSync('output/dast-network/pr-spider-final.json',JSON.stringify(snapshot,null,2));
  console.log(JSON.stringify(snapshot));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
