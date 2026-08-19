---
name: vulnera-implementation-audit
description: Execute a revisão multiagente, somente leitura, do estado real de implementação do Vulnera contra a Checklist Mestre. Use apenas quando o usuário pedir explicitamente para iniciar/continuar a revisão; não use durante setup, desenvolvimento normal ou correções.
---

# Vulnera Implementation Audit

Você é o orquestrador da revisão técnica e funcional do Vulnera.

## Pré-condição absoluta

Antes de spawnar qualquer agente:

1. leia `docs/code-review/SETUP_REPORT.md`, se existir;
2. valide branch/commit e presença de `docs/code-review/MASTER_CHECKLIST.md`;
3. valide `docs/code-review/state/REQUIREMENT_SEEDS.jsonl` e `CHECKLIST_MANIFEST.md`;
4. confirme os custom agents em `.codex/agents/`;
5. leia `references/WRITE_POLICY.md`;
6. se qualquer pré-condição falhar, pare e reporte somente os bloqueios.

## Fontes obrigatórias

Carregue e siga:

- `references/WRITE_POLICY.md`
- `references/CHECKLIST_ROUTING.md`
- `references/PHASES.md`
- `references/FINDING_SCHEMA.md`
- `references/ROUTING_POLICY.md`
- `references/AUDIT_PROTOCOL.md`
- `docs/code-review/MASTER_CHECKLIST.md`

O `AUDIT_PROTOCOL.md` contém o contrato funcional detalhado. A `MASTER_CHECKLIST.md` é imutável durante a revisão.

## Princípios

- Nunca modificar código-fonte, testes, migrations, configuração ou documentação canônica do produto.
- Durante a auditoria, toda escrita deve ficar em `docs/code-review/**`.
- Agentes especialistas são somente leitura.
- Não marcar requisito como implementado pela mera presença de código.
- Priorizar comportamento real e caminhos completos.
- Toda conclusão relevante deve ter evidência.
- Diferenciar ausência de evidência de ausência de implementação.
- Não inventar execução/runtime.
- Classificar auditabilidade antes de gastar tokens com investigação.
- Reutilizar findings canônicos para edge cases/aceite/ready quando forem o mesmo comportamento.
- Manter outputs intermediários compactos.

## Orquestração

Siga `references/PHASES.md`.

Não peça a especialistas para escrever capítulos finais em prosa. Exija `references/FINDING_SCHEMA.md`.

Use `references/ROUTING_POLICY.md` e `references/CHECKLIST_ROUTING.md` para reduzir contexto e custo.

## Artefatos permitidos

O orquestrador pode criar o que for útil dentro de `docs/code-review/`, preferencialmente:

- `state/ARCHITECTURE_MAP.md`
- `state/REQUIREMENT_REGISTRY.md`
- `state/CHECKLIST_MANIFEST.md`
- `state/REQUIREMENT_SEEDS.jsonl`
- `findings/CONSOLIDATED_FINDINGS.md`
- `reviews/FLOW_VALIDATION.md`
- `reviews/CROSS_REVIEW.md`
- `reviews/ADVERSARIAL_REVIEW.md`
- `VULNERA_IMPLEMENTATION_AUDIT.md`
- `RECOMMENDATIONS.md`

## Entregas finais obrigatórias

1. `docs/code-review/VULNERA_IMPLEMENTATION_AUDIT.md`
2. `docs/code-review/RECOMMENDATIONS.md`

`RECOMMENDATIONS.md` deve conter somente sugestões/priorização/ações futuras. Não aplique nenhuma delas.

## Condição de encerramento

Não finalize até:

- todos os itens auditáveis da Checklist Mestre terem status ou `NOT_VALIDATED` explícito;
- itens derivados/processuais terem classificação/rastreabilidade sem varredura redundante;
- findings relevantes terem evidência;
- fluxos críticos terem cross-review;
- conflitos P0/P1 terem sido adjudicados ou marcados como escalonamento necessário;
- a revisão final obrigatória do protocolo ter sido executada;
- o working tree não apresentar alterações fora de `docs/code-review/**` atribuíveis à auditoria.
- executar `validate_review_setup.py` no fim e confirmar que não surgiram mudanças fora do harness/`docs/code-review/**`.
