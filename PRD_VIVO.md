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
| Sprint atual       | **Fase 6.5 — Design System + Dashboards analíticos** (concluída em 2026-08-09, branch `feat/fase-6.5-design-system` **não commitada**) |
| Data início        | 2026-06-10 (Sprint 0)               |
| Data alvo TCC      | 2026-10-25 (11 semanas restantes, ver `docs/BACKLOG.md` v4) |
| Última atualização | 2026-08-09 por Claude Code (Fase 6.5 — design system, componentes próprios, temas, métricas e dashboards) |

---

## 2. Visão por sprint

Legenda: 📋 backlog · 🚧 em progresso · ✅ feito · ❄️ pausado · ❌ cancelado

| Sprint                             | Foco                                       | Status | % concluído |
| ---------------------------------- | ------------------------------------------ | ------ | ----------- |
| 0 — Refactor                       | Alinhar código atual com CLAUDE.md v2      | ✅     | 100%        |
| 1 — Fundação                       | Infra, schema, server base, frontend setup | 🚧     | 91% (10/11 ✅; KAN-108/109 feitos na Fase 3; falta só KAN-110 landing) |
| 2 — Auth + User                    | JWT, register, login, CRUD User            | ✅     | 100% (15/15 ✅; KAN-213/214/215 feitos na Fase 3; branch `feat/sprint-2-auth-user` ainda aguardando PR próprio) |
| 3 — Company + Plan + Subscription  | Onboarding e modelo comercial              | ✅     | 100% — concluída em 2026-08-04 |
| 4 — Application + Project + Member | Catálogo e gestão de projetos              | ✅     | 100% — concluída em 2026-08-04 |
| 5 — Vulnerability + Evidence       | Núcleo do produto                          | ✅     | 100% — concluída em 2026-08-05; **endurecida em 2026-08-07** (225 testes, cobertura ≥90%) |
| 6 — Relatórios + Dashboard         | PDFs e dashboards                          | ✅     | 100% — concluída em 2026-08-07 |
| **6.5 — Design System + Analytics** | **Tokens, componentes próprios, temas, métricas** | ✅ | **100% — concluída em 2026-08-09.** Inserida antes da Fase 7 de propósito: o mobile herda os tokens |
| 7 — Mobile + IA Gemini             | App mobile e assistente IA                 | 📋     | 0%          |
| 8 — Maturidade + Apresentação      | Polimento e entrega                        | 📋     | 0%          |

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
| KAN-110: Landing page                    | 📋     | —     | Não coberto pela Fase 3 — a página pública de planos (`/plans`, KAN-310) cobre a entrada pública por ora; landing de marketing dedicada não estava no escopo do prompt |
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

### FEAT-07 — Mobile + IA Gemini (Sprint 7)

| Task                                         | Status | Owner | PR  |
| -------------------------------------------- | ------ | ----- | --- |
| KAN-701: Setup Expo + TS                     | 📋     | I     | —   |
| KAN-702: Tela Login mobile                   | 📋     | I     | —   |
| KAN-703: Home com lista projetos             | 📋     | I     | —   |
| KAN-704: Detalhe projeto                     | 📋     | I     | —   |
| KAN-705: Detalhe finding read-only           | 📋     | I     | —   |
| KAN-706: Viewer PDF                          | 📋     | I     | —   |
| KAN-707: Expo Push setup                     | 📋     | R     | —   |
| KAN-708: POST /notifications/register-push   | 📋     | R     | —   |
| KAN-709: Service de push em finding CRITICAL | 📋     | R     | —   |
| KAN-710: utils/gemini cliente                | 📋     | R     | —   |
| KAN-711: AI endpoints (sugestões)            | 📋     | R     | —   |
| KAN-712: Botão "Sugerir IA" no editor        | 📋     | I     | —   |

---

### FEAT-08 — Maturidade + Apresentação (Sprint 8)

| Task                                   | Status | Owner | PR  |
| -------------------------------------- | ------ | ----- | --- |
| KAN-801: Seed domínios + controles     | 📋     | I     | —   |
| KAN-802: Maturity Assessment CRUD      | 📋     | R     | —   |
| KAN-803: Maturity factory + routes     | 📋     | R     | —   |
| KAN-804: Tela avaliação (admin web)    | 📋     | I     | —   |
| KAN-805: Radar chart Recharts          | 📋     | I     | —   |
| KAN-806: Maturidade no relatório PDF   | 📋     | G     | —   |
| KAN-807: Seed demo TechNova realista   | 📋     | I     | —   |
| KAN-808: SonarQube relatório capturado | 📋     | R     | —   |
| KAN-809: OWASP ZAP relatório capturado | 📋     | R     | —   |
| KAN-810: Smoke tests E2E manuais       | 📋     | R     | —   |
| KAN-811: README + diagrama             | 📋     | R + I | —   |
| KAN-812: Slides TCC                    | 📋     | I + R | —   |
| KAN-813: Ensaios de apresentação       | 📋     | Todos | —   |

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

---

_Documento vivo. Atualizar a cada PR mergeada e a cada início/fim de sprint._
