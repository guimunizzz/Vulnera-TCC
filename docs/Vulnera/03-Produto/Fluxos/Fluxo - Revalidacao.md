---
type: fluxo
tags: [feature, flow]
status: ativo
---

# Fluxo - Revalidacao

## Objetivo
Descrever o ciclo de correção de uma vulnerabilidade: o cliente marca como corrigida, solicita revalidação e o Pentester confirma ou contesta a correção.

## Ator principal
Cliente (OWNER ou MEMBER) · Pentester (validação)

## Pré-condições
- `Vulnerability` no status `IN_PROGRESS` ou `OPEN` (dependendo se há serviço de remediação)
- Project com Pentester atribuído

## Passos principais

### Sem serviço de remediação (`hasRemediationService = false`)
1. Cliente (ou Admin) implementa a correção no sistema
2. Cliente acessa o finding e muda o status para `FIXED` (apenas cliente pode fazer isso sem remediação)
3. Cliente solicita revalidação → status muda para `REVALIDATION`
4. Pentester recebe notificação
5. Pentester verifica a correção

**Caminho: correção aprovada**
6. Pentester confirma → status muda para `CLOSED`

**Caminho: correção não validada**
6. Pentester contesta → status volta para `IN_PROGRESS`
7. Ciclo se repete

### Com serviço de remediação (`hasRemediationService = true`)
1. Analista (Pentester ou Admin) apoia a correção
2. Analista pode mover o status para `FIXED` diretamente
3. Cliente solicita revalidação → status muda para `REVALIDATION`
4. Pentester valida (mesmos caminhos acima)

### Caminho alternativo: aceite de risco
1. Cliente decide não corrigir o finding
2. Cliente muda status para `RISK_ACCEPTED`
3. Admin registra → status vai para `CLOSED`

## Regras de negócio relacionadas
- [[RN12 - Transicoes seguem maquina de estados]]
- [[RN13 - Fluxo com remediation service]]
- [[RN14 - Fluxo sem remediation service]]
- [[RN15 - Admin pode sempre mover status com auditoria]]

## Pós-condições
- `Vulnerability.status = CLOSED` (correção validada ou risco aceito)
- `AuditLog` gerado para cada transição relevante

## Relacionado
[[Fluxo - Registro de Finding]]
[[Findings]]
[[Vulnerability]]
[[Maquina - Vulnerability]]
[[Project]]
