---
type: changelog
tags: [core]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Changelog do Projeto

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
