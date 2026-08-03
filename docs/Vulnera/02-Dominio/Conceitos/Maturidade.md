---
type: conceito
tags: [domain]
status: ativo
---

# Maturidade

## Definição
Avaliação estruturada do nível de maturidade em segurança de uma empresa, organizada em domínios temáticos com subcontroles pontuados de 1 a 5.

## Estrutura hierárquica

```
MaturityAssessment (avaliação de uma empresa em um projeto)
  └── MaturityDomain (ex: Gestão de Acesso, Segurança de Rede)
        └── MaturityControl (ex: MFA habilitado, Backups testados)
              └── MaturityScore (score 1-5 + is_compliant + notes)
```

## Escala de score (1–5)

| Score | Significado |
|---|---|
| 1 | Inexistente / sem controle |
| 2 | Inicial / ad-hoc |
| 3 | Definido / documentado |
| 4 | Gerenciado / monitorado |
| 5 | Otimizado / melhoria contínua |

## Nível final da avaliação

O `overall_score` (média dos controles) é mapeado para um nível:

| Faixa | Nível |
|---|---|
| < 40 | BASIC |
| 40–70 | INTERMEDIATE |
| > 70 | ADVANCED |

## Domínios previstos no MVP

1. Gestão de Acesso e Identidade
2. Backup e Continuidade
3. Segurança de Rede
4. Gestão de Vulnerabilidades
5. Monitoramento e Resposta a Incidentes
6. Conscientização e Cultura
7. Gestão de Código e Dependências

## Quem avalia
Apenas ADMIN pode criar e editar avaliações — ver [[RN19 - Maturidade e feita por Admin]].
Clientes e pentesters apenas visualizam resultados.

## Links relacionados
[[MaturityAssessment]]
[[MaturityDomain]]
[[MaturityControl]]
[[MaturityScore]]
[[RN19 - Maturidade e feita por Admin]]
[[Enum - AnalysisType e Level]]
[[Maturidade]]
