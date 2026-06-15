# ROADMAP_PROMPTS.md — Prompts pro Claude Code por sprint

> **Como usar este arquivo:**
> 1. Antes de **cada sprint**, abra o Claude Code (`claude` no terminal) na raiz do repo
> 2. Copie o bloco entre as linhas tracejadas da sprint correspondente
> 3. Cole no Claude Code, ele vai trabalhar de forma autocontida
> 4. Se acabarem tokens, abra nova sessão, cole o MESMO prompt — ele vai ler `PRD_VIVO.md`, ver o que falta, e continuar
>
> **Princípio dos prompts:** cada um é autocontido. Nenhum depende de contexto da sessão anterior. Tudo o que o Claude Code precisa saber está no repo (`CLAUDE.md` + `PRD_VIVO.md` + `BACKLOG.md`).

---

## SPRINT 0 — Refactor (antes de começar)

```
# Tarefa: Refactor inicial do projeto Vulnera

## Contexto

Estou começando o desenvolvimento do meu TCC, projeto Vulnera Security (plataforma SaaS de gestão de análises de segurança). O repositório atual tem código parcial que precisa ser alinhado a um padrão arquitetural definido em CLAUDE.md.

## Leitura obrigatória (NÃO PULE)

Antes de fazer QUALQUER alteração, leia:

1. `CLAUDE.md` (raiz do repo ou app/api/) — fonte da verdade do padrão de código
2. `REFACTOR_PLAN.md` — lista exata de tarefas R1-R14 do refactor
3. `PRD_VIVO.md` — estado atual; veja FEAT-00

Se algum desses arquivos não existir no repo, pare e me avise.

## Execução

Execute as tarefas R1 a R14 do REFACTOR_PLAN.md em ordem. PARE a cada R# concluída e me peça revisão antes de continuar.

Para CADA tarefa concluída, atualize PRD_VIVO.md mudando o status correspondente em FEAT-00 de 📋 para ✅.

## Regras invioláveis

- Não invente nada fora do que está em CLAUDE.md
- Não use a pasta `services/` (plural). Use `service/` (singular).
- Não importe `@prisma/client` fora de arquivos da pasta `repository/`
- Cada recurso DEVE ter uma factory em `factory/`
- 1 arquivo por model (type + dto + entity juntos)
- Nomenclatura: kebab + role (`plan.controller.ts`)

## Continuidade

Se a sessão acabar antes de terminar, anote em PRD_VIVO.md exatamente em qual R# parou e o que falta. Próxima sessão, leia PRD_VIVO.md e retome de onde parou.

## Confirmação

Antes de começar, responda:
1. Você encontrou CLAUDE.md? Qual o caminho?
2. Você encontrou REFACTOR_PLAN.md? Qual o caminho?
3. Existe alguma divergência entre o que CLAUDE.md prescreve e o que está no repo que eu não mencionei?

Quando confirmar os 3 pontos, comece pela R1 do REFACTOR_PLAN.md.
```

---

## SPRINT 1 — Fundação

```
# Tarefa: Sprint 1 do Vulnera — Fundação (Infra + Schema + Server base)

## Contexto

Sou o Rafael, tech lead. O refactor da Sprint 0 foi concluído. Agora vou implementar a fundação do projeto: schema completo no banco, server.ts mínimo, CI funcional, testes configurados, seeds e healthcheck.

## Leitura obrigatória

Antes de qualquer mudança:

1. `CLAUDE.md` — padrão de código
2. `PRD_VIVO.md` — veja Sprint 1 (FEAT-01) e marque ela como 🚧 no §2
3. `BACKLOG.md` — tasks KAN-101 a KAN-111 com descrição
4. `app/api/prisma/schema.prisma` — schema completo (já existente)

## Execução

Execute as tasks abaixo EM ORDEM, marcando ✅ em PRD_VIVO.md ao concluir cada uma:

### KAN-101 — Aplicar schema e rodar migrations
- Garantir que o schema.prisma está com os modelos: User, Company, Plan, Subscription, RefreshToken, PasswordResetToken, Application, Project, ProjectMember, Vulnerability, Evidence, VulnerabilityComment, AuditLog, MaturityDomain, MaturityControl, MaturityAssessment, MaturityScore, Notification, Report
- Rodar `npx prisma migrate dev --name initial`
- Validar que todas as tabelas foram criadas (use prisma studio ou query direta)

### KAN-102 — docker-compose.yml na raiz
- Criar com 3 serviços: mysql:8, mailhog:v1.0.1, sonarqube:10-community
- Conforme template em REFACTOR_PLAN.md R13
- Testar: `docker compose up -d` e validar ping no banco

### KAN-103 — Endpoint /api/health
- Criar `routes/health.routes.ts` com `GET /` que retorna `{status:"ok",timestamp:new Date().toISOString(),uptime:process.uptime()}`
- Plugar em `routes/routes.ts`: `router.use("/health", healthRoutes)`
- NÃO aplicar authMiddleware (rota pública)
- Validar com: `curl http://localhost:3000/api/health`

### KAN-104 — Jest + Supertest setup
- Instalar: `npm i -D jest @types/jest ts-jest supertest @types/supertest`
- Criar `jest.config.ts` com preset ts-jest
- Criar `.env.test` com DATABASE_URL apontando pra `vulnera_test`
- Criar `tests/setup.ts` que roda `prisma migrate deploy` antes da suite
- Criar `tests/integration/health.test.ts` validando GET /api/health (smoke test)
- `npm run test` deve passar

### KAN-105 — GitHub Actions CI
- Criar/atualizar `.github/workflows/build.yml` com 3 jobs:
  - `lint`: `npm ci && npm run lint`
  - `build`: `npm ci && npm run build`
  - `test`: usa serviço mysql, roda `npm ci && npm run test`
- Workflow dispara em push e PR para main/develop

### KAN-106 — ESLint + tsconfig strict
- `tsconfig.json` com `strict: true`, `noImplicitAny: true`, `target: ES2022`
- `.eslintrc.json` com TypeScript-eslint recommended
- Rodar `npm run lint` — corrigir warnings antes de commitar

### KAN-107 — Seed inicial
- Criar `prisma/seed.ts` (executado via `tsx prisma/seed.ts`)
- Conteúdo:
  - 3 Plans: BASIC (R$499, 2 apps, 1 projeto), PRO (R$1499, 5 apps, 3 projetos, includesRemediation), PRO_PLUS (sob consulta, 999 apps)
  - 1 admin com email "admin@vulnera.local" e senha "admin12345" (hasheada bcrypt 12)
  - 1 Company "TechNova Solutions" com Subscription ACTIVE no PRO
  - 1 Owner da TechNova com email "owner@technova.demo" e senha "demo12345"
- Adicionar em package.json: `"db:seed": "tsx prisma/seed.ts"`
- Rodar `npm run db:seed` e validar

### KAN-111 — Atualizar PRD_VIVO.md
- Marcar FEAT-01 como ✅
- Atualizar Sprint 1 no §2 com status ✅ e % concluído = 100%
- Adicionar marco no §6: "Sprint 1 concluída em YYYY-MM-DD"

## Tasks de frontend (Iann, paralelo)

Iann (vibecoder frontend) está fazendo em paralelo:
- KAN-108: Setup React+Vite+Tailwind em `app/web`
- KAN-109: Componentes UI base
- KAN-110: Landing page

NÃO execute essas tasks. Foque só no back-end. Marque elas como "Owner: I" e deixe que ele atualize o PRD quando concluir.

## Critérios de pronto da Sprint 1

- [ ] `docker compose up -d` sobe MySQL + Mailhog + SonarQube
- [ ] `npm run dev` sobe API em localhost:3000
- [ ] `curl localhost:3000/api/health` retorna 200 com status:ok
- [ ] `npm run test` passa
- [ ] `npm run lint` passa
- [ ] `npm run build` passa
- [ ] `npm run db:seed` popula banco com TechNova
- [ ] CI verde no GitHub Actions
- [ ] PRD_VIVO.md atualizado com tudo da Sprint 1 ✅

## Continuidade

Se acabar tokens no meio:
1. Anote em PRD_VIVO.md exatamente em qual KAN-XXX parou
2. Próxima sessão: cole este mesmo prompt
3. Você (Claude Code) vai ler PRD_VIVO.md primeiro e retomar daquele ponto

## Confirmação

Responda:
1. CLAUDE.md está em qual caminho?
2. PRD_VIVO.md existe?
3. O refactor da Sprint 0 está concluído (FEAT-00 com tudo ✅)?

Se sim, comece pela KAN-101.
```

---

## SPRINT 2 — Auth + User

```
# Tarefa: Sprint 2 do Vulnera — Auth + User CRUD

## Contexto

Sprint 1 concluída. Banco configurado, server rodando, CI verde. Agora vou implementar autenticação completa (register, login, refresh, logout) e CRUD de User. JWT a partir desta sprint vai proteger todas as outras rotas.

## Leitura obrigatória

1. `CLAUDE.md` — em especial §5 (walkthrough), §8 (Auth JWT) e §9 (códigos de erro)
2. `PRD_VIVO.md` — marcar Sprint 2 (FEAT-02) como 🚧
3. `BACKLOG.md` — tasks KAN-201 a KAN-215

## Execução

Execute EM ORDEM, marcando ✅ em PRD_VIVO.md ao concluir:

### KAN-201 — utils/jwt.util.ts e utils/hash.util.ts
Conforme §8 do CLAUDE.md.
- jwt.util.ts: signAccessToken (15min), verifyAccessToken, signRefreshToken (7d)
- hash.util.ts: hashPassword (bcrypt cost 12), comparePassword

### KAN-202 — middleware/auth.middleware.ts
Conforme §8 do CLAUDE.md. Extrai Bearer, valida, popula req.user. 401 em erro.

### KAN-203 — model/user.model.ts
- type User = PrismaUser
- DTOs: RegisterDTO {name,email,password}, LoginDTO {email,password}, AuthResponseDTO {accessToken,refreshToken,user}, UserResponseDTO {id,name,email,role,companyId,companyRole,createdAt}
- class UserEntity com toResponse() que OMITE password

### KAN-204 — repository/user.repository.ts
findByEmail, findById, findAll, create, update, delete

### KAN-205 — repository/refresh-token.repository.ts
- create(userId, tokenHash, expiresAt) — armazena SHA-256 hash, não o token cru
- findByHash(tokenHash) — retorna RefreshToken | null
- revoke(id) — set revokedAt = now()
- deleteAllForUser(userId) — limpa todos os tokens (usado em logout-all)

### KAN-206 — service/auth.service.ts
- register(dto): valida email único, hashea senha, cria User. Retorna { user, accessToken, refreshToken }
- login(dto): busca user por email, compara hash, emite tokens. Lança INVALID_CREDENTIALS se errado.
- refresh(refreshToken): hashea o token recebido, busca no banco, valida não revogado/expirado, REVOGA o atual e emite novo par (rotação obrigatória)
- logout(refreshToken): revoga o token correspondente

### KAN-207 — controller/auth.controller.ts
Endpoints: register, login, refresh, logout
Validação manual:
- email: existe + regex /@.+\./
- password: ≥ 8 chars
- name: ≥ 3 chars
Erros possíveis: MISSING_EMAIL, INVALID_EMAIL, MISSING_PASSWORD, WEAK_PASSWORD, EMAIL_ALREADY_EXISTS, INVALID_CREDENTIALS, MISSING_REFRESH_TOKEN, INVALID_TOKEN

### KAN-208 — service/user.service.ts e controller/user.controller.ts
CRUD com regras:
- admin: lista todos os users
- client: lista apenas users da própria company
- pentester: lista apenas a si mesmo
- delete: forbidden se for ele mesmo (admin pode deletar outros)
- Rota especial: GET /me (devolve req.user expandido com dados do banco)

### KAN-209 — factory/auth.factory.ts e factory/user.factory.ts
Padrão estrito do CLAUDE.md §5.5.

### KAN-210 — routes/auth.routes.ts (PÚBLICO) e routes/user.routes.ts (autenticado)
- auth.routes.ts: NÃO aplicar authMiddleware
- user.routes.ts: aplicar authMiddleware. Rota `/me` ANTES de `/:id` para evitar conflito de match.
- Plugar AMBOS em routes/routes.ts

### KAN-211 — tests/integration/auth.test.ts
Casos canários (mínimo):
- AUTH-01: registro válido retorna 201 com tokens
- AUTH-02: registro com email duplicado retorna 409 EMAIL_ALREADY_EXISTS
- AUTH-03: registro com senha curta retorna 400 WEAK_PASSWORD
- AUTH-04: login válido retorna 200 com tokens
- AUTH-05: login com senha errada retorna 401 INVALID_CREDENTIALS
- AUTH-06: refresh válido retorna 200 com NOVO par de tokens
- AUTH-07: refresh com token revogado retorna 401 INVALID_TOKEN
- AUTH-08: logout revoga o refresh token
- AUTH-09: rota protegida sem token retorna 401 UNAUTHORIZED

### KAN-212 — tests/integration/user.test.ts
- USR-01: GET /me com token válido retorna dados do user
- USR-02: GET /users como client não-admin retorna apenas users da própria company
- USR-03: DELETE /users/:id (a si mesmo) retorna 403 FORBIDDEN

## Tasks frontend (Iann, paralelo)

KAN-213, KAN-214, KAN-215 são dele. Não execute. Marque owner: I no PRD.

## Critérios de pronto

- [ ] Posso registrar via `POST /api/auth/register`
- [ ] Posso logar via `POST /api/auth/login` e receber tokens
- [ ] Posso renovar via `POST /api/auth/refresh` com rotação
- [ ] Posso fazer logout
- [ ] Rota protegida sem token retorna 401
- [ ] `npm run test` passa com 100% dos canários AUTH-XX
- [ ] PRD_VIVO.md com FEAT-02 ✅

## Continuidade

Se a sessão acabar: anote em PRD_VIVO.md em qual KAN parou. Reinicie nova sessão colando este mesmo prompt.

## Confirmação

1. Sprint 1 está ✅ no PRD_VIVO.md?
2. Banco está rodando (docker compose up)?
3. Existe usuário admin no seed?

Comece pela KAN-201.
```

---

## SPRINT 3 — Company + Plan + Subscription

```
# Tarefa: Sprint 3 do Vulnera — Company + Plan + Subscription

## Contexto

Sprint 2 concluída — auth funcional. Agora implemento o modelo comercial: Company, Plan e Subscription com fluxo de aprovação manual pelo admin.

## Leitura obrigatória

1. `CLAUDE.md`
2. `PRD_VIVO.md` — marcar FEAT-03 como 🚧
3. `BACKLOG.md` — KAN-301 a KAN-312

## Execução

### KAN-301 — Company CRUD completo
- model/company.model.ts (type + DTOs + CompanyEntity com toResponse)
- repository/company.repository.ts
- service/company.service.ts
  - Regras: ao criar, validar planId existente. Cliente OWNER pode editar a própria; MEMBER só lê.
- controller/company.controller.ts
- Códigos: COMPANY_NOT_FOUND, INVALID_NAME, INVALID_CNPJ, PLAN_NOT_FOUND, FORBIDDEN

### KAN-302 — factory/company.factory.ts + routes/company.routes.ts
Plugar em routes/routes.ts: `router.use("/companies", companyRoutes)`

### KAN-303 — Plan CRUD completo
Já existe esqueleto desde o refactor. Completar conforme schema atualizado (maxApplications, maxProjects, includesRemediation, price). Conforme exemplo §5 do CLAUDE.md.

Regras: apenas admin pode criar/editar/deletar planos. Clientes apenas listam (GET /api/plans público apenas para o catálogo, ou exige auth — decidir: vou usar autenticado mas todos podem listar).

### KAN-304 — factory + routes plan

### KAN-305 — Subscription CRUD + endpoints especiais
- model/subscription.model.ts
- repository com findActiveByCompany(companyId)
- service:
  - create: nasce em PENDING_APPROVAL
  - approve: só admin, muda para ACTIVE, startDate=now, validar que não existe ACTIVE pra mesma company
  - reject: só admin, muda para REJECTED
  - current(companyId): retorna a ACTIVE atual ou null
- controller com endpoints:
  - GET /subscriptions (admin lista todas; cliente só vê suas)
  - POST /subscriptions (cliente cria, status PENDING_APPROVAL)
  - POST /subscriptions/:id/approve (só admin)
  - POST /subscriptions/:id/reject (só admin)
  - GET /subscriptions/current (cliente vê sua subscription ativa)
- Códigos: SUBSCRIPTION_NOT_FOUND, INVALID_STATUS_TRANSITION, COMPANY_ALREADY_HAS_ACTIVE_SUBSCRIPTION, FORBIDDEN

### KAN-306 — factory + routes subscription

### KAN-307 — Notificação de subscription pendente
- Instalar nodemailer: `npm i nodemailer @types/nodemailer`
- Criar utils/mailer.util.ts apontando pra Mailhog (host: localhost, port: 1025, ignoreTLS: true)
- No SubscriptionService.create: após criar, dispara e-mail pro admin "Nova subscription pendente: Company X, Plan Y"
- Registrar AuditLog com action="CREATE" entityType="Subscription"
- Não bloquear se e-mail falhar (try/catch silencioso, log warn)

### KAN-308 — Testes de integração
Mínimo:
- BIZ-01: criar plan inválido (maxApplications<1) retorna 400
- BIZ-02: criar segunda subscription ACTIVE pra mesma company retorna 409
- COMP-01: client de company A não vê company B no GET /companies
- SUB-01: aprovar subscription PENDING vira ACTIVE
- SUB-02: aprovar subscription REJECTED retorna 422 INVALID_STATUS_TRANSITION
- SUB-03: cliente não-admin tentando aprovar retorna 403

## Tasks frontend (Iann, paralelo)
KAN-309, 310, 311 — owner: I.

## Critérios de pronto
- [ ] Cliente consegue criar Company + Subscription pendente
- [ ] Admin consegue listar pendentes, aprovar e rejeitar
- [ ] E-mail aparece no Mailhog (http://localhost:8025)
- [ ] AuditLog registra a criação da subscription
- [ ] Testes passam
- [ ] PRD_VIVO.md FEAT-03 ✅

## Confirmação
1. FEAT-02 está ✅?
2. Mailhog está rodando (docker compose ps)?
Comece pela KAN-301.
```

---

## SPRINT 4 — Application + Project + ProjectMember

```
# Tarefa: Sprint 4 do Vulnera — Application + Project + ProjectMember

## Contexto

Sprint 3 concluída — modelo comercial pronto. Agora implemento o catálogo de aplicações e o ciclo de projetos de análise.

## Leitura obrigatória

1. `CLAUDE.md`
2. `PRD_VIVO.md` — marcar FEAT-04 como 🚧
3. `BACKLOG.md` — KAN-401 a KAN-412
4. `app/api/prisma/schema.prisma` — modelos Application, Project, ProjectMember (já presentes)

## Execução

### KAN-401 — Application CRUD
- model/application.model.ts (type + DTOs + entity)
- repository com countByCompany(companyId)
- service com REGRA CRÍTICA:
  - Ao criar Application, validar que Subscription da Company está ACTIVE
  - Validar `count < plan.maxApplications` da subscription ativa
  - companyId vem do req.user (não do body) — segurança
- controller
- Códigos: APPLICATION_NOT_FOUND, INVALID_NAME, INVALID_URL, PLAN_LIMIT_REACHED, NO_ACTIVE_SUBSCRIPTION

### KAN-402 — factory + routes
Plugar em routes/routes.ts

### KAN-403 — Project CRUD
- model/project.model.ts
- repository
- service com REGRAS:
  - Ao criar: companyId herda de Application.companyId (desnormalizado)
  - Subscription da Company deve estar ACTIVE
  - hasRemediation herda do plano (Pro inclui, Basic não)
  - Status nasce em PENDING
  - Endpoint POST /:id/transition aceita {to: status}, valida transição
- Transições válidas (máquina mínima desta sprint):
  - PENDING → IN_PROGRESS
  - IN_PROGRESS → IN_REVIEW
  - IN_REVIEW → COMPLETED
  - IN_REVIEW → IN_PROGRESS (retrabalho)
- controller
- Códigos: PROJECT_NOT_FOUND, INVALID_STATUS_TRANSITION, APPLICATION_NOT_FOUND, NO_ACTIVE_SUBSCRIPTION

### KAN-404 — factory + routes project

### KAN-405 — ProjectMember (sub-resource)
- model/project-member.model.ts
- repository com existsForProject(projectId, userId), findByProject(projectId)
- service:
  - Adicionar: validar que User.role === "PENTESTER" (lança USER_NOT_PENTESTER)
  - Validar projeto existe
  - Unique (projectId, userId)
- controller

### KAN-406 — Subrota nested em project
Em routes/project.routes.ts:
```typescript
import { projectMemberRoutes } from "./project-member.routes";
router.use("/:projectId/members", projectMemberRoutes);
```

projectMemberRoutes endpoints:
- POST /  (adicionar — exige projectId via params, userId via body)
- GET /
- DELETE /:userId

### KAN-407 — Testes Application
Canários multi-tenant (TENABLE-like):
- TEN-01: client A cria app, client B não consegue ver no GET /applications
- TEN-02: client B tentando GET /applications/:idDoA retorna 404 NOT_FOUND
- TEN-03: ao atingir limite do plano, criar nova app retorna 422 PLAN_LIMIT_REACHED
- APP-01: criar app sem subscription ativa retorna 422 NO_ACTIVE_SUBSCRIPTION

### KAN-408 — Testes Project
- PROJ-01: criar project copia companyId da application
- PROJ-02: transição PENDING → COMPLETED inválida retorna 422
- PROJ-03: TEN-04: client A não vê project de client B
- PROJ-04: TEN-05: GET /projects/:id de outra company retorna 404

## Critérios de pronto
- [ ] Posso criar Application até o limite do plano
- [ ] Posso criar Project ligado a Application
- [ ] Posso transicionar Project pelos estados válidos
- [ ] Multi-tenant isolado (testes TEN-XX passando)
- [ ] PRD_VIVO.md FEAT-04 ✅

Comece pela KAN-401.
```

---

## SPRINT 5 — Vulnerability + Evidence ⭐ CORE

```
# Tarefa: Sprint 5 do Vulnera — Vulnerability + Evidence (NÚCLEO DO PRODUTO)

## Contexto

Esta é a sprint mais importante do MVP. Implemento o coração do Vulnera: registro de vulnerabilidades estilo Tenable/Wiz (cada vulnerability é instância individual), upload de evidências, comentários, e auditoria de mudanças sensíveis.

## Leitura obrigatória

1. `CLAUDE.md`
2. `PRD_VIVO.md` — marcar FEAT-05 como 🚧
3. `BACKLOG.md` — KAN-501 a KAN-512
4. `schema.prisma` — modelos Vulnerability, Evidence, VulnerabilityComment, AuditLog

## CONCEITO CRÍTICO

Cada Vulnerability é uma INSTÂNCIA INDIVIDUAL. Pertence a:
- 1 Project
- 1 Application (desnormalizado, mesmo da Project)
- 1 Company (desnormalizado, mesmo da Project)

NÃO HÁ catálogo compartilhado de vulnerabilidades. Mesmo que TechNova e Acme tenham a mesma SQL Injection, são 2 registros distintos.

Isolamento garantido por TODA query incluir filtro por companyId.

## Execução

### KAN-501 — utils/cvss.util.ts
Função que recebe CVSS vector string e calcula:
- Score numérico (0.0-10.0) — pode delegar pra lib `cvss-calculator` (npm)
- Severidade categórica:
  - 0.0 → NONE
  - 0.1-3.9 → LOW
  - 4.0-6.9 → MEDIUM
  - 7.0-8.9 → HIGH
  - 9.0-10.0 → CRITICAL

Exporta `calculateCvss(vector: string): { score: number; severity: string }`

### KAN-502 — Vulnerability CRUD
- model/vulnerability.model.ts
  - DTOs: CreateVulnerabilityDTO, UpdateVulnerabilityDTO, VulnerabilityResponseDTO
  - VulnerabilityEntity com toResponse() e métodos de domínio
- repository com:
  - findByProject(projectId), countBySeverity(companyId)
  - findById, create, update, delete
- service com REGRAS:
  - Ao criar:
    - Validar projectId existe
    - Buscar Project pra copiar applicationId e companyId (desnormalização)
    - Se cvssVector fornecido, calcular cvssScore e severityCalculated
    - severityFinal default = severityCalculated
  - Ao atualizar severityFinal manualmente (override):
    - Exigir severityOverrideReason (≥ 20 chars)
    - Registrar AuditLog action=SEVERITY_OVERRIDE com diff antes/depois
  - Ao mudar status:
    - Validar transição:
      - OPEN → IN_PROGRESS (analista, se hasRemediation=true)
      - IN_PROGRESS → FIXED (analista)
      - FIXED → REVALIDATION (cliente confirma fix)
      - REVALIDATION → CLOSED (analista valida)
      - REVALIDATION → OPEN (não foi corrigido)
      - OPEN → RISK_ACCEPTED (cliente aceita risco, exige justificativa)
    - Registrar AuditLog action=STATUS_CHANGE
- controller
- Códigos: VULNERABILITY_NOT_FOUND, INVALID_CVSS_VECTOR, MISSING_OVERRIDE_REASON, SHORT_OVERRIDE_REASON, INVALID_STATUS_TRANSITION

### KAN-503 — factory + routes vulnerability
Plugar em routes/routes.ts: `router.use("/vulnerabilities", vulnerabilityRoutes)`

### KAN-504 — Evidence (upload)
- Instalar multer: `npm i multer @types/multer`
- model/evidence.model.ts
- repository com findByVulnerability(vulnId)
- service:
  - Validação MIME: jpg, jpeg, png, txt, log
  - Validação magic number (não confiar só no MIME enviado pelo cliente):
    - JPEG: bytes FF D8 FF
    - PNG: 89 50 4E 47
    - TXT/LOG: validar que é texto (ASCII/UTF-8 puro)
  - Tamanho máximo 10MB
  - Renomear pra UUID + ext original
  - Salvar em volume local `./uploads/<companyId>/<vulnId>/<uuid>.<ext>`
  - Persistir metadados no banco
- controller com upload via multer:
  ```typescript
  router.post("/:vulnerabilityId/evidences", multer({ limits: { fileSize: 10*1024*1024 } }).single("file"), ...)
  ```

### KAN-505 — factory/evidence.factory.ts + nested routes
Em vulnerability.routes.ts:
```typescript
router.use("/:vulnerabilityId/evidences", evidenceRoutes);
```

### KAN-506 — VulnerabilityComment (nested)
- model/vulnerability-comment.model.ts
- repository
- service (qualquer membro do projeto pode comentar)
- controller
- Subrota: `/vulnerabilities/:vulnerabilityId/comments`

### KAN-507 — AuditLog helper
- repository/audit-log.repository.ts
- utils/audit.util.ts com função:
  ```typescript
  export async function logAudit(params: { actorId, companyId, entityType, entityId, action, before?, after? }): Promise<void>
  ```
- Chamar de VulnerabilityService no override e status change
- Chamar de SubscriptionService no approve/reject

### KAN-508 — Testes Vulnerability
Mínimo:
- BIZ-03: criar vuln calcula severity automática a partir do CVSS
- BIZ-04: override de severity sem reason retorna 400
- BIZ-05: override com reason curta (<20) retorna 400
- BIZ-06: override válido cria AuditLog
- BIZ-07: status transition inválida retorna 422
- BIZ-08: status transition válida atualiza + cria AuditLog
- TEN-06: client A não vê vulnerabilities de client B

### KAN-509 — Testes Evidence
- BIZ-09: upload de arquivo .exe retorna 400 INVALID_FILE_TYPE
- EVID-01: upload válido salva arquivo e retorna 201 com metadados
- EVID-02: upload sem field "file" retorna 400

## Critérios de pronto
- [ ] Pentester cria vuln com CVSS, severity calcula sozinha
- [ ] Override de severity exige justificativa e cria AuditLog
- [ ] Upload de evidência valida tipo + tamanho
- [ ] Thread de comentários funciona
- [ ] Multi-tenant rigoroso (TEN-XX passando)
- [ ] PRD_VIVO.md FEAT-05 ✅

⚠️ Esta sprint é DENSA. Se acabar tokens, anote no PRD em qual KAN parou. NÃO comece tarefa nova sem fechar a anterior.

Comece pela KAN-501.
```

---

## SPRINT 6 — Relatórios + Dashboard

```
# Tarefa: Sprint 6 do Vulnera — Relatórios PDF + Dashboards

## Contexto

Núcleo do produto funciona. Agora gero relatórios PDF (executivo e técnico) no front, e dashboards por perfil (cliente, pentester, admin).

## Leitura obrigatória

1. `CLAUDE.md`
2. `PRD_VIVO.md` — marcar FEAT-06 como 🚧
3. `BACKLOG.md` — KAN-601 a KAN-611

## Execução

### KAN-601 — GET /api/projects/:id/report-data

Endpoint consolidado que retorna TUDO que o frontend precisa pra gerar o PDF, num único request:

```typescript
{
  project: ProjectResponseDTO,
  company: CompanyResponseDTO,
  application: ApplicationResponseDTO,
  vulnerabilities: VulnerabilityResponseDTO[],
  stats: {
    total: number,
    bySeverity: { CRITICAL: n, HIGH: n, MEDIUM: n, LOW: n },
    byStatus: { OPEN: n, FIXED: n, ... },
    byOwasp: { A01: n, A02: n, ... }
  },
  maturity?: MaturityAssessmentResponseDTO  // se existir
}
```

Em service/project.service.ts adicionar método `getReportData(projectId, requesterId)`.
Validar permissão (admin/pentester membro/cliente da company).

### KAN-602 — report.model.ts + service + controller
- Apenas metadados (PDF é gerado client-side)
- Ao gerar PDF, frontend chama POST /api/reports {projectId, type} pra registrar no banco
- Endpoint útil pra auditoria ("quem gerou qual relatório quando")

### KAN-603 — factory + routes report

### KAN-610 — Testes report-data
- BIZ-10: GET /projects/:id/report-data devolve estatísticas corretas
- REP-01: cliente da outra company recebe 403/404
- REP-02: POST /reports registra metadados

## Tasks frontend (Guilherme + Iann)

KAN-604, 605, 606 (relatórios PDF) — Guilherme
KAN-607, 608, 609 (dashboards) — Iann

NÃO execute essas. São frontend. Marque owners no PRD.

## Critérios de pronto
- [ ] /api/projects/:id/report-data retorna JSON consolidado
- [ ] /api/reports registra metadados
- [ ] PRD_VIVO.md FEAT-06 ✅

Comece pela KAN-601.
```

---

## SPRINT 7 — Mobile + IA Gemini

```
# Tarefa: Sprint 7 do Vulnera — Backend pra Mobile + Integração IA Gemini

## Contexto

Frontend mobile (Expo) sendo feito pelo Iann em paralelo. Eu cuido do back-end pra suportar push notifications e implemento a integração com Gemini pra sugerir descrições de findings.

## Leitura obrigatória

1. `CLAUDE.md`
2. `PRD_VIVO.md` — marcar FEAT-07 como 🚧
3. `BACKLOG.md` — KAN-707 a KAN-712

## Execução

### KAN-707 — Push setup (back-end suporte)
- Adicionar coluna `expoPushToken: String?` no model User (migration)

### KAN-708 — POST /api/notifications/register-push
- Endpoint protegido
- Recebe `{ token: string }`
- Atualiza req.user.expoPushToken
- Retorna 204

### KAN-709 — Service que envia push em finding CRITICAL
- Instalar: `npm i expo-server-sdk`
- utils/push.util.ts com `sendPushToUser(userId, title, body, data?)`
- Hook em VulnerabilityService.create:
  ```typescript
  if (created.severityFinal === "CRITICAL") {
    // buscar usuários da company com role=CLIENT e expoPushToken não-nulo
    // enviar push em paralelo (não bloquear retorno)
  }
  ```
- Não bloquear se push falhar (try/catch silencioso, log)

### KAN-710 — utils/gemini.util.ts
- Instalar: `npm i @google/generative-ai`
- Wrapper que lê GEMINI_API_KEY de EnvVar
- Função `suggestFinding({ title, techStack, owaspCategory? }): Promise<{ description, owaspCategory, recommendation }>`
- Modelo: gemini-1.5-flash (rate limit razoável)
- Prompt template em português, força retorno JSON estruturado

### KAN-711 — AI endpoints
- model/ai.model.ts com DTOs SuggestFindingDTO, FindingSuggestionResponseDTO
- service/ai.service.ts com suggestFinding(dto)
- controller/ai.controller.ts com POST /api/ai/suggest-finding
- Rate limit por user: máx 10 requests/hora (in-memory simples, Map<userId, timestamps[]>)
- Códigos: AI_RATE_LIMITED, AI_PROVIDER_UNAVAILABLE, INVALID_INPUT
- factory + routes plugado em routes.ts

## Tasks mobile (Iann)
KAN-701 a 706, 712 — frontend mobile. NÃO execute.

## Critérios de pronto
- [ ] POST /api/notifications/register-push funciona
- [ ] Criação de vuln CRITICAL dispara push (testar manualmente)
- [ ] POST /api/ai/suggest-finding retorna JSON estruturado da Gemini
- [ ] Rate limit respeitado
- [ ] PRD_VIVO.md FEAT-07 ✅

## Confirmação
1. Tem GEMINI_API_KEY no .env? Se não, eu (Rafael) gero em ai.studio.google.com antes de começar.

Comece pela KAN-707.
```

---

## SPRINT 8 — Maturidade + Polimento + Apresentação

```
# Tarefa: Sprint 8 do Vulnera — Maturidade + Polimento + Apresentação

## Contexto

Última sprint! Implemento avaliação de maturidade, gero relatórios finais (Sonar, OWASP ZAP), reviso documentação e me preparo pra apresentação.

## Leitura obrigatória

1. `CLAUDE.md`
2. `PRD_VIVO.md` — marcar FEAT-08 como 🚧
3. `BACKLOG.md` — KAN-801 a KAN-815

## Execução

### KAN-801 — Seed de domínios e controles de maturidade
- 7 domínios: Gestão de Acesso, Backup e Recuperação, Segurança de Rede, Gestão de Vulnerabilidades, Monitoramento e SIEM, Conscientização de Pessoal, Segurança de Código
- 3 controles por domínio (21 controles totais)
- Adicionar em prisma/seed.ts

### KAN-802 — MaturityAssessment CRUD
- model/maturity-assessment.model.ts
  - DTOs: CreateAssessmentDTO {companyId, notes}, ScoreEntryDTO {controlId, score:1-5, isCompliant, notes?}, BatchScoresDTO {scores: ScoreEntryDTO[]}
- repository
- service:
  - create(dto): cria Assessment com overallScore=0, level=BASIC
  - saveScores(assessmentId, batch): upsert dos MaturityScore, recalcula overallScore (média dos scores) e level (>=4 ADVANCED, >=2.5 INTERMEDIATE, senão BASIC)
  - getByCompany(companyId): última assessment + scores
- controller
- Endpoint especial: POST /:id/scores recebe BatchScoresDTO

### KAN-803 — factory + routes maturity

### KAN-808 — Rodar SonarQube manual
- Executar análise local: `sonar-scanner` apontando pra http://localhost:9000
- Salvar screenshot do dashboard como `docs/evidencias/sonar.png`

### KAN-809 — Rodar OWASP ZAP baseline
- Subir API
- `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:3000`
- Salvar saída como `docs/evidencias/zap-baseline.txt`

### KAN-810 — Smoke tests E2E manuais
Criar `docs/DEMO.md` com roteiro passo a passo da demo:
1. Admin: login, aprovar subscription pendente
2. Cliente: login como TechNova, ver dashboard, criar Application
3. Admin: criar Project, atribuir pentester
4. Pentester: login, ver projeto, criar Vulnerability (com CVSS), upload evidência, mudar status
5. Cliente: ver finding mobile, receber push
6. Admin: gerar relatório PDF executivo
7. Admin: preencher Maturity Assessment

Rodar tudo manualmente, anotar bugs encontrados, abrir issues no JIRA.

### KAN-811 — README + diagrama
- README.md na raiz com:
  - Pitch curto
  - Stack
  - Como rodar localmente
  - Screenshots (landing, dashboard, relatório)
  - Diagrama de arquitetura (Mermaid ou imagem)

### KAN-814 — PRD_VIVO.md final
- Todas as features ✅
- Sprint 8 ✅
- Marco no §6: "TCC concluído em YYYY-MM-DD"

## Tasks finais (Iann + Rafael)
- KAN-804, 805, 807 (frontend de maturidade) — Iann
- KAN-806 (maturity no PDF) — Guilherme
- KAN-812, 813 (slides + ensaios) — todos

## Critérios de pronto
- [ ] Maturity Assessment criada, scores salvos, level calculado
- [ ] Sonar rodou e capturou evidência
- [ ] ZAP rodou e capturou evidência
- [ ] README e diagrama prontos
- [ ] PRD 100% ✅
- [ ] Slides finalizados
- [ ] 3 ensaios feitos

Comece pela KAN-801.
```

---

## Como recuperar contexto se acabarem tokens no meio

Se você abrir uma sessão nova e quiser continuar, cole isto:

```
# Recuperação de contexto

Estou no meio do desenvolvimento do projeto Vulnera (TCC). Acabaram os tokens da sessão anterior. Preciso continuar de onde parei.

## O que fazer

1. Leia `CLAUDE.md` na raiz pra entender o padrão de código.
2. Leia `PRD_VIVO.md` pra ver:
   - Qual sprint está em andamento (status 🚧 no §2)
   - Qual KAN-XXX estava sendo trabalhada (status 🚧 dentro da feature correspondente)
3. Leia `BACKLOG.md` na sprint atual pra ver a descrição completa da task em andamento.
4. Continue de onde a sessão anterior parou.
5. Quando concluir a task, marque ✅ no PRD_VIVO e siga pra próxima.

## Regra de ouro
Não invente. Se tiver dúvida sobre como fazer, releia CLAUDE.md ou me pergunte.

Comece lendo os 3 arquivos e me mostre o status atual.
```

---

## Resumo de uso

| Quando | O que colar |
|--------|-------------|
| Antes de começar | Prompt da Sprint 0 |
| Início Sprint N | Prompt da Sprint N |
| Sessão nova no meio | Prompt de "Recuperação de contexto" |
| Bug específico fora do roadmap | Prompt manual descrevendo o bug |

---

*Este arquivo é estável durante toda a execução do TCC. Ele não é atualizado conforme você avança — quem rastreia o avanço é o PRD_VIVO.md.*
