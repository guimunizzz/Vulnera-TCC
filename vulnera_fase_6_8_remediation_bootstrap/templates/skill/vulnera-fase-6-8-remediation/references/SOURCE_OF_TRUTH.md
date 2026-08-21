# Fonte de verdade e precedência

## Ordem de precedência

1. Restrições explícitas da Fase 6.8 / instrução atual do usuário.
2. `CLAUDE.md` e documentação viva do repositório.
3. `CONSOLIDATED_FINDINGS.md` saneado, especialmente Finding ID, evidência, `VALIDATION_REQUIRED` e `CLOSURE_CRITERIA`.
4. `PRD_VIVO.md`, Contexto Mestre, Design System e schema real.
5. Artefatos históricos da auditoria (`VULNERA_IMPLEMENTATION_AUDIT`, `RECOMMENDATIONS`, `ADVERSARIAL_REVIEW`, session archive) para contexto e rastreabilidade, não para substituir o estado atual do código.

## Regra de realidade

A auditoria foi estática. O código atual + testes/runtime são a verdade operacional da remediação.

Se CP0 refutar um finding ou encontrar divergência material entre evidência histórica e código atual, não force a correção prevista: aplique a STOP CONDITION e reporte.

## Não reescrever o passado

Não altere os achados originais para fingir que nunca existiram. A resolução pertence a `docs/FINDINGS_REMEDIATION.md` e aos artefatos da Fase 6.8.
