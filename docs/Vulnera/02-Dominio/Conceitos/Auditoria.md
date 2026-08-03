---
type: conceito
tags: [domain, seguranca]
status: ativo
---

# Auditoria

## Definição
Trilha de rastreabilidade de ações sensíveis realizadas pelos usuários no sistema. Permite responder: quem fez o quê, quando, em qual recurso e qual foi a mudança.

## Implementação no Vulnera

A auditoria é persistida via entidade `AuditLog`:

| Campo | Conteúdo |
|---|---|
| `actor_id` | Usuário que realizou a ação |
| `entity_type` | Tipo do recurso afetado (ex: `Vulnerability`) |
| `entity_id` | ID do recurso específico |
| `action` | Ação realizada (ex: `CREATED`, `STATUS_CHANGED`, `SEVERITY_OVERRIDDEN`) |
| `diff_json` | JSON com before/after da mudança |
| `created_at` | Timestamp da ação |

## Eventos auditados obrigatoriamente

- criação de `Vulnerability` — [[RN20 - Criacao de Vulnerability gera auditoria]]
- mudança de severidade — [[RN21 - Mudanca de severidade gera auditoria]]
- mudança de status por ADMIN — [[RN15 - Admin pode sempre mover status com auditoria]]
- download de relatório
- aprovação/rejeição de assinatura
- atribuição/remoção de pentester

## Visibilidade
O `AuditLog` é consultável pelo Admin na interface administrativa. Não é exposto a clientes nem pentesters diretamente.

## Links relacionados
[[AuditLog]]
[[RN15 - Admin pode sempre mover status com auditoria]]
[[RN20 - Criacao de Vulnerability gera auditoria]]
[[RN21 - Mudanca de severidade gera auditoria]]
[[Logs Estruturados]]
