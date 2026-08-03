---
type: decisao
tags: [decision, pendente]
status: pendente
codigo: ADR-011
data: 2026-07-26
flag: F-02
---

# ADR-011 - Provedor de IA em revisao

> [!note] Decisão em aberto — impacto baixo
> Gemini 1.5 Flash permanece como padrão até decisão contrária.

## Contexto

O Gemini 1.5 Flash foi escolhido por ter free tier suficiente para o escopo do TCC. Na revisão de 2026-07-26 optou-se por manter a escolha, mas deixá-la explicitamente aberta para reavaliação.

## Questão

O provedor de IA continua sendo o Gemini?

## Impacto de adiar

**Baixo**, desde que decidido antes da Fase 7. O código isola o provedor em um único util (`utils/gemini.util.ts`), então a troca fica contida a um arquivo mais a variável de ambiente.

## Necessário para decidir

- avaliar free tier e custo no momento da Fase 7
- validar qualidade de saída estruturada em JSON (o endpoint depende de resposta parseável)

## Mantido enquanto pendente
- rate limit de 10 requisições/hora por usuário — [[ADR-006 - Gemini com rate limit agressivo]]
- flag `aiAssisted` em todo finding preenchido por IA

## Relacionado
[[Contexto Mestre v4]]
[[IA Gemini]]
[[Integracao Gemini]]
