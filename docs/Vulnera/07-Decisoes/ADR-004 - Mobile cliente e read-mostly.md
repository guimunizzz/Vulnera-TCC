---
type: decisao
tags: [decision]
status: vigente
codigo: ADR-004
---

# ADR-004 - Mobile cliente e read-mostly

## Contexto
O mobile precisa existir no TCC, mas com escopo enxuto e sustentável.

## Decisão
O app mobile será focado em leitura, acompanhamento e notificações para CLIENT.

## Consequências
- reduz complexidade
- preserva valor do mobile
- evita duplicar toda a operação web em React Native

## Relacionado
[[Mobile Cliente]]