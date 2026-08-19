# Vulnera — Findings Consolidados

## Convenções

- Baseline: `dev@49cac59122bc9d4e05e491339e1f4eb80aad838d`.
- Auditoria estática; `RUNTIME_VALIDATED=NOT_ALLOWED` salvo indicação explícita.
- Duplicações entre agentes foram fundidas; IDs derivados apontam para o finding canônico.
- Marcadores `SPEC_AMBIGUITY`, `SPEC_CONFLICT` e `OUT_OF_MVP` não são convertidos em ausência do MVP.

## Sumário de severidade

| Severidade | Findings canônicos |
|---|---:|
| P0 | 0 |
| P1 | 9 |
| P2 | 22 |
| P3 | 1 |
| **Total técnico acionável** | **32** |
| NONE / validação/especificação | 4 |

## Findings P1

### SECURITY-001 — Mass assignment em Application e Project

- **Requisitos:** S02-R051, S08-R017, S09-R027, S23-R006/R013, S31-R010.
- **Status:** `DIVERGENT`; **confiança:** HIGH; **auditabilidade:** CROSS_LAYER.
- **Esperado:** updates aceitam somente campos autorizados e preservam Company, Application, status, timestamps e trilha de transição.
- **Observado:** controllers apenas fazem cast de `req.body`; services autorizam o estado anterior e repositories repassam o objeto integral a `prisma.*.update`. Em Project, `status`, `companyId` e `applicationId` podem contornar `/transition`, role e AuditLog.
- **Evidência:** `app/api/src/controllers/application.controller.ts:77`; `application.service.ts:70`; `application.repository.ts:40`; `project.controller.ts:88`; `project.service.ts:95`; `project.repository.ts:60`; `app/api/prisma/schema.prisma:183,211`.
- **Impacto:** bypass de máquina/auditoria e possível transferência cross-tenant/corrupção das chaves desnormalizadas.
- **Cross-review:** security, backend, business, data, e2e, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Updates devem aceitar apenas campos autorizados, rejeitar/ignorar campos protegidos e preservar tenant, vínculos, status e AuditLog nos testes de integração.

### SECURITY-002 — Segredos JWT previsíveis no Compose

- **Requisito:** S23-R038; S06-R017 relacionado.
- **Status:** `DIVERGENT`; **confiança:** MEDIUM; **auditabilidade:** CODE_STATIC.
- **Esperado:** runtime falha fechado sem segredos externos imprevisíveis.
- **Observado:** Compose usa `NODE_ENV=production`, publica a API e fornece fallbacks JWT fixos; `requireRole` confia no role assinado, e endpoints ADMIN como criação de Plan não reconsultam o ator.
- **Evidência:** `docker-compose.yml:35,45,47,52`; `app/api/src/utils/jwt.util.ts:27,49`; `require-role.middleware.ts:16`; `plan.routes.ts:14`; `plan.service.ts:18`.
- **Impacto:** se o Compose padrão estiver alcançável, um token ADMIN pode ser forjado. Exposição efetiva não foi validada.
- **Cross-review:** security, infra, backend, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `COMPOSE_RUNTIME`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Compose deve falhar fechado sem secrets externos e tokens assinados com defaults conhecidos não podem autenticar.

### AUTH-001 — Refresh não é consumido atomicamente

- **Requisito:** S06-R029; edge S31-R004.
- **Status:** `PARTIAL`; **confiança:** HIGH; **auditabilidade:** CROSS_LAYER.
- **Esperado:** refresh rotacionado é estritamente one-time, inclusive sob concorrência.
- **Observado:** leitura, teste de `revokedAt`, revogação incondicional e emissão são operações separadas; duas requests podem emitir sucessores do mesmo token.
- **Evidência:** `app/api/src/services/auth.service.ts:54,63,68`; `refresh-token.repository.ts:28,32`; `tests/integration/auth.test.ts:99` cobre apenas sequência.
- **Impacto:** replay simultâneo pode originar mais de uma sessão válida.
- **Cross-review:** backend, security, data, tests, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `CONCURRENCY_TEST`, `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Duas requisições concorrentes com o mesmo refresh devem produzir no máximo um sucessor válido e a outra deve falhar de forma controlada.

### BUSINESS-001 — Plano inativo pode ser contratado

- **Requisitos:** S07-R006/S07-R036.
- **Status:** `DIVERGENT`; **confiança:** HIGH; **auditabilidade:** CROSS_LAYER.
- **Observado:** Company e Subscription verificam somente existência do Plan; `isActive` não participa do gate.
- **Evidência:** `company.service.ts:42,46`; `subscription.service.ts:35,39`; `schema.prisma:140,146`.
- **Impacto:** oferta desativada pode gerar contrato pendente e ser aprovada.
- **Cross-review:** business, backend, flow, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Solicitação e aprovação de nova contratação devem recusar Plan inativo em todos os caminhos cobertos.

### BUSINESS-002 — Unicidade de Subscription ACTIVE sujeita a corrida

- **Requisitos:** S05-R043/R044, S07-R046/R049, S31-R017.
- **Status:** `PARTIAL`; **confiança:** HIGH; **auditabilidade:** CROSS_LAYER.
- **Observado:** `findActiveByCompany` e update são separados; não há transação/lock/constraint de unicidade condicional.
- **Evidência:** `subscription.service.ts:79-91`; `subscription.repository.ts:35-38,51-55`; `schema.prisma:156-174`; teste concorrente ausente.
- **Impacto:** duas assinaturas ACTIVE tornam Plan e limites efetivos indeterminados.
- **Cross-review:** business, data, backend, tests, flow, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `CONCURRENCY_TEST`, `DATABASE_RUNTIME`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Aprovações concorrentes devem preservar no máximo uma Subscription ACTIVE por Company, com garantia demonstrada no banco.

### BUSINESS-003 — Project ignora Subscription ACTIVE e `maxProjects`

- **Requisitos:** S09-R002/R003; S31-R016.
- **Status:** `NOT_IMPLEMENTED`; **confiança:** HIGH; **auditabilidade:** CROSS_LAYER.
- **Observado:** `ProjectService.create` consulta Application/ownership/conflito, mas não Subscription, Plan ou contagem de Projects.
- **Evidência:** `app/api/src/services/project.service.ts:35,64,67,75`; `schema.prisma:143`.
- **Impacto:** Company sem contrato ativo ou acima do limite pode iniciar análise.
- **Cross-review:** business, backend, data, flow, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Criação de Project deve exigir Subscription ACTIVE; `maxProjects` só integra o critério após ratificação da especificação.

### BUSINESS-004 — Mutações e AuditLog não são atômicos

- **Requisitos:** S13-R001..R017.
- **Status:** `PARTIAL`; **confiança:** HIGH; **auditabilidade:** CROSS_LAYER.
- **Observado:** Subscription, Project, Vulnerability e Report alteram a entidade antes do AuditLog, sem transação. DELETE de Vulnerability é irreversível antes do log.
- **Evidência:** `subscription.service.ts:45`; `project.service.ts:125`; `vulnerability.service.ts:315`; `report.service.ts:189`; ausência de `$transaction` nos services.
- **Impacto:** trilha sensível pode divergir do estado real, inclusive com erro devolvido após mutação concluída.
- **Cross-review:** business, data, backend, tests, flow, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`, `DATABASE_RUNTIME`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Falha do AuditLog deve reverter a mutação sensível, e falha da mutação não deve produzir log de sucesso, inclusive no DELETE irreversível.

### INFRA-002 — CI referencia lockfile inexistente

- **Requisitos:** S26-R002..R008; S25-R010.
- **Status:** `DIVERGENT`; **confiança:** HIGH; **auditabilidade:** CODE_STATIC.
- **Observado:** lint/build/test usam `npm ci` e cache `app/api/package-lock.json`; nenhum lockfile existe no baseline e `.gitignore` o ignora.
- **Evidência:** `.github/workflows/build.yml:20-29,35-45,49-88`; `.gitignore:5,68`; `app/api/package.json`.
- **Impacto:** gates configurados podem falhar antes de lint/build/migration/test/coverage; não há evidência operacional do pipeline.
- **Cross-review:** infra, tests, process, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `CI_PIPELINE`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Instalação determinística e pipeline completo devem executar com sucesso a partir de checkout limpo.

### METRICS-001 — Filtros produzem populações incoerentes

- **Requisitos:** S16-R052..R055, S34-R056, S35-R011.
- **Status:** `DIVERGENT`; **confiança:** HIGH; **auditabilidade:** CROSS_LAYER.
- **Esperado:** todos os KPIs, gráficos e comparações do painel usam o mesmo conjunto filtrado.
- **Observado:** controller/service transportam severidade/status/OWASP e consultas Prisma os aplicam; SQL raw de risk score, aging, MTTR, reabertura e séries usa apenas Application/período/estados fixos. Comparison descarta as listas de filtro.
- **Evidência:** `metrics.controller.ts:54-66`; `metrics.service.ts:184,215-224,269-292,363-368,498-512`; `metrics.repository.ts:82-89,147-190,234-274,310-353`.
- **Impacto:** após cross-filter, totais/OWASP podem mudar enquanto risk score, aging, MTTR e séries continuam sobre outra população.
- **Cross-review:** backend, frontend, business, e2e, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`, `BROWSER`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Todos os KPIs, gráficos, séries e comparações devem usar a mesma população para cada combinação de filtros, comprovada por API e cross-filter no browser.

## Findings P2

### INFRA-001 — Template local de ambiente não inicializa a API (rebaixado para P2)

- **Requisito:** S04-R026.
- **Status:** `DIVERGENT`; **severidade final:** P2; **confiança:** HIGH; **auditabilidade:** CODE_STATIC.
- **Observado:** `.env.example` declara `SERVER_PORT`; servidor exige `PORT` e lança na ausência.
- **Evidência:** `app/api/.env.example:2`; `app/api/src/server.ts:5`; `config/EnvVar.ts:10-24`.
- **Impacto:** setup local por cópia do template exige intervenção; o Compose principal fornece `PORT` e não é afetado por este mismatch.
- **Cross-review:** infra, backend, tests, adversarial.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** A API deve iniciar pelo setup local documentado após copiar o template, sem intervenção para corrigir o nome da porta; o Compose principal deve permanecer funcional.

### SECURITY-003 — Role/companyRole não são aplicados na Company

- **Requisitos:** S02-R003/R005/R027, S07-R015/R016/R027.
- **Status:** `DIVERGENT`; **confiança:** HIGH.
- **Observado:** qualquer autenticado pode criar Company e receber OWNER; update verifica companyId, não OWNER. MEMBER edita Company e PENTESTER pode adquirir vínculo inválido.
- **Evidência:** `company.routes.ts:21,24`; `company.service.ts:42,54,80`; `user.repository.ts:71`.
- **Impacto:** escalada intra-tenant e violação da separação de roles; não prova acesso a outro tenant por si só.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Create/update de Company deve aplicar role e companyRole, impedir vínculos incompatíveis e restringir edição aos atores autorizados.

### AUTH-002 — E-mail sem normalização e conflito não traduzido

- **Requisitos:** S06-R003/R004.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** register/login usam e-mail original; `findByEmail → create` não é atômico e colisão Prisma cai em 500.
- **Evidência:** `auth.controller.ts:43,63`; `auth.service.ts:29`; `user.repository.ts:29`; `schema.prisma:62`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `UNIT_TEST`, `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Register, login e update devem usar normalização consistente e devolver erro estável, não 500, em colisões inclusive concorrentes.

### SECURITY-004 — Rate limiting ausente

- **Requisitos:** S06-R016; S23-R032..R036.
- **Status:** `NOT_IMPLEMENTED`; **confiança:** HIGH.
- **Observado:** login e upload não têm limiter; limites Multer são por request, não frequência.
- **Evidência:** `app.ts:7`; `auth.routes.ts:8`; `evidence.routes.ts:11`; `upload.middleware.ts:21`; `app/api/package.json:41`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`, `SECURITY_SCAN`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Login e upload devem limitar frequência conforme política definida, responder de forma controlada ao excesso e manter os fluxos normais funcionais.

### BACKEND-001 — Atualização de User tem validação insuficiente

- **Requisito:** S06-R047.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** name/email não têm tipo/formato/tamanho/normalização/conflict handling completo; falhas previsíveis podem virar 500.
- **Evidência:** `user.controller.ts:45,66`; `user.service.ts:53`; `user.repository.ts:49`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `UNIT_TEST`, `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Update de User deve validar tipos, formatos e tamanhos, normalizar e-mail e traduzir conflitos previsíveis sem resposta 500.

### BUSINESS-005 — Onboarding composto não é atômico

- **Requisitos:** S07-R015..R017.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** Company, OWNER e Subscription são chamadas sequenciais; falha posterior deixa Company vinculada e retry encontra `USER_ALREADY_HAS_COMPANY`.
- **Evidência:** `company.service.ts:54`; `onboarding-page.tsx:60`; `subscription.service.ts:45`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`, `DATABASE_RUNTIME`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Falha em qualquer etapa do onboarding não deve deixar estado parcial irrecuperável, e retry deve concluir ou retornar estado consistente.

### BUSINESS-007 — Limite de Applications sujeito a corrida

- **Requisitos:** S08-R011/R012/R014.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** count e create são separados; concorrência pode ultrapassar `maxApplications`.
- **Evidência:** `application.service.ts:62-66`; `application.repository.ts:23,27`; `schema.prisma:183-200`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `CONCURRENCY_TEST`, `DATABASE_RUNTIME`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Criações concorrentes devem respeitar `maxApplications` sem ultrapassar a capacidade efetiva do Plan.

### BUSINESS-008 — Unicidade/transição de Project sujeitas a corrida

- **Requisitos:** S09-R011/R019, S31-R022; sem adjudicar S09-R012.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** `findFirst → create` e `read status → update` são incondicionais; duas criações/transições podem produzir duplicidade/estado e logs incompatíveis.
- **Evidência:** `project.service.ts:75-89,107-127`; `project.repository.ts:35,56,64`; `schema.prisma:211-238`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `CONCURRENCY_TEST`, `DATABASE_RUNTIME`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Criações e transições concorrentes devem preservar unicidade e máquina ratificadas, com estado e AuditLog compatíveis, sem decidir S09-R012 por inferência.

### EVIDENCE-001 — `proof` obrigatório nunca é exigido

- **Requisito:** S11-R006.
- **Status:** `NOT_IMPLEMENTED`; **confiança:** HIGH.
- **Observado:** web envia `proof=""`; controller aplica fallback vazio; service persiste sem validação.
- **Evidência:** `evidence-uploader.tsx:52,58`; `evidence.controller.ts:31`; `evidence.service.ts:163,192`; `schema.prisma:333`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `UNIT_TEST`, `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Formulário, controller e service devem rejeitar `proof` vazio ou fora dos limites definidos e persistir apenas valor válido.

### EVIDENCE-002 — DELETE de Evidence ausente

- **Requisitos:** S11-R033..R038.
- **Status:** `NOT_IMPLEMENTED`; **confiança:** HIGH.
- **Observado:** rotas/controller/service/repository só listam, enviam e baixam.
- **Evidência:** `evidence.routes.ts:9`; `evidence.controller.ts:4`; `evidence.service.ts:155`; `evidence.repository.ts:18`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`, `DATABASE_RUNTIME`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Após definir roles, ownership, auditoria e consistência banco/arquivo, o ciclo DELETE deve aplicar essas regras e não deixar metadado ou arquivo órfão.

### BUSINESS-009 — DELETE de Comment mantém acesso residual

- **Requisitos:** S12-R012; S31-R025.
- **Status:** `DIVERGENT`; **confiança:** HIGH.
- **Observado:** delete busca apenas Comment e autor/ADMIN; ignora `vulnId` e não revalida tenant/membership atual.
- **Evidência:** `vulnerability-comment.controller.ts:66`; `vulnerability-comment.service.ts:63,67,72`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** DELETE deve conferir o `vulnId` pai e revalidar tenant/membership atual, negando acesso residual após remoção do Project.

### DATA-001 — Relações críticas sem FK

- **Requisito:** S05-R071 e relações de maturidade.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** `Vulnerability.createdBy`, `MaturityAssessment.companyId/evaluatedBy` são escalares sem relation/FK; User pode ser hard-deleted.
- **Evidência:** `schema.prisma:294-307,416-426`; migration inicial `:370-380`; `maturity.repository.ts:30`; `user.repository.ts:79`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `DATABASE_RUNTIME`, `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** As relações críticas devem possuir integridade referencial coerente e deleções/alterações relacionadas devem preservar autoria e vínculos de maturidade conforme o contrato.

### MATURITY-001 — Nível categórico contradiz ADR simplificada

- **Requisitos:** S21-R010; conflito canônico S05-R099.
- **Status:** `DIVERGENT`; **confiança:** HIGH.
- **Observado:** backend deriva/persiste `level`; UI e PDF o exibem, embora o requisito vigente remova BASIC/INTERMEDIATE/ADVANCED do resultado.
- **Evidência:** `maturity.service.ts:33,90`; `maturity.repository.ts:69`; `maturity-assessment-page.tsx:166`; `pdf/executive.ts:104`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `UNIT_TEST`, `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** API, persistência, UI e PDF devem refletir de forma consistente a ADR-018 vigente, salvo nova decisão formal que altere o contrato.

### MATURITY-002 — Batch de scores não é atômico

- **Requisitos:** S21-R025/R029.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** validação/upsert ocorre dentro do loop e overallScore depois; erro tardio preserva itens anteriores e concorrência pode persistir média obsoleta.
- **Evidência:** `maturity.service.ts:66-90`; `maturity.repository.ts:55,69`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `CONCURRENCY_TEST`, `DATABASE_RUNTIME`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** O batch deve ser atômico e a média persistida deve corresponder ao conjunto consistente de scores, inclusive sob falha tardia e concorrência.

### FRONTEND-001 — Busca do analytics é decorativa

- **Requisito:** S16-R056.
- **Status:** `NOT_IMPLEMENTED`; **confiança:** HIGH.
- **Observado:** URL/chip mantêm `busca`, mas DTO, serialização, controller e query não a transportam.
- **Evidência:** `filter-bar.tsx:321`; `use-filtros-metricas.ts:44,186,239`; `metrics.types.ts:91`; `metrics.api.ts:33`; `metrics.controller.ts:54`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`, `BROWSER`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** O controle de busca deve alterar resultados de forma coerente ponta a ponta ou ser removido até existir comportamento real, com URL e estado sincronizados.

### FRONTEND-002 — Clique em aging aplica filtro com semântica errada

- **Requisito:** S16-R030.
- **Status:** `DIVERGENT`; **confiança:** HIGH.
- **Observado:** clique converte aging em `to=agora-dias`; API interpreta período de criação, não idade do finding.
- **Evidência:** `metrics/charts.tsx:221-274`; `use-filtros-metricas.ts:201-215`; `metrics.types.ts:91`; `metrics.controller.ts:54`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `INTEGRATION_TEST`, `BROWSER`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** O clique em cada faixa de aging deve filtrar pela idade do finding com limites corretos e produzir na UI a mesma população representada no gráfico.

### FRONTEND-003 — Erro de API mascarado como loading/vazio

- **Requisitos:** S18-R045, S19-R031, S31-R049.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** diversas páginas/dashboards web e queries subordinadas mobile não tratam `isError`; falha vira loading indefinido, zero ou vazio legítimo.
- **Evidência:** `project-detail-page.tsx:75`; `finding-detail-page.tsx:33`; `maturity-assessment-page.tsx:51`; `applications-page.tsx:31`; dashboards; mobile Project/Finding detail.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `BROWSER`, `DEVICE`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Falhas de API devem aparecer como estado de erro distinto de loading/vazio, com retry quando recuperável, nas páginas web e mobile afetadas.

### FRONTEND-004 — Linha clicável não é operável por teclado

- **Requisito:** S17-R054.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** `<tr onClick>` sem controle nativo, foco, role ou teclado.
- **Evidência:** `projects-page.tsx:42-46`; `components/ui/table.tsx:193-201`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `BROWSER`, `ACCESSIBILITY`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Navegação de Project deve ser operável via teclado e possuir semântica, foco e ativação adequados.

### FRONTEND-005 — Gráficos ignoram tokens semânticos

- **Requisito:** S17-R012.
- **Status:** `DIVERGENT`; **confiança:** HIGH.
- **Observado:** donut/radar usam hex fixo, independente do tema/tokens.
- **Evidência:** `tokens.css:12,361,483`; `severity-colors.ts:11`; `severity-donut.tsx:33`; `maturity-radar.tsx:27`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `BROWSER`, `MANUAL_VISUAL`, `ACCESSIBILITY`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Donut de dashboard e radar de maturidade devem consumir tokens semânticos e manter contraste adequado nos temas suportados.

### FRONTEND-006 — Série estimada não é rotulada como aproximação

- **Requisitos:** S16-R018/R019/R036; S34-R058.
- **Status:** `NOT_IMPLEMENTED`; **confiança:** HIGH.
- **Observado:** service estima risk score temporal, mas página e gráfico descrevem “Risk score ao longo do tempo”/“soma ponderada” sem informar aproximação.
- **Evidência:** `metrics.service.ts`; `application-dashboard-page.tsx:275-279`; `metrics/charts.tsx:405-453`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `BROWSER`, `MANUAL_VISUAL`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Página, gráfico e textos associados devem identificar explicitamente a série temporal como estimativa/aproximação.

### TESTS-001 — Cobertura ≥80% não é gate

- **Requisito:** S25-R007.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** coverage é gerada, mas Jest não define `coverageThreshold`; Sonar está pendente.
- **Evidência:** `app/api/package.json:13`; `jest.config.ts:1-20`; `build.yml:85-94`; `docs/evidencias/sonarqube/README.md`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `CI_PIPELINE`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Após resolver o conflito de metas documentais, o pipeline deve falhar abaixo do threshold ratificado e passar quando a cobertura o satisfizer.

### TESTS-002 — Cobertura lógica de fluxos críticos é incompleta

- **Requisitos:** S24-R007, S25-R085..R088/R110/R113/R118, S31-R001..R007/R044.
- **Status:** `PARTIAL`; **confiança:** HIGH.
- **Observado:** não há teste browser de PDFs, exceção Expo cross-layer, refresh expirado/concorrente, logout repetido, mobile ou `diffJson` inválido. Teste de memória de upload mede após alocar o buffer cliente.
- **Evidência:** `web/src/lib/pdf/*`; `report.test.ts`; `push.util.test.ts`; `vulnerability-push.test.ts`; `auth.test.ts`; `metrics.test.ts:95`; `evidence-security.test.ts:299`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `UNIT_TEST`, `INTEGRATION_TEST`, `BROWSER`, `DEVICE`, `EXTERNAL_INTEGRATION`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Os fluxos críticos enumerados devem possuir testes representativos que executem nos ambientes correspondentes e detectem regressões nos comportamentos auditados.

## Finding P3

### BACKEND-002 — Vulnerabilities sem filtros/paginação

- **Requisitos:** S10-R081..R084.
- **Status:** `NOT_IMPLEMENTED`; **confiança:** HIGH.
- **Observado:** controller aceita apenas `projectId`; queries não têm severity/status/OWASP/skip/take.
- **Evidência:** `vulnerability.controller.ts:29-32`; `vulnerability.repository.ts:49-57`.
- **STATIC_EVIDENCE:** `CONFIRMED`.
- **VALIDATION_REQUIRED:** `UNIT_TEST`, `INTEGRATION_TEST`.
- **VALIDATION_STATUS:** `NOT_RUN`.
- **CLOSURE_CRITERIA:** Quando a escala/UX exigir, API e consumidores devem aplicar filtros e paginação consistentes, com contrato e resultados cobertos por testes.

## Sem severidade técnica / não validados

### SPEC-002 — Semântica do sentinel Enterprise requer decisão (BUSINESS-006 refutado)

- **Requisitos:** S07-R004, S31-R021 e ambiguidade canônica S05-R034.
- **Status:** `NOT_APPLICABLE` como defeito técnico; **severidade:** NONE; **confiança:** HIGH.
- **Observado:** seed usa 999, backend compara numericamente e UI apresenta “Até 999”, mas a Checklist marca explicitamente a semântica de “ilimitado” como ambígua.
- **Evidência:** `prisma/seed.ts:75,79`; `application.service.ts:63`; `plans-page.tsx:95`.
- **Adjudicação:** decisão de especificação; não incluir como correção do MVP antes de ratificar o contrato.

### VALIDATION-001 — Visual, runtime e integrações externas

- **Status:** `NOT_VALIDATED`; **auditabilidade:** MANUAL_VISUAL/RUNTIME_REQUIRED.
- Não foram executados Compose, migrations, testes, browser, responsividade 375/768/1440, leitor de tela, geração/abertura real de PDF, performance <500 ms, Expo/device/push real, Sonar ou ZAP.
- Requisitos dependentes permanecem explicitamente `NOT_VALIDATED`, não `NOT_IMPLEMENTED`.

### VALIDATION-002 — ZIP adicional ausente

- **Status:** `NOT_VALIDATED`; nenhum `.zip` está acessível no baseline/workspace atual, portanto não foi possível comparar repositório e ZIP.

### SPEC-001 — Conflitos/ambiguidades preservados

- **Status:** `NOT_APPLICABLE` à conclusão de implementação até adjudicação.
- Inclui S06-R038; S07-R028/R057/R060; S09-R012/R016; S10-R073; S11-R044; S20-R019; S21-R033; S22-R001; S23-R031; S33-R001..R035.
- Itens OUT_OF_MVP permanecem fora do backlog funcional do MVP.

## Cobertura por seção

| Seção | Resultado da auditoria |
|---|---|
| S00–S01 | Processo/contexto rastreado; implementação agregada resolvida pelos domínios canônicos |
| S02 | 53/53 roteados; exceções SECURITY-001/003 e ambiguidade de convite |
| S03 | 38/38 inspecionados; arquitetura predominante presente; conflitos mantidos |
| S04 | 37/37; estrutura estática presente, INFRA-001, runtime e 4 OUT_OF_MVP |
| S05 | 107/107; schema/migration inspecionados; BUSINESS-002/DATA-001 e marcadores |
| S06 | 50/50; auth base presente; AUTH-001/002, SECURITY-002/004; runtime não validado |
| S07 | 61/61; fluxo presente com BUSINESS-001/002/005/006, SECURITY-003 e marcadores |
| S08 | 28/28; CRUD/tenant presentes; SECURITY-001 e BUSINESS-007 |
| S09 | 54/54; CRUD/membership/máquina v4 presentes; BUSINESS-003/008, SECURITY-001 e conflitos |
| S10 | 85/85; CVSS/override/máquina presentes estaticamente; BACKEND-002 e atomicidade BUSINESS-004 |
| S11 | 44/44; hardening principal presente; EVIDENCE-001/002 e conflito whitelist |
| S12 | 12/12; fluxo presente; BUSINESS-009 e desempate temporal parcial |
| S13 | 17/17; eventos chamados; BUSINESS-004 |
| S14 | 63/63; API e geração client-side localizadas; runtime PDF não validado; 3 OUT_OF_MVP |
| S15 | 18/18; dashboards por role localizados; erros parciais e marcadores |
| S16 | 70/70; endpoints/painel localizados; FRONTEND-001/002; performance/visual não validados |
| S17 | 86/86; design system presente; FRONTEND-004/005; contraste/leitor/telas não validados |
| S18 | 53/53; rotas/infra web presentes; FRONTEND-003 e visual não validado |
| S19 | 46/46; mobile CLIENT/SecureStore/read-only presentes; FRONTEND-003; device não validado |
| S20 | 25/25; push code/mocks presentes; entrega real não validada e conflito de preferências |
| S21 | 45/45; maturidade full-stack presente; MATURITY-001/002 e ambiguidade |
| S22 | 9/9 condicionais à ambiguidade de escopo; não viram ausência do MVP |
| S23 | 51/51; superfícies inspecionadas; SECURITY-001/002/004; ZAP/CVE não validados |
| S24 | 13/13; logging/tratamento parcial; TESTS-002 e ambiguidade Pino |
| S25 | 127/127 inventariados; ampla integração API, lacunas TESTS-001/002; execução não validada |
| S26 | 32/32; INFRA-002; Sonar/ZAP não validados; 3 OUT_OF_MVP |
| S27 | 22/22; seeds presentes estaticamente; execução/idempotência não validadas |
| S28 | 47/47 processo/documentação; evidências e demo runtime não validadas |
| S29 | 11/11; health/scripts/Compose localizados; runtime não validado |
| S30 | 24/24 OUT_OF_MVP — nenhum convertido em pendência MVP |
| S31 | 54/54 resolvidos pelos requisitos/findings canônicos ou NOT_VALIDATED |
| S32 | 12/12 limitações rastreadas como documentação/risco residual |
| S33 | 36/36 conflitos/ambiguidade preservados; sem julgamento arbitrário |
| S34 | 76/76 encaminhados à validação de fluxo e `RESOLVED_BY` canônicos |
| S35 | 24/24 gates derivados; resolvidos por findings/processo/runtime |
| S36 | 55/55 processo/manual; evidência preexistente ou `NOT_VALIDATED` |
