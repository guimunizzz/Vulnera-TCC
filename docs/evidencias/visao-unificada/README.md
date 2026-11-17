<!-- Evidências da visão unificada DAST + SAST + SCA e do CODE-FUT-03 (2026-11-15); consumido pelo PR e pela banca. -->

# Visão unificada DAST + SAST + SCA e "Correção não confirmada"

Validação no navegador (Chrome, Playwright) contra a stack local da branch
`feat/unified-origin-view`: API em `:3101` e web em `:5174` sobre um banco
próprio (`vulnera_ti_dev`, `seed` + `seed-demo` + `seed-playbooks`). **Todos os
dados de origem são reais**, gerados na hora:

| Origem | Como foi gerado | Resultado |
|---|---|---|
| SAST | Semgrep 1.184.0 (`p/default`, imagem oficial) contra OWASP NodeGoat `c5cb68a` → SARIF | 35 achados; promovido o `eval` de `contributions.js:32` |
| SCA | Trivy (`fs --format cyclonedx`, imagem oficial) contra o mesmo NodeGoat | 93 achados em 381 componentes; promovida a CVE-2020-7610 do `bson@1.0.9` |
| DAST | Scan **real** do OWASP ZAP (`zaproxy:stable`) contra um `nginx:1.27-alpine` descartável em `host.docker.internal:8099` | 15 achados; promovido "Content Security Policy (CSP) Header Not Set" |

Importação, promoção e scan passaram pela API real (`pr1-dados.mjs`, fora do
repositório); as telas, pelo navegador (`pr1-capturas.mjs`). Log em
[`fluxo-real.txt`](fluxo-real.txt). **0 erros de console.**

| # | Captura | O que prova |
|---|---|---|
| 01 | `01-correcao-nao-confirmada-aviso` | CODE-FUT-03: o `eval` promovido foi marcado FIXED, o mesmo SARIF foi reimportado e o detalhe da importação mostra "Correção não confirmada" com o achado, o local e **Reabrir** |
| 02 | `02-reabrir-confirmacao` | Reabrir pede confirmação e explica o efeito (Corrigida → Em andamento, SLA recomeça, auditoria) |
| 03 | `03-reaberta-aviso-some` | Confirmado: a API devolve `IN_PROGRESS` e o aviso some (deixa de ser candidata) |
| 04 | `04-detalhe-finding-selo-origem-sast` | O detalhe do finding traz o selo da origem |
| 05 | `05-achados-coluna-origem` | Achados da aplicação com a coluna **Origem**: DAST, SAST, SCA e Manual na mesma lista |
| 06 | `06-achados-filtro-origem-com-contagens` | Filtro **Origem** com a contagem de cada opção (faceta `source`) |
| 07 | `07-achados-tres-lentes-dast-sast-sca` | `?sourceType=DAST_IMPORT,SAST_IMPORT,SCA_IMPORT`: só as três lentes automáticas |
| 08 | `08-painel-aplicacao-por-origem-admin` | Painel da aplicação (ADMIN): abertos por origem e a fila de triagem do código (34 SAST e 92 SCA ainda `NEW` na importação mais recente) |
| 09 | `09-do-painel-para-achados-filtrados-sca` | O link "SCA" do painel abre Achados já filtrados por aplicação, origem e abertos |
| 10 | `10-painel-aplicacao-por-origem-client-sem-fila` | CLIENT: a mesma quebra por origem, **sem** fila de triagem e **sem** links (a API manda `filaDeTriagem: null`) |
| 11 | `11-exposure-graph-aplicacao-por-origem` | Exposure Graph (CLIENT): painel da aplicação com "Por origem" e o selo da origem nas mais graves |
| 12 | `12-painel-por-origem-375px` | 375 px: `scrollWidth` 365, sem rolagem horizontal |

## Testes

- API: `npm test` **823/823** (55 suítes), inclusive CODE-REO-01, VULN-LIST-15,
  MET-19, SG-FUT-09 e o FX-I-01 tolerante às duas versões do `content-disposition`
  (regex conferida contra a saída real da 2.0.1).
- Web: **605/605** (71 arquivos; o `findings-table.test.tsx` não versionado
  fica de fora), lint 0 erros, contraste 132 pares.
- E2E contra a stack local: `exposure-graph.spec.ts` 3/3;
  `exposure-remediation` + `exportar-excel` + `acessibilidade` 16/18. As duas
  falhas não vêm desta branch: E2E-EXP-07 procura um *link* com o título na
  tabela de Achados, que renderiza o título como texto (o movimento no quadro
  funcionou e o finding aparece na listagem filtrada); e o teste de CSP exige o
  nginx do Docker, não o Vite de desenvolvimento.
