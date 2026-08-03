---
type: modelagem-dados
tags: [data, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# MER Conceitual

## Definição
Visão conceitual do modelo de dados do Vulnera. Representa as entidades principais, seus agrupamentos lógicos e os relacionamentos entre elas, independente de detalhes de implementação do banco.

## Agrupamentos lógicos

### Núcleo comercial
Entidades que sustentam o modelo SaaS: empresa, planos e assinaturas.

```
Plan ──< Subscription >── Company ──< User
```

### Núcleo operacional
Entidades que representam o trabalho de análise de segurança.

```
Company ──< Application ──── Project ──< Vulnerability ──< Evidence
                                    ├──< ProjectMember (User)
                                    ├──< ChatMessage (User)
                                    ├──< Report
                                    └──< MaturityAssessment ──< MaturityScore
                                                                    └── MaturityControl ──< MaturityDomain
```

### Comunicação e suporte
Entidades de interação entre as partes.

```
Vulnerability ──< VulnerabilityComment (User)
User ──< Notification
User ──< SupportTicket >── Company
```

### Rastreabilidade e sessão
Entidades de segurança, auditoria e controle de acesso.

```
User ──< AuditLog
User ──< PasswordResetToken
User ──< RefreshToken
```

## Diagrama conceitual simplificado

```
┌─────────┐        ┌──────────────┐        ┌─────────┐
│  Plan   │──────<│  Subscription │>───────│ Company │
└─────────┘  1:N  └──────────────┘  N:1   └────┬────┘
                                                │ 1:N
                            ┌───────────────────┼──────────────────┐
                            │                   │                  │
                        ┌───▼───┐          ┌────▼────┐      ┌──────▼──────┐
                        │  User │          │  App    │      │SupportTicket│
                        └───┬───┘          └────┬────┘      └─────────────┘
                            │ N:M via           │ 1:1
                       ProjectMember       ┌────▼────┐
                            │              │ Project │
                            └──────────────┤         ├─────────────────┐
                                           └────┬────┘                 │
                                      ┌─────────┼──────────┐           │
                                      │         │          │           │
                               ┌──────▼──┐  ┌───▼───┐  ┌──▼───┐  ┌────▼────────┐
                               │ Vuln.   │  │ Chat  │  │Report│  │ Maturity    │
                               └──┬──┬───┘  │Msg    │  │      │  │ Assessment  │
                                  │  │      └───────┘  └──────┘  └──────┬──────┘
                              ┌───▼┐ └──────────┐                        │ 1:N
                              │Evi.│         ┌──▼──────┐           ┌─────▼──────┐
                              └────┘         │VulnComm.│           │MaturityScore│
                                             └─────────┘           └──────┬──────┘
                                                                           │ N:1
                                                                   ┌───────▼──────┐
                                                                   │MaturityControl│
                                                                   └───────┬───────┘
                                                                           │ N:1
                                                                   ┌───────▼──────┐
                                                                   │MaturityDomain │
                                                                   └───────────────┘
```

## Entidades por grupo

| Grupo | Entidades |
|---|---|
| Comercial | Plan, Subscription, Company |
| Identidade | User (roles: ADMIN, PENTESTER, CLIENT) |
| Análise | Application, Project, ProjectMember |
| Findings | Vulnerability, Evidence, VulnerabilityComment |
| Comunicação | ChatMessage, SupportTicket, Notification |
| Maturidade | MaturityAssessment, MaturityDomain, MaturityControl, MaturityScore |
| Documentação | Report |
| Rastreabilidade | AuditLog, PasswordResetToken, RefreshToken |

## Cardinalidades principais

| Relacionamento | Cardinalidade | Observação |
|---|---|---|
| Plan → Subscription | 1:N | Um plano pode ter múltiplas assinaturas |
| Company → Subscription | 1:N | Uma empresa pode ter histórico de assinaturas |
| Company → User | 1:N | Múltiplos usuários CLIENT por empresa |
| Company → Application | 1:N | Limitado pelo plano (RN03) |
| Application → Project | 1:1 | Regra central do domínio (RN05) |
| Project → Vulnerability | 1:N | Um projeto tem múltiplos findings |
| Project → ProjectMember | 1:N | Múltiplos pentesters por projeto (RN08) |
| Vulnerability → Evidence | 1:N | Múltiplas evidências por finding |
| MaturityAssessment → MaturityScore | 1:N | Um score por controle por assessment |
| MaturityDomain → MaturityControl | 1:N | Catálogo hierárquico |

## Links relacionados
[[Entidades e Relacionamentos]]
[[ORM Prisma]]
[[Banco de Dados MySQL]]
[[MOC - Dominio]]
