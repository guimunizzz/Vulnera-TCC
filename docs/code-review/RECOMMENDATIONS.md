# Vulnera — Recomendações e Backlog Priorizado

Este documento contém somente ações futuras. Nenhuma recomendação foi aplicada durante a auditoria.

Estado atual reconciliado do backlog técnico: **P0: 0; P1: 9; P2: 22; P3: 1; total: 32**. Decisões de especificação e validações gerais permanecem em seções próprias e não integram esses totais.

## P0 — Crítico

Nenhuma ação P0 foi sustentada pela evidência e pela revisão adversarial.

## P1 — Alta prioridade

- [ ] **[SECURITY-001] Restringir updates de Application e Project a allowlists server-side.**
  - **Finding:** `SECURITY-001`; **Requisito(s):** S02-R051, S08-R017, S09-R027, S23-R006/R013, S31-R010; **Módulo/domínio afetado:** Application, Project, autorização e tenancy.
  - **Arquivos principais envolvidos:** `app/api/src/controllers/application.controller.ts:77`, `application.service.ts:70`, `application.repository.ts:40`, `project.controller.ts:88`, `project.service.ts:95`, `project.repository.ts:60`, `app/api/prisma/schema.prisma:183,211`.
  - **Problema atual:** payloads genéricos alcançam o Prisma e permitem mutar campos protegidos, contornando invariantes, transição e AuditLog.
  - **Resultado esperado após correção:** somente campos autorizados são aceitos e tenant, vínculos, status e timestamps são preservados; **Validação necessária para fechar:** `INTEGRATION_TEST` cobrindo payloads forjados e invariantes; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[SECURITY-002] Eliminar defaults JWT previsíveis do runtime de demonstração.**
  - **Finding:** `SECURITY-002`; **Requisito(s):** S23-R038, relacionado a S06-R017; **Módulo/domínio afetado:** Compose, JWT e autorização ADMIN.
  - **Arquivos principais envolvidos:** `docker-compose.yml:35,45,47,52`, `app/api/src/utils/jwt.util.ts:27,49`, `require-role.middleware.ts:16`, `plan.routes.ts:14`, `plan.service.ts:18`.
  - **Problema atual:** o Compose fornece fallbacks JWT conhecidos e a autorização confia no role assinado sem reconsultar o ator.
  - **Resultado esperado após correção:** o runtime falha fechado sem secrets externos imprevisíveis; **Validação necessária para fechar:** `COMPOSE_RUNTIME` comprovando que defaults conhecidos não autenticam; **Dependências ou decisões de especificação:** a exposição efetiva do Compose permanece não validada.

- [ ] **[AUTH-001] Tornar o consumo do refresh one-time e atômico.**
  - **Finding:** `AUTH-001`; **Requisito(s):** S06-R029, S31-R004; **Módulo/domínio afetado:** Auth e RefreshToken.
  - **Arquivos principais envolvidos:** `app/api/src/services/auth.service.ts:54,63,68`, `refresh-token.repository.ts:28,32`, `tests/integration/auth.test.ts:99`.
  - **Problema atual:** leitura, revogação e emissão são separadas, permitindo mais de um sucessor em replay concorrente.
  - **Resultado esperado após correção:** no máximo uma rotação produz sucessor válido; **Validação necessária para fechar:** `CONCURRENCY_TEST` e `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[BUSINESS-001] Aplicar elegibilidade de Plan ativo na contratação e aprovação.**
  - **Finding:** `BUSINESS-001`; **Requisito(s):** S07-R006/S07-R036; **Módulo/domínio afetado:** Company, Subscription e Plan.
  - **Arquivos principais envolvidos:** `company.service.ts:42,46`, `subscription.service.ts:35,39`, `schema.prisma:140,146`.
  - **Problema atual:** os fluxos verificam existência do Plan, mas não `isActive`.
  - **Resultado esperado após correção:** Plan inativo não gera nem aprova nova contratação; **Validação necessária para fechar:** `INTEGRATION_TEST` em todos os caminhos de contratação; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[BUSINESS-002] Garantir no máximo uma Subscription ACTIVE por Company sob concorrência.**
  - **Finding:** `BUSINESS-002`; **Requisito(s):** S05-R043/R044, S07-R046/R049, S31-R017; **Módulo/domínio afetado:** Subscription e persistência.
  - **Arquivos principais envolvidos:** `subscription.service.ts:79-91`, `subscription.repository.ts:35-38,51-55`, `schema.prisma:156-174`.
  - **Problema atual:** check e update separados não oferecem garantia transacional ou persistente de unicidade ACTIVE.
  - **Resultado esperado após correção:** concorrência preserva uma única Subscription ACTIVE por Company; **Validação necessária para fechar:** `CONCURRENCY_TEST` e `DATABASE_RUNTIME`; **Dependências ou decisões de especificação:** definir a estratégia transacional/persistente.

- [ ] **[BUSINESS-003] Aplicar Subscription ACTIVE ao criar Project.**
  - **Finding:** `BUSINESS-003`; **Requisito(s):** S09-R002/R003, S31-R016; **Módulo/domínio afetado:** Project, Subscription e Plan.
  - **Arquivos principais envolvidos:** `app/api/src/services/project.service.ts:35,64,67,75`, `schema.prisma:143`.
  - **Problema atual:** criação de Project não consulta Subscription, Plan ou contagem de Projects.
  - **Resultado esperado após correção:** Company sem Subscription ACTIVE não cria Project; **Validação necessária para fechar:** `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** `maxProjects` (S09-R003) deve ser ratificado separadamente antes de virar contrato obrigatório.

- [ ] **[BUSINESS-004] Unificar mutação sensível e AuditLog em uma unidade consistente.**
  - **Finding:** `BUSINESS-004`; **Requisito(s):** S13-R001..R017; **Módulo/domínio afetado:** Subscription, Project, Vulnerability, Report e AuditLog.
  - **Arquivos principais envolvidos:** `subscription.service.ts:45`, `project.service.ts:125`, `vulnerability.service.ts:315`, `report.service.ts:189`.
  - **Problema atual:** a entidade muda antes do AuditLog, sem transação, inclusive em DELETE irreversível.
  - **Resultado esperado após correção:** mutação e log confirmam ou revertem juntos; **Validação necessária para fechar:** `INTEGRATION_TEST` e `DATABASE_RUNTIME` com falha induzida do log; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[INFRA-002] Restaurar reprodutibilidade do CI.**
  - **Finding:** `INFRA-002`; **Requisito(s):** S26-R002..R008, S25-R010; **Módulo/domínio afetado:** CI, dependências e gates de qualidade.
  - **Arquivos principais envolvidos:** `.github/workflows/build.yml:20-29,35-45,49-88`, `.gitignore:5,68`, `app/api/package.json`.
  - **Problema atual:** o workflow usa `npm ci` e cache de um lockfile ausente/ignorado.
  - **Resultado esperado após correção:** checkout limpo possui instalação determinística e executa todos os gates; **Validação necessária para fechar:** `CI_PIPELINE`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[METRICS-001] Aplicar os mesmos filtros a todas as métricas e comparações.**
  - **Finding:** `METRICS-001`; **Requisito(s):** S16-R052..R055, S34-R056, S35-R011; **Módulo/domínio afetado:** Metrics backend, analytics web e cross-filter.
  - **Arquivos principais envolvidos:** `metrics.controller.ts:54-66`, `metrics.service.ts:184,215-224,269-292,363-368,498-512`, `metrics.repository.ts:82-89,147-190,234-274,310-353`.
  - **Problema atual:** consultas Prisma, SQL raw e comparison usam populações diferentes sob os mesmos filtros.
  - **Resultado esperado após correção:** KPIs, gráficos, séries e comparison usam a mesma população; **Validação necessária para fechar:** `INTEGRATION_TEST` e `BROWSER` com combinações de cross-filter; **Dependências ou decisões de especificação:** nenhuma documentada.

## P2 — Média prioridade

### Autorização, autenticação e validação

- [ ] **[SECURITY-003] Aplicar `role/companyRole` no create/update de Company.**
  - **Finding:** `SECURITY-003`; **Requisito(s):** S02-R003/R005/R027, S07-R015/R016/R027; **Módulo/domínio afetado:** Company, roles e tenancy.
  - **Arquivos principais envolvidos:** `company.routes.ts:21,24`, `company.service.ts:42,54,80`, `user.repository.ts:71`.
  - **Problema atual:** qualquer autenticado pode criar Company/virar OWNER, e MEMBER pode editar Company.
  - **Resultado esperado após correção:** create/update respeitam role/companyRole e impedem vínculos incompatíveis; **Validação necessária para fechar:** `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[AUTH-002] Normalizar e-mail e traduzir colisões persistentes.**
  - **Finding:** `AUTH-002`; **Requisito(s):** S06-R003/R004; **Módulo/domínio afetado:** Auth e User.
  - **Arquivos principais envolvidos:** `auth.controller.ts:43,63`, `auth.service.ts:29`, `user.repository.ts:29`, `schema.prisma:62`.
  - **Problema atual:** register/login usam o valor original e colisões concorrentes podem virar 500.
  - **Resultado esperado após correção:** normalização é uniforme e conflitos retornam erro estável; **Validação necessária para fechar:** `UNIT_TEST` e `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[SECURITY-004] Adicionar rate limiting a login e upload.**
  - **Finding:** `SECURITY-004`; **Requisito(s):** S06-R016, S23-R032..R036; **Módulo/domínio afetado:** Auth, Evidence upload e segurança operacional.
  - **Arquivos principais envolvidos:** `app.ts:7`, `auth.routes.ts:8`, `evidence.routes.ts:11`, `upload.middleware.ts:21`, `app/api/package.json:41`.
  - **Problema atual:** login e upload não limitam frequência; o limite Multer atua apenas por request.
  - **Resultado esperado após correção:** excesso é limitado por política definida e fluxos normais permanecem funcionais; **Validação necessária para fechar:** `INTEGRATION_TEST` e `SECURITY_SCAN`; **Dependências ou decisões de especificação:** definir janela/chave sem introduzir Redis fora do MVP.

- [ ] **[BACKEND-001] Completar a validação de User update.**
  - **Finding:** `BACKEND-001`; **Requisito(s):** S06-R047; **Módulo/domínio afetado:** User e contratos HTTP.
  - **Arquivos principais envolvidos:** `user.controller.ts:45,66`, `user.service.ts:53`, `user.repository.ts:49`.
  - **Problema atual:** name/email não possuem validação, normalização e tratamento de conflito completos.
  - **Resultado esperado após correção:** entradas inválidas e conflitos previsíveis geram respostas controladas; **Validação necessária para fechar:** `UNIT_TEST` e `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** nenhuma documentada.

### Integridade e regras de negócio

- [ ] **[BUSINESS-005] Tornar o onboarding composto recuperável e consistente.**
  - **Finding:** `BUSINESS-005`; **Requisito(s):** S07-R015..R017; **Módulo/domínio afetado:** onboarding, Company, OWNER e Subscription.
  - **Arquivos principais envolvidos:** `company.service.ts:54`, `onboarding-page.tsx:60`, `subscription.service.ts:45`.
  - **Problema atual:** falha intermediária deixa Company vinculada e bloqueia retry.
  - **Resultado esperado após correção:** nenhuma etapa deixa estado parcial irrecuperável; **Validação necessária para fechar:** `INTEGRATION_TEST` e `DATABASE_RUNTIME` com falha em cada etapa; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[BUSINESS-007] Proteger `maxApplications` contra corrida.**
  - **Finding:** `BUSINESS-007`; **Requisito(s):** S08-R011/R012/R014; **Módulo/domínio afetado:** Application, Plan e capacidade.
  - **Arquivos principais envolvidos:** `application.service.ts:62-66`, `application.repository.ts:23,27`, `schema.prisma:183-200`.
  - **Problema atual:** count e create separados permitem ultrapassar o limite sob concorrência.
  - **Resultado esperado após correção:** criações concorrentes respeitam a capacidade efetiva; **Validação necessária para fechar:** `CONCURRENCY_TEST` e `DATABASE_RUNTIME`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[BUSINESS-008] Proteger criação e transição de Project contra check-then-act concorrente.**
  - **Finding:** `BUSINESS-008`; **Requisito(s):** S09-R011/R019, S31-R022; **Módulo/domínio afetado:** Project, máquina de estados e AuditLog.
  - **Arquivos principais envolvidos:** `project.service.ts:75-89,107-127`, `project.repository.ts:35,56,64`, `schema.prisma:211-238`.
  - **Problema atual:** criação/transição incondicionais podem produzir duplicidade, estado e logs incompatíveis.
  - **Resultado esperado após correção:** concorrência preserva a unicidade e a máquina ratificadas; **Validação necessária para fechar:** `CONCURRENCY_TEST` e `DATABASE_RUNTIME`; **Dependências ou decisões de especificação:** não adjudicar S09-R012 (1:1/histórico) nesta correção.

- [ ] **[BUSINESS-009] Revalidar tenant/membership no DELETE de Comment.**
  - **Finding:** `BUSINESS-009`; **Requisito(s):** S12-R012, S31-R025; **Módulo/domínio afetado:** Vulnerability Comment, tenancy e membership.
  - **Arquivos principais envolvidos:** `vulnerability-comment.controller.ts:66`, `vulnerability-comment.service.ts:63,67,72`.
  - **Problema atual:** delete ignora o `vulnId` pai e não revalida acesso atual.
  - **Resultado esperado após correção:** acesso residual é negado e o parent da rota é conferido; **Validação necessária para fechar:** `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[DATA-001] Definir e aplicar integridade referencial às relações críticas.**
  - **Finding:** `DATA-001`; **Requisito(s):** S05-R071 e relações de maturidade; **Módulo/domínio afetado:** Prisma, Vulnerability, User e MaturityAssessment.
  - **Arquivos principais envolvidos:** `schema.prisma:294-307,416-426`, migration inicial `:370-380`, `maturity.repository.ts:30`, `user.repository.ts:79`.
  - **Problema atual:** autoria e vínculos de maturidade são escalares sem relation/FK, enquanto User pode ser removido fisicamente.
  - **Resultado esperado após correção:** relações e deleções preservam integridade conforme o contrato; **Validação necessária para fechar:** `DATABASE_RUNTIME` e `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** definir a política referencial antes da alteração futura.

- [ ] **[MATURITY-002] Tornar o batch de maturidade atômico.**
  - **Finding:** `MATURITY-002`; **Requisito(s):** S21-R025/R029; **Módulo/domínio afetado:** Maturity scores e persistência.
  - **Arquivos principais envolvidos:** `maturity.service.ts:66-90`, `maturity.repository.ts:55,69`.
  - **Problema atual:** erro tardio preserva upserts anteriores e concorrência pode deixar média obsoleta.
  - **Resultado esperado após correção:** batch e média refletem um único estado consistente; **Validação necessária para fechar:** `CONCURRENCY_TEST` e `DATABASE_RUNTIME`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[MATURITY-001] Alinhar maturidade à ADR-018 vigente.**
  - **Finding:** `MATURITY-001`; **Requisito(s):** S21-R010, conflito canônico S05-R099; **Módulo/domínio afetado:** Maturity backend, UI e PDF.
  - **Arquivos principais envolvidos:** `maturity.service.ts:33,90`, `maturity.repository.ts:69`, `maturity-assessment-page.tsx:166`, `pdf/executive.ts:104`.
  - **Problema atual:** backend persiste e UI/PDF exibem nível categórico removido pelo requisito vigente.
  - **Resultado esperado após correção:** comportamento exposto segue a ADR-018; **Validação necessária para fechar:** `UNIT_TEST` e `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** uma nova decisão formal pode substituir a ADR vigente, mas não deve ser presumida.

### Evidence e segurança operacional

- [ ] **[EVIDENCE-001] Exigir `proof` não vazio e com limites claros.**
  - **Finding:** `EVIDENCE-001`; **Requisito(s):** S11-R006; **Módulo/domínio afetado:** Evidence web, controller, service e persistência.
  - **Arquivos principais envolvidos:** `evidence-uploader.tsx:52,58`, `evidence.controller.ts:31`, `evidence.service.ts:163,192`, `schema.prisma:333`.
  - **Problema atual:** web envia vazio, controller aplica fallback e service persiste sem validar.
  - **Resultado esperado após correção:** somente proof válido é aceito e persistido; **Validação necessária para fechar:** `UNIT_TEST` e `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** definir limites do campo sem inventá-los nesta fase.

- [ ] **[EVIDENCE-002] Implementar o ciclo de DELETE de Evidence após definir suas regras.**
  - **Finding:** `EVIDENCE-002`; **Requisito(s):** S11-R033..R038; **Módulo/domínio afetado:** Evidence API, persistência e armazenamento.
  - **Arquivos principais envolvidos:** `evidence.routes.ts:9`, `evidence.controller.ts:4`, `evidence.service.ts:155`, `evidence.repository.ts:18`.
  - **Problema atual:** rotas, controller, service e repository não oferecem DELETE.
  - **Resultado esperado após correção:** remoção respeita autorização, auditoria e consistência banco/arquivo; **Validação necessária para fechar:** `INTEGRATION_TEST` e `DATABASE_RUNTIME`; **Dependências ou decisões de especificação:** definir roles, ownership, auditoria e política de consistência antes de implementar.

- [ ] **[INFRA-001] Corrigir o template local `SERVER_PORT`/`PORT`.**
  - **Finding:** `INFRA-001`; **Requisito(s):** S04-R026; **Módulo/domínio afetado:** configuração e setup local da API.
  - **Arquivos principais envolvidos:** `app/api/.env.example:2`, `app/api/src/server.ts:5`, `config/EnvVar.ts:10-24`.
  - **Problema atual:** o template declara uma variável diferente da exigida pelo servidor.
  - **Resultado esperado após correção:** o setup local documentado inicia sem ajuste manual do nome da porta; **Validação necessária para fechar:** `INTEGRATION_TEST` do setup local; **Dependências ou decisões de especificação:** o Compose principal já fornece `PORT` e deve permanecer funcional.

### Frontend, analytics e UX

- [ ] **[FRONTEND-001] Conectar a busca textual do analytics ou retirar o controle.**
  - **Finding:** `FRONTEND-001`; **Requisito(s):** S16-R056; **Módulo/domínio afetado:** analytics web e Metrics API.
  - **Arquivos principais envolvidos:** `filter-bar.tsx:321`, `use-filtros-metricas.ts:44,186,239`, `metrics.types.ts:91`, `metrics.api.ts:33`, `metrics.controller.ts:54`.
  - **Problema atual:** URL/chip mantêm `busca`, mas o valor não chega ao backend.
  - **Resultado esperado após correção:** busca altera resultados ponta a ponta ou deixa de ser apresentada; **Validação necessária para fechar:** `INTEGRATION_TEST` e `BROWSER`; **Dependências ou decisões de especificação:** escolher entre implementar o contrato ou retirar temporariamente o controle.

- [ ] **[FRONTEND-002] Corrigir o cross-filter de aging.**
  - **Finding:** `FRONTEND-002`; **Requisito(s):** S16-R030; **Módulo/domínio afetado:** analytics, gráficos e filtros.
  - **Arquivos principais envolvidos:** `metrics/charts.tsx:221-274`, `use-filtros-metricas.ts:201-215`, `metrics.types.ts:91`, `metrics.controller.ts:54`.
  - **Problema atual:** clique traduz idade para período de criação, alterando a semântica.
  - **Resultado esperado após correção:** cada faixa filtra pela idade representada com limites corretos; **Validação necessária para fechar:** `INTEGRATION_TEST` e `BROWSER`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[FRONTEND-003] Diferenciar erro de loading/vazio em web e mobile.**
  - **Finding:** `FRONTEND-003`; **Requisito(s):** S18-R045, S19-R031, S31-R049; **Módulo/domínio afetado:** páginas, dashboards e queries web/mobile.
  - **Arquivos principais envolvidos:** `project-detail-page.tsx:75`, `finding-detail-page.tsx:33`, `maturity-assessment-page.tsx:51`, `applications-page.tsx:31`, dashboards e mobile Project/Finding detail.
  - **Problema atual:** ausência de `isError` transforma falha em loading indefinido, zero ou vazio legítimo.
  - **Resultado esperado após correção:** falha tem estado próprio e retry quando recuperável; **Validação necessária para fechar:** `BROWSER` e `DEVICE`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[FRONTEND-004] Tornar a navegação de Project operável por teclado.**
  - **Finding:** `FRONTEND-004`; **Requisito(s):** S17-R054; **Módulo/domínio afetado:** tabela de Projects e acessibilidade.
  - **Arquivos principais envolvidos:** `projects-page.tsx:42-46`, `components/ui/table.tsx:193-201`.
  - **Problema atual:** `<tr onClick>` não possui semântica, foco ou ativação por teclado.
  - **Resultado esperado após correção:** navegação possui controle/semântica e foco adequados; **Validação necessária para fechar:** `BROWSER` e `ACCESSIBILITY`; **Dependências ou decisões de especificação:** nenhuma documentada.

- [ ] **[FRONTEND-005] Fazer gráficos consumirem tokens semânticos.**
  - **Finding:** `FRONTEND-005`; **Requisito(s):** S17-R012; **Módulo/domínio afetado:** donut do dashboard, radar de maturidade e temas.
  - **Arquivos principais envolvidos:** `tokens.css:12,361,483`, `severity-colors.ts:11`, `severity-donut.tsx:33`, `maturity-radar.tsx:27`.
  - **Problema atual:** donut/radar usam hex fixo, independente dos tokens e do tema.
  - **Resultado esperado após correção:** ambos usam tokens e mantêm contraste por tema; **Validação necessária para fechar:** `BROWSER`, `MANUAL_VISUAL` e `ACCESSIBILITY`; **Dependências ou decisões de especificação:** escopo restrito aos dois gráficos adjudicados.

- [ ] **[FRONTEND-006] Rotular a série temporal de risk score como aproximação.**
  - **Finding:** `FRONTEND-006`; **Requisito(s):** S16-R018/R019/R036, S34-R058; **Módulo/domínio afetado:** Metrics, dashboard e comunicação analítica.
  - **Arquivos principais envolvidos:** `metrics.service.ts`, `application-dashboard-page.tsx:275-279`, `metrics/charts.tsx:405-453`.
  - **Problema atual:** uma série estimada é descrita sem informar sua natureza aproximada.
  - **Resultado esperado após correção:** página e gráfico rotulam explicitamente a estimativa; **Validação necessária para fechar:** `BROWSER` e `MANUAL_VISUAL`; **Dependências ou decisões de especificação:** nenhuma documentada.

### Testes e qualidade

- [ ] **[TESTS-001] Transformar a meta de coverage em gate verificável.**
  - **Finding:** `TESTS-001`; **Requisito(s):** S25-R007; **Módulo/domínio afetado:** Jest, Sonar e CI.
  - **Arquivos principais envolvidos:** `app/api/package.json:13`, `jest.config.ts:1-20`, `build.yml:85-94`, `docs/evidencias/sonarqube/README.md`.
  - **Problema atual:** coverage é gerada, mas não existe threshold que bloqueie regressão; Sonar está pendente.
  - **Resultado esperado após correção:** o pipeline aplica a meta ratificada; **Validação necessária para fechar:** `CI_PIPELINE` com cenários abaixo/acima do threshold; **Dependências ou decisões de especificação:** resolver primeiro o conflito de metas documentais.

- [ ] **[TESTS-002] Cobrir os fluxos críticos ainda sem teste representativo.**
  - **Finding:** `TESTS-002`; **Requisito(s):** S24-R007, S25-R085..R088/R110/R113/R118, S31-R001..R007/R044; **Módulo/domínio afetado:** API, web, mobile, PDF, push, sessão, metrics e upload.
  - **Arquivos principais envolvidos:** `web/src/lib/pdf/*`, `report.test.ts`, `push.util.test.ts`, `vulnerability-push.test.ts`, `auth.test.ts`, `metrics.test.ts:95`, `evidence-security.test.ts:299`.
  - **Problema atual:** os fluxos enumerados não têm cobertura representativa e o teste de upload grande mede memória após alocação cliente.
  - **Resultado esperado após correção:** testes detectam regressões nos ambientes correspondentes; **Validação necessária para fechar:** `UNIT_TEST`, `INTEGRATION_TEST`, `BROWSER`, `DEVICE` e `EXTERNAL_INTEGRATION`; **Dependências ou decisões de especificação:** Playwright não deve ser presumido como requisito obrigatório.

## P3 — Melhoria

- [ ] **[BACKEND-002] Adicionar filtros e paginação à listagem de Vulnerabilities quando a escala/UX exigir.**
  - **Finding:** `BACKEND-002`; **Requisito(s):** S10-R081..R084; **Módulo/domínio afetado:** Vulnerability API, repository e consumidores.
  - **Arquivos principais envolvidos:** `vulnerability.controller.ts:29-32`, `vulnerability.repository.ts:49-57`.
  - **Problema atual:** a listagem aceita apenas `projectId` e não possui severity/status/OWASP/skip/take.
  - **Resultado esperado após correção:** API e consumidores aplicam filtros e paginação consistentes; **Validação necessária para fechar:** `UNIT_TEST` e `INTEGRATION_TEST`; **Dependências ou decisões de especificação:** executar quando a escala/UX justificar, preservando a prioridade P3.

## Decisões de especificação — não executar como correção antes de ratificar

- [ ] Definir a semântica oficial de Enterprise “ilimitado”; o valor 999 atual é evidência da ambiguidade S05-R034, não bug adjudicado.
- [ ] Resolver S07-R028 (DELETE de Company e histórico).
- [ ] Resolver estados SUSPENDED/CANCELED de Subscription.
- [ ] Decidir central de Notification in-app e preferências por categoria.
- [ ] Resolver reutilização histórica/1:1 e máquina canônica de Project.
- [ ] Decidir bypass administrativo da máquina de Vulnerability.
- [ ] Preservar whitelist endurecida de Evidence até ratificar GIF/WebP.
- [ ] Ratificar Helmet/CSP com base na política final e scan.
- [ ] Sincronizar ADRs, Contexto Mestre, README/DEMO e conflitos S33.

## Validações obrigatórias antes de declarar pronto

- [ ] Executar testes/migrations em banco isolado sem modificar o workspace auditado e guardar evidência.
- [ ] Subir o Compose em ambiente controlado, validar health, portas, secrets e fluxo de demo do zero.
- [ ] Validar PDFs executivo/técnico com dados realistas, Unicode e Evidence.
- [ ] Executar browser real em 375/768/1440, contraste, teclado e leitor de tela.
- [ ] Executar mobile em aparelho físico e push real, incluindo permissão negada e navegação segura.
- [ ] Medir performance do analytics no cenário documentado e testar coerência de filtros.
- [ ] Executar/evidenciar Sonar e revisar hotspots.
- [ ] Reexecutar ZAP baseline e adjudicar alertas.
- [ ] Comparar repositório e ZIP caso o artefato adicional seja disponibilizado.

## Exclusões conscientes

Não adicionar ao backlog do MVP, salvo reabertura explícita: IA/Gemini, chat/Socket.IO, SupportTicket, e-mail transacional/reset, pagamento real, Prometheus/Grafana, Redis/filas/workers, Playwright como requisito obrigatório, deploy cloud, i18n, mobile ADMIN/PENTESTER, SAMM completo, malware engine, NVD/scanners e execução real de ataques.
