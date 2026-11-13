<!-- Explica a importação SAST/SCA (SARIF e CycloneDX): uso, regras, API, segurança, limites e a validação com ferramentas reais; consumido pelo time, pela banca e por quem for manter o módulo. -->

# SAST/SCA — importação de relatórios de código

> **ADR:** [ADR-052](Vulnera/07-Decisoes/ADR-052%20-%20Importacao%20SAST%20e%20SCA%20por%20SARIF%20e%20CycloneDX.md) ·
> **Evidências:** [`docs/evidencias/sast-sca/`](evidencias/sast-sca/README.md) ·
> **Branch:** `feat/sast-sca-ingestion` (2026-11-13)

O Vulnera já fazia análise **dinâmica** (DAST, com OWASP ZAP e sensores
passivos). Este módulo cobre o outro lado: o que está **no código** (SAST) e nas
**dependências** (SCA). O Vulnera não executa Semgrep, CodeQL ou Trivy: ele
**importa o relatório que a pipeline do cliente já gera** e aplica a ele o mesmo
fluxo do DAST, que é triagem, promoção para vulnerabilidade com CVSS revisado
por humano, SLA, VRS, remediação e relatório.

## Como usar

1. Rode a ferramenta no repositório da aplicação:

   | Ferramenta | Comando | Formato |
   |---|---|---|
   | Semgrep | `semgrep scan --config p/default --sarif --output semgrep.sarif` | SARIF |
   | CodeQL | `codeql database analyze db --format=sarif-latest --output=codeql.sarif` | SARIF |
   | Trivy (dependências) | `trivy fs --scanners vuln --format cyclonedx --output sbom.cdx.json .` | CycloneDX |
   | Trivy (dependências) | `trivy fs --scanners vuln --format sarif --output trivy.sarif .` | SARIF |

   Qualquer ferramenta que emita **SARIF 2.1.0** ou **CycloneDX ≥ 1.4 com a
   seção `vulnerabilities`** funciona (SonarQube, Bandit, ESLint, Grype...).

2. No menu, abra **SAST/SCA** (selo *new*), clique em **Importar relatório**,
   escolha o projeto e solte o arquivo. Também dá para importar pela aba
   **SAST/SCA** do projeto. Na dúvida, o botão **?** ao lado de "Importar
   relatório" abre o guia: o fluxo em 5 passos, os comandos prontos para copiar
   (Semgrep, Trivy, CodeQL e GitHub Actions; instalado ou por Docker) e o que é
   bom saber antes de importar.
3. A tela de detalhe mostra os números, a distribuição por severidade e a lista
   de achados com filtros (severidade, origem, triagem, busca e "só novos").
4. Em cada achado: **triar** (confirmado / falso-positivo / risco aceito, com
   nota) e **promover para vulnerabilidade**.
5. Na próxima versão do relatório, use **Importar nova versão**. A aba
   **Comparação** mostra o que é novo, o que continua e o que foi resolvido.
6. A aba **Security Graph** desenha onde estão os problemas (pasta, arquivo e
   pacote). Clique num nó para ver os detalhes e use **Ver na lista para triar**.
7. **Baixar PDF** gera o relatório da importação no navegador.

Na primeira visita à página SAST/SCA e na primeira importação aberta, um
**tour guiado** apresenta cada parte, com **Pular tour**. O botão **Ver tour**
repete.

Quem acessa: **ADMIN** (todos os projetos) e **PENTESTER** (só os projetos de
que é membro). CLIENT não vê o módulo, pela mesma razão do DAST: achado de
ferramenta não triado ainda não é finding do produto.

## Regras

### O que é lido

| Formato | Campos usados |
|---|---|
| SARIF 2.1.0 | `tool.driver` (nome/versão), regras do driver **e** das extensões (CodeQL), `ruleId`/`ruleIndex`, `message`, `level`, `properties["security-severity"]`, `tags` (CWE), `locations` (arquivo, linha, trecho), `fingerprints`/`partialFingerprints`, `help`/`helpUri`, `suppressions` |
| CycloneDX | `metadata.tools` (forma 1.4 e 1.5+), `components` (aninhados), `vulnerabilities[]`: `id`, `ratings`, `cwes`, `description`/`detail`, `recommendation`, `affects` (um achado **por componente afetado**), `advisories` |

- **Severidade:** `security-severity` (0–10, padrão GitHub/CodeQL/Trivy)
  vence o `level`. No CycloneDX vale a maior entre as fontes (NVD, GHSA,
  distro). As faixas são as do CVSS: ≥ 9 crítica, ≥ 7 alta, ≥ 4 média, > 0 baixa.
- **SAST × SCA:** é SCA quando a regra é um advisory (`CVE-`, `GHSA-`, `GO-`,
  `PYSEC-`, `RUSTSEC-`, `OSV-`, `NSWG-ECO-`) ou quando a mensagem do Trivy
  traz `Installed Version:`. Todo CycloneDX é SCA.
- **Suprimido na origem** (`// nosemgrep`, alerta dispensado) não entra.

### Impressão digital (fingerprint) e deduplicação

É o que permite dizer, numa reimportação, que um achado "já existia":

| Caso | Fingerprint |
|---|---|
| SCA | ferramenta · regra · arquivo · `pacote@versão` |
| SAST com fingerprint da ferramenta que **distingue** as ocorrências | ferramenta · regra · arquivo · fingerprint da ferramenta, **sem a linha**, para que inserir uma linha acima não crie um "achado novo" |
| SAST sem isso | ferramenta · regra · arquivo · linha |
| Colisão restante (duas ocorrências na mesma linha) | acrescenta o número da ocorrência (`#2`) |

O fingerprint da ferramenta só é usado quando **distingue de fato**. O Semgrep
OSS sem login grava o texto literal `"requires login"` nesse campo, e outras
ferramentas hasheiam só o trecho de código (igual em linhas repetidas). Isso
foi descoberto ao importar um relatório real: sem a regra, 13 de 35 achados do
NodeGoat sumiam.

### Reimportação

- A base de comparação é a **importação anterior do mesmo projeto, formato e
  ferramenta**. Semgrep não se compara com CodeQL.
- **Novo** = fingerprint que não estava na anterior. **Continua** = estava.
  **Resolvido** = estava e sumiu.
- O achado que continua **herda a triagem** (status, nota, autor) e ganha o
  selo *herdada*. Triar de novo encerra a herança.
- "Resolvido" **não é "corrigido"**: o achado pode ter saído do escopo da
  análise. Se ele já era uma vulnerabilidade, a comparação mostra o link para
  ela e o PDF marca "retestar". O status da vulnerabilidade **não muda
  sozinho**: fechar é uma decisão humana, com o reteste.

### Promoção para vulnerabilidade

- O destino é o **projeto da importação**. A API ignora qualquer `projectId`
  enviado (SEC2), e a tela nem pergunta.
- **RN10 intacta:** o score oficial sai do vetor CVSS 3.1 confirmado no
  formulário. O rascunho sugere:
  - o **vetor da ferramenta**, quando houver (ex.: NVD num SBOM do Trivy). Um
    vetor 3.0 tem o prefixo trocado para 3.1, porque as métricas base são as
    mesmas e o score pode variar uma casa decimal. É sugestão, e a tela avisa;
  - senão, um vetor típico da faixa de severidade, marcado como sugestão.
- **OWASP:** SCA é sempre A06 (componente vulnerável); SAST usa o mapa CWE →
  Top 10 do DAST.
- `sourceType` = `SAST_IMPORT` ou `SCA_IMPORT` (proveniência, como o
  `DAST_IMPORT` do ADR-032). O SLA começa **na promoção**.
- **Dedup entre importações:** o mesmo fingerprint já promovido a partir de
  qualquer importação do projeto não vira uma segunda vulnerabilidade (409).
  A linha mostra *promovido* com o link.
- Promover um achado *por triar* marca como **confirmado**.

### PDF

O relatório tem capa, sumário (KPIs + gráfico), triagem e origem, comparação
com a anterior (com os resolvidos que eram vulnerabilidades marcados para
reteste), um bloco por achado e apêndice de metodologia. **Falso-positivo fica
fora da lista e do gráfico, mas é contado**: é o relatório que um cliente lê.
O `pdf-lib` só é baixado quando alguém pede o PDF.

### Security Graph (por importação)

```
Aplicação ─┬─ Código (SAST) ── pasta ── arquivo ── achados
           └─ Dependências (SCA) ── pacote@versão ── CVEs
```

- Mostra **onde** estão os problemas (decisão D17.5). Cada pasta, arquivo e
  pacote tem a cor da pior severidade abaixo dele e o total, e pode ser aberto
  ou recolhido. O diretório comum a todos os caminhos (ex.: `/src/`) sai do
  nome das pastas.
- O motor é o mesmo do CyberGraph do DAST e do Exposure Graph: layouts
  hierárquico, radial, estrela, orgânico e clusters, zoom, minimapa, arrastar,
  teclado, busca e exportação em PNG. Modelo puro em
  `features/security-graph/code-graph-model.ts`; tela em `code-graph.tsx`,
  carregada só quando a aba abre (14 kB).
- **Falsos-positivos ficam ocultos**, com o interruptor "Falsos-positivos (n)"
  para mostrar (D17.8). Os filtros de severidade também valem para o grafo.
- O que começa aberto depende do tamanho: com até 8 pastas ou pacotes e até 30
  achados, tudo aberto; acima disso, só os ramos. A cada filtro o que começa
  aberto é recalculado, e por cima disso valem as escolhas da pessoa (abri /
  recolhi). A busca abre o caminho até o nó achado.
- Teto de **300 nós**, o mesmo do Security Graph do DAST; acima disso o grafo
  avisa e a lista continua tendo todos.
- **Ver na lista para triar** leva o achado para a aba Achados, com os filtros
  limpos e a linha aberta.

### Tour guiado

- Dois tours (D17.6): **lista** (menu, importar, números e importações) e
  **importação** (resumo, abas com o Security Graph, filtros, triagem e
  promoção, nova versão e PDF). Os dois terminam no botão **Ver tour**.
- Abre sozinho na primeira vez, quando a tela já carregou. **Pular tour**, Esc
  ou **Concluir** encerram e lembram, **no navegador e por usuário** (D17.7,
  `localStorage` `vulnera:tour:<tour>:<usuário>`). Em outro navegador aparece
  de novo, uma vez.
- Componente próprio, sem dependência (`components/tour/`): holofote sobre o
  alvo, balão com "2 de 7", foco preso e devolvido, setas para navegar e
  movimento reduzido respeitado. Passo cujo alvo não está na tela (menu fechado
  no celular, lista vazia) é pulado; sem nenhum alvo, o tour não conta como
  visto.

## API

Todas as rotas exigem login e o papel ADMIN ou PENTESTER; a posse do projeto é
verificada no service.

| Método e rota | O que faz |
|---|---|
| `POST /api/code-imports` | multipart: `projectId` + `file` (≤ 10 MB). Importa e compara. Limite de taxa *expensive* |
| `GET /api/code-imports[?projectId=]` | importações do projeto, ou de todos os projetos visíveis ao usuário |
| `GET /api/code-imports/:id` | cabeçalho com `severityCounts` |
| `GET /api/code-imports/:id/findings` | achados, do mais grave ao menos grave, com triagem e promoção |
| `GET /api/code-imports/:id/compare` | novos, continuam e resolvidos em relação à anterior |
| `GET /api/code-imports/:id/report/data` | dados do PDF. Limite de taxa *report* |
| `PATCH /api/code-imports/findings/:findingId/triage` | `{ triageStatus, note }` |
| `GET /api/code-imports/findings/:findingId/promotion-draft` | rascunho (vetor sugerido e origem) |
| `POST /api/code-imports/findings/:findingId/promote` | `{ title, description, owaspCategory, cvssVector, impact?, recommendation? }` |

Erros: `MISSING_FILE`/`MISSING_PROJECT_ID`/`INVALID_FILE_FORMAT` (400),
`UNSUPPORTED_REPORT_FORMAT`/`UNSUPPORTED_SARIF_VERSION`/`IMPORT_TOO_LARGE`
(422), `FORBIDDEN` (403), `PROJECT_NOT_FOUND`/`IMPORT_NOT_FOUND`/`FINDING_NOT_FOUND`
(404), `FINDING_ALREADY_PROMOTED` (409).

**Dados:** `CodeScanImport` (cabeçalho e contadores da comparação) e
`CodeFinding` (achado + triagem), migration `20261113000000_add_code_scan_imports`,
mais `Vulnerability.sourceCodeFindingId` (único, `SetNull`). Camadas: rota →
`code-scan.factory.ts` → controller → `CodeScanService` → `CodeScanRepository`;
o parser (`utils/code-import.util.ts`) é puro.

## Segurança

- **Tenancy:** `companyId` sempre herdado do projeto; nunca é lido do request.
  O PENTESTER de outro projeto recebe 403 em importar, listar, ler, comparar,
  triar, rascunho e promover. CLIENT recebe 403 em todas as rotas. A lista
  global filtra por membro **no banco**.
- **Arquivo do usuário:** só `JSON.parse` e leitura de campos conhecidos, com
  textos cortados. O teto é de 10 MB e 5.000 achados, e acima disso a
  importação é **recusada**, não truncada. Nada é executado nem salvo em disco.
- **XSS:** nenhum texto do relatório vira HTML. Link externo só para `http(s)`:
  um `helpUri: "javascript:..."` aparece como texto. Isso tem teste.
- **Auditoria:** importar, triar e promover geram `AuditLog`.

## Validação com ferramentas reais (2026-11-13)

Relatórios gerados por **Semgrep 1.184.0** e **Trivy 0.76.2** (imagens Docker
oficiais) contra os projetos vulneráveis de propósito **OWASP NodeGoat**
(`c5cb68a`) e **OWASP Juice Shop** (`266448a`):

| Relatório | Achados | Severidade | Observação |
|---|---|---|---|
| NodeGoat · Semgrep SARIF | 35 | 7 altas · 27 médias · 1 baixa | 35 fingerprints únicos; 35 com CWE |
| NodeGoat · Semgrep SARIF **depois de corrigir os `eval`** | 29 | 4 altas · 24 médias · 1 baixa | 29 continuam, **6 resolvidos**, 0 novos |
| NodeGoat · Trivy CycloneDX | 93 (381 componentes) | 16 críticas · 59 altas · 15 médias · 3 baixas | 90 com versão corrigida, 89 com vetor CVSS |
| NodeGoat · Trivy SARIF | 93 | 11 · 47 · 26 · 9 | 93 SCA (inclusive `NSWG-ECO-*`) |
| Juice Shop · Semgrep SARIF | 71 | 20 altas · 48 médias · 3 baixas | — |
| Juice Shop · Trivy CycloneDX | 0 | — | o repositório não versiona lockfile: importa com **aviso**, sem parecer "nada vulnerável" |

O fluxo inteiro foi feito **pela interface** no navegador, como PENTESTER:
importar, triar (risco aceito com nota), promover SAST com vetor revisado,
reimportar depois da correção (triagem herdada, 6 resolvidos, a vulnerabilidade
promovida aparece para reteste), promover SCA com o vetor do NVD, PDF de 16
páginas, SBOM vazio, página global, aba do projeto, tema claro e 375 px. **Zero
erros de console.** As capturas estão em [`evidencias/sast-sca/`](evidencias/sast-sca/README.md).

### O que a validação real encontrou e corrigiu

| Problema | Correção |
|---|---|
| Semgrep OSS grava `"requires login"` como fingerprint, e as ocorrências se fundiam (35 → 22) | o fingerprint da ferramenta só vale quando distingue; senão, linha + ocorrência |
| Título do Semgrep saía como o id da regra | 1ª frase da mensagem quando a descrição curta e o nome não dizem nada |
| Regras `NSWG-ECO-*` do Trivy viravam SAST | SCA também pelo bloco `Installed Version:` |
| Versão corrigida vazia no SBOM do Trivy | `affects[].versions` "unaffected" ou o texto "Upgrade X to version Y" |
| Vetor 3.0 escolhido mesmo havendo 3.1 | v3.1 tem prioridade; 3.0 tem o prefixo convertido no rascunho |
| SBOM sem componentes parecia "0 vulnerabilidades" | aviso explicando o lockfile ausente |
| Recomendação do Semgrep trazia HTML e a propaganda "Enable cross-file analysis... sg.run/pro" | texto puro da ajuda, sem a linha promocional e descartada quando só repete a descrição |
| PDF: URLs longas passavam da margem; capa com "Empresa" e "Aplicação" trocados | tokens longos quebrados; a API devolve `companyName` e a ferramenta foi para o subtítulo |
| O "×" de fechar de todos os diálogos ficava abaixo da descrição, e não no canto | `.alvo-estendido { position: relative }` (CSS fora de camada, em `base.css`) vencia o utilitário `absolute`; a regra agora só vale para hosts não posicionados, e o painel do `Dialog` é `relative` |
| Guia de importação mais largo que a tela no celular | as linhas longas de comando alargavam o painel; `min-w-0` deixa o `<pre>` rolar |
| Teto de 300 nós do grafo passava em 3 (os ancestrais entravam na conta depois dos filhos) | o nó é contado ao entrar nele (teste com 400 achados) |
| Achado que aparecia ao ligar "falsos-positivos" nascia dentro de um arquivo recolhido | o que começa aberto é recalculado a cada filtro, mantendo as escolhas da pessoa |
| "Salvar nota" logo depois de mudar o status **desfazia a triagem** (AuditLog: `ACCEPTED_RISK → NEW` em 73 ms) | o controle de triagem guarda o último status confirmado pela API. **O mesmo componente atende o DAST, que também é corrigido** |

## Limites

- O Vulnera não executa a ferramenta nem confirma a exploração. A qualidade é
  a do relatório de origem.
- Achado de dependência indica uma versão vulnerável presente, não que o trecho
  seja alcançável.
- Os caminhos aparecem como a ferramenta os gravou (ex.: `/src/...` quando o
  Semgrep rodou num contêiner com o código em `/src`).
- Sem integração direta com CI (webhook/token por projeto) nem consulta
  própria a OSV/NVD para SBOM sem CVEs. Ver backlog `CODE-FUT-*`.
