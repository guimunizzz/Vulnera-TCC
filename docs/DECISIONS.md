# DECISIONS.md — Decisões a ratificar com o time

> Use este documento como pauta de uma call de 30 minutos com Guilherme e Iann.
> Cada decisão tem **contexto**, **opção escolhida** e **alternativa rejeitada** — pra eles entenderem o "porquê" antes de só cumprir.

---

## D1 — Padrão arquitetural: 5 camadas + Factory Method

**Decisão:** Controller → Service → Repository → Prisma, com Factory Method por recurso.

**Por quê:**

- Factory Method é padrão **avaliado pelo professor** (não negociável)
- 5 camadas facilita teste (mockar 1 camada por vez)
- Separação clara permite trocar Prisma sem mexer no Service

**Alternativa descartada:** Express puro com função handler por rota.

- Seria 30% menos código, mas perde a nota do padrão acadêmico.

---

## D2 — Estrutura de pastas fixa

**Decisão:**

```
src/
├── config/ (com EnvVar e enum/EnvKeys)
├── controller/
├── database/ (prisma client + scripts SQL futuros)
├── factory/
├── middleware/ (singular)
├── model/ (1 arquivo por recurso)
├── repository/
├── routes/ (com routes.ts central)
├── service/ (SINGULAR, não plural)
└── utils/
```

**Por quê:**

- `service/` singular pra alinhar com `controller/`, `repository/`, `middleware/`
- `database/` separada de `config/` porque vai crescer (scripts SQL, snapshots, docs de modelagem)
- `factory/` nova — não existia no código, agora obrigatória

**Itens divergentes do código atual que vão ser corrigidos:** ver `REFACTOR_PLAN.md`.

---

## D3 — Nomenclatura: kebab + role

**Decisão:** Arquivos no padrão `<recurso>.<role>.ts`.

- ✅ `plan.controller.ts`, `plan.service.ts`, `plan.repository.ts`
- ❌ `PlanController.ts`, `PlanService.ts`

**Por quê:**

- O código atual já usa esse padrão (`user.controller.ts`)
- Mais legível em IDE com fuzzy search ("plan.r" encontra repository)
- Padroniza com convenção popular do Node/Express

**Para as CLASSES dentro dos arquivos:** PascalCase normal (`class PlanController`).

---

## D4 — 1 arquivo por model

**Decisão:** `plan.model.ts` contém **type + DTOs + entity** juntos.

**Por quê:**

- Pra TCC com prazo de 4 meses, 3 arquivos por model vira ritual sem ganho
- Quando um model passar de ~200 linhas, quebra em 3

**Alternativa descartada:** `plan.type.ts` + `plan.dto.ts` + `plan.entity.ts`.

- Padrão mais clássico mas inflama o repo prematuramente.

---

## D5 — Validação manual com `if` (por enquanto)

**Decisão:** validação inline no Controller com `if (!body.name)`.

**Por quê:**

- Time aprendendo. `zod` adiciona conceito novo (schema declarativo) que distrai do padrão de camadas
- Cada validação manual é literal e óbvia

**Alternativa adiada:** migrar pra `zod` depois do MVP.

- Marcado com `🚧 [FUTURO]` no CLAUDE.md.

---

## D6 — try/catch em cada método do controller

**Decisão:** repetir `try/catch` em cada método.

**Por quê:**

- Explícito = didático
- Cada erro é tratado onde a regra dele faz sentido (no controller)

**Alternativa adiada:** middleware global de erro + classe `AppError`.

- Refatorar quando todos os CRUDs estiverem prontos.

---

## D7 — Códigos de erro em SCREAMING_SNAKE_CASE

**Decisão:** Service lança `throw new Error("PLAN_NOT_FOUND")`, Controller traduz pra HTTP + JSON `{ error: "PLAN_NOT_FOUND" }`.

**Padrões fixos:**

- `MISSING_<FIELD>`, `INVALID_<FIELD>`
- `<ENTITY>_NOT_FOUND`, `<ENTITY>_ALREADY_EXISTS`
- `UNAUTHORIZED`, `INVALID_TOKEN`, `FORBIDDEN`
- `INTERNAL_ERROR`

**Por quê:**

- Sem texto humano no Service permite trocar idioma sem mexer em regra
- Frontend pode renderizar mensagem amigável a partir do código

---

## D8 — JWT desde o início

**Decisão:** Auth completa (register, login, refresh, logout, reset) implementada na Sprint 2.

**Por quê:**

- Toda rota de CRUD precisa de `authMiddleware`. Adiar Auth quebra o fluxo de teste.
- O Guilherme conhece JWT bem → naturalmente owner desta sprint.

**Detalhes:**

- Access token: 15 minutos
- Refresh token: 7 dias, armazenado hasheado (SHA-256) no banco
- Bcrypt cost 12 pra senha

---

## D9 — MySQL via Docker Compose

**Decisão:** MySQL 8 em container local. Sem produção, sem Nginx, sem Postgres.

**`docker-compose.yml`** (a criar) deve ter apenas:

- `db` (MySQL 8)
- `mailhog` (SMTP fake pra testar e-mails)
- `sonarqube` (opcional, pra avaliação)

**Por quê:**

- Mínimo viável. Prometheus/Grafana já foram descartados.
- Trocar pra Postgres no futuro = mudar 1 linha no `schema.prisma`.

---

## D10 — Testes de integração obrigatórios

**Decisão:** Toda PR de CRUD inclui `tests/integration/<recurso>.test.ts` com:

- Happy path (POST cria, GET busca, PUT atualiza, DELETE remove)
- 1-2 cenários de erro do controller (validação)
- 1 cenário de regra de negócio do service

**Comando:** `npm run test` deve passar antes de mergear.

**Por quê:**

- "Quero rodar `npm test` e ele garantir que não quebrei nada" — requisito explícito do Rafael.
- Testes unitários por camada são over-engineering nesta fase.

---

## D11 — Vulnerabilidades como instância individual (Tenable/Wiz-like)

**Decisão:** Cada `Vulnerability` é registro único, ligado a UM Project / Application / Company.

**Não há "biblioteca compartilhada de CVEs".** Se TechNova e Acme têm a mesma SQL Injection, são 2 registros independentes.

**Isolamento garantido por:**

- FK `projectId`, `applicationId`, `companyId` em cada Vulnerability
- Toda query de listagem filtra por `companyId` primeiro
- Canários TEN-XX validam que cliente A nunca vê dado de B

---

## D12 — Sprints de 2 semanas

**Decisão:** 8 sprints de 2 semanas = 16 semanas (4 meses).

**Capacidade:**

- Rafael: 4h/dia × 10 dias úteis = 40h/sprint
- Guilherme: ~2h/dia (entre trabalho) = ~20h/sprint
- Iann: ~2h/dia (entre trabalho) = ~20h/sprint
- **Total: ~80h por sprint**

**Sprints (resumo, detalhe no `BACKLOG.md`):**

1. Fundação (infra, schema, server base)
2. Auth + User
3. Company + Plan + Subscription
4. Application + Project + ProjectMember
5. Vulnerability + Evidence (núcleo)
6. Relatórios + Dashboards
7. Mobile + IA Gemini
8. Maturidade + Polimento + Apresentação

---

## D13 — Divisão por integrante

**Rafael (Tech Lead):**

- Toda decisão arquitetural
- Infra (Docker, CI, Sonar)
- Code review obrigatório em PRs
- Schema Prisma e migrations
- Recursos críticos (Project, Vulnerability)

**Guilherme (Backend secundário):**

- Auth completa (sprint 2)
- User CRUD
- Subscription com aprovação (envolve regra fiscal)
- JWT refresh + rotation

**Iann (Frontend):**

- **Pode começar AGORA**, em paralelo com a API
- Setup do React+Vite em `app/web`
- Componentização base com Tailwind + Radix
- Landing page (já temos prompt pronto)
- Páginas mockadas (login, register, dashboard) com dados fake
- Quando API estiver pronta, troca mock por endpoint real

---

## D14 — PRD vivo como gestão à vista

**Decisão:** `PRD_VIVO.md` na raiz do repo.

- Claude Code **lê** no início de cada sessão pra saber o que falta
- Claude Code **atualiza** marcando ✅ quando termina uma task
- Você consulta pra gestão (sem precisar abrir o JIRA toda hora)

**Estrutura:** tabela por sprint, com checklist de tasks dentro de cada feature.

---

## D15 — JIRA: project KAN, type Task, sprints como labels

**Decisão:**

- Project key: `KAN`
- Issue type: `Task` (sem Epic/Story complexo)
- Sprint: campo nativo do JIRA
- Estimativa: em **horas** (não story points)
- Sprints duram 2 semanas; podem encurtar conforme prazo

**O backlog completo está em `BACKLOG.md`** — copia/cola pra criar issues no JIRA.

---

## Pauta sugerida pra call com o time (30 min)

1. **5 min** — Rafael apresenta decisões D1, D2, D3 (estrutura e nomenclatura)
2. **5 min** — Iann valida divisão dele e topa começar landing + componentes
3. **5 min** — Guilherme valida Auth (sprint 2) como responsabilidade dele
4. **10 min** — Discutir D11 (vulnerabilidades como instância) — conceito crítico do produto
5. **5 min** — Combinar ritual de check-in semanal e uso do PRD_VIVO

---

_Toda decisão vira regra escrita no CLAUDE.md. Toda exceção vira nova decisão neste arquivo._
