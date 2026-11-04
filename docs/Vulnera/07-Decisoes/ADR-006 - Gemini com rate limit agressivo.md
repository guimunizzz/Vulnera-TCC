---
type: decisao
tags: [decision]
status: substituida
codigo: ADR-006
---

# ADR-006 - Gemini com rate limit agressivo

> **Histórico:** ficou sem objeto com o corte de IA do ADR-017 em 03/08/2026. O novo assistente de orientação de 23/10/2026 tem escopo e limites próprios no [[ADR-048 - Assistente contextual com Gemini e ajuda local]]; esta decisão não reativa o recurso antigo de findings.

## Contexto
A IA agrega valor, mas introduz custo, risco de abuso e dependência excessiva.

## Decisão
Gemini será assistivo, autenticado e protegido por rate limit agressivo.

## Consequências
- uso controlado
- menor custo
- evita transformar a IA em fonte autônoma e não auditável
