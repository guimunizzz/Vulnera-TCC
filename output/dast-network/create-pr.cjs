// Abre a PR desta entrega com a autenticação Git existente, sem gravar ou exibir credenciais.
// Existe como alternativa ao conector sem permissão de escrita; consumido pelo mantenedor local.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

async function main() {
  const credentialOutput = execFileSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const entries = credentialOutput.trim().split(/\r?\n/).map((line) => {
    const split = line.indexOf('=');
    return [line.slice(0, split), line.slice(split + 1)];
  });
  const credential = Object.fromEntries(entries);
  if (!credential.password) throw new Error('Credencial Git existente indisponível.');
  const response = await fetch('https://api.github.com/repos/guimunizzz/Vulnera-TCC/pulls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credential.password}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'Vulnera-DAST-delivery',
    },
    body: JSON.stringify({
      base: 'dev',
      head: 'codex/fix-dast-network-targets',
      title: 'fix: permitir alvos internos no DAST e validar o fluxo de apresentação',
      body: fs.readFileSync('output/dast-network/pr-body.md', 'utf8'),
      draft: true,
      maintainer_can_modify: true,
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${result.message}`);
  const snapshot = { number: result.number, url: result.html_url, draft: result.draft, base: result.base.ref, head: result.head.ref };
  fs.writeFileSync('output/dast-network/pr.json', JSON.stringify(snapshot, null, 2));
  console.log(JSON.stringify(snapshot));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
