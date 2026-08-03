> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Status de Preenchimento do Vault

## 00-Hub
- [x] MOC - Vulnera
- [x] MOC - Dominio
- [x] MOC - Produto
- [x] MOC - Arquitetura
- [x] MOC - Operacao
- [x] Claude - Guia Operacional

## 01-Contexto
- [x] Visao Geral
- [x] Problema e Oportunidade
- [x] Objetivos
- [x] Publico-Alvo
- [x] Proposta de Valor
- [x] Diferenciais e Posicionamento
- [x] Fora do Escopo

## 02-Dominio/Entidades
- [x] Company
- [x] User
- [x] Subscription
- [x] Application
- [x] Project
- [x] Vulnerability
- [x] Evidence
- [x] MaturityAssessment
- [x] Report
- [x] AuditLog
- [x] Plan
- [x] ProjectMember
- [x] VulnerabilityComment
- [x] ChatMessage
- [x] SupportTicket
- [x] MaturityDomain
- [x] MaturityControl
- [x] MaturityScore
- [x] Notification
- [x] PasswordResetToken
- [x] RefreshToken

## 02-Dominio/Conceitos
- [x] CVSS
- [x] OWASP Top 10
- [x] Maturidade
- [x] Remediation Service
- [x] Multi-tenancy por escopo
- [x] Ownership
- [x] Auditoria
- [x] Client-side PDF

## 02-Dominio/Regras de Negocio
- [x] RN01
- [x] RN02
- [x] RN03
- [x] RN04
- [x] RN05
- [x] RN06
- [x] RN07
- [x] RN08
- [x] RN09
- [x] RN10
- [x] RN11
- [x] RN12
- [x] RN13
- [x] RN14
- [x] RN15
- [x] RN16
- [x] RN17
- [x] RN18
- [x] RN19
- [x] RN20
- [x] RN21
- [x] RN22
- [x] RN23
- [x] RN24

## 02-Dominio/Estados
- [x] Maquina - Project
- [x] Maquina - Vulnerability
- [x] Maquina - Subscription
- [x] Maquina - SupportTicket

## 02-Dominio/Permissoes
- [x] Roles
- [x] Matriz de Permissoes
- [x] CompanyRole
- [x] Regras de Ownership

## 03-Produto/Modulos
- [x] Autenticacao
- [x] Aplicacoes
- [x] Assinaturas
- [x] Projetos
- [x] Findings
- [x] Maturidade
- [x] Relatorios
- [x] IA Gemini
- [x] Chat e Comentarios
- [x] Notificacoes
- [x] Empresas
- [x] Evidencias
- [x] Tickets
- [x] Dashboard

## 03-Produto/Plataformas
- [x] Web Admin
- [x] Web Cliente
- [x] Mobile Cliente

## 03-Produto/Fluxos
- [x] Fluxo - Onboarding
- [x] Fluxo - Contratacao
- [x] Fluxo - Criacao de Aplicacao
- [x] Fluxo - Abertura de Projeto
- [x] Fluxo - Registro de Finding
- [x] Fluxo - Geracao de Relatorio
- [x] Fluxo - Revalidacao
- [x] Fluxo - Uso da IA

## 03-Produto/Jornadas
- [x] Jornada - Cliente
- [x] Jornada - Pentester
- [x] Jornada - Admin

## 04-Arquitetura
- [x] Back-end Express
- [x] Front-end Web React
- [x] Mobile Expo
- [x] API REST
- [x] Guards e Ownership
- [x] Integracao Gemini
- [x] Visao Geral
- [x] Banco de Dados MySQL
- [x] ORM Prisma
- [x] WebSocket e Tempo Real
- [x] Email SMTP
- [x] Expo Push
- [x] DTOs e Validacao
- [x] Repositorios
- [x] Logs Estruturados

## 04-Arquitetura/Estrutura do projeto
- [x] Estrutura Geral do Monorepo
- [x] Estrutura - API Express
- [x] Estrutura - Web React
- [x] Estrutura - Mobile Expo
- [x] Estrutura - Packages Compartilhados
- [x] Estrutura - Infraestrutura
- [x] Estrutura - Docs do Projeto
- [x] Legenda de Arquivos
- [x] Regras para o Claude ao Gerar Codigo
- [x] Escopo Realista para o TCC

## 05-Infra-DevSecOps
- [x] Docker Compose
- [x] GitHub Actions CI
- [x] Seguranca da Aplicacao
- [x] Dockerfiles
- [x] SonarQube
- [x] OWASP ZAP
- [x] Observabilidade
- [x] Prometheus
- [x] Grafana

## 05-Infra-DevSecOps/Desenvolvimento Seguro
- [x] Politica de Desenvolvimento Seguro
- [x] Checklist de Seguranca por Feature
- [x] Padrao - Autenticacao e JWT
- [x] Padrao - Validacao de Entradas
- [x] Padrao - Prevencao de Injection
- [x] Padrao - Prevencao de XSS
- [x] Padrao - Segredos e Variaveis Sensiveis
- [x] Padrao - Logs e Dados Sensiveis
- [x] Padrao - Dependencias e Bibliotecas
- [x] Padrao - Upload Seguro

## 06-Dados
- [x] MER Conceitual
- [x] Entidades e Relacionamentos
- [x] Campos Criticos
- [x] Convenios de Nome
- [x] Enum - Roles
- [x] Enum - CompanyRole
- [x] Enum - ProjectStatus
- [x] Enum - VulnerabilityStatus
- [x] Enum - SubscriptionStatus
- [x] Enum - TicketStatus
- [x] Enum - AnalysisType e Level

## 07-Decisoes
- [x] ADR-001
- [x] ADR-002
- [x] ADR-003
- [x] ADR-004
- [x] ADR-005
- [x] ADR-006
- [x] ADR-007
- [x] ADR-008 — MySQL temporário com migração planejada para MySQL (sessão 16)

## 08-Operacao
- [x] Changelog do Projeto
- [x] Como atualizar o contexto mestre
- [x] Tarefas Abertas
- [x] Roadmap MVP
- [x] Roadmap Fases
- [x] Riscos
- [x] Historico de Ideias
- [x] Hipoteses em Validacao
- [x] Decisoes Recentes

## 09-TCC
- [x] Estrutura da Monografia
- [x] Evidencias para Banca
- [x] Casos Didaticos
- [x] Metodologia
- [x] Distribuicao da Equipe
- [x] Testes
- [x] Referencias e Bases Teoricas

## Status final do vault

✅ **Vault completamente preenchido** — 2026-04-24

`01-Contexto` concluído ✅
`02-Dominio` concluído ✅ (entidades, regras, estados, permissões)
`03-Produto` concluído ✅ (módulos, fluxos, jornadas, plataformas)
`04-Arquitetura` concluído ✅
`05-Infra-DevSecOps` concluído ✅ (incluindo subpasta Desenvolvimento Seguro)
`06-Dados` concluído ✅
`07-Decisoes` concluído ✅ (7 ADRs)
`08-Operacao` concluído ✅
`09-TCC` concluído ✅

**Próxima frente**: implementação do código seguindo o roadmap de fases.

---

## Consolidação final — 2026-04-24 (sessão 12)

Correções aplicadas:
- MOC - Vulnera: adicionadas 11 entidades faltantes, 5 notas de arquitetura, seções Desenvolvimento Seguro, Dados e TCC
- MOC - Dominio: adicionada seção Modelagem de dados (links para 06-Dados)
- MOC - Operacao: adicionada seção TCC (links para 09-TCC)
- `05-Infra-DevSecOps/Politica de Desenvolvimento Seguro.md` (raiz): convertido em redirect para versão canônica em Desenvolvimento Seguro/
- 8 arquivos de conceito preenchidos: CVSS, OWASP Top 10, Maturidade, Remediation Service, Multi-tenancy por escopo, Ownership, Auditoria, Client-side PDF

---

## Status da implementação do código — 2026-04-27

### Onda 1 — Bootstrap do monorepo ✅ Concluído

**Repositório:** `C:\Users\43737514801\Documents\mcp-claude\Vulnera\`

- [x] Estrutura raiz do monorepo (npm workspaces + npm workspaces)
- [x] `apps/api` — Express bootstrap com PrismaService, ValidationPipe, ThrottlerModule
- [x] `apps/web` — React + Vite App Router com grupos de rota por perfil
- [x] `apps/mobile` — Expo com Expo Router, grupos (auth) e (app)
- [x] `packages/types` — enums completos do domínio
- [x] `packages/validators` — estrutura criada
- [x] `packages/utils` — cvss, date, pagination
- [x] `infra/docker-compose.yml` — MySQL, Mailhog, SonarQube
- [x] `infra/prometheus`, `grafana`, `nginx` — estrutura de referência
- [x] `.github/workflows/ci.yml` — CI básico
- [x] `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.npmrc`

### Onda 2 — Autenticação e fundação (próxima)

- [ ] Prisma schema: User, Company, Plan, Subscription, RefreshToken, PasswordResetToken
- [ ] Módulo auth (login, refresh, logout, reset de senha)
- [ ] Módulo users e companies
- [ ] middlewares: JwtAuthGuard, RolesGuard, @CurrentUser()
- [ ] ExceptionFilter global
- [ ] Testes canário de auth e multi-tenancy

---

## Status da implementação do código — 2026-05-14 (atualizado)

### Onda 1 — Bootstrap do monorepo ✅ Concluído

- [x] Estrutura raiz do monorepo (npm workspaces + Turborepo)
- [x] `apps/api` — NestJS bootstrap com PrismaService, ValidationPipe, ThrottlerModule
- [x] `apps/web` — Next.js 14 App Router com grupos de rota por perfil
- [x] `apps/mobile` — Expo com Expo Router, grupos (auth) e (app)
- [x] `packages/types` — enums completos do domínio
- [x] `packages/validators` — estrutura criada
- [x] `packages/utils` — cvss, date, pagination
- [x] `infra/docker-compose.yml` — PostgreSQL, Mailhog, SonarQube
- [x] `.github/workflows/ci.yml` — CI básico

### Onda 2 — API base NestJS ✅ Concluído — 2026-05-14

- [x] `src/main.ts` — helmet, Logger Pino, bufferLogs
- [x] `src/app.module.ts` — LoggerModule (pino + redact), DatabaseModule, HealthModule, APP_FILTER, APP_INTERCEPTOR
- [x] `src/database/database.module.ts` — DatabaseModule @Global exportando PrismaService
- [x] `src/database/prisma.service.ts` — onModuleInit + onModuleDestroy (graceful shutdown)
- [x] `src/config/app.config.ts` — factory centralizada via registerAs
- [x] `src/common/filters/http-exception.filter.ts` — AllExceptionsFilter global
- [x] `src/common/interceptors/logging.interceptor.ts` — LoggingInterceptor
- [x] `src/common/interceptors/transform.interceptor.ts` — TransformInterceptor `{ data: ... }`
- [x] `src/modules/health/` — GET /api/health
- [x] `.env.example` atualizado com LOG_LEVEL
- [x] `package.json` — pino-pretty e @types/express adicionados

### Onda 3 — Autenticação e fundação (próxima)

- [ ] Prisma schema: User, Company, Plan, Subscription, RefreshToken, PasswordResetToken
- [ ] Módulo auth (login, refresh, logout, reset de senha)
- [ ] Módulo users e companies
- [ ] Guards: JwtAuthGuard, RolesGuard, @CurrentUser()
- [ ] `common/filters/prisma-exception.filter.ts`
- [ ] Testes canário de auth e multi-tenancy

---

## Status da implementação do código — 2026-05-14 (Onda 3)

### Onda 3 — Schema Prisma inicial ✅ Concluído — 2026-05-14

- [x] `prisma/schema.prisma` — 21 models, 10 enums, constraints críticas documentadas
- [x] Enums: Role, CompanyRole, SubscriptionStatus, ProjectStatus, VulnerabilityStatus, VulnerabilitySeverity, TicketStatus, AnalysisType, AnalysisLevel, AppEnvironment, ReportType
- [x] Models: Plan, Company, Subscription, User, Application, Project, ProjectMember, Vulnerability, Evidence, VulnerabilityComment, ChatMessage, SupportTicket, Notification, MaturityDomain, MaturityControl, MaturityAssessment, MaturityScore, Report, AuditLog, PasswordResetToken, RefreshToken
- [x] Constraints: `applicationId @unique` (1:1 Application→Project), `@@unique([projectId, userId])`, `@@unique([assessmentId, controlId])`
- [x] Relações nomeadas: VulnerabilityCreator/Assignee, SubscriptionApprover, AssessmentEvaluator
- [x] `prisma/seed.ts` — 3 planos + 5 domínios de maturidade + 15 controles
- [x] `package.json` — `prisma.seed` configurado

### Onda 4 — Módulo de Autenticação (próxima)

- [ ] Executar `prisma migrate dev --name init` para criar primeira migration
- [ ] Executar `prisma db seed` para popular plans e maturity catalog
- [ ] Módulo `auth/` — login (bcrypt + JWT), refresh, logout, reset de senha
- [ ] `common/guards/jwt-auth.guard.ts` + `common/decorators/current-user.decorator.ts`
- [ ] `common/guards/roles.guard.ts` + `common/decorators/roles.decorator.ts`
- [ ] `common/filters/prisma-exception.filter.ts` (P2002 unique, P2025 not found)
- [ ] Módulo `users/` — CRUD básico
- [ ] Módulo `companies/` — CRUD básico
- [ ] Testes canário: autenticação, multi-tenancy, roles
