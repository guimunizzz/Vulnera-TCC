# Contrato de Findings

Todos os agentes devem retornar achados compactos e rastreáveis. Evite prosa longa.

## Status permitidos

- `IMPLEMENTED` → ✅ Implementado
- `PARTIAL` → 🟡 Parcialmente implementado
- `NOT_IMPLEMENTED` → ❌ Não implementado
- `DIVERGENT` → 🔴 Implementado com divergência
- `NOT_VALIDATED` → ⚠️ Não foi possível validar
- `EXTRA` → 🔵 Implementação extra
- `NOT_APPLICABLE` → item não aplicável à auditoria de código atual, mantendo rastreabilidade

## Severidade

- `P0` — crítico
- `P1` — alta prioridade
- `P2` — média prioridade
- `P3` — melhoria
- `NONE` — quando severidade técnica não se aplica

Não inflar severidade.

## Confiança

- `HIGH` — evidência direta e caminho suficientemente confirmado
- `MEDIUM` — evidência relevante, mas existe dependência/caminho não confirmado
- `LOW` — hipótese plausível que exige validação adicional

## Auditabilidade

Use uma categoria de `CHECKLIST_ROUTING.md`:

`CODE_STATIC | CROSS_LAYER | RUNTIME_REQUIRED | MANUAL_VISUAL | PROCESS_DOCUMENTATION | OUT_OF_MVP | SPEC_AMBIGUITY | SPEC_CONFLICT | DERIVED_ACCEPTANCE | REFERENCE_ONLY`

## Formato obrigatório por finding

```text
FINDING_ID: <dominio>-<sequencial>
REQUIREMENT_ID: <ID da Checklist | EXTRA | N/A>
CANONICAL_REQUIREMENT_ID: <ID | SAME | N/A>
AUDITABILITY: <categoria>
DOMAIN: <backend|frontend|business|data|infra|security|tests|e2e|architecture|process>
STATUS: <IMPLEMENTED|PARTIAL|NOT_IMPLEMENTED|DIVERGENT|NOT_VALIDATED|EXTRA|NOT_APPLICABLE>
SEVERITY: <P0|P1|P2|P3|NONE>
CONFIDENCE: <HIGH|MEDIUM|LOW>
EXPECTED: <1-3 frases>
OBSERVED: <1-4 frases>
EVIDENCE:
- <path>:<line opcional> — <símbolo/rota/componente> — <o que prova>
MISSING_OR_DIVERGENCE: <objetivo e curto; NONE se não houver>
IMPACT: <objetivo e curto>
RUNTIME_VALIDATED: <YES|NO|PARTIAL|NOT_ALLOWED>
RESOLVED_BY: <finding/requisito canônico | NONE>
CROSS_REVIEW: <lista de agentes/domínios ou NONE>
```

## Regras de evidência

1. Nunca classificar requisito de código sem evidência.
2. Existência de arquivo/função/rota não prova fluxo funcional.
3. Referenciar caminhos e símbolos sempre que possível.
4. Se runtime for necessário e não estiver disponível sem mutação, usar `NOT_VALIDATED`.
5. Não duplicar findings. Use `CANONICAL_REQUIREMENT_ID`/`RESOLVED_BY`.
6. Itens de processo/visual/fora do MVP não devem ser forçados a status de implementação de código.
7. Retornar apenas findings relevantes ao próprio escopo e conflitos que exigem cross-review.
8. Não sugerir patch dentro de findings; recomendações detalhadas ficam para o relatório final.
