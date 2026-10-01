---
type: conceito
tags: [domain]
status: ativo
---

# Remediation Service

## Definição
Flag opcional de um `Project` (`hasRemediationService`) que define se o serviço de remediação está incluso na análise. Altera quem pode mover o status de uma `Vulnerability` durante o ciclo de remediação.

## Impacto no fluxo de Vulnerability

### Com `hasRemediationService = true`
O analista (PENTESTER/ADMIN) conduz a remediação:
- Pentester pode mover `Vulnerability` para `IN_PROGRESS`, `FIXED` e `REVALIDATION`
- Cliente acompanha e pode aceitar risco (`RISK_ACCEPTED`)

### Sem `hasRemediationService = false`
O cliente conduz a remediação:
- Cliente deve mover para `FIXED` após corrigir
- Apenas Pentester/Admin valida (move para `REVALIDATION` e `CLOSED`)

## Onde é configurado
- no momento da criação do `Project` — campo `has_remediation_service`
- vinculado ao plano: o `Plan` tem o campo `includes_remediation` que indica se o serviço está disponível

## Nota de implementação — Issue #20 (decisão em 2026-10-01)

O campo vigente no schema é `Project.hasRemediation` e o do plano é
`Plan.includesRemediation`. `hasRemediation` é opt-in: só pode ser marcado se a
subscription `ACTIVE` da empresa da Application usada no Project estiver ligada
a um Plan que inclua remediação. Um plano sem o recurso não deve aceitar a
solicitação. Ver [[ADR-044 - Regras comerciais para criar Project]].

**Implementação — CP-3 da Issue #20 (validada em 2026-10-01):** o create só
aceita `hasRemediation: true` se o Plan da subscription `ACTIVE` da empresa da
Application incluir remediação. O update aplica o mesmo gate apenas na mudança
de `false` para `true`; atualização de metadados não depende dele e desligar a
flag para `false` permanece permitido. A whitelist de update protege também os
vínculos e o status do Project. Testes focais API: 24/24; `project.service` com
100% linhas/funções, 84,31% branches e 93,2% statements; build API host aprovado.
Ver [[ADR-044 - Regras comerciais para criar Project]]. A checagem concorrente
de elegibilidade/capacidade continua sem serialização.

## Links relacionados
[[Project]]
[[Vulnerability]]
[[RN13 - Fluxo com remediation service]]
[[RN14 - Fluxo sem remediation service]]
[[Maquina - Vulnerability]]
[[Plan]]
[[Projetos]]
