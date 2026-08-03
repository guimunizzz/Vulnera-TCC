---
type: modelagem-dados
tags: [data, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Convenios de Nome

## Definição
Conjunto de convenções de nomenclatura adotadas no projeto Vulnera para garantir consistência entre schema Prisma, banco MySQL, código TypeScript e documentação do vault.

---

## Convenção geral por camada

| Camada | Convenção | Exemplo |
|---|---|---|
| Schema Prisma (model/field) | `PascalCase` para models, `camelCase` para campos | `model VulnerabilityComment`, `createdAt` |
| Banco MySQL (tabela/coluna) | `snake_case` via `@map` no Prisma | `vulnerability_comment`, `created_at` |
| TypeScript (variável/propriedade) | `camelCase` | `createdAt`, `projectId` |
| TypeScript (classe/interface/enum) | `PascalCase` | `CreateVulnerabilityDto`, `ProjectStatus` |
| TypeScript (constante global) | `SCREAMING_SNAKE_CASE` | `MAX_FILE_SIZE`, `JWT_EXPIRES_IN` |
| Arquivos TypeScript | `kebab-case` | `create-vulnerability.dto.ts` |
| Rotas da API | `kebab-case`, plural | `/api/v1/vulnerabilities`, `/api/v1/support-tickets` |

---

## Nomes de tabelas no banco

| Entidade Prisma | Tabela MySQL |
|---|---|
| `User` | `users` |
| `Company` | `companies` |
| `Plan` | `plans` |
| `Subscription` | `subscriptions` |
| `Application` | `applications` |
| `Project` | `projects` |
| `ProjectMember` | `project_members` |
| `Vulnerability` | `vulnerabilities` |
| `Evidence` | `evidences` |
| `VulnerabilityComment` | `vulnerability_comments` |
| `ChatMessage` | `chat_messages` |
| `SupportTicket` | `support_tickets` |
| `MaturityAssessment` | `maturity_assessments` |
| `MaturityDomain` | `maturity_domains` |
| `MaturityControl` | `maturity_controls` |
| `MaturityScore` | `maturity_scores` |
| `Report` | `reports` |
| `Notification` | `notifications` |
| `AuditLog` | `audit_logs` |
| `PasswordResetToken` | `password_reset_tokens` |
| `RefreshToken` | `refresh_tokens` |

---

## Campos — convenção de nomes comuns

| Propósito | Nome canônico | Tipo |
|---|---|---|
| Chave primária | `id` | `uuid` |
| Referência a outra entidade | `{entidade}_id` (ex: `company_id`) | `uuid FK` |
| Data de criação | `created_at` | `DateTime` |
| Data de atualização | `updated_at` | `DateTime` (updatedAt) |
| Data de início | `started_at` | `DateTime?` |
| Data de encerramento | `closed_at` | `DateTime?` |
| Flag ativo/inativo | `is_active` | `Boolean` |
| Flag de leitura | `is_read` | `Boolean` |
| Referência ao autor | `author_id` | `uuid FK → User` |
| Referência ao criador | `created_by` | `uuid FK → User` |
| Referência ao aprovador | `approved_by` | `uuid FK → User` |
| Referência ao avaliador | `evaluated_by` | `uuid FK → User` |
| Hash de token | `token_hash` | `String` |
| Data de expiração | `expires_at` | `DateTime` |
| Data de uso | `used_at` | `DateTime?` |
| Data de revogação | `revoked_at` | `DateTime?` |

---

## Enums — convenção

Todos os enums usam `SCREAMING_SNAKE_CASE` nos valores:

```prisma
enum Role {
  ADMIN
  PENTESTER
  CLIENT
}

enum ProjectStatus {
  REQUESTED
  TRIAGE
  PLANNED
  IN_PROGRESS
  IN_REVIEW
  DELIVERED
  CLOSED
}
```

Nunca usar valores em minúsculas, camelCase ou strings livres para campos de enum no banco.

---

## Rotas da API — convenção

| Padrão | Exemplo |
|---|---|
| Prefixo global | `/api/v1/` |
| Recurso no plural | `/api/v1/projects` |
| Sub-recurso | `/api/v1/projects/:id/vulnerabilities` |
| Ação não-CRUD | `/api/v1/auth/refresh`, `/api/v1/projects/:id/close` |
| kebab-case para nomes compostos | `/api/v1/support-tickets`, `/api/v1/maturity-assessments` |

---

## Arquivos no back-end — convenção

```
modules/
  vulnerabilities/
    vulnerabilities.controller.ts
    vulnerabilities.service.ts
    vulnerabilities.repository.ts
    vulnerabilities.module.ts
    dto/
      create-vulnerability.dto.ts
      update-vulnerability.dto.ts
      vulnerability-response.dto.ts
```

Padrão: `{modulo}.{tipo}.ts` em `kebab-case`.

---

## Migrations Prisma — convenção de nome

```
prisma/migrations/
  20240101000000_init/
  20240115000000_add_refresh_token/
  20240201000000_add_maturity_score/
```

Formato: `{timestamp}_{descricao_snake_case}`.

---

## Links relacionados
[[Entidades e Relacionamentos]]
[[MER Conceitual]]
[[ORM Prisma]]
[[API REST]]
[[Back-end Express]]
[[MOC - Dominio]]
