---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN15
criticidade: alta
---

# RN15 - Admin pode sempre mover status com auditoria

## Enunciado
Admin pode sempre mover qualquer status de `Vulnerability` ou `Project` para fins de correção administrativa — mas a ação é auditada.

## Motivação
Erros operacionais acontecem. O Admin precisa ter poder de correção sem depender do fluxo normal da máquina de estados. A auditoria obrigatória garante rastreabilidade e transparência dessas intervenções.

## Escopo
Aplica-se a qualquer transição de status de `Vulnerability` e `Project`, inclusive transições que normalmente seriam bloqueadas pela máquina de estados.

## Condições
- a transição pelo Admin não segue as restrições de role normal da máquina de estados
- toda transição feita pelo Admin fora do fluxo normal gera um `AuditLog` com o diff de status
- o campo `actor_id` no `AuditLog` deve registrar o Admin que realizou a ação
- o campo `action` no log deve identificar a natureza administrativa da mudança

## Exceções
- esta regra não remove a necessidade de que outros atores sigam a máquina de estados normal

## Impacta
[[Vulnerability]]
[[Project]]
[[AuditLog]]

## Casos de teste
- Admin move Vulnerability de OPEN para CLOSED diretamente (bypassa fluxo) → gera AuditLog
- AuditLog contém actor_id do Admin, timestamp e diff de status
- Pentester não consegue fazer a mesma transição fora do fluxo normal

## Relacionado
[[Maquina - Vulnerability]]
[[Maquina - Project]]
[[RN12 - Transicoes seguem maquina de estados]]
[[RN20 - Criacao de Vulnerability gera auditoria]]
[[RN21 - Mudanca de severidade gera auditoria]]
