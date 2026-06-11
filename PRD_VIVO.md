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
| Sprint atual       | **Sprint 1 — Fundação**             |
| Data início        | 2026-XX-XX (a definir)              |
| Data alvo TCC      | 2026-XX-XX (16 semanas após início) |
| Última atualização | 2026-06-11 por @rafael              |

---

## 2. Visão por sprint

Legenda: 📋 backlog · 🚧 em progresso · ✅ feito · ❄️ pausado · ❌ cancelado

| Sprint                             | Foco                                       | Status | % concluído |
| ---------------------------------- | ------------------------------------------ | ------ | ----------- |
| 0 — Refactor                       | Alinhar código atual com CLAUDE.md v2      | 🚧     | 0%          |
| 1 — Fundação                       | Infra, schema, server base, frontend setup | 🚧     | em progresso |
| 2 — Auth + User                    | JWT, register, login, CRUD User            | 📋     | 0%          |
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
| KAN-101: Schema + migrations             | 🚧     | R     | feat/sprint-1-foundation — schema validado (19 tabelas), `.env` ajustado p/ user `vulnera`, `prisma generate` ok; `prisma migrate dev` pendente (Docker/MySQL local não disponível) |
| KAN-102: docker-compose                  | ✅     | R     | feat/sprint-1-foundation — arquivo criado, execução pendente (Docker não instalado) |
| KAN-103: /api/health                     | 📋     | R     | —   |
| KAN-104: Jest + Supertest setup          | 📋     | R     | —   |
| KAN-105: GitHub Actions                  | 📋     | R     | —   |
| KAN-106: ESLint + tsconfig strict        | 📋     | R     | —   |
| KAN-107: Seed inicial (TechNova + Admin) | 📋     | R     | —   |
| KAN-108: React+Vite+Tailwind setup       | 📋     | I     | —   |
| KAN-109: Componentes UI base             | 📋     | I     | —   |
| KAN-110: Landing page                    | 📋     | I     | —   |

---

### FEAT-02 — Auth + User (Sprint 2)

| Task                                | Status | Owner | PR  |
| ----------------------------------- | ------ | ----- | --- |
| KAN-201: utils/jwt + hash           | 📋     | G     | —   |
| KAN-202: auth.middleware            | 📋     | G     | —   |
| KAN-203: user.model                 | 📋     | G     | —   |
| KAN-204: user.repository            | 📋     | G     | —   |
| KAN-205: refresh-token.repository   | 📋     | G     | —   |
| KAN-206: auth.service               | 📋     | G     | —   |
| KAN-207: auth.controller            | 📋     | G     | —   |
| KAN-208: user.service + controller  | 📋     | G     | —   |
| KAN-209: factories (Auth + User)    | 📋     | G     | —   |
| KAN-210: routes                     | 📋     | G     | —   |
| KAN-211: Testes Auth (AUTH-01 a 09) | 📋     | R     | —   |
| KAN-212: Testes User                | 📋     | R     | —   |
| KAN-213: Login page (web)           | 📋     | I     | —   |
| KAN-214: Register page (web)        | 📋     | I     | —   |
| KAN-215: Axios interceptor          | 📋     | I     | —   |

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
| —    | Refactor inicial                 | A registrar |
| —    | Primeira PR mergeada             | A registrar |
| —    | API rodando localmente           | A registrar |
| —    | Primeiro teste passando          | A registrar |
| —    | MVP funcional (Sprint 5 fechada) | A registrar |
| —    | Apresentação TCC                 | A registrar |

---

## 7. Bloqueios e impedimentos

> Use esta seção quando algo trava o time. Atualizar em tempo real.

| Data | Bloqueio | Impacta | Responsável | Status |
| ---- | -------- | ------- | ----------- | ------ |
| —    | —        | —       | —           | —      |

---

_Documento vivo. Atualizar a cada PR mergeada e a cada início/fim de sprint._
