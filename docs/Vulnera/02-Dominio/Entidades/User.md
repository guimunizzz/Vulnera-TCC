---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# User

## Definição
Identidade base de qualquer pessoa autenticada no sistema.

## Roles possíveis
- ADMIN
- PENTESTER
- CLIENT

## CompanyRole
Quando o role é CLIENT:
- OWNER
- MEMBER

## Relacionamentos
- pode pertencer a uma [[Company]]
- pode participar de [[Project]] via [[ProjectMember]]
- pode criar [[Vulnerability]]
- pode abrir [[SupportTicket]]
- recebe [[Notification]]
- gera [[AuditLog]]

## Regras associadas
- [[RN02 - Usuario pertence a no maximo uma Company]]
- [[RN16 - Cliente so ve dados da propria Company]]
- [[RN17 - Pentester so ve Projects atribuidos]]

## Ver também
[[Roles]]
[[CompanyRole]]
[[Matriz de Permissoes]]