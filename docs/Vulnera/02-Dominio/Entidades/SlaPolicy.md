---
type: entidade
tags: [domain, source-of-truth, sla, remediation]
status: ativo
---

# SlaPolicy

## Definição
A política de prazo de remediação de uma Company: quantos dias corridos cada
severidade tem para ser corrigida.

## Papel no sistema
É de onde sai o `slaDueAt` de cada [[Vulnerability]] no momento em que ela é
criada. Existe uma política **padrão** (`companyId = null`) para empresas que
nunca configuraram a sua.

## Campos importantes
- `companyId` — null = política padrão do produto
- `criticalDays` · `highDays` · `mediumDays` · `lowDays`
- `createdBy`, `createdAt`

## Regras associadas
- **Salvar uma política NÃO recalcula prazo nenhum.** Vale para os próximos
  findings; reaplicar aos abertos é ação separada, de ADMIN, e gera
  `SLA_RECALCULATED` no [[AuditLog]]. É o que impede "consertar" um estouro
  afrouxando a regra.
- Severidade `NONE` não tem prazo — o finding fica `NO_SLA`, que é diferente de
  "no prazo".
- `CLIENT OWNER` edita a da própria empresa; `ADMIN` edita a de qualquer uma;
  `PENTESTER` não define prazo de ninguém.

## Relacionado
[[Vulnerability]]
[[Company]]
[[ADR-034 - SLA de remediacao persiste o prazo e deriva o estado]]
