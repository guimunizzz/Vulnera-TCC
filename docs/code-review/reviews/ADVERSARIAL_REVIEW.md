# Vulnera — Revisão Adversarial

## Cobertura

- P0: 0/0.
- P1: 10/10 candidatos revisados.
- `DIVERGENT`: 12/12 revisados.
- LOW confidence: 0/0.
- Amostras dirigidas de implementação: registro público/role, derivação em creates, isolamento de métricas e autorização/elegibilidade de Report.

Estado atual reconciliado após as adjudicações: **P0: 0; P1: 9; P2: 22; P3: 1; total técnico acionável: 32**. A cobertura `P1: 10/10 candidatos` e a tabela abaixo preservam o histórico anterior à consolidação, inclusive o downgrade de `INFRA-001`.

## Resultado

- Confirmados: 14.
- Rebaixados: 1.
- Refutados: 1.
- Elevados: 0.
- Não resolvidos: 0.

## Adjudicação dos P1 candidatos

| Finding | Veredito | Severidade/confiança final | Síntese |
|---|---|---|---|
| SECURITY-001 | CONFIRMED | P1/HIGH | casts não removem propriedades; campos extras válidos chegam ao Prisma |
| SECURITY-002 | CONFIRMED | P1/MEDIUM | defaults JWT previsíveis alcançam role ADMIN; exposição real não validada |
| AUTH-001 | CONFIRMED | P1/HIGH | consumo do refresh não é condicional/transacional |
| BUSINESS-001 | CONFIRMED | P1/HIGH | Plan `isActive` não participa de request/approve |
| BUSINESS-002 | CONFIRMED | P1/HIGH | múltiplas pendências podem ser aprovadas concorrentemente |
| BUSINESS-003 | CONFIRMED | P1/HIGH | Project não consulta Subscription; `maxProjects` fica condicionado à ratificação |
| BUSINESS-004 | CONFIRMED | P1/HIGH | entidade muda antes do AuditLog sem transação |
| INFRA-001 | DOWNGRADED | P2/HIGH | defeito local; Compose principal fornece `PORT` |
| INFRA-002 | CONFIRMED | P1/HIGH | `npm ci` sem lockfile impede os gates configurados |
| METRICS-001 | CONFIRMED | P1/HIGH | populações filtradas divergem entre Prisma/SQL/comparison |

## Divergências restantes

- SECURITY-003: confirmado P2/HIGH.
- BUSINESS-006: refutado como bug; reclassificado como decisão `SPEC_AMBIGUITY`/NONE.
- BUSINESS-009: confirmado P2/HIGH.
- MATURITY-001: confirmado P2/HIGH; ADR-018 vigente sustenta a divergência.
- FRONTEND-002: confirmado P2/HIGH.
- FRONTEND-005: confirmado P2/HIGH, escopo restrito ao donut de dashboard e radar de maturidade.

## Amostras positivas

- Registro público força CLIENT e não aceita role do payload.
- Creates de Application/Project reconstroem campos e derivam ownership; o problema SECURITY-001 é específico de update.
- Metrics autoriza Application/Company/ProjectMember antes das consultas.
- Report valida Company/membership e estado elegível; ainda depende de Project não corrompido por SECURITY-001.

## Controles contra falso positivo

- Nenhum item `OUT_OF_MVP` virou pendência do MVP.
- `VALIDATION-001/002` permanecem tarefas de validação, não bugs.
- BUSINESS-003 separa gate ACTIVE obrigatório de `maxProjects` condicionado à ratificação.
- METRICS-001, FRONTEND-001 e FRONTEND-002 são comportamentos distintos.
- BUSINESS-004 (entidade/AuditLog) não duplica BUSINESS-005 (onboarding composto).
- Nenhum P0 foi sustentado: os impactos P1 exigem autenticação/condição operacional ou não comprovam exfiltração global imediata.

## Verificação de não mutação

O revisor não escreveu arquivos. A inspeção final encontrou apenas artefatos da auditoria em `docs/code-review/**`; nenhum arquivo funcional do produto foi modificado.
