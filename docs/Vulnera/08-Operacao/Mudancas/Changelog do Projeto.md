---
type: changelog
tags: [core]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Changelog do Projeto

## 2026-08-07 (sessão 25 — Endurecimento da Fase 5)

### Objetivo

Endurecer a Fase 5 (Vulnerability + Evidence), **sem features novas**. Critério: o que uma banca de TCC em segurança da informação atacaria neste código, e o que quebraria numa demo ao vivo. Branch `fix/fase-5-hardening`.

**Testes 107 → 225**, todos verdes. Cobertura dos services da Fase 5 toda ≥90%.

### CVSS — o parser estava correto; o que faltava era prova

Nenhum erro de cálculo encontrado. O que foi feito:

1. **13 vetores oficiais** do FIRST/NVD viraram teste, **5 deles com Scope Changed** (Log4Shell 10.0, Zerologon 10.0, CVE-2012-1516 9.1 com PR:H, CVE-2013-0375 6.4 com PR:L, CVE-2013-1937 6.1 com UI:R). 13/13 conferem. Duas divergências na primeira rodada eram erro do **vetor de teste** (escrevi `S:C` onde o NVD publica `S:U`), não do código — o parser deu o valor matematicamente correto do vetor que recebeu, o que é validação mais forte ainda.
2. **Varredura exaustiva dos 2592 vetores base possíveis**: nenhum produz NaN/Infinity nem sai de [0,10].
3. **Arredondamento**: o código **já usava** a aritmética inteira do Apêndice A do 3.1, não o `Math.ceil(x*10)/10` do 3.0. Achado que virou evidência: nos 2592 vetores base os dois algoritmos **coincidem** — a diferença só aparece em valores intermediários (como os que métricas temporais/ambientais produzem). Provado com o exemplo canônico do Apêndice A: `0.1+0.2 = 0.30000000000000004` → o correto devolve **0.3**, o ingênuo devolveria **0.4**. `roundUp` passou a ser exportada para permitir esse teste direto.
4. **Versão**: `CVSS:3.0/` já era rejeitado, mas **por acidente** (o segmento não batia com nenhuma métrica) — sem teste, e quebraria se alguém mexesse no parser. Agora há `assertSupportedVersion()` explícita. Métricas temporais/ambientais (`E:`, `RL:`, `CR:`…) idem: rejeitadas, nunca ignoradas em silêncio.
5. **Paridade front/back**: teste novo importa `app/web/src/lib/cvss.ts` na suíte da API e roda os mesmos 2592 vetores nos dois — **0 divergências**; ambos recusam as mesmas entradas malformadas.
6. **Corrigido**: a detecção de métrica duplicada usava `if (parsed[key])`, falsy para string vazia — `C:/C:H` passava batido. Trocado por `key in parsed` (espelhado no front).

### Upload e download — superfície de ataque (27 testes, SEC-EV-01..07)

**Corrigido — validação de texto aceitava binário (severidade média).** O fallback `text/plain` aprovava qualquer buffer cujos bytes fossem code points UTF-8 válidos, e bytes de controle **são** UTF-8 válido: `Buffer.from([0x00,0x01,0x02])` passava como texto e era gravado como `.txt`. Substituído por `isPlainText()`, que rejeita controles fora de TAB/LF/CR.

**Corrigido — dois 500 por estouro de `VARCHAR(191)`.** `Evidence.originalName` e `Vulnerability.title` eram gravados crus; valores longos estouravam a coluna e o erro do Prisma vazava como `500 INTERNAL_ERROR`. Agora `sanitizeOriginalName()` e `FIELD_LIMITS` devolvem 400.

**Corrigido — multipart sem limite de partes.** Adicionados `files: 1`, `fields: 5`, `parts: 10`.

**Confirmado sem furo** (virou teste, que é o valor): o caminho do download já derivava 100% do registro no banco — nenhum componente vem da URL, só o `evidenceId` como chave de busca. A autorização já acontecia **antes** de tocar o disco (provado com teste que apaga o arquivo e ainda recebe 403, não 500). O `content-disposition` do Express já fazia basename e escapava CRLF. A extensão em disco já vinha do tipo **detectado**, não do nome enviado. O limite de 10MB já era aplicado pelo multer **no stream** (provado medindo `heapUsed` num POST de 25MB).

**Defesa em profundidade adicionada**: `resolveDentroDeUploads()` valida contenção sob `UPLOADS_ROOT` na leitura e na escrita; `X-Content-Type-Options: nosniff` no download.

**Polyglot documentado como limitação aceita** (L-02 em `docs/BACKLOG.md`), com as quatro mitigações verificadas por teste.

### Isolamento multi-tenant — TEN-07 a TEN-13

Existia só o TEN-06, que cobria **leitura** de Vulnerability. Adicionados canários para Evidence (list/download/upload), Comment (list/create/delete) e escrita de Vulnerability (update/transition/override/delete), nos dois vetores: **CLIENT cross-tenant** (RN16) e **PENTESTER sem ProjectMember** (RN17). **Nenhum furo encontrado** — o valor é a prova, que não existia.

Três decisões de escrita: cada bloco tem **controle positivo** (o membro legítimo faz a mesma operação com sucesso — senão o canário passaria com a rota quebrada devolvendo 403 pra todos); cada bloco **verifica efeito colateral no banco** depois do 403; e o **TEN-13** prova que `companyId`/`projectId`/`severityFinal`/`cvssScore` forjados no corpo são integralmente ignorados (mass assignment).

Status mantido em **403**, não 404, conforme `CLAUDE.md` §9 e o padrão das Fases 3/4 — registrado como limitação consciente L-04.

### Auditoria — buraco na trilha, corrigido

O `PUT` com vetor novo descartava o override manual (decisão correta da Fase 5, ver sessão 23) mas registrava só um `SEVERITY_CHANGE` genérico. Na trilha impressa no PDF Técnico, um `SEVERITY_OVERRIDE` **sumia sem explicação** — quem auditasse não conseguia reconstruir a história do finding.

Novo evento **`SEVERITY_OVERRIDE_RESET`** com `reason: "CVSS_VECTOR_CHANGED"`, severidade descartada, **a justificativa que deixou de valer** e a severidade recalculada. Só dispara quando havia override ativo. O `SEVERITY_CHANGE` passou a registrar também vetor e score de origem/destino.

### Alinhamento com a Fase 6

Novo `app/web/src/lib/font-safety.ts`: detecta caracteres fora do WinAnsi/cp1252 iterando por *code point*. O `FindingEditorPage` mostra aviso **não-bloqueante** listando exatamente quais virarão `?` no PDF. Não-bloqueante de propósito — o dado no banco é UTF-8 e está correto; impedir o registro de um finding legítimo por causa de um emoji seria pior. O `sanitizeForFont()` da Fase 6 continua sendo a rede de segurança; isto é a prevenção na origem.

Limites de tamanho (`FIELD_LIMITS`) em título/descrição/impacto/recomendação/comentário e **teto de 1000 na justificativa de override** (novo `JUSTIFICATION_TOO_LONG`) — sem teto, texto de 50 mil caracteres ia inteiro pro `diffJson` do AuditLog e pro PDF.

### Máquina de estados — [[ADR-021 - Maquina de Vulnerability com 4 estados]]

A divergência vault (6 estados) × código (4) nunca tinha virado ADR, e quem lia o vault concluía que faltou implementar. Argumento central encontrado na investigação: **os dois estados faltantes dependem de regras que também não existem no código** — `REVALIDATION` precisa do fluxo de remediation service (RN13/RN14), `RISK_ACCEPTED` precisa de uma alçada formal de aceite de risco que a [[Matriz de Permissoes]] não define. Implementá-los sem as regras que os governam produziria transições sem semântica.

[[Maquina - Vulnerability]] reestruturada em "Implementado no MVP" × "Modelo conceitual completo"; RN12 com callout apontando qual máquina vale; RN13 e RN14 marcadas como não implementadas (estavam `status: ativo` sem nada no código).

### Validação em navegador real

A extensão do Chrome **conectou** (não conectara na sessão 24), fechando as duas pendências herdadas da Fase 6:

- ✅ **Embed de evidência no PDF Técnico CONFIRMADO** — PNG 480×240 subido pela UI, PDF gerado e aberto no Chrome: imagem embutida e renderizada (`/Subtype /Image`, `/Width 480 /Height 240`). **O fallback não foi acionado**: `axios` com `responseType: "blob"` produz Blob real no adapter XHR, exatamente como suspeitado na sessão 24.
- ✅ PDFs Executivo e Técnico e os 3 dashboards conferidos visualmente. Zero erros de console.
- ✅ Upload no navegador real: PNG aceito, executável MZ/PE renomeado para `.png` (com `Content-Type: image/png` enviado pelo browser) **bloqueado**.
- ✅ CLIENT read-only provado via `fetch` no console, não só pela UI: PUT/transition/override/DELETE/upload **403**; GET 200; comentar 201.
- ✅ Path traversal ao vivo (`../`, `%2e%2e%2f`, `....//`, caminho absoluto): todos 404.

O mesmo PDF **provou o problema que o aviso novo previne**: a seta `→` saiu como `?` e o emoji `⚠️` como `??`.

### Ambiente e ferramentas

O `npm run check` **não rodava num clone limpo**: `.env`/`.env.test` não existem (estão no `.gitignore`) e o `jest.config.ts` em TypeScript exige `ts-node`, ausente das devDependencies — **adicionado ao `package.json`**.

Banner do dotenv 17.x silenciado **no código versionado** (`quiet: true` em `tests/setup.ts` e `EnvVar.ts`), não numa variável de ambiente: `.env*` está no `.gitignore`, então quem clonasse veria o banner de volta na saída dos testes (que vira screenshot de evidência do TCC).

### Pendências registradas

- **Limitações conhecidas L-01..L-08** em `docs/BACKLOG.md` — cada uma com o motivo de não ter sido corrigida. Base pronta para a task 8.7 (README/DEMO).
- **Bug da Fase 6 (não corrigido, §0.2 S6):** no PDF Executivo, "Top 5 riscos", título longo sobrepõe o texto `CVSS x.x · Axx · Categoria` (`lib/pdf/executive.ts`). Task 8.11.
- **Tasks descobertas:** 8.9 (rota DELETE de Evidence, que não existe), 8.10 (rate limiting).
- **`CLAUDE.md` §2 corrigido para plural** — exigia singular, contra o [[ADR-009 - Pastas no plural e cadeia de camadas]], o [[Contexto Mestre v4]] e o código real. Rafael confirmou nesta sessão (R4 exige confirmação humana antes de editar regra eterna).
- **Colisão de ADR:** o `docker-compose.yml` referenciava um "ADR-021 - Stack completa no Docker Compose" nunca escrito (commit `c131aef`). ADR-021 foi usado para a máquina de estados; o compose agora registra que o ADR do Docker deve ser **ADR-022**.

---

## 2026-08-07 (sessão 24 — Fase 6 implementada: Relatórios + Dashboards)

### Objetivo

Executar a Fase 6 completa (`docs/ROADMAP_PROMPTS.md`) — `report-data` consolidado, PDFs Executivo e Técnico 100% client-side com `pdf-lib` (decisão revertida de `@react-pdf/renderer`), e os 3 dashboards por role. Branch `feat/fase-6-relatorios`.

### Backend

1. **`GET /projects/:id/report-data`** — projeção agregada computada em `report.service.ts` a partir de Project/Application/Company/Vulnerability/Evidence/VulnerabilityComment (nenhuma tabela nova). Resolve nomes de autor/responsável/comentaristas em UMA query batch (`UserRepository.findByIds`, novo) em vez de N+1. **RN18 aplicada** ("Relatórios exigem Project em IN_REVIEW ou superior") — `assertProjectReady()` bloqueia com `422 PROJECT_NOT_READY_FOR_REPORT` se o Project ainda não chegou em IN_REVIEW/COMPLETED; validado nos dois pontos do fluxo (`report-data` e `generate()`), já que `report-data` é o primeiro passo do próprio fluxo de geração e hoje não tem outro consumidor.
2. **`POST/GET /reports`** — metadado de geração (`title`, `type`, `generatedBy`, `createdAt`). Toda geração grava `AuditLog` `REPORT_GENERATED`. Quem pode gerar: ADMIN, PENTESTER-membro **ou CLIENT da company** — diferente da escrita de Vulnerability (lá CLIENT é sempre read-only); aqui o PDF é montado no browser do próprio usuário, então "gerar" e "baixar" são o mesmo clique, e a Matriz de Permissões já lista "baixar relatório" como ação do Client Owner/Member.
3. **Rota `GET /:id/report-data` montada em `project.routes.ts`**, não em `report.routes.ts` — a URL exigida pelo enunciado é aninhada em `/projects/:id`, mas a lógica inteira mora em `ReportService`/`ReportController` (reaproveitados via `report.factory.ts`). Documentado em comentário no código pra não confundir sessões futuras.
4. **`GET /subscriptions/active`** (novo, admin-only, mesmo padrão de `/pending`) — `Company` não tem campo `isActive` no schema; "empresas ativas" só existe via `Subscription.status === ACTIVE`. Usado só pelo dashboard admin.
5. **Nenhum outro endpoint novo pros dashboards** — `GET /vulnerabilities` e `GET /projects` sem filtro já vêm escopados por role desde a Fase 4/5 (ADMIN=tudo, CLIENT=própria company via RN16, PENTESTER=projetos onde é membro via RN17); os 3 dashboards só compõem esses dados no frontend.

### Testes

10 novos: `report.test.ts` (9 — stats/byOwasp/topRisks batendo com o banco, RN18 com 422, isolamento cross-company 403, PENTESTER não-membro 403, PENTESTER-membro 200, POST/GET reports + AuditLog) e 1 em `subscription.test.ts` (`GET /subscriptions/active` admin-only, só ACTIVE). Total **107/107**. Cobertura de `report.service.ts`: 89.4% statements / 97.4% lines.

### Frontend

`lib/pdf/base.ts` — helpers pdf-lib imperativos: página A4, cabeçalho/rodapé paginado, capa em tema escuro (replica a UI), `drawText`/`wrapText` com quebra automática e pulo de página sozinho, `drawBarChart` (retângulos proporcionais desenhados à mão), `drawChip`, paleta idêntica ao `tailwind.config.ts` do app/web (verde `#10b981` + paleta de severidade — mesma fonte usada em `lib/severity-colors.ts` pro Recharts). **`sanitizeForFont()`** — achado durante o smoke, não estava no prompt: `StandardFonts.Helvetica` só codifica WinAnsi/cp1252, não cobre emoji nem setas unicode; sem sanitizar, um finding com esses caracteres no título/comentário derrubava a geração do PDF inteiro. `lib/pdf/executive.ts` (capa + sumário + KPIs + gráfico de severidade + top 5 riscos + maturidade placeholder condicional + conclusão — 3 páginas no smoke com 3 findings) e `lib/pdf/technical.ts` (capa + sumário + 1 seção por finding com evidências PNG/JPEG embutidas via `embedPng`/`embedJpg` — PDF/TXT viram referência em texto, não dá pra virar pixel — + comentários + apêndice glossário). Aba Relatórios no `ProjectDetailPage`: gate visual quando o Project não está pronto (RN18), botões "Gerar PDF Executivo"/"Gerar PDF Técnico" (busca `report-data` → gera o PDF no browser → download via Blob → registra `POST /reports`) e histórico de gerações. `Dashboard.tsx` roteando por role: `ClientDashboard` (KPIs + `SeverityDonut` via Recharts + 5 recentes), `PentesterDashboard` (projetos atribuídos + findings da semana) e `AdminDashboard` (empresas ativas + pendentes com link pra tela da Fase 3 + críticos globais + top companies por volume).

### Smoke (duas camadas — extensão do Chrome não conectou nesta sessão)

1. **Headless com dados sintéticos** via `vite.ssrLoadModule` (roda `lib/pdf/*` fora do browser, mas dentro do pipeline do Vite pra `import.meta.env` existir) — pegou e corrigiu o bug do WinAnsi (`sanitizeForFont`) antes de qualquer usuário real ver.
2. **Headless com dados REAIS do banco de dev** — login programático como ADMIN, `report-data` de verdade do finding da TechNova (Fase 5), PDFs gerados e inspecionados visualmente (via ferramenta que renderiza PDF): cover, KPIs, gráfico, seção do finding com CVSS/OWASP/descrição/impacto/recomendação/justificativa de override/comentário real do Bruno Pentester, tudo correto. Embed da evidência PNG caiu no fallback gracioso (ver limitação abaixo — artefato do ambiente headless, não bug de produto).
3. **Dashboards validados via API direta** (não via UI) nos 3 perfis contra o banco de dev real: ADMIN vê 1 company ativa / 0 pendente / 1 finding global; CLIENT vê o mesmo 1 finding escopado pra própria company; PENTESTER vê 1 projeto atribuído + 1 finding via membership.

### Limitações conhecidas / decisões autônomas

- ⚠️ **Inspeção visual no navegador real não foi feita nesta sessão** — a extensão do Chrome (`claude-in-chrome`) não conectou. Todo o smoke acima foi feito por API direta + PDFs gerados fora do browser. A arquitetura e os dados foram validados de ponta a ponta; falta só o "olho humano" vendo renderizado no app rodando. Servidores de dev (API `:3001`, Web `:3000`, Prisma Studio `:5555`) foram deixados rodando pro Rafael conferir.
- ⚠️ **Embed de evidência (`embedPng`) não verificado no navegador de verdade** — `axios` com `responseType: "blob"` só produz um `Blob` real no adapter XHR do browser; em Node (ambiente do smoke headless) cai no fallback já previsto no código, sem derrubar o PDF. É o mesmo padrão de download já usado (e correto) desde a Fase 5; mesmo assim, vale um clique de confirmação do Rafael.
- Projeto de demo da TechNova foi transicionado de `IN_PROGRESS` pra `IN_REVIEW` via API (ADMIN, RN15) durante o smoke, de propósito — assim o Rafael já consegue clicar em "Gerar PDF" na demo sem precisar mexer no status primeiro.
- Nenhum endpoint de agregação novo pros dashboards (decisão de simplicidade) — só `GET /subscriptions/active`, porque não tinha outro jeito de saber "empresas ativas" sem tabela/campo específico.

### Pendente

- PR `feat/fase-6-relatorios` → `develop` — Rafael abre manualmente.
- Conferência visual no navegador real (extensão do Chrome) — dashboards nos 3 perfis + os dois PDFs abertos de verdade.

## 2026-08-05 (sessão 23 — Fase 5 implementada: Vulnerability + Evidence, núcleo do produto)

### Objetivo

Executar a Fase 5 completa (`docs/ROADMAP_PROMPTS.md`) — a fase mais pesada, com pedido explícito de "esforço adicional" e validação real a cada checkpoint. `utils/cvss.util.ts` (parser manual CVSS 3.1), CRUD de Vulnerability com transição/override (RN09..RN11, RN20/RN21), upload de Evidence validado por magic number, VulnerabilityComment paginado, telas web correspondentes e smoke E2E completo com arquivos binários reais. Branch `feat/fase-5-findings`.

### Backend

1. **`utils/cvss.util.ts`** — parser manual do vetor CVSS 3.1 (AV/AC/PR/UI/S/C/I/A), fórmulas oficiais do FIRST (Impact/Exploitability/roundup do Apêndice A), comentadas em PT-BR. `INVALID_CVSS_VECTOR` em vetor malformado, duplicado ou com métrica desconhecida. Validado à mão contra 5 vetores: canônico (9.8 CRITICAL), Log4Shell CVE-2021-44228 com Scope Changed (10.0 CRITICAL), Heartbleed CVE-2014-0160 (7.5 HIGH), e dois vetores calculados manualmente pra cobrir MEDIUM (5.1) e LOW (1.8).
2. **Vulnerability** — `models/repositories/services/controllers/factories/routes` completos.
   - `create()`: `applicationId`/`companyId` sempre herdados do `Project` via `projectId` (RN09) — nunca aceitos do DTO. Score/severidade sempre recalculados a partir do `cvssVector` (nunca aceitos prontos). `owaspCategory` obrigatória, validada contra o enum A01..A10 no controller (RN11). Gera `AuditLog` `CREATE` (RN20).
   - `update()`: se o `cvssVector` mudar, recalcula e **reseta qualquer override anterior** (`severityFinal` volta a acompanhar `severityCalculated`, `severityOverrideReason` limpo) — decisão não especificada no prompt: a justificativa de um override foi escrita pro score antigo, não faz sentido continuar valendo pro novo. Gera `AuditLog` `SEVERITY_CHANGE` com `{from, to}` (RN21).
   - Máquina de estados mínima de 4 estados (`OPEN → IN_PROGRESS → FIXED → CLOSED`) — mesma simplificação já aplicada em Project na Fase 4; a máquina de 6 estados do vault (REVALIDATION/RISK_ACCEPTED, dependente de `hasRemediation` — RN13/RN14) fica pra sprint futura. Toda transição grava `AuditLog` `STATUS_CHANGE`.
   - `overrideSeverity()`: exige justificativa ≥20 caracteres (`MISSING_JUSTIFICATION`), grava `AuditLog` `SEVERITY_OVERRIDE` com `{from, to, reason}`.
   - `delete()`: restrito a ADMIN (não PENTESTER), hard delete (sem `isActive` no schema pra Vulnerability), gera `AuditLog` `DELETE`.
   - Quem escreve (create/update/transition/override): ADMIN ou PENTESTER membro do Project — CLIENT é sempre `FORBIDDEN`. Visibilidade (list/getById): RN16 (CLIENT só a própria company) + RN17 (PENTESTER só projetos onde é membro), mesma lógica do `ProjectService`.
3. **Evidence** — `multer` (`memoryStorage`) + validação manual + gravação manual, exatamente como pedido.
   - Detecção de tipo real por **magic number** nos primeiros bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, PDF `25 50 44 46`, texto validado por decodificação UTF-8 estrita) — o `Content-Type` que o cliente declara **nunca é usado pra decidir aceitar/rejeitar**, só a assinatura real dos bytes. Testado explicitamente: um `.exe` com `Content-Type: image/png` forjado ainda é rejeitado.
   - Limite de 10MB — barrado em duas camadas: `multer.limits.fileSize` (corta cedo, sem gastar memória) e uma checagem redundante no service (defesa em profundidade / correção do service isolado de testes).
   - Arquivo aprovado é regravado com nome UUID + extensão (nunca o nome original) em `uploads/{companyId}/{vulnId}/`.
   - `UPLOADS_DIR` nova env var (`EnvKeys`/`EnvVar`, como o CLAUDE.md §6 exige) — `.env.test` aponta pra `uploads-test/`, nunca polui o volume real de dev com arquivo de teste.
   - GET de download é autenticado e resolve o caminho absoluto só depois de checar acesso à company (mesma regra de visibilidade do Vulnerability) — nunca expõe `filePath` bruto na resposta JSON.
4. **VulnerabilityComment** — `GET`/`POST` paginados (`page`/`pageSize`, default 20/máx 100, ordem cronológica). Diferente da escrita do Vulnerability em si: **qualquer ator com acesso de leitura ao finding pode comentar** (é canal de comunicação, não edição do finding) — CLIENT comenta normalmente. `DELETE` restrito ao autor ou a um ADMIN.
5. **Bug pré-existente corrigido (bloqueava upload de verdade no Checkpoint 6):** `.gitignore` da raiz apontava pra `apps/api/uploads/*` (plural — resquício de estrutura antiga que nunca existiu neste repo). Corrigido nos dois `.gitignore` (raiz e `app/api/`) pra apontar pro caminho real `app/api/uploads/`, senão evidências de verdade seriam commitadas por engano.

### Testes

24 novos: `tests/unit/cvss.util.test.ts` (13 — os 5 vetores conhecidos + 7 casos de vetor inválido), `vulnerability.test.ts` (17 — BIZ-03..08 + TEN-06 + cobertura extra de list/getById/PUT sem mudar vetor/listByProject), `evidence.test.ts` (7 — BIZ-09 completo: .exe bloqueado, Content-Type forjado, .txt UTF-8 válido vs binário disfarçado, arquivo >10MB, roles), `vulnerability-comment.test.ts` (6 — paginação, CLIENT comentando, DELETE autor/admin/terceiro-bloqueado). Total **97/97**. Cobertura de linha: `vulnerability.service.ts` 97.6% (statements 84.9%), `evidence.service.ts` 95% (statements 85.1%), `vulnerability-comment.service.ts` 96.4% (statements 88.9%) — todos ≥80% também em statements. `cleanDatabase()` já estava na ordem certa (`evidence → vulnerabilityComment → vulnerability` antes de `projectMember`), herdada da Fase 4, não precisou de ajuste.

### Frontend

`lib/cvss.ts` — espelho em TypeScript do `cvss.util.ts` do backend, usado pro cálculo em tempo real sem round-trip ao servidor. Aba Findings no `ProjectDetailPage` (filtros de severidade/status/OWASP, paginação client-side, contador "X críticos abertos" no header). `FindingEditorPage` (create + edit numa página só: título, select OWASP, vetor CVSS com preview ao vivo, descrição/impacto/recomendação, upload drag-drop multi-arquivo com preview local e barra de progresso via `onUploadProgress`, timeline de comentários paginada, botões de transição e override — modal com contador de caracteres, desabilitado abaixo de 20). `FindingDetailPage` — versão read-only (usada pelo CLIENT e como "visualização" antes de editar pra ADMIN/PENTESTER, que veem um botão "Editar").

### Smoke E2E (navegador real, backend+frontend rodando, arquivos binários de verdade)

Login CLIENT (TechNova) → criar aplicação + projeto DAST via wizard. Login ADMIN → transicionar projeto pra "Em andamento" → atribuir pentester (criado direto no banco, sem tela de gestão de usuário ainda). Login PENTESTER → aba Findings → criar finding com o vetor canônico → **score calculado em tempo real no cliente = 9.8 CRITICAL**, idêntico ao backend → salvar → editar → upload de um PNG com assinatura de bytes válida (aceito, gravado em `uploads/{companyId}/{vulnId}/{uuid}.png`) e de um "executável" com cabeçalho MZ (`400 INVALID_FILE_TYPE`, inclusive disfarçado com `Content-Type: image/png` forjado) → comentar → override pra MEDIUM com justificativa (contador de caracteres testado: botão fica desabilitado com 11/20, habilita com a justificativa completa) → header passa a mostrar "Média" + "(calculada: CRITICAL)". Login CLIENT de novo → abre a mesma URL do finding → visão 100% read-only (sem botão Editar, sem zona de upload, evidência listada com download funcionando, comentário do pentester visível, card de "Justificativa do override" visível). AuditLog conferido no Prisma Studio: 3 registros exatos (`Project STATUS_CHANGE`, `Vulnerability CREATE`, `Vulnerability SEVERITY_OVERRIDE`), todos com `actorId` e `diffJson` corretos. Console do navegador sem erros em nenhum passo.

### Limitações conhecidas / decisões autônomas

- ⚠️ **Sem varredura antivírus/malware no upload** — validação é de tipo (magic number) e tamanho, não de conteúdo malicioso embutido num arquivo do tipo aceito (ex: polyglot files, exploit em parser de imagem). Fora do escopo do MVP por decisão explícita do prompt da fase.
- Máquina de estados de Vulnerability simplificada (4 estados) — REVALIDATION/RISK_ACCEPTED e a bifurcação por `hasRemediation` (RN13/RN14) ficam como trabalho futuro, mesma decisão já tomada pro Project na Fase 4.
- DELETE de Vulnerability é ADMIN-only — não pedido explicitamente, decisão por analogia com a sensibilidade de apagar evidência de auditoria de segurança.
- `npm audit` no backend aponta 4 vulnerabilidades pré-existentes (2 baixas, 2 altas) em dependências de ferramenta (`eslint`/`jest`/`esbuild` transitivos, mais `body-parser` do Express) — nenhuma nova por causa do `multer`, não corrigido nesta sessão (fora do escopo).
- Observação à parte (não é do código do projeto): o `dotenv` 17.x imprime uma linha de "tip" promocional no console a cada carregamento de `.env` (ex: `// tip: ⌘ secrets for agents [www.dotenvx.com]`), incluindo URLs de terceiros. Não afeta funcionalidade nem segurança dos dados do projeto, mas é ruído nos logs de teste — vale considerar `DOTENV_CONFIG_QUIET` ou pin de versão numa sessão de manutenção futura.

### Pendente

- PR `feat/fase-5-findings` → `develop` — Rafael abre manualmente.

## 2026-08-04 (sessão 22 — Fase 4 implementada: Application + Project + ProjectMember)

### Objetivo

Executar a Fase 4 completa (`docs/ROADMAP_PROMPTS.md`): CRUD de Application com gate de plano/assinatura (RN03/RN07), CRUD de Project com máquina de estados mínima e RN05/RN06, ProjectMember (RN08), telas web correspondentes e smoke E2E nos 3 roles. Branch `feat/fase-4-projetos`, seguindo direto da Fase 3 concluída na mesma data.

### Backend

1. **Application** — `models/repositories/services/controllers/factories/routes` completos.
   - `create()`: busca a Subscription ACTIVE da company (404 `USER_HAS_NO_COMPANY` se o actor não tem company; 422 `NO_ACTIVE_SUBSCRIPTION` se não há assinatura ativa); conta applications ativas e compara com `plan.maxApplications` da assinatura (422 `PLAN_LIMIT_REACHED`) — RN03 + RN07.
   - `companyId` nunca sai do DTO — sempre resolvido do `req.user`, mesmo que o body tente mandar um diferente (testado explicitamente).
   - `delete()` é soft delete (`isActive=false`), nunca `DELETE` físico — RN04. Contagem do limite do plano só considera `isActive=true`.
   - URL validada por regex no controller (`INVALID_URL`).
2. **Project** — máquina de estados mínima de 4 estados (`PENDING → IN_PROGRESS → IN_REVIEW → COMPLETED`, com retorno `IN_REVIEW → IN_PROGRESS`) — a mesma simplificação que o schema já documentava como decisão prévia, não a máquina de 7 estados do vault ([[Maquina - Project]], que continua como referência futura). Toda transição grava `AuditLog` `STATUS_CHANGE` com `diffJson` `{from, to}`.
   - RN05 (1-para-1 com Application) e RN06 (`companyId` sempre herdado da Application) — sem `@unique` no schema pra RN05, invariante garantida no service (`findByApplication` + 409 `APPLICATION_ALREADY_HAS_PROJECT`).
   - RN17: `list()`/`getById()`/`transition()` para PENTESTER checam `ProjectMemberRepository.findOne()` — só vê/transiciona projetos onde está atribuído.
   - CLIENT nunca transiciona status (só ADMIN e PENTESTER-membro).
3. **ProjectMember** — subrota `/projects/:projectId/members` (`mergeParams: true`).
   - **Ajuste feito a meio da implementação**: a primeira versão gateava `GET` também com `requireRole("ADMIN")`, seguindo ao pé da letra "só ADMIN gerencia" do prompt. Ao chegar no Checkpoint 5 (frontend), ficou claro que o requisito "Visão geral (metadados + membros, com gestão de membros se ADMIN)" implica que a **leitura** deveria ser visível a qualquer um que pode ver o próprio Project (CLIENT da company, PENTESTER membro, ADMIN) — só a **gestão** (POST/DELETE) é exclusiva de ADMIN. Corrigido: `ProjectMemberService.list()` passou a receber o actor e aplicar a mesma checagem de visibilidade do `ProjectService` (RN16/RN17); só `POST`/`DELETE` mantêm `requireRole("ADMIN")` na rota.
   - Alvo precisa ter `role=PENTESTER` (400 `USER_NOT_PENTESTER`); par único (409 `MEMBER_ALREADY_EXISTS`).

### Testes

20 novos: `application.test.ts` (6 — APP-01..04 + TEN-01/02 combinado + TEN-03), `project.test.ts` (11 — PROJ-01..09 + TEN-04/05, os PROJ-06..09 adicionados depois pra cobrir list/getById/update como CLIENT/ADMIN que a primeira rodada de cobertura não pegava), `project-member.test.ts` (3 — MEMBER-01..03). Total 51/51. Cobertura de linha: `application.service.ts` 85.4%, `project.service.ts` 100% (subiu de 66.6% depois de completar os casos de CLIENT/ADMIN em list/getById/update), `project-member.service.ts` 100%.

### Frontend

`ApplicationsPage` (tabela + filtro + modal "Nova aplicação" + soft-delete com confirmação + erro `PLAN_LIMIT_REACHED` customizado mostrando o número do limite e o nome do plano — não é só a mensagem genérica do `useApiError`), `NewAnalysisPage` (wizard 4 passos: aplicação → tipo → nível/escopo → remediação, pré-seleciona a aplicação via `?applicationId=`), `ProjectsPage` (lista, degrada graciosamente pra PENTESTER que não pode buscar nomes de Application), `ProjectDetailPage` (breadcrumb company→app→projeto, badge + botões de transição espelhando a máquina do backend, abas Visão geral/Findings/Relatórios com as duas últimas como placeholder, gestão de membros condicionada a `role === "ADMIN"`). Sidebar com "Aplicações" (ADMIN/CLIENT) e "Projetos" (todos).

Nota sobre o tipo de análise: o prompt do frontend dizia "tipo (PENTEST/DAST/SAST)", mas `analysisType` no schema é `SAST | DAST | MATURITY | COMBO` — sem "PENTEST". Seguido o schema (fonte de verdade), com os 4 valores reais no wizard.

### Smoke E2E (navegador real, backend+frontend rodando)

Login CLIENT (TechNova, seed) → Aplicações → criar aplicação → contador de limite do plano PRO correto → wizard Nova Análise completo (4 passos, aplicação pré-selecionada) → ProjectDetail com breadcrumb e metadados corretos, sem controles de transição/gestão de membros pro CLIENT. Login ADMIN → transição PENDING→IN_PROGRESS→IN_REVIEW pela UI (badge e botões corretos a cada passo) → atribuir pentester via select (usado `form_input` depois que o clique simulado em `<select>` nativo não registrou a opção). Login PENTESTER (criado direto no banco pra teste) → sidebar sem "Aplicações"/"Aprovações" → `/projects` mostra só o projeto atribuído (RN17 confirmada visualmente) → ProjectDetail com breadcrumb degradado ("Empresa" genérico, já que ele não pode resolver o nome real) → transição própria funciona. Empresa de teste extra no plano BASIC pra confirmar visualmente a mensagem "Limite de 2 aplicações do plano BASIC atingido...". Todos os dados de teste limpos do banco de dev ao final.

### Limitações conhecidas / decisões autônomas

- PENTESTER não gerencia (nem lista) Applications diretamente — decisão por analogia com RN17, não estava explícito no prompt pra esse recurso.
- Sem `DELETE` para Project — não pedido explicitamente, e não faz sentido de produto apagar um engagement em andamento.
- Durante os testes manuais, processos `vite`/`node` órfãos de sessões anteriores ficaram presos em portas (3000/3001), causando um `404` intermitente na API por colisão de porta — resolvido identificando via `netstat` e matando via `taskkill`. Não é bug de código, é higiene de ambiente local.

### Pendente

- PR `feat/fase-4-projetos` → `develop` — Rafael abre manualmente.

## 2026-08-04 (sessão 21 — Fase 3 implementada: Company + Plan + Subscription + bootstrap web)

### Objetivo

Executar a Fase 3 completa (`docs/ROADMAP_PROMPTS.md`) em modo solo-delegado (`CLAUDE.md` §0.2): refactor de pastas pro plural, backend de Company/Plan/Subscription, bootstrap do `app/web` do zero e as 3 telas da fase. Branch `feat/fase-3-empresas`.

### Achado que corrige o diagnóstico da sessão 20

A sessão 20 (mesmo repositório, 2026-07-26) tinha concluído que o projeto estava "na prática na Fase 0/1", com apenas 9 models no schema e arquivos de código vazios — e recomendou refazer tudo em Express do zero. **Isso não era mais verdade no momento desta sessão**: o `schema.prisma` já tinha os 19 models completos do domínio, `Company`/`Plan` já eram CRUDs reais e funcionais (só sem auth aplicada), e a estrutura de pastas já estava com bastante trabalho feito — só ainda no singular. O Checkpoint 0 desta sessão (auditoria antes de escrever qualquer código, conforme `CLAUDE.md` §0.2 S2) confirmou isso comparando com o código real, não com o vault. Registrando aqui pra não repetir o mesmo diagnóstico desatualizado numa sessão futura — **sempre confirme no código antes de confiar num changelog anterior.**

### Checkpoints executados

1. **Auditoria** — confirmou schema completo (19 models), Company/Plan como CRUDs reais (não stubs), ausência de `require-role`/`Subscription`/`AuditLog`. `npm run check` falhava só por Docker/MySQL não estarem no ar — não por código quebrado.
2. **Refactor pro plural** — `controller/model/repository/service/factory/middleware` → plural, via `git mv` (preserva histórico), imports corrigidos em 19+ arquivos, `docs/architecture.md` atualizado. `config/` e `database/` mantidos singular (ADR-009). Build e testes idênticos antes/depois.
3. ~~Schema completo~~ — pulado, schema já estava completo (ver "Achado" acima).
4. **Backend**:
   - `middlewares/require-role.middleware.ts` — `requireRole(...roles)`, 403 FORBIDDEN.
   - `repositories/audit-log.repository.ts` — append-only, `create()` conforme os campos reais do schema (`actorId`, `entityType`, `diffJson: String?`).
   - **Subscription** completa (model, repository, service, controller, factory, routes) — `request`/`listPending`/`getCurrent`/`approve`/`reject`. Regra de ouro (1 ACTIVE por company) validada no `request` **e de novo no `approve`**, porque o estado pode mudar entre os dois.
   - **Plan** — unicidade de nome (`PLAN_ALREADY_EXISTS`), rotas com GET público e POST/PUT/DELETE `authMiddleware + requireRole("ADMIN")`.
   - **Company** — criador vira dono (`User.companyId` + `companyRole="OWNER"` setados na criação), CNPJ único com regex de formato (14 dígitos ou máscara, sem dígito verificador), `GET /companies/me`, escopo CLIENT (só a própria) / ADMIN (todas) resolvido no service.
   - `prisma/seed.ts` corrigido: plano `PRO_PLUS` → `Enterprise`.
   - **CORS habilitado na API** (não estava no prompt original — bug bloqueante descoberto ao montar o cliente Axios do frontend; ver [[ADR-020 - Stack final do frontend web e CORS]]).
5. **Testes** — 18 testes novos (`plan.test.ts`, `company.test.ts`, `subscription.test.ts`, prefixos PLAN/COMP/SUB + canários TEN-01/TEN-02 de tenancy), 3 fixtures novas. Total 31/31 passando. Cobertura de linha nos 3 services novos: 100% (plan), 100% (subscription), 94.7% (company).
6. **Bootstrap do `app/web`** — do zero: Vite + React 18 + TS + Tailwind + Radix + TanStack Query + Zustand + Axios. Cliente Axios com interceptor de refresh + fila de requests concorrentes. Zustand auth store com `persist`. `useApiError` mapeando os códigos SCREAMING_SNAKE do backend (que usa `{code}` em alguns controllers e `{error}` em outros — o hook lê os dois) pra PT-BR. Componentes base (Button/Input/Label/Card/Alert/Dialog).
7. **Telas da Fase 3** — `PlansPage` pública (3 cards, plano com `price=0` mostra "Sob consulta"), `OnboardingPage` (wizard 3 passos só com `useState`, cria Company + Subscription em sequência), `PendingSubscriptionsPage` (admin-only, TanStack Query, aprovar/rejeitar com modal Radix Dialog e invalidação automática da lista). Sidebar com item "Aprovações" visível só pra ADMIN.
8. **Smoke E2E real** — feito com navegador de verdade (Chrome via extensão), não só roteiro em texto: `/plans` deslogado → registro → onboarding cria Company+Subscription → dashboard sem "Aprovações" pro CLIENT → login admin → "Aprovações" aparece → aprovar via modal → lista atualiza sozinha → CLIENT tentando `/admin/subscriptions` direto por URL é redirecionado → console sem erros.

### Decisões registradas

- [[ADR-020 - Stack final do frontend web e CORS]] — SPA Vite (não Next.js App Router), Radix direto (não shadcn CLI), TanStack Query + Zustand juntos, CORS habilitado.

### Correção de documentação

- [[Front-end Web React]] e [[Estrutura - Web React]] — corrigidas: ainda descreviam Next.js App Router, `shadcn/ui` CLI e Socket.IO/Recharts como se fossem a stack real; adicionado callout apontando a estrutura de fato implementada.

### Limitações conhecidas / decisões autônomas (S3 — não-irreversíveis, decididas e documentadas)

- `PendingSubscriptionsPage` resolve nome de empresa/plano com duas chamadas extras (`GET /companies`, `GET /plans`) em vez de um endpoint que já devolva os nomes — aceitável no volume da Fase 3.
- Onboarding não valida formato de CNPJ no client, só no submit (resposta da API) — simplicidade proposital.
- `GET /companies` e `GET /companies/:id` ficaram admin-only; CLIENT usa só `/me`. Não há endpoint de listagem para CLIENT (não haveria uso: isolamento multi-tenant).

### Pendente

- PR `feat/fase-3-empresas` → `develop` — o Rafael abre manualmente (mensagem de PR sugerida no relatório de encerramento da sessão).
- Branch `feat/sprint-2-auth-user` (Auth+User backend) continua sem merge — bloqueio pré-existente, não criado nesta sessão.

## 2026-07-26 (sessão 20 — auditoria de código real vs vault)

### Objetivo

Comparar o que o vault afirmava sobre o estado do projeto (3 de 9 fases concluídas, Auth+User pronto, schema com 19 models) com o código real em `Vulnera-TCC/`, a pedido do Rafael, antes de iniciar qualquer implementação nova.

### Achado principal

A sessão 19 (mesma data) reescreveu o vault para declarar a stack Express/MySQL e marcar as Fases 0–2 como concluídas, mas **não verificou o código real**. No mesmo dia, o commit `654fd80 refactoring` **apagou** a implementação NestJS funcional que existia em `Vulnera/apps/api/` — a mesma descrita nas sessões 16, 17 e 18 deste changelog (Auth com JWT+bcrypt, Users, Companies, Plans, Subscriptions, Applications, Projects, guards, middlewares) — e a substituiu pelo esqueleto `Vulnera-TCC/app/api/`, que ficou incompleto.

### Estado real encontrado em `Vulnera-TCC/`

- `app/api/prisma/schema.prisma` — real, **9 models** (User, Company, Plan, Subscription, RefreshToken, PasswordResetToken, Application, Project, ProjectMember). Faltam os outros 10 do modelo-alvo do vault (Vulnerability, Evidence, VulnerabilityComment, AuditLog, Notification, Report, MaturityDomain, MaturityControl, MaturityAssessment, MaturityScore) — o próprio schema documenta isso como "Onda 5+".
- `app/api/src/config/` — real (`EnvVar.ts`, `EnvKeys.ts`).
- `app/api/src/{controller,model,repository,routes,service}/user.*` — **todos com 0 bytes** (arquivos criados, nunca escritos).
- `app/api/src/server.ts` — **0 bytes**. A API não sobe.
- Sem `middlewares/`, `utils/`, `database/` — não existe auth, JWT, bcrypt, hash de senha, require-role em lugar nenhum do código.
- Sem nenhum arquivo de teste (`*.test.ts`/`*.spec.ts`).
- Sem `docker-compose` em qualquer lugar do repositório.
- Sem `prisma/migrations/` e sem `prisma/seed.ts`.
- `app/web/` e `app/mobile/` — cada um só tem um `package.json` mínimo, sem `src/` nem nenhuma dependência de React/Expo instalada.
- Convenção de pastas real é **singular** (`controller/`, `model/`, `repository/`, `service/`), divergindo do plural exigido por [[ADR-009 - Pastas no plural e cadeia de camadas]] — e também divergindo do `docs/architecture.md` do próprio repositório, que documenta uma terceira variante mista.

### Diagnóstico

O projeto está, na prática, na **Fase 0/1 (Fundação)**, não na Fase 3. A única fase com trabalho substancial já foi apagada pela migração de stack e precisa ser refeita em Express. `schema.prisma` é o único artefato realmente avançado.

### Correções aplicadas nesta sessão

- [[Contexto Mestre v4]] — tabela "Prazo e estado" corrigida (Progresso, Fase atual) + callout de divergência
- [[Roadmap Fases]] — Fases 1 e 2 alteradas de "✅ concluída" para "⚠️ retrabalho"; Fase 3 marcada como bloqueada; callout com o achado completo

### Pendente (não resolvido nesta sessão)

- Decidir se a implementação NestJS apagada em `654fd80` deve ser recuperada do histórico do git (`git show 654fd80^:Vulnera/apps/api/...`) como base para o retrabalho em Express, ou se o retrabalho parte do zero.
- F-01, F-02, F-03 continuam em aberto — não resolvidos aqui.
## 2026-07-26 (sessão 19 — refatoração do vault para a stack Express + prazo de 3 meses)

### Objetivo

Alinhar o vault inteiro às decisões vigentes registradas no `VULNERA_MASTER.md` do repositório, criando a nota [[Contexto Mestre v4]] como fonte de maior autoridade e corrigindo a stack documentada, que ainda descrevia o projeto original em NestJS.

### Stack — substituições aplicadas em todo o vault

| De | Para |
|---|---|
| NestJS | Express |
| PostgreSQL 16 | MySQL 8 |
| Next.js | React + Vite |
| `@react-pdf/renderer` | `pdf-lib` |
| `PRO_PLUS` | `Enterprise` |
| Turborepo | npm workspaces |
| Guards / `CanActivate` | middlewares + ownership no service |
| Exceptions do Nest | string-códigos SCREAMING_SNAKE |

### Notas renomeadas

- `Back-end NestJS` → [[Back-end Express]]
- `Banco de Dados PostgreSQL` → [[Banco de Dados MySQL]]
- `Front-end Web Nextjs` → [[Front-end Web React]]
- `Guards e Ownership` → [[Middlewares e Ownership]]
- `Estrutura - API NestJS` → [[Estrutura - API Express]]
- `Estrutura - Web Nextjs` → [[Estrutura - Web React]]

### Notas reescritas do zero

- [[Visao Geral]] — diagrama, fluxo de requisição e integrações
- [[Middlewares e Ownership]] — divisão entre verificação grossa (middleware) e fina (service)
- [[Back-end Express]] — estrutura de pastas no plural
- [[Roadmap Fases]] — recalculado para 13 semanas

### Escopo cortado

Marcadas com `status: fora-de-escopo`, preservadas como histórico: [[ChatMessage]], [[SupportTicket]], [[Maquina - SupportTicket]], [[Chat e Comentarios]], [[Tickets]], [[WebSocket e Tempo Real]], [[Email SMTP]], [[Prometheus]], [[Grafana]], [[Observabilidade]], [[Enum - TicketStatus]].

Os models `ChatMessage` e `SupportTicket` já não existiam no `schema.prisma` — o vault estava documentando entidades inexistentes.

### Decisões registradas

- [[ADR-009 - Pastas no plural e cadeia de camadas]] — inverte a convenção de singular
- [[ADR-010 - Factory Method pendente de confirmacao]] 🚩 — pendência de maior impacto
- [[ADR-011 - Provedor de IA em revisao]] 🚩
- [[ADR-012 - SonarQube como pipeline separado]] — sai do Docker Compose
- [[ADR-013 - Dominios de maturidade em aberto]] 🚩
- [[ADR-014 - Escopo reduzido para prazo de 3 meses]]
- [[ADR-015 - MySQL definitivo]] — substitui o ADR-008

### Colisão de roadmap resolvida

O vault tinha um cronograma de **28 semanas com 9 fases** cuja numeração conflitava com a do repositório: a "Fase 3" do vault era Comunicação (chat, tickets, e-mail) enquanto a do repositório é Plan + Company + Subscription; a "Fase 7" do vault era Observabilidade, no repositório é Mobile + IA.

Numeração unificada pela do repositório. O cronograma de 28 semanas foi substituído por um de 13 semanas.

### Hierarquia documental revisada

`[[vulnera]]` e `[[Fonte Original - MVP Vulnera]]` deixam de ser referência de implementação e passam a ser **material histórico** para a monografia. A autoridade é [[Contexto Mestre v4]].

---

## 2026-05-18 (sessão 18 — Onda 4 arquitetada: Applications + Projects + ProjectMember)

### Objetivo

Escrever — **sem executar nenhum comando** — o código da Onda 4: Applications e Projects (com membros), aplicando o `ActiveSubscriptionGuard` da Onda 3 e materializando as regras de negócio RN03 (limite por plano), RN05 (1:1 Project-Application), RN06 (Project herda Company), RN07 (assinatura ativa), RN08 (N pentesters por Project), RN16 (escopo CLIENT), RN17 (escopo PENTESTER).

### Schema (`apps/api/prisma/schema.prisma`)

Três novos models adicionados ao final do arquivo, com back-relations no `User` e `Company`:

- **Application** — `id (cuid)`, `name`, `description?`, `companyId`, timestamps. Back-relation `Company.applications`. Relação 1-para-1 com `Project` (back-relation `project Project?`). Índice `[companyId]`.
- **Project** — `id (cuid)`, `name`, `applicationId @unique` (RN05), `companyId` (denormalizado conforme RN06), `status String @default("PENDING")`, `remediationService Boolean @default(false)`, timestamps. Relações com `Application`, `Company`, `ProjectMember[]`. Índices `[companyId]` e `[status]`.
- **ProjectMember** — `id (cuid)`, `projectId`, `userId`, `createdAt`. `@@unique([projectId, userId])` + índices nos dois campos. `onDelete: Cascade` no `projectId` (remoção do Project zera vínculos). Back-relation `User.projectMembers`.

### Módulo `applications/`

- `applications.module.ts` — importa `SubscriptionsModule`; registra `ActiveSubscriptionGuard` como provider local (precisa de `Reflector` + `SubscriptionsService` via DI).
- `applications.repository.ts` — `findAll`, `findById` (com `include project`), `findByCompany`, `countByCompany` (usado por RN03), `create`, `update`, `delete`.
- `applications.service.ts`:
  - `findAccessible(user)`: ADMIN vê todas, CLIENT vê da sua company, PENTESTER recebe `throw new Error("FORBIDDEN")`.
  - `findById` valida ownership via `assertCanAccessApplication` (RN16).
  - `create`:
    - CLIENT só cria na própria company; ADMIN pode em qualquer empresa.
    - busca a Subscription ACTIVE da company (defesa em profundidade — o middlewares já bloqueou se inativa).
    - busca o `Plan` da Subscription e compara `countByCompany` com `plan.maxApplications` — **RN03** (lança `throw new Error("<ENTITY>_LIMIT_REACHED")` com mensagem citando o plano e o limite).
  - `delete` lança `throw new Error("<ENTITY>_ALREADY_EXISTS")` se houver `Project` vinculado (preserva integridade do RN05 sem cascade).
- `applications.controller.ts`:
  - `RolesGuard` + `ActiveSubscriptionGuard` no controller; rota a rota controla via `@Roles` e `@RequiresActiveSubscription`.
  - `GET /applications` e `GET /:id` — `@Roles(Role.ADMIN, Role.CLIENT)`.
  - `POST /applications` — `@Roles(Role.ADMIN, Role.CLIENT) + @RequiresActiveSubscription()`.
  - `PATCH /:id` e `DELETE /:id` — `@Roles(Role.ADMIN)`.
- DTOs: `create-application.dto.ts` (name, description?, companyId), `update-application.dto.ts`.

### Módulo `projects/`

- `projects.module.ts` — análogo ao Applications: importa `SubscriptionsModule` e provê `ActiveSubscriptionGuard`.
- `projects.repository.ts`:
  - `findAll`, `findById` (com `application + members`), `findByCompany`, `findByMember(userId)` (RN17), `findByApplication`, `create`, `update`, `updateStatus`.
  - Membros: `findMembers` (inclui User), `findMember`, `addMember`, `removeMember`, `isMember`.
- `projects.service.ts`:
  - `findAccessible(user)` separa por role: ADMIN → todos, CLIENT → company, PENTESTER → `findByMember(sub)`.
  - `findById` aplica `assertCanAccessProject` (RN16 para CLIENT, RN17 para PENTESTER).
  - `create`:
    - busca `Application` por id; falha 422 se não existir.
    - **RN05** — bloqueia com `throw new Error("<ENTITY>_ALREADY_EXISTS")` se já existir Project para essa Application (`findByApplication`).
    - **RN07** — `subscriptionsService.isActive(application.companyId)` (defesa em profundidade).
    - **RN06** — `companyId` é forçado para `application.companyId`; nunca aceito do payload.
    - status inicial: `"PENDING"`. Pentesters NÃO são adicionados aqui (entram via `POST /:id/members`) — **RN08**.
  - `update` bloqueia PENTESTER em metadados (ele só pode mover status).
  - `updateStatus` — máquina mínima da Onda 4:
    - tabela `ALLOWED_TRANSITIONS`: `PENDING → IN_PROGRESS`, `IN_PROGRESS → IN_REVIEW`, `IN_REVIEW → {COMPLETED, IN_PROGRESS}`, `COMPLETED → ∅`.
    - ADMIN pode forçar qualquer transição (RN15).
    - PENTESTER só pode `PENDING→IN_PROGRESS` e `IN_PROGRESS→IN_REVIEW`.
    - CLIENT recebe `throw new Error("FORBIDDEN")`.
  - `addMember`:
    - `target.role` deve ser `PENTESTER` (**RN08**).
    - duplicação bloqueada (constraint UNIQUE no schema + check no service).
- `projects.controller.ts`:
  - `RolesGuard` + `ActiveSubscriptionGuard` no controller.
  - `GET /projects` e `GET /:id` aceitam as três roles; filtragem feita no service.
  - `POST /projects` — `@Roles(Role.ADMIN) + @RequiresActiveSubscription()`.
  - `PATCH /:id` e `PATCH /:id/status` — `@Roles(Role.ADMIN, Role.PENTESTER)`.
  - `GET /:id/members` — todas as roles autorizadas via service.
  - `POST /:id/members` e `DELETE /:id/members/:userId` — `@Roles(Role.ADMIN)`.
- DTOs: `create-project.dto.ts` (name, applicationId, remediationService?), `update-project.dto.ts`, `update-project-status.dto.ts` (com `ProjectStatus` exportado), `add-project-member.dto.ts`.

### Outros arquivos

- `src/app.module.ts` — `ApplicationsModule` e `ProjectsModule` importados.
- `SubscriptionsModule` já exportava `SubscriptionsService` desde a Onda 3 — nenhuma mudança necessária.

### Divergências do vault (registrar e revisar antes da Onda 5+)

1. **Máquina de estados mínima do Project** — o vault [[Maquina - Project]] define 7 estados (`REQUESTED → TRIAGE → PLANNED → IN_PROGRESS → IN_REVIEW → DELIVERED → CLOSED`), e o [[Fluxo - Abertura de Projeto]] usa TRIAGE e PLANNED. Esta Onda 4 implementou uma máquina mínima de 4 estados (`PENDING → IN_PROGRESS → IN_REVIEW → COMPLETED`) por instrução explícita da sessão. Marcação `PENDING` no schema é equivalente operacional ao `REQUESTED` do vault. A máquina formal será expandida na Onda 5+ junto com o fluxo completo de triagem e atribuição.
2. **`Application.applicationId @unique` no Project** — implementa a regra estrita 1:1 do RN05 e do ADR-002. Isso impede o "reuso" da Application em vários Projects ao longo do tempo mencionado em [[RN04 - Application pertence a uma unica Company]]. Decisão: priorizar a leitura estrita do RN05/ADR-002 — uma Application = um Project. Se o time decidir permitir reuso após `CLOSED`, basta remover `@unique` e adicionar regra "no máximo 1 Project ativo por Application" na camada de serviço.
3. **Campos do vault não modelados nesta onda** — `Application.url`, `environment`, `tech_stack`, `is_active`, `Project.analysis_type`, `analysis_level`, `scope_in`, `scope_out`, `notes`, `requested_at`, `started_at`, `closed_at` ficaram fora. Razão: o pedido da sessão definiu apenas `name`/`description` e `name`/`applicationId`/`remediationService`. Campos adicionais entram na Onda 5+ junto com o fluxo completo. Documentação canônica permanece a fonte de verdade.

### Limitações conhecidas (aguardando ambiente)

- nada executado: nenhum `npm install`, `prisma generate`, `prisma migrate`, ou teste
- `Prisma.ProjectCreateInput`, `Prisma.ApplicationCreateInput` e `Prisma.ProjectMember*` só existem após `prisma generate` — erros de TypeScript reais só aparecem nesse ponto

### Próximos passos

1. Onda 5 — Vulnerabilities + Evidence + VulnerabilityComment (core de findings)
2. Expandir máquina de estados do Project para os 7 estados do vault
3. Onda 6+ — Maturidade, Relatórios, Notifications/SMTP (resolve RN22 como envio real)

## 2026-05-18 (sessão 17 — Onda 3 arquitetada: Plans + Companies expandido + Subscriptions)

### Objetivo

Escrever — **sem executar nenhum comando** — o código da Onda 3 (camada comercial). Plans com CRUD básico, Companies com gestão de membros e ownership, Subscriptions com criação/aprovação e o middlewares que materializa a [[RN07 - Projeto exige assinatura ativa]] para uso pelas Ondas 4+.

### Arquivos criados em `apps/api/src/modules/plans/`

- `plans.module.ts`
- `plans.repository.ts` — `findAll` (ordenado por preço asc), `findById`, `create`
- `plans.service.ts` — wrapper com `throw new Error("<ENTITY>_NOT_FOUND")` no `findById`
- `plans.controller.ts` — `GET /plans` e `GET /plans/:id` com `@Public()` (página de pricing); `POST /plans` com `@Roles(Role.ADMIN)` e `RolesGuard` local
- `dto/create-plan.dto.ts` — `name` (min 2 / max 60), `maxApplications` (Int ≥ 1), `price` (Number ≥ 0, 2 casas decimais)

### Arquivos expandidos em `apps/api/src/modules/companies/`

- `companies.repository.ts` — adicionados `findAll`, `update`, `findMembers`, `addMember(companyId, userId, companyRole)` (força `role = CLIENT`), `removeMember(userId)` (limpa companyId + companyRole)
- `companies.service.ts` — reescrito:
  - injeta `PrismaService` para transações
  - `findAll` ADMIN-only (proteção no controller)
  - `findById` valida ownership: ADMIN passa; CLIENT/PENTESTER só passa se `user.companyId === company.id` — [[RN16 - Cliente so ve dados da propria Company]]
  - `create` em `$transaction`: cria Company **e** Subscription ACTIVE com o `planId` informado
  - `update` valida planId quando alterado
  - `addMember` checa que o `target.companyId` não está preenchido em outra empresa — [[RN02 - Usuario pertence a no maximo uma Company]]
  - `removeMember` zera companyId e companyRole
- `companies.controller.ts` — novo: `GET /companies`, `GET /companies/:id`, `POST /companies`, `PATCH /companies/:id`, `GET /companies/:id/members`, `POST /companies/:id/members`, `DELETE /companies/:id/members/:userId`; `RolesGuard` aplicado ao controller; rotas de leitura para CLIENT delegam ownership ao service
- `companies.module.ts` — controller registrado
- `dto/create-company.dto.ts`, `dto/update-company.dto.ts`, `dto/add-member.dto.ts`

### Arquivos criados em `apps/api/src/modules/subscriptions/`

- `subscriptions.module.ts`
- `subscriptions.repository.ts` — `findByCompany`, `findActiveByCompany` (`status = ACTIVE`, mais recente), `findById`, `create`, `updateStatus`
- `subscriptions.service.ts`:
  - `isActive(companyId)` — usado pelo `ActiveSubscriptionGuard`
  - `create` valida existência de Company e Plan; ao criar com `PENDING_APPROVAL`, **loga** intenção de notificar Admin (ponto de extensão para [[RN22 - Nova assinatura notifica Admin]] quando NotificationsModule e SMTP entrarem na Onda 5+)
  - `updateStatus` lança `throw new Error("<ENTITY>_NOT_FOUND")` se a Subscription não existir; máquina de estados fica para a Onda 5+ (não implementada agora)
- `subscriptions.controller.ts` — `@Roles(Role.ADMIN)` no nível do controller; rotas: `GET /subscriptions/company/:companyId`, `GET /subscriptions/company/:companyId/active`, `POST /subscriptions`, `PATCH /subscriptions/:id/status`
- `dto/create-subscription.dto.ts` (com tipo `SubscriptionStatus` reusável), `dto/update-subscription-status.dto.ts`

### middlewares de RN07

- `src/common/decorators/requires-active-subscription.decorator.ts` — `@RequiresActiveSubscription()`
- `src/common/middlewares/active-subscription.middlewares.ts` — Reflector lê o flag; ADMIN passa sempre; demais roles passam apenas se `SubscriptionsService.isActive(user.companyId) === true`; senão `throw new Error("FORBIDDEN")` com mensagem citando RN07
- Será aplicado pontualmente em `ApplicationsController.create` e `ProjectsController.create` (Onda 4). NÃO foi registrado como `APP_GUARD` global — só rotas que mexem em recursos sujeitos à RN07 devem usá-lo.

### Outras mudanças

- `src/common/decorators/roles.decorator.ts` — adicionada constante `Role` (`{ ADMIN, PENTESTER, CLIENT }`) para suportar a sintaxe `@Roles(Role.ADMIN)` requisitada nesta sessão; o tipo `AppRole` continua sendo a fonte de verdade
- `src/app.module.ts` — `PlansModule` e `SubscriptionsModule` importados
- `prisma/schema.prisma` — sem mudanças nos models; adicionado `@@index([companyId, status])` em `Subscription` para otimizar `findActiveByCompany`. Relacionamentos User↔Company, Company↔Plan, Company↔Subscription, Plan↔Subscription já estavam completos desde a Onda 2.

### Divergências e pontos a observar

- **Nenhum endpoint público de “solicitar assinatura” foi criado nesta onda.** O documento [[Assinaturas]] descreve o fluxo "cliente solicita plano → admin aprova", mas como o módulo de fluxo inicial (onboarding com criação de Subscription `PENDING_APPROVAL` pelo próprio cliente) ainda não foi modelado em controllers para CLIENT, fica para a próxima onda. O `POST /subscriptions` atual é ADMIN-only e cobre criação manual + transição.
- **RN22 fica como log por enquanto** — o efeito real (e-mail + Notification in-app) depende da Onda 5+. O ponto de extensão está marcado no service.
- **Máquina de estados de Subscription não está implementada** — `PATCH /subscriptions/:id/status` aceita qualquer transição válida do enum hoje. Quando a máquina formal de estados de [[Maquina - Subscription]] for implementada, este controller será o ponto de entrada.

### Limitações conhecidas (aguardando ambiente)

- nada executado: nenhum `npm install`, `prisma generate`, `prisma migrate`, ou teste
- toda a validação de tipos depende de `prisma generate` para a sintaxe `Prisma.UserCreateInput`, etc.; portanto erros de TypeScript só aparecem após o `npm install + db:generate`

### Próximos passos

1. Onda 4 — Applications + Projects (consumindo `ActiveSubscriptionGuard` e RN03)
2. Onda 5+ — Notifications/SMTP + máquina formal de Subscription

## 2026-05-18 (sessão 16 — Onda 2 arquitetada: Auth + Users + Companies)

### Objetivo

Escrever — **sem executar nenhum comando** — todos os arquivos de código da Onda 2 (autenticação, usuários, empresas, planos e assinaturas no nível de schema). O ambiente local não tem Docker, MySQL nem MySQL; o código fica pronto para `npm install` + `prisma migrate dev` quando o ambiente estiver disponível.

### Decisão estrutural

`ADR-008 - MySQL temporário com migração planejada para MySQL` registrado. Resumo:
- `datasource db` em `schema.prisma` ficou com `provider = "mysql"` por limitação do ambiente
- não usamos features exclusivas do MySQL (sem `@db.Uuid`, sem enums nativos)
- "enums" do domínio (`Role`, `CompanyRole`, `SubscriptionStatus`) são `String` validados em camada TypeScript / class-validator
- migração futura para MySQL: trocar `provider` + `DATABASE_URL` + `prisma migrate dev` em ambiente limpo

### Arquivos criados/modificados em `apps/api/`

**prisma/**
- `schema.prisma` — datasource MySQL; models `User`, `Company`, `Plan`, `Subscription`, `RefreshToken`, `PasswordResetToken` com índices e cascade nos tokens
- `seed.ts` — 1 Plan Basic (maxApplications=3, price=0), 1 Demo Company, 1 Subscription ACTIVE, 3 Users (`admin@`, `pentester@`, `client@vulnera.local`); senha de todos `Vulnera@2025` via hash bcrypt **placeholder** (substituir antes de rodar)

**configuração**
- `.env.example` — `DATABASE_URL` MySQL; comentário com receita de migração para MySQL
- `package.json` — adicionado `cookie-parser`, `@types/cookie-parser`, `@types/express`

**src/main.ts**
- `cookieParser()` registrado (refresh token via cookie HttpOnly)
- `HttpExceptionFilter` global

**src/app.module.ts**
- `AuthModule`, `UsersModule`, `CompaniesModule` importados
- `JwtAuthGuard` registrado como `APP_GUARD` global — todas as rotas exigem auth por padrão; rotas anotadas com `@Public()` ficam abertas

**src/common/**
- `decorators/public.decorator.ts`, `roles.decorator.ts`, `current-user.decorator.ts`
- `middlewares/jwt-auth.middlewares.ts` — respeita `@Public()`
- `middlewares/roles.middlewares.ts` — via `Reflector`
- `filters/http-exception.filter.ts` — `{ statusCode, message, timestamp, path }`; sem stack trace; loga 5xx via `Logger`

**src/modules/auth/**
- `auth.module.ts` — `JwtModule.registerAsync` com `JWT_SECRET` via `ConfigService`, `expiresIn` `JWT_EXPIRES_IN` (default 15m); `PassportModule`
- `auth.controller.ts` — `POST /auth/login` (rate 5/min), `/refresh`, `/logout`, `/forgot-password` (rate 3/min), `/reset-password`; refresh token via cookie `httpOnly + secure(prod) + sameSite=strict`
- `auth.service.ts` — bcrypt cost 12; access JWT 15m; refresh 64 bytes aleatórios armazenado como SHA-256, TTL 7d, **rotação obrigatória** no `/refresh`; forgot/reset com hash SHA-256 e TTL 30min; reset revoga todas as sessões ativas do usuário
- `strategies/jwt.strategy.ts` — Bearer no header; payload `{ sub, email, role, companyId }`
- `dto/` — `LoginDto`, `RegisterDto`, `RefreshTokenDto`, `ForgotPasswordDto`, `ResetPasswordDto`

**src/modules/users/**
- `users.module.ts`, `users.service.ts`, `users.repository.ts` — `findById`, `findByEmail`, `existsByEmail`, `create`, `updatePassword`. Sem controller no MVP.

**src/modules/companies/**
- `companies.module.ts`, `companies.service.ts`, `companies.repository.ts` — `findById`, `create`, `findByPlan`. Sem controller no MVP.

### Divergências do vault (registrar e justificar)

- `User.password` (vault canônico usa `passwordHash`) — mantido como `password` por solicitação explícita da sessão; o conteúdo é o hash bcrypt. Sem impacto de segurança.
- `Company.planId` direto na tabela `Company` (vault liga Plan a Company **apenas via Subscription**) — mantido por solicitação explícita; representa o "plano atual" denormalizado. Subscription continua sendo a fonte de verdade do ciclo comercial.
- Esses dois pontos não introduzem regra de negócio nova — são apenas opções de modelagem que podem ser revisadas antes da migração para MySQL.

### Limitações conhecidas (aguardando ambiente)

- nada foi executado: nem `npm install`, nem `prisma generate`, nem `prisma migrate dev`, nem testes
- hash bcrypt do seed é **placeholder** — substituir antes do primeiro seed
- `bcrypt` (módulo nativo) requer toolchain de build no Windows — `bcryptjs` é alternativa puramente JS se houver problema na instalação
- SMTP não configurado — `forgot-password` apenas loga o link de reset; aceito por enquanto

### Próximos passos (quando o ambiente estiver pronto)

1. `npm install` na raiz e em `apps/api/`
2. `docker compose -f infra/docker-compose.yml up -d` (ou MySQL/MariaDB local)
3. atualizar `DATABASE_URL` em `apps/api/.env`
4. gerar hash bcrypt real e substituir o placeholder em `prisma/seed.ts`
5. `npx prisma migrate dev --name init-auth`
6. `npx prisma db seed`
7. testar `POST /api/auth/login` com `admin@vulnera.local` / `Vulnera@2025`

## 2026-04-27 (sessão 13 — estrutura do projeto de código)

### Área preenchida: 04-Arquitetura/Estrutura do projeto

Confirmado preenchimento e corrigido problema na pasta `04-Arquitetura/Estrutura do projeto/` (10 arquivos):

- `Estrutura Geral do Monorepo.md` — visão macro do repositório; papel de `.github/`, `apps/`, `packages/`, `infra/`, `docs/`; regras de uso pelo Claude
- `Estrutura - API Express.md` — módulos por domínio (14 módulos); padrão por módulo (module, controller, service, dto, spec); `common/` (middlewares, decorators, filters, interceptors); `config/`, `database/`, `prisma/`, `uploads/`; regras críticas e segurança obrigatória
- `Estrutura - Web React.md` — grupos de rota App Router por perfil ((public), (admin), (pentester), (client)); `components/` por domínio; `lib/api`, `lib/hooks`, `lib/store`; considerações de segurança no front-end
- `Estrutura - Mobile Expo.md` — escopo read-mostly para CLIENT; Expo Router com (auth) e (app); `services/`, `store/`, `hooks/`; o que o mobile não deve ter no MVP
- `Estrutura - Packages Compartilhados.md` — `packages/types`, `packages/validators`, `packages/utils`; critério do que vai para packages vs o que fica no app
- `Estrutura - Infraestrutura.md` — `infra/docker-compose.yml`, `prometheus/`, `grafana/`, `nginx/`; distinção entre obrigatório e referência futura
- `Estrutura - Docs do Projeto.md` — diferença entre `docs/` do repositório e `Vault_TCC`; estrutura com openapi, architecture, decisions
- `Legenda de Arquivos.md` — tabela de nomenclatura por framework (Express, React + Vite, Expo Router, configuração)
- `Regras para o Claude ao Gerar Codigo.md` — o que consultar antes de gerar código; 15 ondas de implementação; regras de escopo, simplicidade, segurança, documentação e consistência
- `Escopo Realista para o TCC.md` — **corrigido** (estava com conteúdo duplicado de Regras); reescrito com: o que é obrigatório para a banca, o que é desejável, o que é referência futura, critérios de corte, 5 ondas de implementação, o que pode ser mockado na demo

### Arquivos operacionais atualizados

- `Status de Preenchimento do Vault.md` — adicionada seção `04-Arquitetura/Estrutura do projeto` (10 itens)
- `Changelog do Projeto.md` — registrada sessão 13

- total de arquivos nesta sessão: 10 estruturais revisados + 1 corrigido + 2 operacionais = 13

## 2026-04-24 (sessão 12 — consolidação final do vault)

### MOCs e navegabilidade
- `MOC - Vulnera.md`: adicionadas 11 entidades faltantes do Núcleo do domínio (ProjectMember, VulnerabilityComment, ChatMessage, SupportTicket, MaturityDomain, MaturityControl, MaturityScore, PasswordResetToken, RefreshToken); adicionadas 5 notas de arquitetura (Visao Geral, Email SMTP, Expo Push, Repositorios, Logs Estruturados); adicionados Prometheus e Grafana ao DevSecOps; criadas novas seções: Desenvolvimento Seguro, Dados e modelagem, TCC
- `MOC - Dominio.md`: adicionada seção "Modelagem de dados" com todos os 11 links de 06-Dados
- `MOC - Operacao.md`: adicionada seção "TCC" com links para 09-TCC

### Correção de duplicação
- `05-Infra-DevSecOps/Politica de Desenvolvimento Seguro.md` (raiz): convertido em nota redirect para a versão canônica em `Desenvolvimento Seguro/` (que tem 155 linhas vs 77 da versão rasa)

### Conceitos de domínio
- preenchidos 8 arquivos de `02-Dominio/Conceitos` (todos estavam vazios):
  - `CVSS.md` — definição, vetor v3.1, tabela de métricas, mapeamento de score para severidade, uso no Vulnera
  - `OWASP Top 10.md` — edição 2021, 10 categorias A01-A10, uso como campo obrigatório no finding, relação com CVSS
  - `Maturidade.md` — estrutura hierárquica, escala 1-5, mapeamento para nível BASIC/INTERMEDIATE/ADVANCED, domínios do MVP
  - `Remediation Service.md` — flag do projeto, impacto no fluxo com/sem remediação, onde é configurado
  - `Multi-tenancy por escopo.md` — como o isolamento funciona em 3 camadas (middlewares, service, repository), risco principal, testes canário
  - `Ownership.md` — hierarquia de ownership, regras CLIENT/PENTESTER/ADMIN, 404 vs 403
  - `Auditoria.md` — estrutura do AuditLog, eventos auditados, visibilidade
  - `Client-side PDF.md` — tecnologia (pdf-lib), justificativa, trade-offs, tipos de relatório

### Status file
- adicionada seção `02-Dominio/Conceitos` ao Status de Preenchimento
- removida seção "Preencher:" obsoleta (substituída por nota de consolidação)

- total de arquivos alterados nesta sessão: 3 MOCs + 1 redirect + 8 conceitos + 2 operação = 14

## 2026-04-24 (sessão 11 — preenchimento 09-TCC)
- preenchidos 7 arquivos de `09-TCC` (todos estavam vazios):
  - `Estrutura da Monografia.md` — 8 capítulos com seções detalhadas, pontos-chave por capítulo, distribuição de escrita por integrante, checklist de redação
  - `Metodologia.md` — natureza do trabalho (pesquisa aplicada + produto funcional), Scrum adaptado, fluxo de desenvolvimento, metodologia de pesquisa (ADRs), testes (filosofia pragmática), segurança (DevSecOps integrado), documentação (vault), critérios de avaliação interna
  - `Distribuicao da Equipe.md` — matriz de responsabilidade completa (🔴🟡🟢 por área), pontos de concentração e mitigação, responsabilidade por capítulo, acordo de trabalho
  - `Testes.md` — filosofia, 3 tipos (canários, integração, unitários), tabelas de testes canário (auth, multi-tenant, regras de negócio), fluxos de integração, estrutura de arquivos, ferramentas, o que não testar, valor para a banca
  - `Evidencias para Banca.md` — 7 categorias (produto funcional, testes, arquitetura, DevSecOps, segurança, processo, plano B), checklist de ambiente 24h antes, checklist final pré-banca
  - `Casos Didaticos.md` — 4 casos (aplicação de colegas, Vulnera analisando a si mesmo, seed didático para demo, comparativo de maturidade), estrutura de documentação por caso, uso na monografia, considerações éticas
  - `Referencias e Bases Teoricas.md` — 9 bases temáticas (segurança, CVSS, OWASP, arquitetura, DevSecOps, SaaS, IA, web moderno, testes), materiais oficiais por tema, checklist de fundamentação
- `09-TCC` agora está 100% preenchido (7/7 arquivos)
- **Vault do Vulnera completamente preenchido** — todas as áreas concluídas em 11 sessões
- total de arquivos preenchidos nesta sessão: 7

## 2026-04-24 (sessão 10 — preenchimento 08-Operacao)
- preenchidos 7 arquivos de `08-Operacao` (6 estavam vazios, 1 desatualizado):
  - `Tarefas Abertas.md` — atualizado para refletir estado atual (vault concluído; próxima frente é código); backlog por fase com responsáveis
  - `Roadmap MVP.md` — fases 0–2 com entregas detalhadas, responsáveis e critérios de done; regras do MVP
  - `Roadmap Fases.md` — visão completa das 9 fases com datas estimadas, entregas, marcos e responsáveis; estimativa de posição atual (semana 16 / Fase 5)
  - `Riscos.md` — 10 riscos do projeto com probabilidade, impacto, status, detalhamento e mitigações; seção de riscos materializados
  - `Historico de Ideias.md` — ideias incorporadas (serviço de remediação, maturidade 1-5, PDF client-side, testes canário), descartadas (WhatsApp, PDF server-side, upload S3) e adiadas (scanner externo, comparativo de maturidade)
  - `Hipoteses em Validacao.md` — 5 hipóteses técnicas (PDF 20+ págs, Socket.IO + Expo, CVSS, rate Gemini, Prisma migrate) + 3 de produto + 2 de DevSecOps, todas com como validar e fallback
  - `Decisoes Recentes.md` — registro cronológico, sumário dos 7 ADRs e template para novas decisões
- `08-Operacao` agora está com todas as notas operacionais preenchidas
- total de arquivos preenchidos ou enriquecidos nesta sessão: 7

## 2026-04-24 (sessão 9 — preenchimento 07-Decisoes restante)
- preenchidos 3 ADRs de `07-Decisoes` (todos estavam vazios):
  - `ADR-002 - Project 1 para 1 com Application.md` — contexto da decisão (N projetos vs 1-para-1), alternativas A/B/C, consequências positivas (ownership direto, middlewares simples, dashboard claro), trade-offs (sem paralelo de análises), impacto no schema (FK unique), quando revisar
  - `ADR-005 - Desenvolvimento local com Docker minimo.md` — contexto (velocidade de dev vs paridade de ambiente), alternativas (tudo no Docker / banco local / adotada), consequências (onboarding rápido, hot reload, Expo sem problema), impacto por área, comandos do fluxo de trabalho
  - `ADR-007 - Sonar informativo e ZAP manual.md` — contexto (rigor vs viabilidade acadêmica), alternativas (Quality Gate bloqueante / ZAP no CI / adotada), consequências por ferramenta, mitigação dos trade-offs, frequência planejada do ZAP (3 execuções), impacto no pipeline e branch protection
- `07-Decisoes` agora está 100% preenchido (7/7 ADRs)
- total de arquivos preenchidos nesta sessão: 3

## 2026-04-24 (sessão 8 — preenchimento 05-Infra-DevSecOps restante)
- preenchidos 6 arquivos de `05-Infra-DevSecOps` (todos estavam vazios):
  - `Dockerfiles.md` — propósito (validação de build no CI, não dev), dois Dockerfiles completos (API e Web), boas práticas aplicadas (usuário não-root, npm ci, cache de layer, prisma generate)
  - `SonarQube.md` — configuração Docker, integração CI, metrics acompanhadas, TECH_STATUS.md automático, explicação de por que não bloqueia (ADR-007), valor para a banca
  - `OWASP ZAP.md` — posição manual (não no CI), comando de execução, tipos de scan (baseline/full/API), checks relevantes para o Vulnera, como documentar evidências para o TCC
  - `Observabilidade.md` — visão geral da camada (Fase 7), arquitetura Pino + Prometheus + Grafana, docker-compose.observability.yml separado, métricas técnicas e de negócio planejadas
  - `Prometheus.md` — configuração Docker, arquivo prometheus.yml, métricas coletadas com queries PromQL de exemplo, integração com prom-client no Express
  - `Grafana.md` — dashboards planejados (operacional + negócio), provisionamento via arquivos JSON, configuração de datasource, valor para a banca
- `05-Infra-DevSecOps` agora está 100% preenchido (9/9 arquivos + subpasta Desenvolvimento Seguro)
- total de arquivos preenchidos nesta sessão: 6

## 2026-04-24 (sessão 7 — preenchimento 06-Dados)
- preenchidos 11 arquivos de `06-Dados` (todos estavam vazios):
  - `MER Conceitual.md` — agrupamentos lógicos, diagrama conceitual, tabela de cardinalidades
  - `Entidades e Relacionamentos.md` — catálogo completo de todas as 21 entidades com campos, tipos e restrições
  - `Campos Criticos.md` — campos de segurança (nunca expor), campos derivados (nunca aceitar do cliente), campos de enum, campos com override, campos de timestamp, limites de texto livre, campos de arquivo
  - `Convenios de Nome.md` — convenções por camada (Prisma/MySQL/TypeScript/API/arquivos), tabela de nomes de tabelas, campos comuns, enums, rotas e migrations
  - `Enum - Roles.md` — ADMIN, PENTESTER, CLIENT com impacto funcional por role
  - `Enum - CompanyRole.md` — OWNER, MEMBER com tabela de capacidades e campo nullable
  - `Enum - ProjectStatus.md` — 7 estados com fluxo, quem pode transicionar e impacto funcional
  - `Enum - VulnerabilityStatus.md` — 6 estados com fluxo de remediação, tabela por contexto (com/sem remediation service)
  - `Enum - SubscriptionStatus.md` — 5 estados com fluxo, atores e impacto operacional
  - `Enum - TicketStatus.md` — 3 estados com fluxo, atores e comportamento de notificação
  - `Enum - AnalysisType e Level.md` — AnalysisType (SAST/DAST/MATURITY/COMBO) e AnalysisLevel (BASIC/INTERMEDIATE/ADVANCED) com impacto funcional
- `06-Dados` agora está 100% preenchido (11/11 arquivos)
- total de arquivos preenchidos nesta sessão: 11

## 2026-04-24 (sessão 6 — preenchimento 05-Infra-DevSecOps/Desenvolvimento Seguro)
- preenchida `Politica de Desenvolvimento Seguro.md` (estava vazia) — documento-mestre com princípios, controles obrigatórios por camada e referências da stack
- expandidos 9 padrões de segurança com implementação específica da stack Vulnera (Express, Prisma, React, Multer, Pino):
  - `Checklist de Seguranca por Feature.md` — expandido com itens detalhados e tabela de riscos por feature
  - `Padrao - Autenticacao e JWT.md` — adicionado: bcrypt cost 12, refresh token com hash+rotação, cookie HttpOnly, rate limiting no login, reset de senha
  - `Padrao - Validacao de Entradas.md` — adicionado: ValidationPipe global, decorators por tipo, campos bloqueados do body, validação de uploads, tabela de MaxLength
  - `Padrao - Prevencao de Injection.md` — adicionado: exemplos Prisma seguros vs inseguros, filtros dinâmicos, path traversal, template injection no Gemini, ownership como proteção
  - `Padrao - Prevencao de XSS.md` — adicionado: DOMPurify, react-markdown + rehype-sanitize, chat como texto puro, CSP via Helmet, erros de API
  - `Padrao - Segredos e Variaveis Sensiveis.md` — adicionado: .env.example completo, ConfigService com getOrThrow, GitHub Secrets, tabela de riscos por segredo, geração de secrets
  - `Padrao - Logs e Dados Sensiveis.md` — adicionado: redact config completo, tabela logar/não logar, separação log técnico vs AuditLog, exception filter seguro
  - `Padrao - Dependencias e Bibliotecas.md` — adicionado: tabela completa de bibliotecas aprovadas por camada, processo de adoção, red flags, dependências a evitar
  - `Padrao - Upload Seguro.md` — adicionado: config Multer completa, validação de magic number, servir arquivos com auth, tabela de tipos permitidos
- total de arquivos preenchidos ou expandidos nesta sessão: 10

## 2026-04-24 (sessão 5 — preenchimento 04-Arquitetura)
- preenchidos 9 arquivos de `04-Arquitetura`: Visao Geral, Banco de Dados MySQL, ORM Prisma, WebSocket e Tempo Real, Email SMTP, Expo Push, DTOs e Validacao, Repositorios, Logs Estruturados
- cada nota inclui: resumo, papel na arquitetura, tecnologias, configuração/uso, considerações de segurança, riscos e links relacionados
- `04-Arquitetura` agora está 100% preenchido (15/15 notas)
- Repositorios.md foi reescrito a partir do rascunho existente no arquivo
- total de arquivos preenchidos ou enriquecidos nesta sessão: 9

## 2026-04-24 (sessão 4 — preenchimento entidades restantes de 02-Dominio/Entidades)
- preenchidas 11 entidades: Plan, ProjectMember, VulnerabilityComment, ChatMessage, SupportTicket, MaturityDomain, MaturityControl, MaturityScore, Notification, PasswordResetToken, RefreshToken
- cada entidade inclui: definição, papel no sistema, campos principais, relacionamentos, regras associadas, estados/enums, permissões/visibilidade, riscos de inconsistência e links internos
- `02-Dominio/Entidades` agora está 100% preenchido (21/21 entidades)
- incluídas considerações de segurança em VulnerabilityComment, ChatMessage, PasswordResetToken e RefreshToken
- total de arquivos preenchidos nesta sessão: 11

## 2026-04-23 (sessão 3 — preenchimento Onda 2 · 03-Produto)
- preenchidos 8 arquivos de `03-Produto/Fluxos`: Onboarding, Contratacao, Criacao de Aplicacao, Abertura de Projeto, Registro de Finding, Geracao de Relatorio, Revalidacao, Uso da IA
- preenchidos 4 módulos vazios de `03-Produto/Modulos`: Empresas, Evidencias, Tickets, Dashboard
- preenchidas 3 jornadas de `03-Produto/Jornadas`: Cliente, Pentester, Admin
- enriquecidos 3 módulos/plataformas superficiais: Web Admin, Web Cliente, Maturidade, Chat e Comentarios
- adicionadas ao Status as seções de Jornadas (não constavam)
- total de arquivos preenchidos ou enriquecidos nesta sessão: 19

## 2026-04-23 (sessão 2 — preenchimento Onda 1)
- preenchidos 4 arquivos de `01-Contexto`: Publico-Alvo, Proposta de Valor, Diferenciais e Posicionamento, Fora do Escopo (expandido)
- preenchidos 2 arquivos de `02-Dominio/Permissoes`: CompanyRole, Regras de Ownership
- preenchidos 2 arquivos de `02-Dominio/Estados`: Maquina - Subscription, Maquina - SupportTicket
- preenchidas 14 regras de negócio: RN01, RN02, RN04, RN06, RN08, RN09, RN11, RN15, RN19, RN20, RN21, RN22, RN23, RN24
- total de arquivos preenchidos nesta sessão: 22

## 2026-04-23 (sessão 1 — criação inicial)
- criado vault inicial do Vulnera no Obsidian
- definidos MOCs principais
- definido guia operacional do Claude
- criadas notas canônicas de domínio, produto, arquitetura e decisões iniciais

## 2026-04-27 (sessão 14 — referências de código legado e guia de adaptação)

### Objetivo da sessão

Tornar explícito que os exemplos de código do autor foram criados originalmente com TypeScript, Express e MySQL/MySQL2, e devem ser usados apenas como referência de estilo, simplicidade e organização — nunca como definição da stack do Vulnera.

### Arquivo criado

- `04-Arquitetura/Referencias de Codigo/Referencia - Adaptacao Express MySQL para Express Prisma.md` — guia completo de adaptação de código legado para a stack oficial; inclui: mapeamento geral (tabela Express/MySQL → Express/Prisma), adaptação por camada (server.ts, routes, middleware, config/env, database, repository, models, multer), exemplos de código para cada camada, o que preservar, o que não copiar, segurança na adaptação, links relacionados

### Arquivos atualizados

- `Referencia - Estrutura Backend Simples.md` — adicionadas seções: Contexto dos exemplos (stack legada), Stack oficial do Vulnera, Mapeamento para Express (tabela), Estrutura equivalente no Vulnera, O que preservar, O que adaptar, links relacionados
- `Guia de Estilo de Codigo.md` — adicionada seção "Guia de adaptação completo" com link e sumário da nova nota de adaptação
- `Referencia - Controller.md` — adicionada seção "Nota sobre a origem dos exemplos" explicitando TypeScript + Express + MySQL/MySQL2 e link para o guia de adaptação
- `Referencia - Service.md` — adicionada seção "Nota sobre a origem dos exemplos" com mesmo contexto e link
- `Referencia - Repository.md` — adicionada seção "Nota sobre a origem dos exemplos" com contexto de MySQL2 + SQL manual e link

### O que não precisou de alteração (já estava correto)

- `MOC - Arquitetura.md` — já continha `[[Referencia - Adaptacao para Prisma]]` na seção de Referências de código
- `Claude - Guia Operacional.md` — já continha seção completa "Uso de códigos legados do autor" com política e links

### Decisão documentada

Nenhuma decisão arquitetural nova foi introduzida. Esta sessão apenas tornou explícito o contexto de origem dos exemplos legados e criou o guia de adaptação que já estava referenciado nos demais arquivos mas ainda não existia.

- total de arquivos criados: 1
- total de arquivos atualizados: 5
- total de arquivos verificados sem alteração: 2

## 2026-04-27 (sessão 15 — Onda 1: Bootstrap do monorepo)

### Objetivo

Criar a base física do repositório Vulnera para que as próximas ondas de implementação sejam feitas com consistência estrutural.

### Diretório criado

`C:\Users\43737514801\Documents\mcp-claude\Vulnera\`

### Estrutura criada

**Raiz do monorepo:**
- `package.json` — npm workspaces configurados (`apps/*`, `packages/*`)
- `turbo.json` — npm workspaces com tasks: build, dev, lint, test
- `tsconfig.base.json` — config TypeScript base compartilhada
- `.gitignore` — cobre Node, Express, React + Vite, Expo, uploads, secrets
- `.editorconfig` — LF, indent 2, charset UTF-8
- `.npmrc` — engine-strict=true
- `README.md` — início rápido, stack, estrutura

**apps/api (Express):**
- `package.json` — dependências completas: Express, Prisma, JWT, bcrypt, class-validator, multer, pino
- `tsconfig.json` — herda base, adiciona emitDecoratorMetadata, paths para packages
- `nest-cli.json` — apontando para src/
- `jest.config.ts` — configuração de testes com ts-jest
- `.env.example` — todas as variáveis necessárias (DATABASE_URL, JWT, MAIL, UPLOAD, GEMINI)
- `src/main.ts` — bootstrap Express com ValidationPipe global (whitelist, forbidNonWhitelisted), CORS, prefixo /api
- `src/app.module.ts` — ConfigModule global + ThrottlerModule; comentários listando módulos das próximas ondas
- `src/database/prisma.service.ts` — PrismaService implementando OnModuleInit
- `prisma/schema.prisma` — generator + datasource MySQL; comentários com roadmap de models por onda
- `prisma/seed.ts` — placeholder para seed da Onda 2
- `Dockerfile` — build multi-stage, usuário não-root
- `uploads/.gitkeep`, `test/.gitkeep`
- `src/modules/.gitkeep`, `src/config/.gitkeep`
- `src/common/middlewares/`, `decorators/`, `filters/`, `interceptors/` — pastas reservadas

**apps/web (React + Vite):**
- `package.json` — React + Vite, React 18, Tailwind, Zustand, Axios, socket.io-client
- `tsconfig.json` — App Router, paths configurados
- `next.config.ts` — transpile dos packages compartilhados
- `tailwind.config.ts` — content cobrindo app/, components/, lib/
- `components.json` — shadcn/ui configurado
- `.env.example` — NEXT_PUBLIC_API_URL e NEXT_PUBLIC_WS_URL
- `styles/globals.css` — Tailwind base
- `app/layout.tsx` — RootLayout com metadata e lang pt-BR
- `app/page.tsx` — redirect para /login
- `app/(public)/login/page.tsx` — placeholder para Onda 2
- `Dockerfile` — multi-stage com standalone output
- `components/ui/.gitkeep`, `lib/api/.gitkeep`

**apps/mobile (Expo):**
- `package.json` — Expo 51, Expo Router, expo-notifications, expo-secure-store, Zustand
- `tsconfig.json` — estende expo/tsconfig.base, strict
- `app.config.ts` — configuração Expo com bundleIdentifier iOS/Android
- `babel.config.js` — babel-preset-expo
- `.env.example` — EXPO_PUBLIC_API_URL
- `app/_layout.tsx` — Stack root sem header
- `app/index.tsx` — redirect para /(auth)/login
- `app/(auth)/_layout.tsx` e `login.tsx` — grupo de autenticação
- `app/(app)/_layout.tsx` — Tabs para área logada (CLIENT apenas — ADR-004)
- `services/`, `store/`, `hooks/` — pastas reservadas

**packages/types:**
- `package.json`, `tsconfig.json`
- `src/enums.ts` — todos os enums do domínio: Role, CompanyRole, ProjectStatus, VulnerabilityStatus, VulnerabilitySeverity, SubscriptionStatus, TicketStatus, AnalysisType, AnalysisLevel
- `src/index.ts` — re-export

**packages/validators:**
- `package.json`, `tsconfig.json`
- `src/index.ts` — placeholder com roadmap de schemas por onda

**packages/utils:**
- `package.json`, `tsconfig.json`
- `src/cvss.ts` — `cvssScoreToSeverity()` com tabela CVSS 3.1
- `src/date.ts` — `formatDate()` e `isExpired()`
- `src/pagination.ts` — `getPaginationOffset()`, `buildPaginatedResult()`, interfaces
- `src/index.ts` — re-export

**infra:**
- `docker-compose.yml` — MySQL 8, Mailhog, SonarQube 10 (com healthcheck)
- `prometheus/prometheus.yml` — scrape da API
- `grafana/grafana.ini` — porta 3010, admin/vulnera
- `grafana/provisioning/datasources/datasource.yml` — Prometheus datasource
- `nginx/nginx.conf` — referência futura de proxy reverso

**.github/workflows:**
- `ci.yml` — Node 20, MySQL service, steps: install, generate Prisma, lint, test

**docs:**
- `README.md` — papel da pasta vs vault Obsidian

### Total de arquivos criados

67 arquivos em 46 diretórios

### Decisões tomadas nesta sessão

- npm workspaces com npm workspaces (conforme documentado no vault)
- `ValidationPipe` global configurado desde o `main.ts` — segurança por padrão
- ThrottlerModule configurado desde o início (100 req/min) — proteção básica imediata
- `PrismaService` criado e disponível para uso nos módulos
- Enums criados em `packages/types` — fonte única para API, Web e Mobile
- `schema.prisma` apenas com generator/datasource — models serão adicionados por onda
- Docker Compose sobe MySQL, Mailhog e SonarQube — sem API/Web no compose (ADR-005)
- Dockerfile API com usuário não-root — segurança por padrão
- Mobile com Tabs para área logada apenas para CLIENT — ADR-004 respeitado

### Próximos passos (Onda 2)

1. `npm install` para instalar dependências
2. `docker compose -f infra/docker-compose.yml up -d` para subir MySQL
3. Implementar Prisma schema: User, Company, Plan, Subscription, RefreshToken, PasswordResetToken
4. Implementar módulo de autenticação (auth, users, companies)
5. Implementar middlewares globais: JwtAuthGuard, RolesGuard, @CurrentUser()
6. Implementar ExceptionFilter global

## 2026-05-14 (sessão 16 — Onda 2: API base NestJS)

### Objetivo

Expandir a base da API NestJS com infraestrutura transversal: logger estruturado, filtros de exceção, interceptors, módulo de banco de dados global e health check.

### Arquivos criados

- `src/database/database.module.ts` — DatabaseModule global (@Global) que provê e exporta PrismaService para todos os módulos sem necessidade de importação individual
- `src/config/app.config.ts` — factory de configuração via `registerAs('app', ...)` centralizando PORT, NODE_ENV, CORS_ORIGIN e LOG_LEVEL (nenhum acesso direto a `process.env` fora daqui)
- `src/common/filters/http-exception.filter.ts` — AllExceptionsFilter global: captura HttpException e erros inesperados; loga stack trace apenas para 5xx; retorna JSON padronizado `{ statusCode, message, path, timestamp }` sem vazar detalhes internos ao cliente
- `src/common/interceptors/logging.interceptor.ts` — LoggingInterceptor: loga método, URL, status code e tempo de resposta em ms; opera ao nível do handler NestJS (complementar ao pino-http que opera no nível HTTP)
- `src/common/interceptors/transform.interceptor.ts` — TransformInterceptor: envolve toda resposta de sucesso em `{ data: ... }` para consistência de contrato
- `src/modules/health/health.controller.ts` — GET /api/health retorna `{ status: 'ok', timestamp }` sem dependência de DB (health superficial de infra)
- `src/modules/health/health.module.ts` — HealthModule registrando o controller

### Arquivos atualizados

- `src/main.ts` — adicionado: `helmet()` para headers de segurança HTTP; `app.useLogger(app.get(Logger))` para substituir logger padrão por Pino; `bufferLogs: true` para não perder logs de bootstrap
- `src/app.module.ts` — adicionado: LoggerModule (nestjs-pino com redact de campos sensíveis e pino-pretty em dev); DatabaseModule; HealthModule; APP_FILTER (AllExceptionsFilter); APP_INTERCEPTOR (LoggingInterceptor e TransformInterceptor)
- `src/database/prisma.service.ts` — adicionado `onModuleDestroy` com `$disconnect()` para graceful shutdown correto
- `package.json` — adicionadas dependências de dev: `pino-pretty@^11.0.0` e `@types/express@^4.17.0`
- `.env.example` — adicionada variável `LOG_LEVEL=info`

### Decisões tomadas

- `DatabaseModule` marcado como `@Global()` — evita importação repetida em cada módulo de domínio; PrismaService disponível em toda a aplicação sem boilerplate
- `AllExceptionsFilter` registrado via `APP_FILTER` (DI) — pode receber injeção de dependência futura (PinoLogger) sem necessidade de refatoração
- `LoggingInterceptor` e `TransformInterceptor` registrados via `APP_INTERCEPTOR` — globais sem acoplamento ao AppModule
- Redact de campos sensíveis configurado no LoggerModule: `password`, `passwordHash`, `token`, `tokenHash`, `newPassword`, `currentPassword`, `authorization`, `cookie` — política de logs seguros aplicada desde o início
- Health endpoint é superficial (retorna 200 sem consultar DB) — adequado para o MVP; verificação de conectividade do banco será adicionada quando necessário
- `pino-pretty` em devDependencies — não utilizado em produção (transport é `undefined` quando `NODE_ENV=production`)

### Pendências técnicas desta onda

- Guards (`JwtAuthGuard`, `RolesGuard`) — dependem do módulo de auth (Onda 3)
- Decorator `@CurrentUser()` — depende do módulo de auth (Onda 3)
- `prisma-exception.filter.ts` — tratamento de erros Prisma (P2002 unique, P2025 not found) — adiado para junto com os primeiros módulos de domínio
- `src/common/middleware/` — ainda vazio; será preenchido com rate-limit por rota se necessário
- `audit.interceptor.ts` — adiado para quando o módulo de AuditLog existir
- Prisma schema sem models — será expandido na Onda 3 (User, Company, Plan, Subscription, RefreshToken, PasswordResetToken)

### Total desta sessão

- 7 arquivos criados
- 5 arquivos atualizados

## 2026-05-14 (sessão 17 — Onda 3: Schema Prisma e seed inicial)

### Objetivo

Transformar o domínio documentado do vault em schema Prisma completo, criando todas as 21 entidades com relações, enums e constraints consistentes com o MER Conceitual.

### Schema criado — `apps/api/prisma/schema.prisma`

#### Enums definidos (10)
- `Role` — ADMIN, PENTESTER, CLIENT
- `CompanyRole` — OWNER, MEMBER
- `SubscriptionStatus` — PENDING_APPROVAL, ACTIVE, SUSPENDED, CANCELED, REJECTED
- `ProjectStatus` — REQUESTED, TRIAGE, PLANNED, IN_PROGRESS, IN_REVIEW, DELIVERED, CLOSED
- `VulnerabilityStatus` — OPEN, IN_PROGRESS, FIXED, REVALIDATION, CLOSED, RISK_ACCEPTED
- `VulnerabilitySeverity` — NONE, LOW, MEDIUM, HIGH, CRITICAL (sincronizado com packages/types e packages/utils/cvss.ts)
- `TicketStatus` — OPEN, IN_PROGRESS, CLOSED
- `AnalysisType` — SAST, DAST, MATURITY, COMBO
- `AnalysisLevel` — BASIC, INTERMEDIATE, ADVANCED
- `AppEnvironment` — PROD, HOMOL, DEV
- `ReportType` — EXECUTIVE, TECHNICAL

#### Models criados (21)

| Grupo | Models |
|---|---|
| Núcleo Comercial | Plan, Company, Subscription |
| Identidade | User |
| Análise | Application, Project, ProjectMember |
| Findings | Vulnerability, Evidence, VulnerabilityComment |
| Comunicação | ChatMessage, SupportTicket, Notification |
| Maturidade | MaturityDomain, MaturityControl, MaturityAssessment, MaturityScore |
| Rastreabilidade | Report, AuditLog, PasswordResetToken, RefreshToken |

#### Constraints críticas implementadas
- `Plan.name @unique` — sem planos duplicados
- `Company.cnpj @unique` — CNPJ único
- `User.email @unique` — e-mail único
- `Project.applicationId @unique` — garante relação 1:1 com Application (RN05)
- `ProjectMember @@unique([projectId, userId])` — sem duplicação de atribuição (RN08)
- `MaturityScore @@unique([assessmentId, controlId])` — um score por controle por assessment

#### Relações nomeadas (para múltiplos FKs ao mesmo modelo)
- `VulnerabilityCreator` / `VulnerabilityAssignee` — User → Vulnerability
- `SubscriptionApprover` — User → Subscription
- `AssessmentEvaluator` — User → MaturityAssessment

#### Segurança por design no schema
- `passwordHash`, `tokenHash` presentes no schema mas comentados para exclusão nos DTOs de resposta
- Campos de origem interna (`createdBy`, `uploadedBy`, `authorId`, `actorId`) sem default no schema — serão sempre extraídos do JWT no service
- `diffJson` em AuditLog como String nullable — campos sensíveis não devem ser incluídos no diff
- Comentários inline marcando restrições de segurança diretamente no schema

### Seed criado — `apps/api/prisma/seed.ts`

#### Dados semeados
- **3 Planos**: BASIC (R$299, 2 apps, 1 projeto), PRO (R$799, 5 apps, 3 projetos, remediação), PRO_PLUS (R$1999, ilimitado, remediação)
- **5 Domínios de Maturidade** com **3 controles cada** (15 controles total):
  1. Gestão de Identidade e Acesso (MFA, senha forte, revisão de acessos)
  2. Gestão de Vulnerabilidades (scanning, patch management, classificação de risco)
  3. Desenvolvimento Seguro — SDLC (code review, CI/CD, dependências)
  4. Proteção de Dados (criptografia, controle de acesso, retenção)
  5. Resposta a Incidentes (IRP, treinamento, testes periódicos)

#### Estratégia de idempotência
- Verifica count antes de inserir — safe para rodar múltiplas vezes
- Sem `createMany skipDuplicates` para evitar dependência de constraint única em domínios/controles

### Arquivo atualizado
- `package.json` — adicionado `"prisma": { "seed": "ts-node prisma/seed.ts" }` para `prisma db seed` funcionar automaticamente

### Decisões tomadas

1. **`VulnerabilitySeverity` como enum Prisma** — campo fechado, consistente com packages/types; evita valores arbitrários de severidade no banco
2. **`AppEnvironment` como enum** — PROD/HOMOL/DEV são valores fechados e controlados
3. **`ReportType` como enum** — EXECUTIVE/TECHNICAL são os únicos tipos previstos no MVP
4. **`Plan.appLimit = 9999` para ilimitado** — evita bugs com comparação `count >= 0` (sempre true). Service deve checar: `if (plan.appLimit !== 9999 && count >= plan.appLimit)`
5. **`Subscription.startDate` e `endDate` como `DateTime?`** — sem `@db.Date` para evitar complexidade de timezone; aplicação trata como datas sem hora
6. **Sem `updatedAt` em Company e Application** — spec não prevê; adicionado apenas em User e Vulnerability conforme documentado
7. **`Notification.category` como `String`** — categorias documentadas como comentário no schema; String evita necessidade de migration para novas categorias futuras
8. **Sem índices explícitos além das FKs** — alinhado com decisão do vault (ORM Prisma): avaliar quando volume crescer

### Pendências técnicas identificadas

- `prisma generate` precisa rodar após schema para gerar o client atualizado
- `prisma migrate dev` criará a primeira migration (`init`) — executar com banco PostgreSQL ativo
- `prisma db seed` populará plans + maturity catalog após a migration
- Admin user deve ser criado via script ou endpoint pós-deploy — não hardcoded no seed (política de segurança)
- OWASP categories validadas como String no schema — validação com `@IsIn(['A01','A02',...,'A10'])` ficará no DTO da Onda 4

### Total desta sessão
- 1 schema Prisma criado (21 models, 10 enums, constraints críticas)
- 1 seed criado (3 planos + 5 domínios + 15 controles)
- 1 package.json atualizado
