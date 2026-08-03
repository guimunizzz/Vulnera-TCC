---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# MaturityScore

## Definição
Representa o score atribuído a um `MaturityControl` específico dentro de uma `MaturityAssessment`. É o registro granular do nível de conformidade observado para cada controle avaliado.

## Papel no sistema
`MaturityScore` é a linha de dados da avaliação de maturidade. Para cada assessment, existe um registro MaturityScore por controle avaliado. O `overall_score` no `MaturityAssessment` é calculado com base na média dos scores individuais. O campo `is_compliant` permite filtragem rápida de controles conformes e não conformes.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `assessment_id` | uuid FK | Referência ao [[MaturityAssessment]] |
| `control_id` | uuid FK | Referência ao [[MaturityControl]] |
| `score` | int | Nível de maturidade: 1 a 5 |
| `is_compliant` | boolean | Se o controle está em conformidade |
| `notes` | text | Observações do avaliador sobre o controle |

## Escala de score

| Score | Significado |
|---|---|
| 1 | Inexistente / sem controle |
| 2 | Inicial / ad-hoc |
| 3 | Definido / documentado |
| 4 | Gerenciado / monitorado |
| 5 | Otimizado / melhoria contínua |

## Relacionamentos
- pertence a um [[MaturityAssessment]]
- referencia um [[MaturityControl]]
- indiretamente ligado a [[MaturityDomain]] via MaturityControl

## Regras associadas
- [[RN19 - Maturidade e feita por Admin]] — apenas Admin pode criar e editar scores
- CLIENT e PENTESTER atribuídos podem apenas ler os resultados

## Estados / enums
`MaturityScore` não possui estados. Uma vez registrado, pode ser editado pelo Admin para refletir evolução ou correção.

## Permissões / visibilidade
- criação e edição: exclusiva do ADMIN
- leitura: ADMIN, PENTESTER atribuído ao projeto, CLIENT da company

## Riscos de inconsistência
- constraint UNIQUE(`assessment_id`, `control_id`) deve ser aplicada — um controle só deve ter um score por assessment
- `score` deve ser validado no range 1-5 — valor fora da escala quebraria a semântica do modelo
- se um `MaturityControl` for removido do catálogo, MaturityScores históricos ficam com FK inválida — proteger com soft delete no controle
- `overall_score` no Assessment deve ser recalculado ao atualizar um score individual

## Links relacionados
[[MaturityAssessment]]
[[MaturityControl]]
[[MaturityDomain]]
[[RN19 - Maturidade e feita por Admin]]
[[Maturidade]]
[[MOC - Dominio]]
