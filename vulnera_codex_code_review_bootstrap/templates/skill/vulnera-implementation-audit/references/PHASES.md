# Fases da Revisão Multiagente

## Gate 0 — prontidão

Não começar se branch, checklist, registry seed ou harness estiverem inconsistentes.

Confirme também a política de escrita: a auditoria só pode criar arquivos em `docs/code-review/**`.

## Fase 0 — entendimento e indexação econômica

Executar em paralelo:

- `architecture_mapper`
- `checklist_indexer`

Entradas do indexador:

- `docs/code-review/MASTER_CHECKLIST.md`
- `docs/code-review/state/REQUIREMENT_SEEDS.jsonl`
- `references/CHECKLIST_ROUTING.md`

Saídas esperadas:

- mapa compacto da arquitetura real;
- Requirement Registry enriquecido com domínio, auditabilidade, dependências e canonicalização;
- grupos/batches de auditoria;
- itens que não justificam inspeção profunda de código;
- limitações de validação.

Persistir em `docs/code-review/state/`.

## Fase 1 — especialistas em batches

Executar, preferencialmente em paralelo e respeitando o limite de threads:

- `backend_auditor`
- `frontend_ux_auditor`
- `business_rules_auditor`
- `data_infra_auditor`
- `security_auditor`
- `test_quality_auditor`

Cada invocação recebe apenas:

- 40–80 requisitos relevantes, salvo lote mecânico justificável;
- recorte do Architecture Map;
- findings prévios estritamente necessários;
- acesso de leitura ao repositório.

Não enviar a checklist inteira.

Itens `PROCESS_DOCUMENTATION`, `REFERENCE_ONLY` e `DERIVED_ACCEPTANCE` não devem disparar uma nova auditoria profunda. Itens `OUT_OF_MVP` recebem verificação dirigida, não varredura completa.

O orquestrador normaliza/deduplica e pode persistir resultados em `docs/code-review/findings/`.

## Fase 2 — validação cruzada

1. `flow_validator` revisa fluxos principais, priorizando P0/P1, divergências, parciais e requisitos críticos.
2. `adversarial_reviewer` tenta refutar:
   - 100% P0;
   - 100% P1;
   - 100% DIVERGENT;
   - 100% LOW confidence;
   - conflitos entre agentes;
   - amostra dirigida de IMPLEMENTED.
3. O orquestrador adjudica conflitos.
4. Se a confirmação exigir runtime mutável ou externo, usar `NOT_VALIDATED`/`ESCALATION_REQUIRED`; não executar por conta própria.

Persistir em `docs/code-review/reviews/`.

## Fase 3 — cobertura derivada e síntese

Antes de escrever o relatório:

- resolva critérios de aceite e MVP pronto a partir de findings canônicos sempre que possível;
- marque itens processuais/manuais corretamente;
- confirme que nenhum checkbox ficou perdido apenas porque não era requisito de código;
- calcule métricas separando `NOT_VALIDATED`, `OUT_OF_MVP`, `PROCESS_DOCUMENTATION` e derivados quando isso evitar falsa precisão.

Antes de encerrar, execute novamente:

`python vulnera_codex_code_review_bootstrap/scripts/validate_review_setup.py --repo .`

Se aparecer qualquer mudança fora do harness e `docs/code-review/**`, não esconda o fato: marque a revisão como operacionalmente inválida até o repositório voltar ao baseline.

Gerar:

- `docs/code-review/VULNERA_IMPLEMENTATION_AUDIT.md`
- `docs/code-review/RECOMMENDATIONS.md`

## Política de escrita

Agentes especialistas são read-only.

O orquestrador só pode escrever em `docs/code-review/**`.

Nenhum código é corrigido nesta execução.
