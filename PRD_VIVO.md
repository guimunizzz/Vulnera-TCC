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
| Sprint atual       | **Sprint 2 — Auth + User** (backend completo; aguardando merge em develop e frontend Iann) |
| Data início        | 2026-06-10 (Sprint 0)               |
| Data alvo TCC      | 2026-XX-XX (16 semanas após início) |
| Última atualização | 2026-06-16 por @rafael              |

---

## 2. Visão por sprint

Legenda: 📋 backlog · 🚧 em progresso · ✅ feito · ❄️ pausado · ❌ cancelado

| Sprint                             | Foco                                       | Status | % concluído |
| ---------------------------------- | ------------------------------------------ | ------ | ----------- |
| 0 — Refactor                       | Alinhar código atual com CLAUDE.md v2      | ✅     | 100%        |
| 1 — Fundação                       | Infra, schema, server base, frontend setup | 🚧     | 73% (8/11 ✅; KAN-108/109/110 📋 Iann) |
| 2 — Auth + User                    | JWT, register, login, CRUD User            | 🚧     | 80% (12/15 ✅; KAN-213/214/215 📋 Iann; branch aguardando merge) |
| 3 — Company + Plan + Subscription  | Onboarding e modelo comercial              | 📋     | 0%          |
| 4 — Application + Project + Member | Catálogo e gestão de projetos              | 📋     | 0%          |
| 5 — Vulnerability + Evidence       | Núcleo do produto                          | 📋     | 0%          |
| 6 — Relatórios + Dashboard         | PDFs e dashboards                          | 📋     | 0%          |
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
| KAN-108: React+Vite+Tailwind setup       | 📋     | I     | —   |
| KAN-109: Componentes UI base             | 📋     | I     | —   |
| KAN-110: Landing page                    | 📋     | I     | —   |
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
| KAN-213: Login page (web)           | 📋     | I     | — (app/web placeholder) |
| KAN-214: Register page (web)        | 📋     | I     | — (app/web placeholder) |
| KAN-215: Axios interceptor          | 📋     | I     | — (app/web placeholder) |

---

### FEAT-03 — Company + Plan + Subscription (Sprint 3)

| Task                                        | Status | Owner | PR  |
| ------------------------------------------- | ------ | ----- | --- |
| KAN-301: Company CRUD                       | 📋     | G     | —   |
| KAN-302: Company factory + routes           | 📋     | G     | —   |
| KAN-303: Plan CRUD completo                 | 📋     | R     | —   |
| KAN-304: Plan factory + routes              | 📋     | R     | —   |
| KAN-305: Subscription CRUD + approve/reject | 📋     | R     | —   |
| KAN-306: Subscription factory + routes      | 📋     | R     | —   |
| KAN-307: Notificação admin (email + audit)  | 📋     | R     | —   |
| KAN-308: Testes integração                  | 📋     | R     | —   |
| KAN-309: Onboarding (web)                   | 📋     | I     | —   |
| KAN-310: Página de planos pública           | 📋     | I     | —   |
| KAN-311: Dashboard admin (pendentes)        | 📋     | I     | —   |

---

### FEAT-04 — Application + Project + ProjectMember (Sprint 4)

| Task                                        | Status | Owner | PR  |
| ------------------------------------------- | ------ | ----- | --- |
| KAN-401: Application CRUD                   | 📋     | R     | —   |
| KAN-402: Application factory + routes       | 📋     | R     | —   |
| KAN-403: Project CRUD + transition          | 📋     | R     | —   |
| KAN-404: Project factory + routes           | 📋     | R     | —   |
| KAN-405: ProjectMember CRUD                 | 📋     | G     | —   |
| KAN-406: Nested route /projects/:id/members | 📋     | G     | —   |
| KAN-407: Testes Application (TEN-01 a 03)   | 📋     | R     | —   |
| KAN-408: Testes Project (TEN-04, 05)        | 📋     | R     | —   |
| KAN-409: Lista de aplicações (web)          | 📋     | I     | —   |
| KAN-410: Wizard nova análise (web)          | 📋     | I     | —   |
| KAN-411: Detalhe de projeto (web)           | 📋     | I     | —   |

---

### FEAT-05 — Vulnerability + Evidence (Sprint 5) ⭐ CORE

| Task                                        | Status | Owner | PR  |
| ------------------------------------------- | ------ | ----- | --- |
| KAN-501: utils/cvss (cálculo automático)    | 📋     | R     | —   |
| KAN-502: Vulnerability CRUD + transition    | 📋     | R     | —   |
| KAN-503: Vulnerability factory + routes     | 📋     | R     | —   |
| KAN-504: Evidence CRUD (upload MIME)        | 📋     | G     | —   |
| KAN-505: Evidence factory + nested routes   | 📋     | G     | —   |
| KAN-506: VulnerabilityComment nested        | 📋     | G     | —   |
| KAN-507: AuditLog helper                    | 📋     | R     | —   |
| KAN-508: Testes Vulnerability (BIZ-03 a 08) | 📋     | R     | —   |
| KAN-509: Testes Evidence (BIZ-09)           | 📋     | R     | —   |
| KAN-510: Lista de findings (web)            | 📋     | I     | —   |
| KAN-511: Editor de finding (web)            | 📋     | I     | —   |

---

### FEAT-06 — Relatórios + Dashboard (Sprint 6)

| Task                                 | Status | Owner | PR  |
| ------------------------------------ | ------ | ----- | --- |
| KAN-601: /projects/:id/report-data   | 📋     | R     | —   |
| KAN-602: Report metadata CRUD        | 📋     | R     | —   |
| KAN-603: Report factory + routes     | 📋     | R     | —   |
| KAN-604: react-pdf setup             | 📋     | G     | —   |
| KAN-605: Relatório Executivo PDF     | 📋     | G     | —   |
| KAN-606: Relatório Técnico PDF       | 📋     | G     | —   |
| KAN-607: Dashboard cliente           | 📋     | I     | —   |
| KAN-608: Dashboard pentester         | 📋     | I     | —   |
| KAN-609: Dashboard admin             | 📋     | I     | —   |
| KAN-610: Testes report-data (BIZ-10) | 📋     | R     | —   |

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
| —    | MVP funcional (Sprint 5 fechada) | A registrar |
| —    | Apresentação TCC                 | A registrar |

---

## 7. Bloqueios e impedimentos

> Use esta seção quando algo trava o time. Atualizar em tempo real.

| Data | Bloqueio | Impacta | Responsável | Status |
| ---- | -------- | ------- | ----------- | ------ |
| 2026-06-11 | Docker não instalado na máquina de dev local; porta 3306 ocupada por `MySQL80` | KAN-101, KAN-102, KAN-104, KAN-107 | R | ✅ Resolvido — migration `initial` foi aplicada via CI (job `test` usa mysql como serviço no GitHub Actions); seed pode ser rodado quando Docker disponível |
| 2026-06-16 | Branch `feat/sprint-2-auth-user` com Sprint 2 backend completa não foi mergeada em develop | Sprint 2 no board, início da Sprint 3 | R | Aberto — criar PR e mergear |
| 2026-06-16 | Frontend (app/web) só tem placeholder `package.json` — KAN-108/109/110/213/214/215 não iniciados | Sprint 1 e 2 ficam em 🚧; Iann não iniciou | I | Aberto — ⚠️ verificar com Iann |

---

_Documento vivo. Atualizar a cada PR mergeada e a cada início/fim de sprint._
