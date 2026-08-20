---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN21
criticidade: alta
---

# RN21 - Mudanca de severidade gera auditoria

## Enunciado
Mudança de severidade de uma `Vulnerability` — seja automática via recálculo de CVSS ou manual via override — gera um registro de auditoria.

## Motivação
Severidade determina priorização de remediação e afeta a percepção do cliente sobre o risco. Alterações nesse campo sem rastreabilidade criariam espaço para manipulação de resultados ou erros silenciosos.

## Escopo
Aplica-se a qualquer alteração dos campos `severity_final` ou `severity_calculated` de uma Vulnerability.

## Condições
- mudança de severidade automática (por alteração do CVSS vector) gera AuditLog com:
  - `action = 'SEVERITY_CHANGE'`
  - `diff_json` com valor anterior e novo
- mudança manual com override gera AuditLog adicional com `action = 'SEVERITY_OVERRIDE'` e deve incluir o campo `severity_override_reason`
- o campo `severity_override_reason` é obrigatório para override manual

## Impacta
[[Vulnerability]]
[[AuditLog]]

## Casos de teste
- alterar CVSS vector gera AuditLog com action = SEVERITY_CHANGE
- override manual sem justificativa retorna erro de validação
- override manual com justificativa gera AuditLog com action = SEVERITY_OVERRIDE e razão

## Relacionado
[[RN10 - Severidade via CVSS com override justificado]]
[[RN20 - Criacao de Vulnerability gera auditoria]]
[[AuditLog]]
[[CVSS]]
