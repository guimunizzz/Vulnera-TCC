# Checklist Mestre — notas de desenho da revisão

A Checklist Mestre fornecida é ampla e não representa apenas requisitos diretamente auditáveis por inspeção de código.

## Perfil estrutural

- 39 seções de nível 2 (`0` a `38`).
- 1.619 itens marcáveis.
- 13 itens explicitamente marcados como especificação incompleta/ambígua.
- 48 itens explicitamente marcados como conflito de especificação.
- 45 itens explicitamente marcados como fora do MVP/trabalho futuro.

## Consequência para o harness

A revisão não deve enviar os 1.619 itens para cada especialista.

O fluxo correto é:

1. parsing determinístico dos checkboxes;
2. enriquecimento/classificação pelo `checklist_indexer`;
3. canonicalização de requisitos repetidos;
4. batches por domínio;
5. auditoria especializada;
6. resolução derivada de edge cases, critérios de aceite e critérios de MVP pronto;
7. cross-review apenas nos pontos de maior risco/incerteza.

## Seções que merecem tratamento diferente

- `30. Itens explicitamente fora do MVP atual`: não devem ser cobrados como implementação obrigatória.
- `31. Edge cases obrigatórios`: devem referenciar o requisito canônico sempre que possível.
- `33. Registro mestre de conflitos e ambiguidades`: deve orientar adjudicação, não gerar certeza artificial.
- `34. Checklist de aceite ponta a ponta`: deve ser resolvida por `flow_validator` reutilizando findings.
- `35. Critérios para considerar o MVP pronto`: deve ser derivado dos findings já consolidados.
- `36. Evidências acadêmicas, monografia e preparação da banca`: grande parte é processo/manual e não justifica inspeção profunda de código.
- `37–38`: referência/inventário, sem checkboxes próprios.

## Regra de imutabilidade

`docs/code-review/MASTER_CHECKLIST.md` é entrada de auditoria. Não marcar seus checkboxes.

Status, evidências e recomendações ficam em arquivos separados dentro de `docs/code-review/`.
