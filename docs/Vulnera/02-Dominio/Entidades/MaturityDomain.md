---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# MaturityDomain

## Definição
Representa um domínio temático do modelo de maturidade de segurança. Agrupa controles relacionados sob uma mesma área de conhecimento (ex: Gestão de Identidade, Segurança de Rede, SDLC Seguro).

## Papel no sistema
`MaturityDomain` é a estrutura de catálogo de alto nível da avaliação de maturidade. Define as categorias sob as quais os `MaturityControl` são organizados. É uma entidade de referência — não muda por avaliação, serve de base fixa para todas as assessments. Permite evoluir o modelo de maturidade sem quebrar avaliações históricas.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `name` | string | Nome do domínio (ex: "Gestão de Identidade e Acesso") |
| `description` | text | Descrição do que o domínio cobre |
| `sort_order` | int | Ordem de exibição na interface |

## Relacionamentos
- possui múltiplos [[MaturityControl]]
- indiretamente vinculado a [[MaturityScore]] via MaturityControl
- referenciado por [[MaturityAssessment]] indiretamente

## Regras associadas
- [[RN19 - Maturidade e feita por Admin]] — apenas Admin pode criar/editar domínios
- o catálogo de domínios é global e compartilhado entre todas as avaliações

## Estados / enums
`MaturityDomain` não possui estados. É entidade de catálogo — estável e reutilizável.

## Permissões / visibilidade
- criação e edição: exclusiva do ADMIN
- leitura: ADMIN, PENTESTER atribuído, CLIENT da company avaliada

## Riscos de inconsistência
- excluir um domínio que possui `MaturityControl` vinculados quebraria avaliações históricas — exclusão deve ser bloqueada ou feita via soft delete
- alterar o nome de um domínio afeta o entendimento retroativo de scores já registrados — recomendado não editar nomes após uso em avaliações
- `sort_order` duplicado pode causar comportamento indeterminado na exibição — validar unicidade por ordem

## Links relacionados
[[MaturityControl]]
[[MaturityAssessment]]
[[MaturityScore]]
[[RN19 - Maturidade e feita por Admin]]
[[Maturidade]]
[[MOC - Dominio]]
