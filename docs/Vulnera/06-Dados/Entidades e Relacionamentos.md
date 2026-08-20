---
type: modelagem-dados
tags: [data, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Entidades e Relacionamentos

## Definição
Catálogo completo das entidades do domínio Vulnera com seus campos principais, tipos e relacionamentos diretos. Serve como referência estrutural entre domínio, schema Prisma e banco MySQL.

---

## Entidades do núcleo comercial

### Plan
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `name` | string | `BASIC \| PRO \| Enterprise` |
| `app_limit` | int | NOT NULL |
| `concurrent_project_limit` | int | NOT NULL |
| `includes_remediation` | boolean | NOT NULL |
| `monthly_price` | decimal | NOT NULL |
| `is_active` | boolean | DEFAULT true |

### Company
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `legal_name` | string | NOT NULL |
| `trade_name` | string | NOT NULL |
| `cnpj` | string | UNIQUE |
| `contact_email` | string | NOT NULL |
| `contact_phone` | string | - |
| `created_at` | datetime | DEFAULT now() |

### Subscription
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `company_id` | uuid | FK → Company |
| `plan_id` | uuid | FK → Plan |
| `status` | SubscriptionStatus | NOT NULL |
| `start_date` | date | - |
| `end_date` | date | - |
| `approved_by` | uuid | FK → User (nullable) |
| `created_at` | datetime | DEFAULT now() |

---

## Entidades de identidade

### User
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `email` | string | UNIQUE |
| `password_hash` | string | NOT NULL |
| `name` | string | NOT NULL |
| `role` | Role | `ADMIN \| PENTESTER \| CLIENT` |
| `company_role` | CompanyRole? | `OWNER \| MEMBER \| null` |
| `company_id` | uuid? | FK → Company (nullable para ADMIN/PENTESTER) |
| `is_active` | boolean | DEFAULT true |
| `expo_push_token` | string? | Para push mobile |
| `created_at` | datetime | DEFAULT now() |
| `updated_at` | datetime | updatedAt |

---

## Entidades de análise

### Application
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `company_id` | uuid | FK → Company |
| `name` | string | NOT NULL |
| `url` | string | - |
| `environment` | string | `PROD \| HOMOL \| DEV` |
| `tech_stack` | string | - |
| `description` | text | - |
| `is_active` | boolean | DEFAULT true |
| `created_at` | datetime | DEFAULT now() |

### Project
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `application_id` | uuid | FK → Application (1:1) |
| `name` | string | NOT NULL |
| `analysis_type` | AnalysisType | `SAST \| DAST \| MATURITY \| COMBO` |
| `analysis_level` | AnalysisLevel | `BASIC \| INTERMEDIATE \| ADVANCED` |
| `has_remediation_service` | boolean | NOT NULL |
| `scope_in` | text | - |
| `scope_out` | text | - |
| `notes` | text | - |
| `status` | ProjectStatus | NOT NULL |
| `requested_at` | datetime | DEFAULT now() |
| `started_at` | datetime? | - |
| `closed_at` | datetime? | - |

### ProjectMember
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → Project |
| `user_id` | uuid | FK → User |
| `assigned_at` | datetime | DEFAULT now() |
| — | — | UNIQUE (project_id, user_id) |

---

## Entidades de findings

### Vulnerability
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → Project |
| `title` | string | NOT NULL |
| `description` | text | - |
| `owasp_category` | string | `A01..A10` |
| `cvss_vector` | string | - |
| `cvss_score` | float | - |
| `severity_calculated` | string | Derivado do CVSS |
| `severity_final` | string | Com possível override |
| `severity_override_reason` | text | Obrigatório se override |
| `impact` | text | - |
| `recommendation` | text | - |
| `status` | VulnerabilityStatus | NOT NULL |
| `ai_assisted` | boolean | DEFAULT false |
| `created_by` | uuid | FK → User |
| `assigned_to` | uuid? | FK → User |
| `created_at` | datetime | DEFAULT now() |
| `updated_at` | datetime | updatedAt |

### Evidence
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `vulnerability_id` | uuid | FK → Vulnerability |
| `file_name` | string | UUID gerado pelo sistema |
| `file_path` | string | Caminho interno |
| `mime_type` | string | Validado no upload |
| `size_bytes` | int | - |
| `proof` | text | Contexto da evidência |
| `uploaded_by` | uuid | FK → User |
| `created_at` | datetime | DEFAULT now() |

### VulnerabilityComment
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `vulnerability_id` | uuid | FK → Vulnerability |
| `author_id` | uuid | FK → User |
| `content` | text | NOT NULL |
| `created_at` | datetime | DEFAULT now() |

---

## Entidades de comunicação

### ChatMessage
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → Project |
| `author_id` | uuid | FK → User |
| `content` | text | NOT NULL |
| `sent_at` | datetime | DEFAULT now() |

### SupportTicket
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `opened_by` | uuid | FK → User |
| `company_id` | uuid | FK → Company |
| `subject` | string | NOT NULL |
| `description` | text | NOT NULL |
| `status` | TicketStatus | NOT NULL |
| `opened_at` | datetime | DEFAULT now() |
| `closed_at` | datetime? | - |

### Notification
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → User |
| `category` | string | Categoria do evento |
| `title` | string | NOT NULL |
| `message` | text | NOT NULL |
| `is_read` | boolean | DEFAULT false |
| `sent_as_push` | boolean | DEFAULT false |
| `created_at` | datetime | DEFAULT now() |

---

## Entidades de maturidade

### MaturityDomain
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `name` | string | NOT NULL |
| `description` | text | - |
| `sort_order` | int | - |

### MaturityControl
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `domain_id` | uuid | FK → MaturityDomain |
| `name` | string | NOT NULL |
| `description` | text | - |
| `sort_order` | int | - |

### MaturityAssessment
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `company_id` | uuid | FK → Company |
| `project_id` | uuid | FK → Project |
| `overall_score` | float | Média dos scores |
| `level` | AnalysisLevel | `BASIC \| INTERMEDIATE \| ADVANCED` |
| `notes` | text | - |
| `evaluated_by` | uuid | FK → User (Admin) |
| `created_at` | datetime | DEFAULT now() |

### MaturityScore
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `assessment_id` | uuid | FK → MaturityAssessment |
| `control_id` | uuid | FK → MaturityControl |
| `score` | int | 1–5 |
| `is_compliant` | boolean | - |
| `notes` | text | - |
| — | — | UNIQUE (assessment_id, control_id) |

---

## Entidades de rastreabilidade

### Report
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `project_id` | uuid | FK → Project |
| `type` | string | `EXECUTIVE \| TECHNICAL` |
| `title` | string | NOT NULL |
| `summary` | text | - |
| `generated_at` | datetime | DEFAULT now() |
| `generated_by` | uuid | FK → User |

### AuditLog
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `actor_id` | uuid | FK → User |
| `entity_type` | string | Nome da entidade |
| `entity_id` | uuid | ID do recurso |
| `action` | string | Ex: `CREATED`, `STATUS_CHANGED` |
| `diff_json` | text | JSON com before/after |
| `created_at` | datetime | DEFAULT now() |

### PasswordResetToken
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → User |
| `token_hash` | string | NOT NULL |
| `expires_at` | datetime | NOT NULL |
| `used_at` | datetime? | - |
| `created_at` | datetime | DEFAULT now() |

### RefreshToken
| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → User |
| `token_hash` | string | NOT NULL |
| `expires_at` | datetime | NOT NULL |
| `revoked_at` | datetime? | - |
| `created_at` | datetime | DEFAULT now() |
| `device_info` | string? | Opcional para auditoria |

---

## Links relacionados
[[MER Conceitual]]
[[ORM Prisma]]
[[Banco de Dados MySQL]]
[[Campos Criticos]]
[[Convenios de Nome]]
[[MOC - Dominio]]
