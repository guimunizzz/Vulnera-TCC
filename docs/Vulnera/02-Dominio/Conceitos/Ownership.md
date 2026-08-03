---
type: conceito
tags: [domain, seguranca]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Ownership

## Definição
Princípio de que cada recurso do sistema pertence a um escopo bem definido, e somente quem pertence àquele escopo pode acessá-lo. No Vulnera, ownership é verificado em toda operação que toca dados de um tenant específico.

## Hierarquia de ownership

```
Company
  └── Application
        └── Project
              └── Vulnerability
                    └── Evidence
                    └── VulnerabilityComment
              └── ChatMessage
              └── Report
              └── MaturityAssessment
  └── Subscription
  └── SupportTicket
```

Toda entidade operacional pertence indiretamente a uma `Company`.

## Regra central
- `CLIENT` só acessa dados da própria `Company` — verificado via `companyId`
- `PENTESTER` só acessa `Project` onde é `ProjectMember` — verificado via relação de membro
- `ADMIN` tem acesso global operacional

## Onde é verificado
- nos guards Express (verificação de role)
- nos services (verificação de companyId ou membership)
- nas queries do repository (filtro de company na where clause)

## Erro de não-existência vs proibido
Quando um usuário tenta acessar um recurso de outra Company, o sistema retorna **404 (Not Found)**, não 403 (Forbidden). Isso evita revelar a existência do recurso a quem não deveria saber que ele existe.

## Links relacionados
[[Middlewares e Ownership]]
[[Regras de Ownership]]
[[Matriz de Permissoes]]
[[Multi-tenancy por escopo]]
[[RN16 - Cliente so ve dados da propria Company]]
[[RN17 - Pentester so ve Projects atribuidos]]
