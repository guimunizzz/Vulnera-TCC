---
type: entidade
tags: [domain, source-of-truth, risco, governanca]
status: ativo
---

# RiskAcceptance

## Definição
O registro formal de que uma [[Vulnerability]] **não será corrigida agora**, por
decisão de negócio, com autor, aprovador, justificativa e prazo de validade.

## Papel no sistema
Separar "em que ponto do conserto está" de "houve decisão formal de não
consertar agora". São dois eixos independentes, e é por isso que **a
vulnerabilidade continua ABERTA** durante o aceite — aceitar risco não corrige
nada.

## Campos importantes
- `status` — `REQUESTED` · `APPROVED` · `REJECTED` · `REVOKED` · `EXPIRED`
- `requestedById` / `reviewedById` / `revokedById`
- `justification`, `compensatingControls`, `reviewNote`, `revokeReason`
- `expiresAt` — **obrigatório**, teto de 365 dias
- `endedAt`

## Regras associadas
- **Segregação de função sem exceção:** `requestedById != reviewedById`,
  inclusive para `ADMIN`.
- `PENTESTER` **solicita, nunca aprova**. Quem assina é o dono do risco.
- `companyRole` é lido do **banco**, nunca do JWT — um refresh desatualizado não
  pode conceder alçada.
- Enquanto vigente, **o SLA fica pausado** (não zerado); ao terminar, o
  intervalo é somado a `slaPausedMs`.
- **Expiração é preguiçosa e atômica**: não há job; a leitura normaliza o que
  venceu, e apenas um vencedor escreve o evento de auditoria.
- Aceite decidido é **imutável**. O que existe é revogar, que é outro evento.

## Relacionado
[[Vulnerability]]
[[AuditLog]]
[[ADR-036 - Aceite de risco como entidade, nunca como status]]
[[Matriz de Permissoes]]
