---
type: decisao
tags: [decision, pendente]
status: pendente
codigo: ADR-013
data: 2026-07-26
flag: F-03
---

# ADR-013 - Dominios de maturidade em aberto

> [!note] Decisão em aberto — bloqueia apenas a Fase 8

## Contexto

O **modelo** de avaliação de maturidade está definido: domínios de segurança → controles → score de 1 a 5 por controle → agregação por domínio → exibição em radar. A referência de partida é o SAMM simplificado.

O **conteúdo** — quais domínios, quantos, e quais controles em cada um — não está fechado.

## Questão

Quais domínios e controles compõem a avaliação de maturidade?

## Exemplo ilustrativo (não é a lista final)

**Domínio: Gestão de Vulnerabilidades**

| Controle | Score 1 | Score 5 |
|---|---|---|
| Processo formal de triagem | inexistente | documentado e seguido |
| SLA por severidade | não definido | definido e medido |
| Verificação pós-remediação | não ocorre | obrigatória e auditada |

## Impacto de adiar

Bloqueia a **Fase 8** (seed de domínios, tela de avaliação, seção de maturidade no relatório executivo). Não bloqueia nenhuma fase anterior.

## Necessário para decidir

- quantos domínios (a referência anterior citava 7)
- quais domínios
- quantos controles por domínio (a referência anterior citava ~3)

## Relacionado
[[Contexto Mestre v4]]
[[Maturidade]]
[[MaturityDomain]]
[[MaturityControl]]
