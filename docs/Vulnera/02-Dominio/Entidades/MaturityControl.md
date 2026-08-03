---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# MaturityControl

## Definição
Representa um subcontrole dentro de um `MaturityDomain`. É a unidade granular que é avaliada individualmente durante uma `MaturityAssessment`. Cada controle recebe um score de 1 a 5 em cada avaliação.

## Papel no sistema
`MaturityControl` é o elemento atômico do modelo de maturidade. Define exatamente o que está sendo avaliado (ex: "Autenticação multifator está implementada para todos os acessos privilegiados"). O catálogo de controles é centralizado e fixo — permite evolução do modelo sem quebrar scores históricos já registrados.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `domain_id` | uuid FK | Referência ao [[MaturityDomain]] |
| `name` | string | Nome do controle (descrição curta) |
| `description` | text | Descrição detalhada do que deve ser verificado |
| `sort_order` | int | Ordem de exibição dentro do domínio |

## Relacionamentos
- pertence a um [[MaturityDomain]]
- referenciado por múltiplos [[MaturityScore]] (um por assessment que o avalia)

## Regras associadas
- [[RN19 - Maturidade e feita por Admin]] — apenas Admin pode criar/editar controles
- o catálogo de controles é global — mudanças afetam todas as avaliações futuras

## Estados / enums
`MaturityControl` não possui estados. É entidade de catálogo — estável e reutilizável.

## Permissões / visibilidade
- criação e edição: exclusiva do ADMIN
- leitura: ADMIN, PENTESTER atribuído ao projeto, CLIENT da company avaliada

## Riscos de inconsistência
- excluir um `MaturityControl` que possui `MaturityScore` vinculados em avaliações históricas quebraria o modelo — exclusão deve ser bloqueada ou via soft delete
- alterar `name` ou `description` de um controle já avaliado altera retroativamente o significado do score — não recomendado após uso em produção
- `domain_id` deve existir e ser válido — FK obrigatória

## Links relacionados
[[MaturityDomain]]
[[MaturityScore]]
[[MaturityAssessment]]
[[RN19 - Maturidade e feita por Admin]]
[[Maturidade]]
[[MOC - Dominio]]
