---
type: decisao
tags: [decision, escopo]
status: vigente
codigo: ADR-017
data: 2026-08-03
---

# ADR-017 - IA cortada do escopo do MVP

## Contexto

A integração com Gemini 1.5 Flash (sugestão assistida de finding) estava planejada para a Fase 7, com rate limit de 10 requisições por hora e flag `aiAssisted` nos findings gerados. O provedor estava sob revisão em [[ADR-011 - Provedor de IA em revisao]] (flag F-02).

Com o prazo consolidado em 25/10/2026 e 12 semanas restantes para 6 fases, o escopo foi reavaliado.

## Decisão

**A integração de IA sai inteiramente do escopo do MVP.** A flag F-02 fica encerrada por remoção, não por escolha de provedor.

Removidos:

- `utils/gemini.util.ts` e a dependência `@google/generative-ai`
- endpoint `POST /api/ai/suggest-finding` e sua camada de service/controller
- rate limit in-memory por usuário
- botão "Sugerir com IA" no editor de finding
- variável de ambiente `GEMINI_API_KEY`

Mantido: o campo `aiAssisted` no model `Vulnerability`. Fica sempre `false`, sem custo, e preserva o schema caso o recurso volte depois do TCC.

## Justificativa

- não é critério de avaliação da banca — o que ela avalia é a arquitetura, o isolamento multi-tenant e o ciclo de análise
- libera a Fase 7 inteira para o mobile, que tem valor de demonstração maior
- elimina dependência de API externa e de quota durante os ensaios da apresentação
- reduz superfície de falha no dia da defesa

## Consequências

- a Fase 7 passa a ser apenas mobile + push, e encolhe de ~40h para ~24h
- [[ADR-006 - Gemini com rate limit agressivo]] fica sem objeto — marcar como substituída
- [[ADR-011 - Provedor de IA em revisao]] fica encerrada
- [[Fluxo - Uso da IA]] e [[IA Gemini]] passam a `status: fora-de-escopo`
- entra no README como trabalho futuro

## Relacionado

[[Contexto Mestre v4]] · [[ADR-011 - Provedor de IA em revisao]] · [[ADR-006 - Gemini com rate limit agressivo]] · [[Fora do Escopo]] · [[Roadmap Fases]]
