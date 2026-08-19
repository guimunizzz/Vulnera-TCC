# Política de Classificação da Checklist Mestre

A Checklist Mestre contém itens de naturezas diferentes. Não trate todos os checkboxes como se fossem requisitos de código independentes.

## Classificação de auditabilidade

O `checklist_indexer` deve atribuir uma das categorias abaixo a cada item:

- `CODE_STATIC` — pode ser validado principalmente por inspeção estática do código/configuração.
- `CROSS_LAYER` — exige correlação entre frontend/backend/dados/segurança.
- `RUNTIME_REQUIRED` — não pode ser concluído com segurança sem execução; por padrão termina como `NOT_VALIDATED` se não houver evidência runtime pré-existente.
- `MANUAL_VISUAL` — exige inspeção visual/manual; não inventar conclusão.
- `PROCESS_DOCUMENTATION` — evidência de processo, TCC, screenshots, monografia, operação ou documentação; não justificar varredura profunda do código.
- `OUT_OF_MVP` — item explicitamente fora do MVP/trabalho futuro. Auditar apenas se existe implementação indevida relevante ou se o item afeta interpretação do escopo.
- `SPEC_AMBIGUITY` — especificação incompleta/ambígua; não inventar requisito.
- `SPEC_CONFLICT` — fontes vigentes entram em conflito; registrar conflito antes de julgar implementação.
- `DERIVED_ACCEPTANCE` — critério de aceite/ready que deve ser resolvido a partir de findings canônicos já produzidos, evitando reauditar o mesmo fluxo.
- `REFERENCE_ONLY` — matriz, inventário ou material sem ação auditável própria.

## Regras de deduplicação

1. Requisitos primários de domínio são canônicos.
2. Itens de edge case e aceite devem referenciar requisitos/findings canônicos quando descrevem o mesmo comportamento.
3. Não criar dois findings para o mesmo defeito só porque aparece novamente em seção de testes/aceite/MVP pronto.
4. Preserve todos os IDs para cobertura da checklist, mas permita `RESOLVED_BY: <REQ/FINDING>` para itens derivados.

## Uso seletivo das fontes documentais

A checklist referencia documentação extensa. Não leia todo o acervo previamente.

Abra documentação fonte somente quando:

- o requisito está marcado como ambíguo/conflitante;
- a semântica necessária não está contida no próprio item;
- há divergência relevante entre código e checklist;
- a decisão de precedência exige ADR/PRD/Contexto Mestre.

Isso reduz contexto sem perder rastreabilidade.

## Batching

Nunca envie a Checklist Mestre inteira para um especialista.

- Agrupe por domínio e dependência.
- Preferência: 40–80 requisitos auditáveis por chamada.
- Pode aumentar até ~120 apenas quando os itens forem mecânicos/estruturais.
- Itens `PROCESS_DOCUMENTATION`, `OUT_OF_MVP`, `DERIVED_ACCEPTANCE` e `REFERENCE_ONLY` não devem consumir uma auditoria profunda individual.

## Perfil desta Checklist Mestre

A checklist fornecida possui 1.619 itens marcáveis em 39 seções de nível 2.

Routing inicial por seção:

| Seções | Dono primário | Observação |
|---|---|---|
| 0–1 | checklist_indexer / orchestrator | contexto, escopo e precedência |
| 2 | business_rules + security | roles, autorização, tenancy |
| 3 | architecture_mapper + backend | arquitetura/camadas |
| 4 | data_infra | ambiente, Prisma, Docker, env |
| 5 | data_infra + business_rules | modelo de dados/integridade |
| 6 | security + backend + frontend | auth, sessão, refresh |
| 7–13 | backend + business_rules + security/data conforme item | domínio principal |
| 14–16 | frontend + backend + flow | reports, dashboards, analytics |
| 17–18 | frontend_ux | design system e web |
| 19–20 | frontend_ux + backend/security conforme integração | mobile/push |
| 21–22 | business/backend/frontend | maturidade/notificações |
| 23 | security | segurança da aplicação |
| 24 | backend + test_quality | logs/falhas |
| 25 | test_quality | testes automatizados; cross-review quando teste representa regra crítica |
| 26–29 | data_infra + test_quality | CI/CD, seed, documentação operacional, health |
| 30 | checklist_indexer/orchestrator | fora do MVP; apenas verificação dirigida |
| 31 | agente dono do domínio | edge cases; reutilizar requisitos canônicos |
| 32–33 | orchestrator + especialista sob demanda | limitações/conflitos |
| 34 | flow_validator | aceite E2E, preferencialmente resolvido por findings canônicos |
| 35 | orchestrator | critério de pronto, derivado |
| 36 | PROCESS_DOCUMENTATION / MANUAL_VISUAL | não fazer varredura profunda de código |
| 37–38 | REFERENCE_ONLY | matriz e inventário |

Este mapa é uma heurística de roteamento, não uma alteração da Checklist Mestre.
