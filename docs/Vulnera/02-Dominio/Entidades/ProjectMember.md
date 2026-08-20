---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# ProjectMember

## Definição
Entidade de junção que representa o vínculo entre um `User` com role `PENTESTER` e um `Project`. Gerencia quais pentesters estão atribuídos a cada análise.

## Papel no sistema
`ProjectMember` é o mecanismo central de controle de acesso dos pentesters. Um pentester só pode visualizar e atuar em um Project se existir um registro `ProjectMember` ligando-o a esse projeto. A atribuição é feita pelo Admin e define o escopo de trabalho operacional.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `project_id` | uuid FK | Referência ao [[Project]] |
| `user_id` | uuid FK | Referência ao [[User]] (deve ser PENTESTER) |
| `assigned_at` | datetime | Momento da atribuição |

## Relacionamentos
- pertence a um [[Project]]
- pertence a um [[User]] com `role = PENTESTER`
- um Project pode ter múltiplos ProjectMembers
- um Pentester pode estar em múltiplos ProjectMembers (projetos distintos)

## Regras associadas
- [[RN08 - Projeto pode ter multiplos Pentesters]]
- [[RN17 - Pentester so ve Projects atribuidos]]

## Estados / enums
`ProjectMember` não possui estados. A relação é binária: existe ou não existe.

Comportamento na remoção:
- remover um `ProjectMember` revoga o acesso do pentester ao projeto imediatamente
- findings já registrados pelo pentester **não são afetados** — o campo `created_by` na `Vulnerability` persiste

## Permissões / visibilidade
- criação: exclusiva do ADMIN
- remoção: exclusiva do ADMIN
- leitura: Admin vê todos; Pentester vê a própria atribuição; Client vê a lista de pentesters do seu projeto

## Riscos de inconsistência
- não validar se o `user_id` tem `role = PENTESTER` permite atribuir clientes a projetos, quebrando o modelo de acesso
- remover um ProjectMember sem notificar o pentester pode causar confusão operacional
- atribuir o mesmo pentester duas vezes ao mesmo projeto deve ser prevenido por constraint UNIQUE(`project_id`, `user_id`)

## Links relacionados
[[Project]]
[[User]]
[[RN08 - Projeto pode ter multiplos Pentesters]]
[[RN17 - Pentester so ve Projects atribuidos]]
[[Regras de Ownership]]
[[Projetos]]
[[MOC - Dominio]]
