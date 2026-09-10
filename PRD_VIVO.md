# PRD_VIVO.md — Estado atual do projeto Vulnera

> **ATENÇÃO — Para agentes de código (Claude Code, Cursor, etc.):**
>
> Este arquivo é a **fonte da verdade do estado de implementação**. Leia-o ao
> iniciar QUALQUER sessão para saber:
>
> - O que JÁ foi entregue ✅
> - O que está EM PROGRESSO 🚧
> - O que está pendente 📋
>
> Ao concluir uma task, **atualize este arquivo** mudando o status correspondente
> antes de commitar. A última seção (§5) mostra como atualizar corretamente.

---

## 1. Estado geral do projeto

| Métrica            | Valor                               |
| ------------------ | ----------------------------------- |
| Sprint atual       | **Fase 9.2 — DAST: triagem, promoção para Vulnerability e comparação de scans** 🚧 em revisão (código pronto e validado na stack real, docs fechadas); Fase 8 (Maturidade + TCC) segue com Sonar bloqueado em Rafael |
| Data início        | 2026-06-10 (Sprint 0)               |
| Data alvo TCC      | 2026-10-25 (ver `docs/BACKLOG.md` v4) |
| Última atualização | 2026-09-09 por Claude Code (Fase 9.2: o pentester passa a **fazer algo** com o resultado — triar, promover pra `Vulnerability` e comparar execuções. Antes disso, os limites da 9.1 foram **medidos** na stack real: watchdog respeitando 2 simultâneos ✅, mas **sem teto de RAM/CPU por container** — corrigido. 333 → **353 testes backend** + 34 frontend + **6 E2E Playwright** contra a stack real. Ver §6 "Ponto de parada" e ADR-032) |

---

## 2. Visão por sprint

Legenda: 📋 backlog · 🚧 em progresso · ✅ feito · ❄️ pausado · ❌ cancelado

| Sprint                             | Foco                                       | Status | % concluído |
| ---------------------------------- | ------------------------------------------ | ------ | ----------- |
| 0 — Refactor                       | Alinhar código atual com CLAUDE.md v2      | ✅     | 100%        |
| 1 — Fundação                       | Infra, schema, server base, frontend setup | ✅     | 100% (11/11 ✅; KAN-108/109 feitos na Fase 3; KAN-110 completo em 2026-08-19 via task 8.12) |
| 2 — Auth + User                    | JWT, register, login, CRUD User            | ✅     | 100% (15/15 ✅; KAN-213/214/215 feitos na Fase 3; branch `feat/sprint-2-auth-user` ainda aguardando PR próprio) |
| 3 — Company + Plan + Subscription  | Onboarding e modelo comercial              | ✅     | 100% — concluída em 2026-08-04 |
| 4 — Application + Project + Member | Catálogo e gestão de projetos              | ✅     | 100% — concluída em 2026-08-04 |
| 5 — Vulnerability + Evidence       | Núcleo do produto                          | ✅     | 100% — concluída em 2026-08-05; **endurecida em 2026-08-07** (225 testes, cobertura ≥90%) |
| 6 — Relatórios + Dashboard         | PDFs e dashboards                          | ✅     | 100% — concluída em 2026-08-07 |
| **6.5 — Design System + Analytics** | **Tokens, componentes próprios, temas, métricas** | ✅ | **100% — concluída em 2026-08-09.** Inserida antes da Fase 7 de propósito: o mobile herda os tokens |
| 7 — Mobile enxuto + Push           | App mobile read-only (CLIENT) + Expo Push  | ✅     | 100% — concluída em 2026-08-10 |
| 8 — Maturidade + Apresentação      | Polimento e entrega                        | 🚧     | 69% (9/13 ✅ — CP1-3 concluídos + CP4 ZAP; Sonar bloqueado em Rafael, README/DEMO prontos) |
| **9 — DAST (OWASP ZAP)**           | **Scans automatizados: runner Docker, pipeline, API, UI, PDF** | ✅ | **100% — concluída em 2026-09-05.** Entrada fora da numeração original do BACKLOG v4 (prompt dado diretamente numa sessão dedicada) |
| **9.1 — DAST: scan real na stack** | **ZAP em modo daemon por scan, watchdog (máx. 2), % de progresso, simulado visível** | 🚧 | **Código completo e validado em 2026-09-09; em revisão do Rafael.** Fecha as 3 causas + a lacuna de produto de `docs/DAST-DOCKER-GAP.md`. Ver ADR-031 |
| **9.2 — DAST: o que fazer com o resultado** | **Triagem, promoção para `Vulnerability`, comparação entre execuções + limites de recurso** | 🚧 | **Código completo e validado na stack real em 2026-09-09; em revisão do Rafael.** Fecha os 4 pontos que o ADR-029 deixou em aberto e o buraco de recurso que a 9.1 não cobria. Ver ADR-032 |

---

## 3. Detalhamento por feature

### FEAT-00 — Refactor de estrutura

| Task                                                           | Status | Owner | Notas |
| -------------------------------------------------------------- | ------ | ----- | ----- |
| Criar pastas faltantes (factory/, middleware/, utils/, tests/) | ✅     | R     | —     |
| Auditar model files existentes                                 | ✅     | R     | plan e company reescritos no padrão type+DTO+entity |
| Criar factories pros recursos atuais                           | ✅     | R     | plan.factory.ts, company.factory.ts |
| Criar routes/routes.ts central                                 | ✅     | R     | registra /plans e /companies |
| Refatorar server.ts pra usar routes.ts                         | ✅     | R     | monta apiRoutes em /api, exporta app |
| Reescrever user.routes.ts pra usar factory                     | ✅     | R     | Removido — será recriado na Sprint 2 (junto com user.controller.ts) |
| Conformar Services (sem Prisma direto)                         | ✅     | R     | plan.service.ts e company.service.ts injetam repository |
| Conformar Repositories (sem lógica)                            | ✅     | R     | findAll/findById/create/update/delete via PrismaClient injetado |
| Adicionar scripts em package.json                              | ✅     | R     | dev/build/lint/test/prisma:* conforme §11; eslint+jest configurados |
| Aplicar schema.prisma revisado + migrate                       | 🚧     | R     | schema já revisado; falta `prisma migrate dev` (precisa MySQL local rodando) |
| Adicionar .env.example, .env.test                              | 🚧     | R     | .env.example existe; falta .env.test |
| Criar docker-compose.yml na raiz                               | 📋     | R     | —     |

---

### FEAT-01 — Fundação (Sprint 1)

| Task                                     | Status | Owner | PR  |
| ---------------------------------------- | ------ | ----- | --- |
| KAN-101: Schema + migrations             | ✅     | R     | Migration `20260615135850_initial` aplicada via CI (job `test` usa serviço mysql no GitHub Actions) |
| KAN-102: docker-compose                  | ✅     | R     | docker-compose.yml com mysql:8, mailhog, sonarqube na raiz do repo |
| KAN-103: /api/health                     | ✅     | R     | feat/sprint-1-foundation — testado via curl, retorna 200 ok |
| KAN-104: Jest + Supertest setup          | ✅     | R     | jest.config.ts, server dividido em app.ts + server.ts (fix Jest handle), smoke test health passando |
| KAN-105: GitHub Actions                  | ✅     | R     | 4 jobs: lint, build, test (serviço mysql ubuntu), sonarqube |
| KAN-106: ESLint + tsconfig strict        | ✅     | R     | feat/sprint-1-foundation — tsconfig com resolveJsonModule+exclude, lint e build sem erros |
| KAN-107: Seed inicial (TechNova + Admin) | ✅     | R     | `prisma/seed.ts` criado (3 Plans, 1 admin, 1 company TechNova, 1 subscription ACTIVE); script `db:seed` no package.json |
| KAN-108: React+Vite+Tailwind setup       | ✅     | Claude | feat/fase-3-empresas — bootstrap completo de app/web (Vite+React+TS+Tailwind), feito no Checkpoint 5 da Fase 3 |
| KAN-109: Componentes UI base             | ✅     | Claude | feat/fase-3-empresas — Button/Input/Label/Card/Alert/Dialog (Radix + Tailwind) |
| KAN-110: Landing page                    | ✅     | Claude | `fix/landing-publica` (2026-08-18) deixou o placeholder mínimo publicando "/"; **task 8.12 (2026-08-19) completou a cena "cyber-samurai"** descrita na issue original: `useHeroScene` (Three.js vanilla + `examples/jsm/postprocessing`) com lâmina wireframe + glow shell, partículas sakura/spark, passe ASCII (atlas de glifos JetBrains Mono gerado em runtime) + aberração cromática + scanlines + glitch periódico; `CyberCanvas` carregado via `React.lazy()` (chunk próprio, ~132kB gzip, só baixado em "/"); fallback CSS estático sem WebGL2/`prefers-reduced-motion`/jsdom; dispose completo no unmount. Ver ADR-026 §6 |
| KAN-111: Atualizar PRD_VIVO.md           | ✅     | R     | Auditoria pós-Sprint 2 via chore/docs-audit-sprint-2 (2026-06-16) |

---

### FEAT-02 — Auth + User (Sprint 2)

| Task                                | Status | Owner | PR  |
| ----------------------------------- | ------ | ----- | --- |
| KAN-201: utils/jwt + hash           | ✅     | G     | feat/sprint-2-auth-user — signAccessToken/Refresh/Verify + bcrypt cost 12 |
| KAN-202: auth.middleware            | ✅     | G     | feat/sprint-2-auth-user — Bearer extractor, popula req.user, 401/UNAUTHORIZED |
| KAN-203: user.model                 | ✅     | G     | feat/sprint-2-auth-user — RegisterDTO, LoginDTO, AuthResponseDTO, UserEntity.toResponse() sem password |
| KAN-204: user.repository            | ✅     | G     | feat/sprint-2-auth-user — findByEmail/findById/findAll/create/update/delete |
| KAN-205: refresh-token.repository   | ✅     | G     | feat/sprint-2-auth-user — hash SHA-256 via crypto, não armazena token cru |
| KAN-206: auth.service               | ✅     | G     | feat/sprint-2-auth-user — register/login/refresh/logout com rotação de token |
| KAN-207: auth.controller            | ✅     | G     | feat/sprint-2-auth-user — register/login/refresh/logout; validação manual |
| KAN-208: user.service + controller  | ✅     | G     | feat/sprint-2-auth-user — me/list/getById/update/delete com regras por role |
| KAN-209: factories (Auth + User)    | ✅     | G     | feat/sprint-2-auth-user — makeAuthController + makeUserController |
| KAN-210: routes                     | ✅     | G     | feat/sprint-2-auth-user — auth (público) + user (autenticado, /me antes /:id) |
| KAN-211: Testes Auth (AUTH-01 a 09) | ✅     | R     | feat/sprint-2-auth-user — 9 cenários: register/login/refresh/logout/rotação |
| KAN-212: Testes User                | ✅     | R     | feat/sprint-2-auth-user — 3 cenários: USR-01/02/03 (me, visibilidade, auto-delete) |
| KAN-213: Login page (web)           | ✅     | Claude | feat/fase-3-empresas — LoginPage com useApiError, testado no navegador |
| KAN-214: Register page (web)        | ✅     | Claude | feat/fase-3-empresas — RegisterPage, redireciona pro onboarding |
| KAN-215: Axios interceptor          | ✅     | Claude | feat/fase-3-empresas — client.ts com fila de refresh concorrente |

---

### FEAT-03 — Company + Plan + Subscription (Sprint 3)

| Task                                        | Status | Owner | PR  |
| ------------------------------------------- | ------ | ----- | --- |
| KAN-301: Company CRUD                       | ✅     | Claude | feat/fase-3-empresas — ownership (criador vira OWNER), CNPJ (regex, sem dígito verificador), /me, escopo CLIENT/ADMIN |
| KAN-302: Company factory + routes           | ✅     | Claude | feat/fase-3-empresas — auth em todas as rotas, /me antes de /:id |
| KAN-303: Plan CRUD completo                 | ✅     | Claude | feat/fase-3-empresas — unicidade de nome, GET público, CUD admin-only |
| KAN-304: Plan factory + routes              | ✅     | Claude | feat/fase-3-empresas |
| KAN-305: Subscription CRUD + approve/reject | ✅     | Claude | feat/fase-3-empresas — regra de ouro (1 ACTIVE/company) validada no request E no approve |
| KAN-306: Subscription factory + routes      | ✅     | Claude | feat/fase-3-empresas |
| KAN-307: Notificação admin (email + audit)  | ✅     | Claude | feat/fase-3-empresas — só a parte de AuditLog (SUBSCRIPTION_REQUESTED/APPROVED/REJECTED); e-mail continua fora de escopo (cortado, ver BACKLOG "Removido do escopo") |
| KAN-308: Testes integração                  | ✅     | Claude | feat/fase-3-empresas — 18 testes novos (PLAN/COMP/SUB), 31/31 total, cobertura services 94-100% |
| KAN-309: Onboarding (web)                   | ✅     | Claude | feat/fase-3-empresas — wizard 3 passos (useState), testado no navegador |
| KAN-310: Página de planos pública           | ✅     | Claude | feat/fase-3-empresas — `/plans`, 3 cards, sem auth |
| KAN-311: Dashboard admin (pendentes)        | ✅     | Claude | feat/fase-3-empresas — PendingSubscriptions, TanStack Query + modal de confirmação |

---

### FEAT-04 — Application + Project + ProjectMember (Sprint 4)

| Task                                        | Status | Owner | PR  |
| ------------------------------------------- | ------ | ----- | --- |
| KAN-401: Application CRUD                   | ✅     | Claude | feat/fase-4-projetos — RN03 (limite do plano) + RN07 (assinatura ativa) no create; companyId sempre do req.user; delete é soft (RN04) |
| KAN-402: Application factory + routes       | ✅     | Claude | feat/fase-4-projetos |
| KAN-403: Project CRUD + transition          | ✅     | Claude | feat/fase-4-projetos — máquina mínima de 4 estados (PENDING→IN_PROGRESS→IN_REVIEW→COMPLETED, retorno IN_REVIEW→IN_PROGRESS); toda transição gera AuditLog STATUS_CHANGE |
| KAN-404: Project factory + routes           | ✅     | Claude | feat/fase-4-projetos |
| KAN-405: ProjectMember CRUD                 | ✅     | Claude | feat/fase-4-projetos — GET visível a quem vê o projeto (CLIENT/PENTESTER-membro/ADMIN); POST/DELETE só ADMIN |
| KAN-406: Nested route /projects/:id/members | ✅     | Claude | feat/fase-4-projetos — router com mergeParams |
| KAN-407: Testes Application (TEN-01 a 03)   | ✅     | Claude | feat/fase-4-projetos — 6 testes (APP-01..04 + TEN-01/02/03) |
| KAN-408: Testes Project (TEN-04, 05)        | ✅     | Claude | feat/fase-4-projetos — 11 testes (PROJ-01..09 + TEN-04/05) + 3 de ProjectMember |
| KAN-409: Lista de aplicações (web)          | ✅     | Claude | feat/fase-4-projetos — tabela + filtro + modal + erro PLAN_LIMIT_REACHED amigável (testado no navegador) |
| KAN-410: Wizard nova análise (web)          | ✅     | Claude | feat/fase-4-projetos — 4 passos com useState, testado no navegador |
| KAN-411: Detalhe de projeto (web)           | ✅     | Claude | feat/fase-4-projetos — abas, transição de status, gestão de membros (ADMIN), breadcrumb; testado com os 3 roles no navegador |

---

### FEAT-05 — Vulnerability + Evidence (Sprint 5) ⭐ CORE

| Task                                        | Status | Owner | PR  |
| ------------------------------------------- | ------ | ----- | --- |
| KAN-501: utils/cvss (cálculo automático)    | ✅     | Claude | feat/fase-5-findings — parser manual CVSS 3.1, 13 testes unitários (vetor canônico + Log4Shell + Heartbleed + vetores LOW/MEDIUM calculados à mão) |
| KAN-502: Vulnerability CRUD + transition    | ✅     | Claude | feat/fase-5-findings — máquina de 4 estados (OPEN→IN_PROGRESS→FIXED→CLOSED); override-severity com justificativa ≥20 chars; PUT com vetor novo reseta override anterior (RN21) |
| KAN-503: Vulnerability factory + routes     | ✅     | Claude | feat/fase-5-findings |
| KAN-504: Evidence CRUD (upload MIME)        | ✅     | Claude | feat/fase-5-findings — multer memoryStorage + magic number (ignora Content-Type declarado) + UUID + uploads/{companyId}/{vulnId}/ |
| KAN-505: Evidence factory + nested routes   | ✅     | Claude | feat/fase-5-findings — GET de download autenticado, valida acesso à company antes de servir |
| KAN-506: VulnerabilityComment nested        | ✅     | Claude | feat/fase-5-findings — GET paginado, POST aberto a quem tem acesso de leitura, DELETE autor/admin |
| KAN-507: AuditLog helper                    | ✅     | Claude | feat/fase-5-findings — CREATE (RN20), SEVERITY_CHANGE (RN21), STATUS_CHANGE, SEVERITY_OVERRIDE, DELETE |
| KAN-508: Testes Vulnerability (BIZ-03 a 08) | ✅     | Claude | feat/fase-5-findings — 17 testes de integração + TEN-06 |
| KAN-509: Testes Evidence (BIZ-09)           | ✅     | Claude | feat/fase-5-findings — 7 testes (.exe bloqueado, Content-Type forjado, .txt UTF-8, tamanho, roles) |
| KAN-510: Lista de findings (web)            | ✅     | Claude | feat/fase-5-findings — aba Findings no ProjectDetail: filtros, badges, paginação, contador de críticos abertos |
| KAN-511: Editor de finding (web)            | ✅     | Claude | feat/fase-5-findings — FindingEditor (CVSS live client-side, drag-drop, override, transição) + FindingDetail read-only |
| KAN-512: Endurecimento da Fase 5 (2026-08-07) | ✅   | Claude | fix/fase-5-hardening — CVSS validado contra 13 vetores oficiais do FIRST + varredura dos 2592 vetores base + paridade front/back (0 divergências); 27 testes de superfície de ataque do upload (SEC-EV-01..07); canários TEN-07..13 (Evidence/Comment/escrita de Vulnerability, cross-tenant e não-membro); `FIELD_LIMITS` nos campos de texto; `SEVERITY_OVERRIDE_RESET` no AuditLog; aviso de caracteres não-WinAnsi no editor; ADR-021 (máquina de 4 estados). 107 → 225 testes, cobertura dos services da Fase 5 ≥90%. Limitações conhecidas L-01..L-08 em `docs/BACKLOG.md` |

---

### FEAT-06 — Relatórios + Dashboard (Sprint 6)

| Task                                 | Status | Owner | PR  |
| ------------------------------------ | ------ | ----- | --- |
| KAN-601: /projects/:id/report-data   | ✅     | Claude | feat/fase-6-relatorios — RN18 aplicada (Project IN_REVIEW/COMPLETED, senão 422 PROJECT_NOT_READY_FOR_REPORT), stats/topRisks/evidências/comentários consolidados num request |
| KAN-602: Report metadata CRUD        | ✅     | Claude | feat/fase-6-relatorios — POST /reports gera AuditLog REPORT_GENERATED; GET /reports?projectId= lista histórico; quem gera inclui CLIENT (PDF client-side) |
| KAN-603: Report factory + routes     | ✅     | Claude | feat/fase-6-relatorios — report-data montado em project.routes.ts (URL aninhada exigida), resto do CRUD em report.routes.ts |
| KAN-604: pdf-lib setup               | ✅     | Claude | feat/fase-6-relatorios — decisão revertida de @react-pdf/renderer pra pdf-lib (API imperativa); lib/pdf/base.ts com helpers reutilizáveis |
| KAN-605: Relatório Executivo PDF     | ✅     | Claude | feat/fase-6-relatorios — capa tema escuro + sumário + KPIs + gráfico de barras à mão + top 5 riscos + maturidade placeholder + conclusão (3 páginas no smoke) |
| KAN-606: Relatório Técnico PDF       | ✅     | Claude | feat/fase-6-relatorios — 1 seção por finding com evidências PNG/JPEG embutidas (embedPng/embedJpg) + comentários + glossário |
| KAN-607: Dashboard cliente           | ✅     | Claude | feat/fase-6-relatorios — KPIs + donut Recharts por severidade + 5 findings recentes |
| KAN-608: Dashboard pentester         | ✅     | Claude | feat/fase-6-relatorios — projetos atribuídos + findings registrados na semana |
| KAN-609: Dashboard admin             | ✅     | Claude | feat/fase-6-relatorios — empresas ativas (GET /subscriptions/active, novo) + assinaturas pendentes + críticos globais + top companies |
| KAN-610: Testes report-data (RPT-01..03) | ✅ | Claude | feat/fase-6-relatorios — 9 testes de report + 1 de subscription/active, 107/107 total |

---

### FEAT-065 — Design System + Dashboards analíticos (Fase 6.5)

| Task                                          | Status | Owner | Notas |
| --------------------------------------------- | ------ | ----- | ----- |
| KAN-651: Tokens OKLCH + escalas + temas       | ✅     | Claude | `styles/tokens.css`; 7 rampas × 11 passos; primitivo × semântico; dark/light/system sem flash |
| KAN-652: Ferramenta de contraste WCAG         | ✅     | Claude | `scripts/check-contrast.mjs` — 66 pares, 0 falhas, 0 fora do gamut; roda no `npm run check` |
| KAN-653: Rota /styleguide (dev)               | ✅     | Claude | Dois temas lado a lado; única tela autorizada a usar primitivo |
| KAN-654: Biblioteca própria + remoção do Radix | ✅    | Claude | ~30 componentes; `grep @radix-ui` vazio; ADR-023 |
| KAN-655: Contrato de acessibilidade testado   | ✅     | Claude | A11Y-01..14 + axe-core; achou bug real no `offsetParent` da armadilha de foco |
| KAN-656: Camada de movimento                  | ✅     | Claude | `motion` 13; hook central de `prefers-reduced-motion`; 8 padrões |
| KAN-657: Backend de métricas (4 endpoints)    | ✅     | Claude | Histórico do `AuditLog`, sem migration; agregação no banco; ADR-025 |
| KAN-658: Testes de métricas + tenancy         | ✅     | Claude | MET-01..18 + TEN-14..17; 225 → 247 testes |
| KAN-659: Dashboard analítico (4 abas)         | ✅     | Claude | Postura / Evolução / Insights / Comparativo; 5 gráficos tematizados |
| KAN-660: Filtros sincronizados com a URL      | ✅     | Claude | `useSearchParams` como fonte única; filtragem cruzada; chips |
| KAN-661: Migração das telas existentes        | 🚧     | Claude | Tokens e componentes migrados em todas as 13 telas (build e tipos limpos). Login, Register, Plans e o layout foram **reescritos**; as demais receberam a migração mecânica — falta o polimento de skeleton/vazio/erro tela a tela |
| KAN-662: Seed de demonstração                 | ✅     | Claude | `prisma/seed-demo.ts`; 90 findings em 90 dias; semente fixa; `--volume=500` |
| KAN-663: Validação no navegador real          | ❌     | R     | **Bloqueada** — a extensão do Chrome não conectou nesta sessão. Os 10 itens do CP8 ficam para o Rafael |
| KAN-664: ADRs 022-025 + DESIGN_SYSTEM.md      | ✅     | Claude | ADR-024 reverte o corte de "toggle de tema" do escopo |

---

### FEAT-07 — Mobile enxuto + Push (Sprint 7)

> KAN-710/711/712 (IA/Gemini no mobile) cancelados — IA já estava fora do escopo desde 2026-08-03 (ver `docs/BACKLOG.md` "Removido do escopo"); o título da feature também foi corrigido (dizia "+ IA Gemini").

| Task                                         | Status | Owner  | PR  |
| -------------------------------------------- | ------ | ------ | --- |
| KAN-701: Setup Expo + TS                     | ✅     | Claude | feat/fase-7-mobile — Expo SDK 57 + expo-router (file-based), tema dark portado de tokens.css (Fase 6.5), sem alias de import (imports relativos, CLAUDE.md §13) |
| KAN-702: Tela Login mobile                   | ✅     | Claude | feat/fase-7-mobile — sem register (ADR-004); barra ADMIN/PENTESTER explicitamente (mobile é exclusivo do CLIENT) |
| KAN-703: Home com lista projetos             | ✅     | Claude | feat/fase-7-mobile — TanStack Query, pull-to-refresh, GET /projects já escopado por role (RN16) |
| KAN-704: Detalhe projeto                     | ✅     | Claude | feat/fase-7-mobile — metadados + lista de findings, sem filtro (não é paridade com o web) |
| KAN-705: Detalhe finding read-only           | ✅     | Claude | feat/fase-7-mobile — severidade/CVSS, descrição/impacto/recomendação, evidências em carrossel (Image com header Authenticated, token nunca na URL), comentários |
| KAN-706: Viewer PDF                          | ❌     | —      | Cortado pelo prompt da fase — fora do escopo do mobile |
| KAN-707: Expo Push setup                     | ✅     | Claude | feat/fase-7-mobile — expo-notifications, permissão pedida no boot autenticado, canal Android configurado |
| KAN-708: POST /notifications/register-push   | ✅     | Claude | feat/fase-7-mobile — recurso `notification` enxuto (sem model/DTO dedicado — só User.expoPushToken) |
| KAN-709: Service de push em finding CRITICAL | ✅     | Claude | feat/fase-7-mobile — utils/push.util.ts (expo-server-sdk) + hook em VulnerabilityService.create, sempre em try/catch |
| ~~KAN-710: utils/gemini cliente~~            | ❌     | —      | Cancelado — IA fora do escopo desde 2026-08-03 |
| ~~KAN-711: AI endpoints (sugestões)~~        | ❌     | —      | Cancelado — idem |
| ~~KAN-712: Botão "Sugerir IA" no editor~~    | ❌     | —      | Cancelado — idem |

---

### FEAT-08 — Maturidade + Apresentação (Sprint 8)

| Task                                   | Status | Owner | PR  |
| -------------------------------------- | ------ | ----- | --- |
| KAN-801: Seed domínios + controles     | ✅     | Claude | feat/fase-8-maturidade-tcc — 7 domínios × 4 perguntas em `prisma/seed.ts`, upsert por nome/domínio+nome |
| KAN-802: Maturity Assessment CRUD      | ✅     | Claude | feat/fase-8-maturidade-tcc — POST assessments, POST :id/scores (batch + média simples recalculada), GET :companyId/latest; RN19 (só ADMIN escreve) |
| KAN-803: Maturity factory + routes     | ✅     | Claude | feat/fase-8-maturidade-tcc — `maturity.factory.ts` + `maturity.routes.ts`, plugado em `routes.ts` |
| KAN-804: Tela avaliação (admin web)    | ✅     | Claude | feat/fase-8-maturidade-tcc — `maturity-assessment-page.tsx`: domínios na lateral, seletor 1-5 + observação, médias, salvar em lote; entrada pelos 3 dashboards |
| KAN-805: Radar chart Recharts          | ✅     | Claude | feat/fase-8-maturidade-tcc — `components/maturity/maturity-radar.tsx` (tela) |
| KAN-806: Maturidade no relatório PDF   | ✅     | Claude | feat/fase-8-maturidade-tcc — `report.service.ts` agora popula `maturity` de verdade (era `null`); tabela de médias + `drawRadarChart` (radar à mão em pdf-lib, `base.ts`) no Executivo; validado com PDF real gerado a partir do banco de dev |
| KAN-807: Seed demo TechNova realista   | ✅     | Claude | feat/fase-8-maturidade-tcc — 5 apps/projetos, 10 findings (2C/3H/3M/2L exato), 2 evidências, 4 comentários, 2 pentesters, 2 clients, 1 avaliação de maturidade (28 respostas não-uniformes); idempotente (upsert/find-then-create), contagens conferidas no banco |
| KAN-808: SonarQube relatório capturado | 🚧 **bloqueado em Rafael** | Claude/R | CI corrigido (mismatch `dev`/`develop`, nunca rodou em fase alguma; cobertura agora publicada como artifact) — falta abrir o PR pra disparar. Link no relatório da sessão |
| KAN-809: OWASP ZAP relatório capturado | ✅     | Claude | feat/fase-8-maturidade-tcc — 0 FAIL/5 WARN/62 PASS contra a stack real (`docker compose up --build`); achou e corrigiu bug real que impedia o próprio build da imagem web (`@types/node` ausente) |
| KAN-810: Smoke tests E2E manuais       | 📋     | R     | —   |
| KAN-811: README + diagrama             | ✅     | Claude | feat/fase-8-maturidade-tcc — `README.md` na raiz (pitch, stack, setup dos 2 modos, diagrama Mermaid, screenshots reais via Playwright, limitações, trabalho futuro) + `docs/DEMO.md` (roteiro cronometrado ~10min) |
| KAN-812: Slides TCC                    | 📋     | I + R | —   |
| KAN-813: Ensaios de apresentação       | 📋     | Todos | —   |

---

### FEAT-09 — DAST via OWASP ZAP (módulo novo, fora da numeração original)

> Prompt dado diretamente ao agente numa sessão dedicada (branch `feat/dast-zap`,
> renomeada de `feat/scan-dast-OWASP`) — não fazia parte do BACKLOG v4 original.
> Depende da Fase 6 (design system) e do padrão de camadas da Fase 5.
> Ver `docs/DAST.md` para a documentação técnica completa e
> `docs/ROADMAP_PROMPTS.md` (Fase 9) para o histórico detalhado de execução.

| Task                                         | Status | Owner  | Notas |
| --------------------------------------------- | ------ | ------ | --- |
| 9.0: Reconhecimento do ZAP + pré-requisitos  | ✅     | Claude | `zap-full-scan.py --help` revelou que não há flag de tempo máximo total (timeout é responsabilidade de quem chama); achado de ambiente pré-existente (Prisma Client sem `expoPushToken`, `expo-server-sdk` ausente, migration de push não aplicada no banco de teste) resolvido como pré-requisito |
| 9.1: Schema (`DastScan`/`DastFinding`)       | ✅     | Claude | Enum nativo (`DastScanStatus`/`DastRisk`), exceção consciente à filosofia "sem enums" do `schema.prisma` — confirmada com o Rafael antes da migration. Índices: `[requestedById]`, `[status]`, `[status, targetUrl(191)]` em `DastScan`; `[scanId]`, `[risk]`, único `[scanId, fingerprint]` em `DastFinding` |
| 9.2: Runner Docker (`zap-runner.service.ts`) | ✅     | Claude | `execFile("docker", [...])` — nunca shell, imune a command injection; `validateTargetUrl` bloqueia SSRF (loopback + faixas privadas, liberável só em dev via `DAST_ALLOW_PRIVATE_TARGETS`); critério de sucesso é a existência/parseabilidade de `report.json`, nunca o exit code (confirmado empiricamente: exit 2 pode ser só warning) |
| 9.3: Pipeline de findings (`dast-findings.service.ts`) | ✅ | Claude | Fingerprint `sha256(pluginId\|normalizedUrl\|param)` com normalização de URL (IDs/UUIDs viram `{id}`/`{uuid}`, tokens >16 chars descartados) — o que faz o mesmo bug em 50 URLs virar 1 achado, não 50; `description`/`solution`/`reference` passam por `stripHtml()` antes de persistir |
| 9.4: API + RBAC (7 rotas)                    | ✅     | Claude | `requireRole("PENTESTER","ADMIN")` em todas; ownership fina no service (`getOwnedScan` — PENTESTER só vê os próprios, ADMIN vê tudo); path traversal bloqueado em `resolveReportPath` (whitelist de extensão + confere prefixo de `REPORTS_DIR` resolvido) |
| 9.5: Testes SEC/RBAC/PIPE/LIFE               | ✅     | Claude | 42 testes novos (269 → **315**), cobertura 89-96% nos 3 services novos, **zero dependência de Docker** (`DAST_FORCE_SIMULATE=true` no `.env.test`) |
| 9.6: Frontend (`/dast`, `/dast/scans/:id`, `/dast/scans/:id/report`) | ✅ | Claude | Design system da Fase 6.5 (zero Radix); polling a cada 5s com cronômetro; tabela HTML manual com linha expansível (decisão de consistência com `applications-page.tsx`/`project-detail-page.tsx`, que já usam `<table>` manual — `<Table>` do design system não suporta linha expansível nativamente); relatório do ZAP em `<iframe sandbox>` |
| 9.7: PDF client-side                         | ✅     | Claude | Mesmo estilo visual dos relatórios Executivo/Técnico (`pdf-lib`); `requestedByName` adicionado ao payload de `report/data` (join a mais, sem migration) pra capa mostrar "quem executou" em vez de um `cuid` cru |
| 9.8: Validação end-to-end (Juice Shop + example.com) | ✅ | Claude | **Dois scans reais** persistidos em `app/api/dast-reports/`: contra `http://example.com` (13 alertas) e contra `https://host.docker.internal:3500` — Juice Shop (16 alertas). Playwright ad-hoc cobriu 26 checks visuais contra a stack de dev real (RBAC visual, polling real, download de PDF validado com `pdf-lib`, responsivo 375/768/1440, console limpo) — extensão do Chrome não conectou (mesmo bloqueio recorrente de todas as fases). Screenshots e o PDF real ficam com o Rafael |
| 9.9: `docs/DAST.md` + ADRs 028-030 + docs vivos | ✅   | Claude | `docs/DAST.md` (arquitetura, segurança, modelo de dados, config, alvos de laboratório, troubleshooting, limitações — 10 seções); ADR-028 (Docker spawn — risco do socket assumido e documentado), ADR-029 (silo, sem importar pra `Vulnerability` — CVSS ausente do ZAP contaminaria o cálculo 100%-confiável), ADR-030 (fire-and-forget + watchdog, sem fila) |

#### FEAT-09.1 — Scan real dentro da stack Docker (2026-09-09)

> Motivada por `docs/DAST-DOCKER-GAP.md` (diagnóstico de 2026-09-06: todo scan
> dentro do `docker compose` caía silenciosamente no simulado) + requisito novo
> do Rafael: **container do ZAP criado sob demanda, no máximo 2 scans por vez
> com aviso em caso de erro, e percentual de progresso na UI** — com queda
> para o resultado simulado, com mensagem amigável, quando o real falhar.
> Decisão completa em `docs/Vulnera/07-Decisoes/ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker.md`.

| Task                                             | Status | Owner  | Notas |
| ------------------------------------------------ | ------ | ------ | --- |
| 9.1.1: Runner em modo daemon + API HTTP do ZAP   | ✅     | Claude | `zap-full-scan.py` (caixa preta, sem progresso) trocado por `zap.sh -daemon` conduzido pelos endpoints `/JSON/spider/*`, `/JSON/pscan/*`, `/JSON/ascan/*` e `/OTHER/core/other/{json,html}report/`. **Continua UM container por scan** (o ADR-028 recusava daemon *compartilhado*, não este). Relatórios chegam por HTTP e são gravados pelo Node — **o bind mount sumiu do desenho, então a "Causa 3" deixou de existir**. Chave `api.key` aleatória por scan, nunca `api.disablekey=true` |
| 9.1.2: DooD — `docker-cli` na imagem + socket    | ✅     | Claude | Causas 1 e 2 do relatório. `apk add docker-cli`; `-v /var/run/docker.sock` no compose; usuário `vulnera` no GID 0 (socket do Docker Desktop é `root:root 0660` — sem isso, `permission denied` e volta tudo pro simulado). Rede fixa `vulnera-net` pra API alcançar o ZAP pelo nome do container. ⚠️ Aumento de superfície de risco aceito e registrado no ADR-031 |
| 9.1.3: Watchdog de concorrência                  | ✅     | Claude | `dast-watchdog.service.ts` (novo): fila FIFO em memória, `DAST_MAX_CONCURRENT_SCANS` (default **2**), abort de scan sem pulso por 2min, anel dos últimos 20 alertas. Singleton injetado pela factory — uma instância por factory daria "2 por instância", que é o mesmo que não ter limite |
| 9.1.4: Progresso persistido + status do módulo   | ✅     | Claude | Migration `20260909131426_add_dast_progress_and_simulated_flag`: `progress`, `phase`, `simulated`, `warningMessage`. Escrita com throttle (só quando a fase muda ou o % anda 1 ponto, no máx. 1x/s). Rota nova `GET /api/dast/scans/status` (literal ANTES de `/:id`) com estado do Docker, vagas, fila e alertas |
| 9.1.5: UI — barra, fila e selo de simulado       | ✅     | Claude | `dast-status-banner.tsx` (novo, com o hook `useDastStatus`); barra de progresso na listagem e no detalhe (componente `Progress` já existente do design system); posição na fila; selo "simulado" + alerta explicando em PT-BR. Polling 5s → **3s** (cadência com que o runner atualiza o %) |
| 9.1.6: Fallback amigável                         | ✅     | Claude | Scan real que falha **mantém o resultado simulado** em vez de morrer, com `simulated: true` e `warningMessage` traduzida por `friendlyFailureReason()`. Única exceção: cancelamento — quem cancelou não quer resultado |
| 9.1.7: Testes                                    | ✅     | Claude | 315 → **333**. `zap-runner.service.test.ts` reescrito pro fluxo novo (mock de `child_process` **e** de `http`); `dast-watchdog.service.test.ts` novo (10 casos: DAST-WD-01..07); `dast.test.ts` +4 (DAST-PROG-01, DAST-SIM-01, DAST-STAT-01, ordem de rota literal). RBAC agora cobre 8 rotas |
| 9.1.8: Validação real                            | ✅     | Claude | Scan real contra `https://example.com`: **47s, 7 alertas reais do ZAP 2.17.0, `simulated: false`**, progresso percorrendo STARTING→SPIDER→PASSIVE→ACTIVE→REPORT→DONE. Na stack: `docker compose exec api docker info` responde `29.5.2` e `GET /status` devolve `dockerAvailable: true` |
| 9.1.9: Docs (ADR-031 + DAST.md + gap + vivos)    | ✅     | Claude | ADR-031 novo; nota de "parcialmente substituída" no ADR-028 §"Por que não modo daemon" (R6); `docs/DAST.md` §2/§4/§6/§7/§9 reescritas; `docs/DAST-DOCKER-GAP.md` com cabeçalho ✅ RESOLVIDO + relatório de ponto de parada |

⚠️ **Achado de ambiente, corrigido como pré-requisito:** o `.env.test` local
**não tinha** `DAST_FORCE_SIMULATE=true`, apesar de `dast.test.ts` afirmar no
próprio cabeçalho que tinha — e o banco `vulnera_test` estava sem as tabelas do
DAST (migrations nunca aplicadas nele). Isso deixava a suíte inteira vermelha
(221 falhas) por motivo não relacionado a código. Resolvido: `.env.test`
atualizado e `prisma migrate deploy` rodado no banco de teste.

**Bugs reais encontrados e corrigidos durante a execução** (não hipotéticos):
corrida genuína em `dast-scan.service.ts` — cancelar um scan simulado não
interrompia de fato o `setTimeout` interno, e ele tentava persistir findings
~3s depois num registro que já não era mais `RUNNING` (corrigido com checagem
de estado antes de persistir e antes de marcar conclusão — o mesmo bug
existiria com Docker real numa janela menor); timeout de 5s em
`isDockerAvailable()` classificava Docker como indisponível nesta máquina
(Docker Desktop/WSL2 "frio" levou ~6s), derrubando scans reais pro fallback
simulado por engano — subido pra 10s.

⚠️ **Nenhum commit feito nesta branch** (`feat/dast-zap`) — decisão do prompt
original da sessão, mesmo padrão de todas as fases anteriores deste projeto
(Fase 6.5, fix/landing-publica, task 8.12): trabalho completo em working tree,
Rafael decide quando commitar.

#### FEAT-09.2 — O que o pentester faz com o resultado do scan (2026-09-09)

> Pedido do Rafael na mesma sessão, depois de validado o scan real: *"garanta
> que o watchdog está respeitando os limites, que o scan funciona de verdade,
> e que o pentester tenha possibilidade com o resultado do Scan DAST"*. As três
> frentes (triagem, promoção, comparação) foram escolhidas por ele.
> Decisão completa em `docs/Vulnera/07-Decisoes/ADR-032 - Triagem, promocao para Vulnerability e comparacao de scans DAST.md`.

| Task                                             | Status | Owner  | Notas |
| ------------------------------------------------ | ------ | ------ | --- |
| 9.2.0: Verificação do que a 9.1 entregou         | ✅     | Claude | Medido na stack real, não deduzido: DooD confirmado (`which docker` → `/usr/bin/docker` dentro do container, `docker info` → 29.4.3); **3 scans disparados juntos → exatamente 2 containers ZAP no `docker ps` + 1 na fila com alerta**, e o 3º entrou sozinho ao abrir vaga (FIFO end-to-end); 3 scans reais concluídos com `simulated: false` em 39-52s |
| 9.2.1: ⚠️ Limites de recurso por container       | ✅     | Claude | **Lacuna achada ao medir**: o watchdog limitava *quantos* scans, nada limitava *quanto* cada um consome — 2 scans reais ocupavam ~960% de 1200% de CPU e cresciam sem teto de RAM (`936MiB/7.7GiB` + `1.39GiB/7.7GiB`, onde 7.7GiB é a VM inteira). `DAST_ZAP_MEMORY` (2g) e `DAST_ZAP_CPUS` (4) viram `--memory`/`--memory-swap`/`--cpus`. ⚠️ Os dois **têm** de andar juntos: o `zap.sh` calcula o heap de `/proc/meminfo` (RAM do **host**, não do cgroup) e sem `-Xmx` explícito a JVM pediria ~1.9GB e morreria por OOM — `heapArgForMemoryLimit()` deriva `-Xmx` a 65% do teto |
| 9.2.2: ⚠️ Dois buracos de heartbeat              | ✅     | Claude | `withKeepAlive()`. (a) `docker run` na 1ª execução de uma máquina faz o pull de ~3.7GB antes de subir — passava dos 2min de silêncio e o watchdog abortaria justamente o primeiro scan de uma máquina nova (timeout do run: 3min → 10min); (b) download dos relatórios são dois `httpGet` de 120s em sequência contra um limite de silêncio de 120s |
| 9.2.3: Triagem no silo                           | ✅     | Claude | Enum `DastTriageStatus` (NEW/CONFIRMED/FALSE_POSITIVE/ACCEPTED_RISK) + `triageNote`/`triagedById`/`triagedAt`. `PATCH /dast/scans/findings/:id/triage`. UI salva **no clique** (é a tarefa mais repetitiva da tela; exigir "salvar" dobraria os cliques) — a nota é a exceção. Coluna "Triagem" substituiu "Confiança" na tabela, que foi pro detalhe expandido |
| 9.2.4: Promoção → `Vulnerability`                | ✅     | Claude | Responde os 4 pontos que o ADR-029 deixou em aberto. `sourceType`/`sourceDastFindingId` (`@unique`, FK `SetNull`). **O vetor CVSS é sugerido e revisado pelo humano, nunca inventado** — é o que mantém a RN10 intacta e evita criar uma segunda classe de score no produto. CWE→OWASP é factual (lista oficial do Top 10 2021); risco→vetor é suposição e vem com aviso na tela. Dedup garantida pelo `@unique` do banco, não por checagem de aplicação |
| 9.2.5: Comparação entre execuções                | ✅     | Claude | `GET /:id/comparable` e `/:id/compare?base=`. Diff por `fingerprint` (que já existia e **não inclui evidência** — por isso um problema não corrigido aparece como "continua aberto", não como "sumiu um/surgiu outro"). Alvos diferentes → 422 em vez de um diff 100%/100% inútil. Validado com 2 scans reais consecutivos: **11 persistentes, 0 resolvidos, 0 novos** |
| 9.2.6: Testes                                    | ✅     | Claude | 333 → **353** backend (`dast-triage.test.ts` novo: 16 casos DAST-TRI/PRO/CMP/RBAC-10, incluindo `DAST-PRO-07` — apagar o scan de origem não apaga a Vulnerability; +4 unitários de limite de recurso). Script E2E ad-hoc de 30 checks contra a stack real, todos verdes |
| 9.2.7: Playwright                                | ✅     | Claude | `app/web/e2e/` + `playwright.config.ts`. Sem `webServer` **de propósito**: o alvo é a stack real, mesma que a demonstração usa. 6 casos, incluindo o E2E-01 que prova que **o percentual da barra sobe e as fases nomeadas do ZAP aparecem** (uma barra estimada por tempo passaria no primeiro teste, não no segundo). **Pegou um bug real que Vitest e Supertest não pegariam**: link apontando pra `/vulnerabilities/:id` quando a rota do produto é `/findings/:id` |
| 9.2.8: Docs                                      | ✅     | Claude | ADR-032 novo; `docs/DAST.md` §11 nova; PRD/BACKLOG |

---

## 4. Decisões em aberto (precisam ser tomadas)

> Adicione aqui qualquer decisão pendente. Quando resolvida, mover pra DECISIONS.md
> e remover daqui.

- [ ] Versionar imagens do Docker localmente ou usar registry?
- [ ] Quando começar a apresentação visual (slides)? Sprint 7 ou Sprint 8?
- [ ] Como simular pagamento da subscription na demo? (sem gateway real)

---

## 5. Como atualizar este arquivo

### Quando uma task é INICIADA

```diff
- | KAN-101: Aplicar schema | 📋 | R | — |
+ | KAN-101: Aplicar schema | 🚧 | R | feature/schema-revised |
```

### Quando uma task é CONCLUÍDA

```diff
- | KAN-101: Aplicar schema | 🚧 | R | feature/schema-revised |
+ | KAN-101: Aplicar schema | ✅ | R | #42 |
```

### Quando uma sprint é INICIADA

1. Atualizar tabela §2: status 🚧
2. Atualizar campo "Sprint atual" no §1

### Quando uma sprint é CONCLUÍDA

1. Status ✅ na tabela §2
2. Atualizar % concluído pra 100%
3. Adicionar nota: "Concluída em YYYY-MM-DD"

### Cálculo de % concluído por sprint

- Total de tasks da sprint = N
- Tasks com ✅ = M
- % = (M / N) × 100, arredondado pra inteiro

---

## 6. Histórico de marcos importantes

> Quando algo significativo for entregue, anote aqui. Vira material pro TCC.

| Data | Marco                            | Notas       |
| ---- | -------------------------------- | ----------- |
| 2026-06-10 | Sprint 0 (Refactor) concluída e mergeada | PR #2 `refactor/align-claude-md` → develop. Estrutura alinhada com CLAUDE.md v2, factories e routes.ts criados |
| 2026-06-11 | Sprint 1 (Fundação) concluída e mergeada | PR #3 `feat/sprint-1-foundation` → develop. Backend 100%: migration, docker-compose, health, CI, eslint, seed |
| 2026-06-11 | API rodando localmente           | `/api/health` respondendo 200 em http://localhost:3001 (`npm run dev`) |
| 2026-06-11 | Primeiro teste passando          | Smoke test `tests/integration/health.test.ts` (Jest+Supertest) — 1/1 |
| 2026-06-15 | Sprint 2 (Auth + User) — backend completo | Branch `feat/sprint-2-auth-user`. Auth JWT (register/login/refresh/logout), CRUD User, 12 testes de integração (9 auth + 3 user). Aguardando PR → develop |
| 2026-08-04 | Sprint 3 (Company + Plan + Subscription) concluída | Branch `feat/fase-3-empresas`, aguardando PR → develop (Rafael abre manualmente). Refactor de pastas pro plural (ADR-009); require-role middleware; AuditLog; Subscription completa com regra de ouro (1 ACTIVE/company, revalidada no approve); Plan e Company completados (ownership, CNPJ, auth); CORS habilitado na API; 18 testes novos (31/31 total); bootstrap completo do `app/web` (Vite+React+Tailwind+Radix+TanStack Query+Zustand+Axios); telas Plans/Onboarding/PendingSubscriptions; smoke E2E manual no navegador real, ponta a ponta, sem erros de console. Ver ADR-020 |
| 2026-08-04 | Sprint 4 (Application + Project + Member) concluída | Branch `feat/fase-4-projetos`, aguardando PR → develop. Application CRUD com gate RN03 (limite do plano) + RN07 (assinatura ativa) + soft delete (RN04); Project CRUD + máquina de estados mínima (4 estados) com AuditLog STATUS_CHANGE em toda transição; ProjectMember com leitura ampliada (RN16/RN17) e gestão ADMIN-only; 20 testes novos (51/51 total), cobertura services 85-100%; telas Applications/NewAnalysis/ProjectDetail/Projects; smoke E2E extenso no navegador (CLIENT, ADMIN, PENTESTER) incluindo o gate visual de PLAN_LIMIT_REACHED |
| 2026-08-05 | Sprint 5 (Vulnerability + Evidence — núcleo do produto) concluída | Branch `feat/fase-5-findings`, aguardando PR → develop. `utils/cvss.util.ts` — parser manual CVSS 3.1 com as fórmulas oficiais do FIRST, validado contra 5 vetores conhecidos (canônico 9.8, Log4Shell 10.0, Heartbleed 7.5, mais LOW/MEDIUM calculados à mão); Vulnerability CRUD com RN09 (herda project/application/company), RN10/RN21 (severidade calculada + override justificado ≥20 chars, sempre auditado), RN11 (OWASP obrigatória), RN20 (auditoria na criação), máquina de 4 estados (mesma simplificação do Project); Evidence com upload multipart validado por magic number (Content-Type declarado é ignorado por completo, não só double-checado) + UUID + `uploads/{companyId}/{vulnId}/`; VulnerabilityComment paginado; 24 testes novos (97/97 total), cobertura 95-97% nos 3 services novos; telas aba Findings (filtros/badges/contador de críticos) + FindingEditor (CVSS ao vivo no cliente, drag-drop, override, transição) + FindingDetail read-only; smoke E2E completo no navegador com arquivos binários reais (PNG aceito, .exe bloqueado mesmo com Content-Type forjado) e AuditLog conferido no Prisma Studio. Ver ROADMAP_PROMPTS.md §Histórico pra desvios do prompt original |
| 2026-08-07 | Sprint 6 (Relatórios + Dashboards) concluída | Branch `feat/fase-6-relatorios`, aguardando PR → develop. `GET /projects/:id/report-data` consolidado (project/company/application/findings/stats/topRisks/maturity=null) com RN18 aplicada (Project precisa IN_REVIEW/COMPLETED); `POST/GET /reports` com AuditLog REPORT_GENERATED; `lib/pdf/base.ts` com helpers pdf-lib imperativos (página A4, cabeçalho/rodapé paginado, drawText com quebra automática, drawBarChart à mão, `sanitizeForFont` — achado no smoke, WinAnsi não cobre emoji/setas unicode); PDF Executivo (capa tema escuro + KPIs + gráfico + top 5 riscos + conclusão, 3-5 páginas) e PDF Técnico (1 seção por finding com evidências PNG/JPEG embutidas via embedPng/embedJpg + comentários + glossário) — paleta idêntica ao tailwind.config.ts do app/web; 3 dashboards por role (CLIENT: KPIs + donut Recharts + recentes; PENTESTER: projetos atribuídos + findings da semana; ADMIN: empresas ativas via `GET /subscriptions/active` novo + pendentes + críticos globais + top companies), todos reaproveitando os endpoints já escopados por role das Fases 4/5; 10 testes novos (107/107 total); smoke em duas camadas — dados sintéticos via `vite.ssrLoadModule` headless (pegou o bug do WinAnsi antes de qualquer usuário ver) e depois PDFs gerados com dados reais do banco de dev (evidência PNG real embutida, comentário real), conferidos visualmente; dashboards validados via API direta nos 3 perfis contra o banco de dev — a extensão do Chrome não conectou nesta sessão, então a inspeção visual no navegador de verdade fica pendente pro Rafael conferir. Ver ROADMAP_PROMPTS.md §Histórico pra desvios do prompt original |
| 2026-08-07 | Fase 5 endurecida (sessão de hardening) | Branch `fix/fase-5-hardening`, aguardando PR. Sem features novas — critério: "o que uma banca de segurança atacaria e o que quebraria numa demo". **Testes 107 → 225**, cobertura dos services da Fase 5 toda ≥90% (vulnerability 84.9→94.9%, evidence 85.1→94.6%, comment 88.9→91.7%). CVSS: parser confirmado correto contra **13 vetores oficiais** do FIRST/NVD (5 com Scope Changed), varredura exaustiva dos **2592 vetores base** provando ausência de NaN/Infinity e que o arredondamento é o do Apêndice A do 3.1, **paridade front/back com 0 divergências**, rejeição explícita de CVSS 3.0/temporais/ambientais. Upload: 27 testes de superfície de ataque (path traversal, IDOR, magic number, limite de 10MB no stream, Content-Disposition, extensão em disco, polyglot). Corrigidos: validação de texto que aceitava binário de controle, dois 500 por estouro de `VARCHAR(191)` (título e nome de arquivo), duplicata de métrica CVSS não detectada, ausência de limites de partes no multipart. Isolamento: **TEN-07..13** cobrindo Evidence, Comment e escrita de Vulnerability (nenhum furo — o valor é a prova, que não existia). Auditoria: novo evento `SEVERITY_OVERRIDE_RESET`, que fecha o buraco da trilha onde um override "sumia" sem explicação. Novo `font-safety.ts` avisando no editor sobre caracteres que virariam `?` no PDF. **ADR-021** documentando a máquina de 4 estados. **Navegador real (extensão do Chrome conectou, ao contrário da Fase 6):** embed de evidência PNG 480×240 no PDF Técnico **confirmado visualmente** — o fallback não foi acionado —, PDFs e 3 dashboards conferidos, CLIENT read-only provado via `fetch` no console (PUT/transition/override/DELETE/upload todos 403). Limitações conhecidas L-01..L-08 registradas em `docs/BACKLOG.md` |
| 2026-08-09 | **Fase 6.5 (Design system + Dashboards analíticos) concluída** | Branch `feat/fase-6.5-design-system`, **não commitada** (o prompt pediu para não commitar). **Design system próprio**: `app/web/src/styles/tokens.css` com 7 rampas OKLCH × 11 passos na mesma espinha de lightness, primitivos separados de semânticos, tipografia Archivo+JetBrains Mono em escala modular 1.200, espaçamento 4px sem meio-passo, raio/borda/elevação nomeados por intenção, tokens de movimento. Três temas (dark/light/system) sem flash, via script síncrono no `<head>`. `scripts/check-contrast.mjs` converte OKLCH→sRGB à mão e mede WCAG: **66 pares, 0 falhas, 77 primitivos, 0 fora do gamut** — a ferramenta pegou 4 reprovações reais (texto branco sobre `iris-500` a 4,18:1) e 15 cores fora do gamut, todas corrigidas. Rota `/styleguide` (só em dev) com os dois temas lado a lado. **Radix removido por completo** (ADR-023): 4 pacotes fora, incluindo `react-select` que era dependência morta; ~30 componentes próprios com contrato de acessibilidade escrito em PT-BR e provado por teste. **Camada de movimento** com `motion` 13 e hook central de `prefers-reduced-motion`. **Backend de métricas** (ADR-025): 4 endpoints aditivos, histórico reconstruído de `Vulnerability.createdAt` + `AuditLog.diffJson` **sem migration**, toda agregação no banco, risk score `Σ(cvss²/10)` documentado, MTTR por mediana, aging em 4 faixas, insights determinísticos. **Dashboard analítico** por aplicação com 4 abas e filtros na URL. **Testes: backend 225 → 247** (MET-01..18 + TEN-14..17); **frontend 0 → 24** (A11Y-01..14, TEMA-01..04, MOV-01..02, FILT-01..04, AXE-01). Desempenho com 502 findings: 9–17 ms por endpoint (limite era 500). `prisma/seed-demo.ts` com 90 findings em 90 dias e trilha de auditoria. ⚠️ **A extensão do Chrome não conectou nesta sessão** — a validação visual no navegador real (os 10 itens do CP8) fica pendente para o Rafael. ADRs 022, 023, 024 e 025; `docs/DESIGN_SYSTEM.md` criado |
| 2026-08-10 | Fase 7 (Mobile enxuto + Push) concluída | Branch `feat/fase-7-mobile`, aguardando PR → develop. **App mobile** (Expo SDK 57 + React 19 + expo-router file-based): bootstrap do zero (`app/mobile` só tinha `package.json`), tema portado à mão de `tokens.css` (OKLCH→hex via matriz de Björn Ottosson, só o tema escuro — o próprio tokens.css já previa isso: "Fase 7 (mobile), que porta os mesmos valores"), `store/auth.store.ts` com SecureStore (Zustand persist) no lugar de localStorage, `api/client.ts` espelhando o interceptor de refresh-com-fila do web. 5 telas, só as pedidas: Login (sem register, ADR-004; barra ADMIN/PENTESTER explicitamente), Home (lista de projetos, pull-to-refresh), ProjectDetail (metadados + findings, sem filtro), FindingDetail (severidade/CVSS, descrição/impacto/recomendação, evidências em carrossel com `<Image source={{uri,headers}}>` — token no header, nunca na URL —, comentários), Configurações (logout + status de push). Navegação por abas (Projetos/Configurações) com stack aninhado dentro da aba Projetos. **Push**: migration `expoPushToken String?` em `User` (diff mostrado e aplicado só depois de confirmação explícita do Rafael); `POST /notifications/register-push` (recurso enxuto, sem model/DTO dedicado); `utils/push.util.ts` com `expo-server-sdk`; hook em `VulnerabilityService.create` — CRITICAL dispara push pros CLIENT da company com token, sempre em try/catch (falha de push nunca quebra a criação do finding). **Achado de infra**: `expo-server-sdk` publica ESM puro e quebrava os 247 testes existentes ao ser importado pela cadeia `app.ts → vulnerability.service.ts` — corrigido com mock global (`moduleNameMapper` no jest.config.ts + `tests/mocks/expo-server-sdk.ts`), que também serve o "mock do envio" pedido no PUSH-02. **Testes: 247 → 259** (13 novos: PUSH-01 com 4 casos, PUSH-02 com 3, mais 5 unitários de `push.util.ts` cobrindo skip/erro/exceção). Bundle validado com `expo export --platform android` (1441 módulos, sem erro) já que a extensão do Chrome não conectou nesta sessão. **Pendente pro Rafael**: smoke manual no Expo Go (abrir o app no celular físico, logar, navegar, criar um finding CRITICAL pelo web e ver o push chegar) — isso exige aparelho físico e não pode ser feito por mim; ambiente deixado pronto (API+web locais, `expo start` rodando, `.env` do mobile já com o IP da rede local). Ver ROADMAP_PROMPTS.md §Histórico pra desvios do prompt original |
| 2026-08-11 | Fase 8 — Checkpoints 1-3 (Maturidade backend+frontend+seed) concluídos | Branch `feat/fase-8-maturidade-tcc`. Checklist simplificado (decisão de 2026-08-03): 7 domínios × 4 perguntas, resposta 1-5, **média simples** sem ponderação nem nível por domínio. **Backend**: recurso `Maturity` completo (model/repository/service/controller/factory/routes) — RN19 (só ADMIN cria/preenche; CLIENT da própria company e PENTESTER atribuído só leem, via `ProjectMemberRepository.existsForUserInCompany`, novo); 10 testes de integração (MAT-01 batch+recalculo, MAT-02 latest por `createdAt desc`, MAT-03 isolamento por company e por papel). Bug real encontrado e corrigido em `tests/setup.ts`: `cleanDatabase()` nunca limpava `maturityAssessment` (a FK não está declarada no schema, então nunca dava erro de constraint — só acumulava linha órfã). `report.service.ts` deixou de devolver `maturity: null` fixo: agora agrega os scores da avaliação mais recente por domínio (nova `findLatestByCompanyWithDomains`) e devolve médias reais. **Frontend**: `maturity-assessment-page.tsx` (domínios na lateral, seletor 1-5 + observação por pergunta, médias ao vivo, salvar em lote), radar Recharts na tela, entrada nos 3 dashboards (admin por company com findings, client via `/me`, pentester por projeto atribuído). **PDF**: `drawRadarChart` novo em `lib/pdf/base.ts` — radar desenhado à mão (pdf-lib não roda componentes React/Recharts dentro do PDF); a conversão de coordenada de `drawSvgPath` (Y local cresce pra BAIXO, ancorado em x/y, ao contrário do resto do pdf-lib) foi validada em dois smoke tests isolados antes de entrar no código real. Seção "Maturidade de segurança" do Executivo agora desenha tabela de médias + radar quando existe avaliação, mantendo o aviso condicional quando não existe. **Seed**: `prisma/seed.ts` estendido com o catálogo de maturidade, 5 aplicações/projetos realistas (status variado — 3 IN_REVIEW/1 IN_PROGRESS/1 COMPLETED, de propósito, pra demo mostrar tanto o gate de RN18 quanto o relatório liberado), 10 findings curados com vetores CVSS validados contra `calculateCvss` do próprio projeto (2 CRITICAL/3 HIGH/3 MEDIUM/2 LOW exato), 2 evidências reais em disco, 4 comentários, 2 pentesters, 2 clients, 1 avaliação de 28 respostas não-uniformes (de propósito — um heptágono perfeitamente regular no radar pareceria dado inventado); idempotente, contagens reconferidas no banco de dev depois do reset (consentido explicitamente pelo Rafael via prompt de confirmação — `prisma migrate reset` é bloqueado por padrão pro Claude Code). **Validação real, não só testes**: `npm run check` verde nos dois workspaces (269 testes API, 24 testes web, lint 0 erros, `check-contrast` 66/66 pares WCAG AA); `report-data` chamado de verdade contra o banco de dev via HTTP (token JWT real) confirmando as médias por domínio; PDF Executivo gerado pelo pipeline real (mesmo `generateExecutivePdf` do browser, rodado headless) e **inspecionado visualmente** — tabela e radar corretos, lobo maior em "Backup e Recuperação" (4.25), menores em "Gestão de Vulnerabilidades"/"Conscientização" (2.25), batendo com o payload da API. **Achado de infra corrigido**: `app/web/node_modules` não tinha `motion`, `vitest`, `@testing-library/*` etc. instalados apesar de já declarados no `package.json` desde a Fase 6.5 (commit `f0b1f2c`) — `npm install` nunca tinha rodado depois daquele commit nesta máquina; sem isso o app inteiro (toda tela usa os componentes de UI que importam `motion/react`) não rodava. `npm install` na raiz resolveu (82 pacotes). Também encontrados e finalizados dois processos Node órfãos ocupando as portas 3000/5173 sem servir a aplicação real (provável sobra de sessão anterior) — servidores de dev corretos sobem em 3000 (web) e 3001 (api, conforme `.env`). Extensão do Chrome não conectou nesta sessão — validação visual da tela nova (`maturity-assessment-page.tsx`) ficou por conta do PDF real + `tsc`/lint/testes, não por navegador; fica pendente pro Rafael um smoke visual da tela em si |
| 2026-08-11 | Fase 8 — Checkpoint 4 (evidências de qualidade) — ZAP completo, Sonar bloqueado em Rafael | Branch `feat/fase-8-maturidade-tcc`. **OWASP ZAP baseline** rodado contra a stack de PRODUÇÃO real (`docker compose up --build`, não o dev server) — resultado final 0 FAIL/5 WARN/62 PASS. O achado mais valioso não veio do ZAP em si: **`app/web/Dockerfile` não buildava** (`@types/node` nunca declarado — só "funcionava" local por hoisting acidental do workspace; corrigido) e `vite preview` bloqueava o host do container do ZAP (`preview.allowedHosts`, corrigido). Adicionados 4 headers de segurança (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) via plugin Vite mínimo, derrubando os WARN de 8 pra 5; os 5 restantes (CSP, COEP, cache de estáticos, "Modern Web Application" informativo, e um falso positivo de comentário de licença MIT do `tslib`) documentados em `docs/evidencias/zap/README.md` como limitação consciente. **SonarQube**: descoberto (e confirmado via API pública do GitHub — repo é público) que o pipeline **nunca rodou em nenhuma fase anterior**, desde `refactor/align-claude-md` em 2026-06-10 — o workflow disparava em push/PR pra `develop`, branch que nunca existiu no GitHub (a real é `dev`). Corrigido `build.yml` (aceita os dois nomes agora) e a geração de cobertura (`test:coverage` + artifact entre jobs, `sonar-project.properties` com `sources`/`lcov` explícitos, antes quase vazio). **Falta abrir o PR** `feat/fase-8-maturidade-tcc` → `dev` pra disparar o Sonar de verdade — ação do Rafael, agente não tem `gh` CLI nem token neste ambiente (decisão tomada via pergunta direta ao Rafael, que escolheu "eu abro o PR"). 6 commits nesta branch até aqui (maturidade backend/PDF/frontend/seed + CI + ZAP), todos com `npm run check` verde nos dois workspaces antes de cada um. |
| 2026-08-11 | Fase 8 — Checkpoint 5 (documentação final) | `README.md` novo na raiz (pitch, stack, diagrama Mermaid, setup dos 2 modos — stack completa via Docker vs dev local, screenshots reais, qualidade/segurança, limitações conhecidas, trabalho futuro) + `docs/DEMO.md` (roteiro cronometrado ~10min, 2 trilhas — ao vivo criando empresa nova + "estado maduro" trocando pra conta da TechNova do seed). **Screenshots reais capturados via Playwright** (instalado ad-hoc no scratchpad, Chromium baixado na hora) contra a stack rodando em `docker compose up --build` — login, planos, os 3 dashboards, projetos, detalhe de projeto e **a tela de maturidade nova da Fase 8**, com os dados reais do seed (média 2.89, nível Intermediário, batendo com o que a API devolve). Isso fecha, por uma via alternativa, o item pendente de várias fases anteriores ("extensão do Chrome não conectou") — Playwright provou visualmente que a tela renderiza certo, sem depender da extensão. `docs/Vulnera/00-Hub/Contexto Mestre v4.md` atualizado: branch de integração real (`dev`), decisão F-03 resolvida, tabela de infraestrutura corrigida (Docker Compose virou stack completa na Fase 8, não só MySQL+Mailhog — estava desatualizada desde a Fase 8 anterior... ver ADR-022), divergência documentada entre `CLAUDE.md` §12 e o comportamento real de `cleanDatabase()` pra maturidade (não editei `CLAUDE.md` — regra de nunca editar sozinho). ADR-007 e ADR-022 ganharam seções de atualização com os achados reais desta sessão. |
| 2026-08-18 | Fix: landing pública em "/" + botão de login na navbar | Branch `fix/landing-publica`, **não commitada** (prompt pediu para não commitar nem abrir PR). **Checkpoint 0 (auditoria):** o redirecionamento indevido não estava no `ProtectedRoute` — era um `<Navigate to="/dashboard" replace />` incondicional na própria rota `"/"` em `App.tsx`, que aí esbarrava no guard de `/dashboard` e devolvia pro `/login` (duplo redirect). Confirmado também que **a landing "cena Three.js com efeito ASCII e samurai procedural" descrita na issue original nunca existiu neste repositório em nenhum formato** — nem componente React, nem HTML standalone (grep por `three\|THREE\|ascii\|samurai\|*.html` em todo o repo deu negativo; o próprio `PRD_VIVO.md` já tinha KAN-110 como 📋 pendente desde a Fase 3). Como isso mudava o tamanho da task de "corrigir rota" pra "feature nova", parei e perguntei ao Rafael — decisão: placeholder mínimo agora, cena 3D completa vira task 8.12 no `BACKLOG.md`. **Implementado:** `pages/landing-page.tsx` novo (navbar com brand + CTA condicional lendo `useAuthStore` — "Entrar"/"Iniciar Análise" sem sessão, só "Ir para o Dashboard" com sessão, nunca dois botões preenchidos competindo; hero; 3 cards de recursos reaproveitando `Card`/`LinkButton`/`StaggerList` do design system, mesmo padrão visual de `plans-page.tsx`); `App.tsx` — rota `"/"` pública movida pra cima da árvore, fora do `ProtectedRoute`, renderizando a landing igual com ou sem sessão (decisão: não expulsar quem já logou, é material de apresentação); interceptor do Axios (`lib/api/client.ts`) auditado — não faz redirect global em 401, só `clearAuth()`, então não havia essa armadilha adicional. **Testes: 24 → 30** no frontend (`landing-page.test.tsx` com LAND-01/02; `App.test.tsx` novo com ROTA-01..04 cobrindo pública/privada/sessão/sem sessão); `npm run check` verde nos dois workspaces (API 269/269 inalterado, web lint 0 erros + contraste 66/66 + 30/30 testes). **Validação em navegador real:** a extensão do Chrome não conectou nesta sessão (mesmo bloqueio de fases anteriores) — repetido o fallback da Fase 8 Checkpoint 5: Playwright ad-hoc no scratchpad contra `docker compose up --build` (rebuild real da imagem `web`, não dev server), 21/21 checks headless passando — login real com `admin@vulnera.local` do seed, `/` sem sessão fica em `/` sem redirect, `/dashboard` sem sessão ainda vai pro `/login`, `/` com sessão mostra só "Ir para o Dashboard", console limpo nos 3 breakpoints (375/768/1440) e com `prefers-reduced-motion` ativo, screenshots conferidos visualmente. |
| 2026-08-19 | Task 8.12 — landing "cyber-samurai" completa (cena Three.js) | Branch `feat/improve-landing-page`, **não commitada**. Executa a task que `fix/landing-publica` (2026-08-18) deixou deliberadamente pendente. **Decisão de arquitetura (ADR-026):** a landing força `data-theme="dark"` numa subárvore (mesmo mecanismo do `/styleguide`) e a paleta cyber vive fora de `tokens.css`, num módulo hex dedicado (`components/landing/landing-palette.ts`) — precedente direto de `lib/severity-colors.ts` (Recharts/pdf-lib já exigiam o mesmo). `tokens.css`/`tailwind.config.ts` não mudaram; `check-contrast.mjs` continua 66/66. **Cena 3D:** `useHeroScene` (nome exigido pelo BACKLOG) em Three.js vanilla + `three/examples/jsm/postprocessing` (sem `@react-three/fiber` nem dependência nova além de `three`) — lâmina wireframe estilizada + "glow shell" aditivo (bloom de verdade seria 5 render targets extras/frame, caro demais pro orçamento de 60fps), ~220 partículas sakura/cyber-spark com turbulência via soma de senos, passe ASCII (atlas de glifos JetBrains Mono desenhado em runtime, sem asset de imagem) + aberração cromática (amostragem de cor deslocada por canal, luma lido uma vez só) + scanlines + glitch periódico (WCAG 2.3.1 respeitado: burst espacial de ~180ms a cada 5-8s, não é flash de luminância). **Degradação graciosa, um caminho de código só:** `supportsWebGL2()` (feature-detect sem tocar o canvas, pra não anular os atributos do `WebGLRenderer` — pegadinha real da spec de Canvas) cobre ao mesmo tempo `prefers-reduced-motion`, GPU/navegador sem WebGL2 **e o jsdom dos testes** (não implementa a API) — os três caem no mesmo gradiente CSS estático. **Perf:** `CyberCanvas` carregado via `React.lazy()` — sem isso, `three` (~600kB gzip) entraria no chunk PRINCIPAL da app e toda rota (dashboard, login) pagaria o download; build real confirmou o chunk `cyber-canvas` isolado em 132kB gzip, zero ocorrência de `three` no chunk principal (grep no bundle). `dispose()` completo no unmount (geometrias/materiais/texturas/composer/renderer + `forceContextLoss()`), conforme a exigência literal do BACKLOG (evitar vazar contexto WebGL a cada navegação landing↔dashboard). **Seções novas:** navbar com chip de status decorativo + âncoras; hero com `GlitchText` (headline, duplicata RGB-split via `data-text`, zerada em `prefers-reduced-motion`); 4 cards de recursos (SAST/DAST, maturidade, relatórios, auditoria/MTTR); preview de risk score reimplementando **a mesma fórmula** de `metrics.model.ts` (`Σcvss²/10`) sobre uma amostra fixa (24,04), com `SeverityBadge` real; seção de Planos consumindo `plansApi.list()` (mesma queryKey de `plans-page.tsx`, cache compartilhado); footer sem link "Entrar" fixo (colidia com o CTA condicional da navbar — achado pelos testes). **Bugs achados e corrigidos ainda dentro desta sessão** (não é lista de pendência, já resolvidos): classe Tailwind montada em template string (`` `bg-severity-${x}` ``, invisível no build de produção — Tailwind varre texto-fonte, não runtime); `h-64`/`w-32`/`mt-9`/`py-28`/`sm:py-36`/`sm:text-5xl`/`gap-1.5`/`h-1.5` — chaves que não existem na escala de espaçamento/tipografia CUSTOM deste projeto (`theme` substitui o default do Tailwind por inteiro, não estende); todos verificados um a um contra um build real do Tailwind (`npx tailwindcss`), não só por leitura. Sinal de sinal errado na turbulência das partículas (spark devia subir, código fazia ele cair — corrigido). ⚠️ **Achado fora do escopo, não corrigido** (S6): `plans-page.tsx` já tinha o mesmo tipo de bug (`w-32` num `Skeleton`, também inválido nesta escala) — pré-existente, não tocado. **Testes: 34 → 34** no frontend, mas landing ganhou 4 casos novos (LAND-03..06: seções renderizam, canvas degrada sem lançar exceção, risk score bate com a fórmula, planos da API aparecem ordenados) — `App.test.tsx` ROTA-04 atualizado pro headline novo ("Encontre. Priorize. Remedie."); `landing-page.test.tsx` ganhou `QueryClientProvider` (a seção de Planos agora usa `useQuery`) e mock de `plansApi.list`. `npm run check` verde (lint 0 erros, contraste 66/66, 34/34 testes); `tsc --noEmit` e `vite build` (produção) verdes. **Validação visual em navegador real — extensão do Chrome não conectou (mesmo bloqueio de sessões anteriores), mas desta vez o fallback Playwright (instalado ad-hoc, `npx playwright install chromium`) foi decisivo, não só formal: rodando a cena de verdade num Chromium real (`vite build` + `vite preview`, 3 viewports incluindo `prefers-reduced-motion`), achou TRÊS bugs que nenhum teste automatizado pegaria, porque `jsdom` nunca executa WebGL de verdade:**
(1) `new THREE.WebGLRenderer()` podia retornar SEM lançar mesmo com o contexto já morto (visto rodando em modo dev com StrictMode + software rendering degenerado) — o canvas ficava opaco e QUEBRADO (branco) por cima do fallback, pior que nunca ter montado; corrigido com `renderer.getContext().isContextLost()` explícito logo após a criação + listener `webglcontextlost` contínuo (`onLost` novo em `useHeroScene`, devolve `cyber-canvas.tsx` pro fallback se o contexto morrer no meio da sessão).
(2) `gl_PointSize` das partículas usava um fator de escala (`200.0`) grande demais pro `aSize`/distância da câmera — em GPU real teria virado blob enorme (clamp de `ALIASED_POINT_SIZE_RANGE`), em software rendering simplesmente sumia; ajustado pra `28.0` + `aSize` reduzido, confirmado visualmente (faíscas/pétalas pequenas e legíveis, não manchas).
(3) **O mais sério:** `ShaderPass` CLONA o objeto de uniforms quando recebe um descritor plano (`{uniforms, vertexShader, fragmentShader}`) — todo update por frame (`uTime`, `uResolution`, `uGlitchAmount`...) estava escrevendo num objeto que o material renderizado NUNCA lia. `uResolution` ficava congelado em `(1,1)`, a grade de células colapsava pra um texel só fora do range `[0,1]` (clampado na borda), e a tela inteira virava uma cor sólida — o efeito ASCII nunca tinha realmente rodado em nenhum teste anterior desta sessão. Corrigido construindo `new THREE.ShaderMaterial({uniforms: asciiUniforms, ...})` explicitamente e passando a INSTÂNCIA pro `ShaderPass` (sem clone). Também achado nesse ciclo: um `` /* comentário com `crase` */ `` dentro do template literal do GLSL fechava a string mais cedo e quebrava `vite build` inteiro (esbuild não faz type-check, só `tsc --noEmit` pegaria — reforça por que os dois rodam separados). Depois dos quatro fixes, `npm run check` + `tsc --noEmit` + `vite build` + nova rodada de screenshots confirmaram: partículas visíveis e variando entre frames, headline com glitch RGB-split, fallback estático correto sob `prefers-reduced-motion`, zero erro de console. Screenshots enviados ao Rafael. ADR-026 documenta a decisão de arquitetura completa. |
| 2026-08-20 | Chore: dependências do mobile atualizadas pro SDK 57 mais recente | Branch `feat/mobile`, não commitada ainda. `npx expo install --fix` (ferramenta oficial, não edição manual do `package.json`/lockfile) — `expo` 57.0.11→57.0.15, `expo-constants` 57.0.9→57.0.13, `expo-linking` 57.0.5→57.0.7, `expo-notifications` 57.0.9→57.0.13, `expo-router` 57.0.11→57.0.15. `expo install --check` e `expo-doctor` confirmam compatibilidade (20/21 checks; o único aviso — react duplicado entre `app/mobile` e a raiz — é estrutural do monorepo, react 19 no mobile vs `^18.3.1` no `app/web`, não introduzido por este bump). `tsc --noEmit` limpo. `npm run lint` acusa 1 erro pré-existente em `use-push-registration.ts` (não relacionado, ver bloqueios §7) |
| 2026-08-20 | Mobile rebaixado pra Expo SDK 54 (Expo Go do Rafael no iPhone só reconhece SDK 54) + `app/mobile` saiu do workspace npm da raiz | Branch `feat/mobile`, não commitada ainda. `expo` 57.0.15→54.0.37, `expo-router` 57.0.15→6.0.24, `expo-constants` →18.0.14, `expo-font` →14.0.12, `expo-linking` →8.0.12, `expo-notifications` →0.32.17, `expo-secure-store` →15.0.8, `expo-status-bar` →3.0.9, `react` 19.2.3→19.1.0, `react-native` 0.86.2→0.81.5, `@types/react` →19.1.10, `typescript` →5.9.2 (todos calculados por `expo install --fix`, nunca escritos à mão). **Achado sério no processo**: `npm install` da raiz (monorepo com `react` 18 no web e 19 no mobile) passou a hospedar o React errado pro `react-router-dom` do web, quebrando `tsc` do `app/web` e criando risco de duas cópias de React no bundle do Vite em runtime — não só erro de tipo. `npm overrides` (mecanismo padrão do npm pra isso) **não funcionou neste ambiente** (testado dobrado, com log verboso, nunca aparece no lockfile — armadilha documentada no ADR). Correção estrutural, decidida com o Rafael: `app/mobile` saiu do array `workspaces` da raiz, ganhou `node_modules`/lockfile próprios (o que o `README.md` já documentava). Ver **ADR-027**. Também corrigido: `expo-status-bar@3.0.9` não tem *config plugin* de verdade (só componente) e quebrava `expo config`/`expo-doctor` com `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` ao ser listado em `app.json > plugins` — removido de lá, `<StatusBar/>` continua funcionando via import direto. **Validação final**: `expo-doctor` 18/18 no mobile (isolado), `tsc --noEmit` limpo nos 3 workspaces (api/web/mobile), `npm run check` do web 100% verde (lint + 66/66 contraste + 30/30 testes), lint do mobile com o mesmo erro pré-existente e não relacionado de sempre (`use-push-registration.ts`, ver bloqueios §7). **Segundo achado, exposto só ao testar no Expo Go de verdade**: `zustand` nunca esteve declarado em `app/mobile/package.json` (só em `app/web/package.json`) desde a Fase 7 — `auth.store.ts` importa `zustand`/`zustand/middleware` e sempre "funcionou" por acidente via hoisting do workspace único. Isolar o mobile (ADR-027) expôs a dependência fantasma: `expo start` falhava no bundle do Metro com `Unable to resolve "zustand"`. Corrigido adicionando `"zustand": "^5.0.3"` às dependencies do mobile (mesma versão do web). Validado com `npx expo export --platform ios` completo (1263 módulos, sem erro) — teste equivalente ao `--platform android` que a Fase 7 já tinha usado, mas que não pega dependência fantasma resolvida só via hoisting cross-workspace (por isso não foi pego antes) |
| 2026-09-05 | Fase 9 (DAST via OWASP ZAP) concluída | Branch `feat/dast-zap` (renomeada de `feat/scan-dast-OWASP`), **não commitada** — instrução do prompt original. Módulo novo, fora da numeração v4, dado numa sessão dedicada. Fluxo "um campo e um botão": `POST /api/dast/scans {targetUrl}` cria `QUEUED` e dispara em background (fire-and-forget, sem fila — ADR-030); `zap-runner.service.ts` sobe `docker run --rm --name vulnera-zap-<id>` com `execFile` (nunca shell — imune a command injection), roda `zap-full-scan.py`, valida SSRF antes de qualquer execução (loopback + faixas privadas bloqueadas por padrão); `dast-findings.service.ts` normaliza URLs (`/users/123`→`/users/{id}`) e gera fingerprint estável `sha256(pluginId\|url\|param)` pra não duplicar o mesmo achado entre scans; **silo próprio** (`DastScan`/`DastFinding`, sem FK pra `Vulnerability`) porque o ZAP não fornece vetor CVSS e inventar um contaminaria o cálculo hoje 100%-confiável (ADR-029). RBAC: `requireRole("PENTESTER","ADMIN")` nas 7 rotas + ownership fina (PENTESTER só vê os próprios scans). Frontend com o design system da Fase 6.5 (zero Radix): lista com polling, detalhe com cronômetro e tabela expansível, relatório ZAP em `<iframe sandbox>`, PDF client-side no estilo dos relatórios Executivo/Técnico. **Testes: 269 → 315** (42 novos: SEC-01..05, RBAC-01..09, PIPE-01..05, LIFE-01..04), cobertura 89-96% nos 3 services novos, zero dependência de Docker na suíte (`DAST_FORCE_SIMULATE=true`). **Validação real, não simulada**: dois scans genuínos persistidos em disco — `http://example.com` (13 alertas) e o OWASP Juice Shop via `host.docker.internal:3500` (16 alertas) — mais 26 checks Playwright ad-hoc contra a stack de dev rodando de verdade (a extensão do Chrome não conectou, mesmo bloqueio recorrente de todas as fases anteriores). Corrigidos dois bugs reais: corrida em cancelamento de scan simulado (persistia findings ~3s depois de já não estar mais `RUNNING`) e timeout curto demais de `isDockerAvailable()` (5s→10s, Docker Desktop "frio" responde em ~6s). `docs/DAST.md` (10 seções) + ADR-028 (Docker spawn, risco do socket assumido) + ADR-029 (silo) + ADR-030 (sem fila). Ver `docs/ROADMAP_PROMPTS.md` §Fase 9 para o histórico completo de execução e desvios do prompt |
| —    | MVP funcional (Sprint 6 fechada) | A registrar |
| —    | Apresentação TCC                 | A registrar |

---

## 7. Bloqueios e impedimentos

> Use esta seção quando algo trava o time. Atualizar em tempo real.

| Data | Bloqueio | Impacta | Responsável | Status |
| ---- | -------- | ------- | ----------- | ------ |
| 2026-06-11 | Docker não instalado na máquina de dev local; porta 3306 ocupada por `MySQL80` | KAN-101, KAN-102, KAN-104, KAN-107 | R | ✅ Resolvido — migration `initial` foi aplicada via CI (job `test` usa mysql como serviço no GitHub Actions); seed pode ser rodado quando Docker disponível |
| 2026-06-16 | Branch `feat/sprint-2-auth-user` com Sprint 2 backend completa não foi mergeada em develop | Sprint 2 no board, início da Sprint 3 | R | Aberto — criar PR e mergear |
| 2026-06-16 | Frontend (app/web) só tem placeholder `package.json` — KAN-108/109/110/213/214/215 não iniciados | Sprint 1 e 2 ficam em 🚧; Iann não iniciou | I | ✅ Resolvido em 2026-08-04 — bootstrap completo feito na Fase 3 (Claude Code); só falta KAN-110 (landing de marketing dedicada) |
| 2026-08-04 | Branch `feat/fase-3-empresas` completa (backend + web) não foi mergeada em develop | Início da Fase 4 | R | Aberto — Rafael vai abrir o PR manualmente |
| 2026-08-05 | Branch `feat/fase-5-findings` completa (backend + web) não foi mergeada em develop | Início da Fase 6 | R | Aberto — Rafael vai abrir o PR manualmente |
| 2026-08-07 | Branch `feat/fase-6-relatorios` completa (backend + web) não foi mergeada em develop | Início da Fase 7 | R | Aberto — Rafael vai abrir o PR manualmente |
| 2026-08-07 | Extensão do Chrome não conectou nesta sessão — smoke visual de PDF e dashboards foi feito via API direta + PDFs gerados fora do browser (headless), não no app rodando de verdade | Confiança visual da Fase 6 | R | ✅ **Resolvido em 2026-08-07** (sessão de endurecimento) — a extensão conectou; embed de evidência no PDF Técnico confirmado visualmente (PNG 480×240 embutido, fallback não acionado), PDFs Executivo/Técnico e os 3 dashboards conferidos no navegador real |
| 2026-08-07 | `npm run check` não rodava num clone limpo: `.env`/`.env.test` ausentes (estão no `.gitignore`) e `ts-node` faltando nas devDependencies, exigido pelo `jest.config.ts` em TypeScript | Qualquer sessão nova; CI | R | ✅ **Resolvido em 2026-08-07** — `ts-node` adicionado ao `package.json`; `.env`/`.env.test` criados localmente (continuam fora do git, ver `.env.example`) |
| 2026-08-09 | Extensão do Chrome não conectou na sessão da Fase 6.5 — a validação visual dos 10 itens do CP8 (styleguide nos dois temas, troca sem flash, dashboards nos 3 papéis, filtragem cruzada, navegação só por teclado, overlays, responsivo 375/768/1440, `prefers-reduced-motion`, PDFs, console limpo) não foi feita | Confiança visual da Fase 6.5 | R | **Aberto** — substituído por validação headless (24 testes de frontend com jsdom + axe-core + `check-contrast`), que cobre acessibilidade e contraste mas **não** cobre aparência real, layout responsivo nem console do navegador |
| 2026-08-09 | Branch `feat/fase-6.5-design-system` **não commitada** (o prompt pediu explicitamente para não commitar nem abrir PR) | Integração da Fase 6.5 | R | Aberto — Rafael decide quando commitar |
| 2026-08-07 | PDF Executivo: no "Top 5 riscos", título longo sobrepõe o texto `CVSS x.x · Axx · Categoria` (`app/web/src/lib/pdf/executive.ts`) | Aparência do relatório na demo | R | Aberto — bug da Fase 6, fora do escopo do endurecimento (§0.2 S6). Task 8.11 no BACKLOG |
| 2026-08-10 | Branch `feat/fase-7-mobile` completa (mobile + backend de push) não foi mergeada em develop | Início da Fase 8 | R | Aberto — Rafael vai abrir o PR manualmente |
| 2026-08-10 | Smoke manual do app mobile no Expo Go (celular físico) não foi feito — exige aparelho real, fora do alcance do agente | Confiança de que o app roda de verdade fora do bundler/testes | R | Aberto — ambiente deixado pronto: API+web locais rodando, `npx expo start` ativo em `app/mobile`, `.env` já apontando pro IP da rede local (`10.87.169.58:3001/api`). Falta só o Rafael escanear o QR com o Expo Go e testar o fluxo (login → navegação → push de um CRITICAL criado pelo web) |
| 2026-08-11 | `app/web/node_modules` sem `motion`/`vitest`/`@testing-library/*` etc. instalados — declarados no `package.json` desde `f0b1f2c` (Fase 6.5) mas `npm install` nunca rodou depois; o app inteiro não subia (toda tela importa `motion/react` via os componentes de UI) | Qualquer sessão nova; build/dev do web | R | ✅ **Resolvido em 2026-08-11** — `npm install` na raiz (workspaces), 82 pacotes adicionados; `tsc --noEmit`, lint e `vitest run` voltaram a rodar limpos |
| 2026-08-11 | Extensão do Chrome não conectou na sessão da Fase 8 (CP1-3) — a tela nova `maturity-assessment-page.tsx` não foi vista rodando num navegador de verdade | Confiança visual da tela de maturidade | R | ✅ **Resolvido em 2026-08-11 (mesma sessão, Checkpoint 5)** — Playwright instalado ad-hoc (scratchpad, fora do repo) capturou screenshots reais da tela contra `docker compose up --build`: sidebar de domínios, seletor 1-5, observações, radar, tudo com os dados reais do seed. Ver `docs/evidencias/screenshots/04-maturidade.png` e o README raiz |
| 2026-08-18 | Landing "cena Three.js" (efeito ASCII, samurai procedural, mergulho de câmera por scroll) da issue original não existe em nenhum formato no repositório — não é bugfix, é feature nova | KAN-110 (só o essencial da rota foi corrigido) | R | ✅ **Resolvido em 2026-08-19** — task 8.12 completa (ver §6 e ADR-026): `useHeroScene`, ASCII + aberração cromática + partículas + lâmina wireframe, `lazy()`, degradação graciosa. "Mergulho de câmera por scroll" da issue original virou parallax por ponteiro (mais barato, sem scroll-jacking) — desvio anotado, não scroll real |
| 2026-08-19 | Extensão do Chrome não conectou nesta sessão (mesmo bloqueio recorrente) — a cena Three.js da task 8.12 precisava ser vista rodando de verdade, não só passar em `jsdom` (que não implementa WebGL) | Confiança visual da task 8.12 | R | ✅ **Resolvido na mesma sessão, e valeu a pena de verdade** — Playwright ad-hoc (`npx playwright install chromium`) contra `vite build`+`vite preview`: achou e permitiu corrigir 3 bugs reais que só apareciam com WebGL de verdade (contexto perdido sem exceção, escala de partícula, e o `ShaderPass` clonando uniforms e congelando o efeito ASCII inteiro) — ver §6, entrada de 2026-08-19. Sem essa validação, a landing teria sido entregue com o hero quebrado ou com a cena 3D nunca de fato animando |
| 2026-08-18 | Extensão do Chrome não conectou nesta sessão — validação visual do fix de landing feita via Playwright ad-hoc (mesmo fallback da Fase 8 CP5) | Confiança visual do fix `fix/landing-publica` | R | ✅ **Resolvido na mesma sessão** — 21/21 checks headless contra `docker compose up --build` real (não dev server): login real com seed, redirects, navbar condicional, 375/768/1440, `prefers-reduced-motion`, console limpo; screenshots conferidos |
| 2026-08-20 | `app/mobile/src/hooks/use-push-registration.ts:34` viola `@typescript-eslint/no-var-requires` (`require("expo-notifications")` em vez de import) — encontrado ao rodar `npm run lint` depois do bump de dependências do Expo, código não tocado nesta task | `npm run lint` do mobile fica vermelho | R | Aberto — bug fora do escopo desta task (§0.2 S6); relacionado ao commit `67f814f` ("fix: bug use-push-registration, inacabado") |
| 2026-09-05 | Branch `feat/dast-zap` completa (315 testes, docs, 3 ADRs) não commitada — instrução do prompt original | Integração da Fase 9 | R | Aberto — Rafael decide quando commitar. Confirmado nesta sessão (2026-09-06): `npm run check` verde nos dois workspaces (315 backend + 34 frontend), build de produção limpo, migration MySQL aplicada, RBAC de rotas e menu conferidos no código |
| 2026-09-05 | Smoke visual real do módulo DAST (screenshots Playwright + PDF baixado) não anexado ao repositório — ficou só descrito no relatório da sessão que fez o trabalho | Confiança visual do módulo DAST pro Rafael | R | Parcialmente resolvido em 2026-09-06 — os dois relatórios ZAP reais (`example.com` e Juice Shop) foram copiados de `app/api/dast-reports/` para `docs/evidencias/dast/` com README explicando o contraste entre os dois (controle negativo/positivo — Backup File Disclosure com 31 instâncias no Juice Shop). **Ainda falta**: os screenshots Playwright em si (login, RBAC visual, polling, tabela expansível) e o PDF baixado pela UI não foram gerados/anexados — os 26 checks *rodaram e passaram* na sessão original, mas não deixaram artefato. Se quiser esses screenshots no repo, é preciso rodar o smoke de novo |
| 2026-08-11 | PR `feat/fase-8-maturidade-tcc` → `dev` não aberta — necessária pra disparar o SonarQube (evento `pull_request`) | Evidência de qualidade do Checkpoint 4 (Sonar) | R | **Aberto** — agente não tem `gh` CLI nem token do GitHub neste ambiente. Link pronto: https://github.com/guimunizzz/Vulnera-TCC/compare/dev...feat/fase-8-maturidade-tcc (trocar base pra `dev` se o GitHub sugerir `main`). Repo é público — assim que a PR abrir, o agente consegue acompanhar o resultado sozinho via API pública do GitHub, sem precisar de token |

---

_Documento vivo. Atualizar a cada PR mergeada e a cada início/fim de sprint._
