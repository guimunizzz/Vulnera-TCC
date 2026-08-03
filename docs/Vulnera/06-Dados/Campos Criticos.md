---
type: modelagem-dados
tags: [data, source-of-truth]
status: ativo
---

# Campos Criticos

## Definição
Catálogo dos campos com comportamento especial, restrições de segurança, regras de negócio críticas ou impacto direto no funcionamento correto do sistema. Campos que merecem atenção redobrada na implementação e nos testes.

---

## Campos de segurança — nunca expor

| Entidade | Campo | Risco se exposto |
|---|---|---|
| `User` | `password_hash` | Permite ataque offline de força bruta |
| `RefreshToken` | `token_hash` | Permite assumir sessão de qualquer usuário |
| `PasswordResetToken` | `token_hash` | Permite redefinir senha de qualquer usuário |
| `User` | `expo_push_token` | Identificador de dispositivo — privacidade |

**Regra:** DTOs de resposta nunca devem incluir esses campos. Usar `select` explícito no repository ou mapear manualmente para DTO de saída.

---

## Campos derivados — nunca aceitar do cliente

Esses campos são calculados ou extraídos internamente. Nunca devem ser aceitos pelo corpo da requisição:

| Entidade | Campo | Origem correta |
|---|---|---|
| `Vulnerability` | `created_by` | JWT do usuário autenticado |
| `Evidence` | `uploaded_by` | JWT do usuário autenticado |
| `VulnerabilityComment` | `author_id` | JWT do usuário autenticado |
| `ChatMessage` | `author_id` | JWT do usuário autenticado |
| `SupportTicket` | `opened_by` | JWT do usuário autenticado |
| `SupportTicket` | `company_id` | Company do usuário autenticado |
| `MaturityAssessment` | `evaluated_by` | JWT do usuário autenticado (Admin) |
| `Subscription` | `approved_by` | JWT do Admin que aprovou |
| `Report` | `generated_by` | JWT do usuário autenticado |
| `AuditLog` | `actor_id` | JWT do usuário autenticado |

---

## Campos de enum — validação obrigatória

Campos cujo valor deve pertencer a um enum fechado. Aceitar valor fora do enum é bug crítico:

| Entidade | Campo | Enum |
|---|---|---|
| `User` | `role` | [[Enum - Roles]] |
| `User` | `company_role` | [[Enum - CompanyRole]] |
| `Project` | `status` | [[Enum - ProjectStatus]] |
| `Project` | `analysis_type` | [[Enum - AnalysisType e Level]] |
| `Project` | `analysis_level` | [[Enum - AnalysisType e Level]] |
| `Vulnerability` | `status` | [[Enum - VulnerabilityStatus]] |
| `Subscription` | `status` | [[Enum - SubscriptionStatus]] |
| `SupportTicket` | `status` | [[Enum - TicketStatus]] |
| `Application` | `environment` | `PROD \| HOMOL \| DEV` |
| `Report` | `type` | `EXECUTIVE \| TECHNICAL` |
| `Vulnerability` | `owasp_category` | `A01..A10` |

---

## Campos com regra de override — lógica condicional

| Entidade | Campo | Regra |
|---|---|---|
| `Vulnerability` | `severity_final` | Se diferente de `severity_calculated`, exige `severity_override_reason` não nulo |
| `Vulnerability` | `severity_override_reason` | Obrigatório quando `severity_final ≠ severity_calculated` |
| `MaturityScore` | `score` | Deve estar entre 1 e 5 — validação no DTO e na camada de serviço |
| `Plan` | `app_limit` | Valor 0 ou negativo tem semântica especial (ilimitado) — verificar implementação |

Ver: [[RN10 - Severidade via CVSS com override justificado]]

---

## Campos de limite — impactam regras de negócio

| Entidade | Campo | Regra associada |
|---|---|---|
| `Plan` | `app_limit` | Limita quantidade de Applications ativas por Company (RN03) |
| `Plan` | `concurrent_project_limit` | Limita projetos simultâneos em andamento |
| `Plan` | `includes_remediation` | Define se o serviço de remediação está disponível |
| `Project` | `has_remediation_service` | Determina quem pode mover status de Vulnerability (RN13/RN14) |

---

## Campos de timestamp — preenchimento automático

Esses campos nunca devem ser aceitos do cliente — são preenchidos automaticamente pelo banco ou pelo ORM:

| Entidade | Campo | Preenchimento |
|---|---|---|
| Todas | `created_at` | `@default(now())` no Prisma |
| `User`, `Project`, `Vulnerability` | `updated_at` | `@updatedAt` no Prisma |
| `Project` | `started_at` | Preenchido quando status muda para `IN_PROGRESS` |
| `Project` | `closed_at` | Preenchido quando status muda para `CLOSED` |
| `SupportTicket` | `closed_at` | Preenchido quando status muda para `CLOSED` |
| `PasswordResetToken` | `used_at` | Preenchido quando o token é consumido |
| `RefreshToken` | `revoked_at` | Preenchido no logout ou rotação |

---

## Campos de texto livre — limites de tamanho

Campos sem limite explícito são vetores de DoS por payload excessivo. Usar `@MaxLength` nos DTOs:

| Entidade | Campo | MaxLength recomendado |
|---|---|---|
| `Vulnerability` | `title` | 255 |
| `Vulnerability` | `description` | 10.000 |
| `Vulnerability` | `recommendation` | 10.000 |
| `Vulnerability` | `severity_override_reason` | 1.000 |
| `ChatMessage` | `content` | 4.000 |
| `VulnerabilityComment` | `content` | 4.000 |
| `SupportTicket` | `subject` | 255 |
| `SupportTicket` | `description` | 5.000 |
| `MaturityScore` | `notes` | 2.000 |
| `Evidence` | `proof` | 5.000 |

---

## Campos de arquivo (Evidence) — validação obrigatória

| Campo | Validação | Detalhe |
|---|---|---|
| `file_name` | Gerado pelo sistema | UUID + extensão — nunca originalname |
| `mime_type` | Lista de MIME permitidos | JPEG, PNG, GIF, WebP, PDF, TXT |
| `size_bytes` | Máximo 10 MB | Validado no Multer antes de salvar |

Ver: [[Padrao - Upload Seguro]]

---

## Links relacionados
[[Entidades e Relacionamentos]]
[[MER Conceitual]]
[[Convenios de Nome]]
[[Enum - Roles]]
[[Enum - VulnerabilityStatus]]
[[Enum - ProjectStatus]]
[[RN10 - Severidade via CVSS com override justificado]]
[[Padrao - Upload Seguro]]
[[DTOs e Validacao]]
[[MOC - Dominio]]
