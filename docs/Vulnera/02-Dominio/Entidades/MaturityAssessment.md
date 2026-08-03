---
type: entidade
tags: [domain]
status: ativo
---

# MaturityAssessment

## Definição
Avaliação de maturidade de segurança associada a um Project e a uma Company.

## Papel no sistema
Consolidar score por domínios e subcontroles, permitindo leitura executiva do nível de maturidade do cliente.

## Estrutura
- múltiplos [[MaturityDomain]]
- múltiplos [[MaturityControl]]
- múltiplos [[MaturityScore]]

## Regras associadas
- [[RN19 - Maturidade e feita por Admin]]

## Observação
O score é ajustado pela quantidade e severidade de findings ativos.