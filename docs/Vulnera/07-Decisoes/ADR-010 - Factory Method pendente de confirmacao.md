---
type: decisao
tags: [decision, architecture, pendente]
status: pendente
codigo: ADR-010
data: 2026-07-26
flag: F-01
---

# ADR-010 - Factory Method pendente de confirmacao

> [!warning] Decisão em aberto — não resolver sem confirmação humana
> Esta é a pendência de maior impacto do projeto. Ver [[Contexto Mestre v4]] §Decisões pendentes.

## Contexto

O Factory Method era a decisão **D1/A1**, explicitamente marcada como *não-negociável por ser padrão avaliado pelo professor*. Cada recurso tinha uma factory (`plan.factory.ts`) responsável por montar a stack Repository → Service → Controller e devolver o controller pronto, consumida apenas pelo arquivo de rotas.

Na revisão de 2026-07-26, a cadeia de camadas foi redefinida (ver [[ADR-009 - Pastas no plural e cadeia de camadas]]) **sem incluir a camada de factory**.

Não está claro se isso foi remoção intencional ou omissão.

## Questão

O Factory Method permanece na arquitetura?

## Opções

| Opção | Consequência |
|---|---|
| **Manter** `factories/` entre services e routes | preserva o critério acadêmico; mantém o código já escrito |
| **Remover** e instanciar a stack no arquivo de rotas | menos indireção; perde o padrão avaliado |
| **Manter apenas** nos recursos já implementados | inconsistência arquitetural — pior dos dois mundos |

## Impacto de adiar

O custo de reintroduzir cresce a cada fase implementada: cada recurso novo é mais uma stack para reescrever. A Fase 3 sozinha cria três recursos (Plan, Company, Subscription).

**Recomendação: decidir antes de iniciar a Fase 3.**

## Necessário para decidir

Confirmar com o professor/orientador se o Factory Method é critério de avaliação da banca.

## Relacionado
[[Contexto Mestre v4]]
[[ADR-009 - Pastas no plural e cadeia de camadas]]
[[Back-end Express]]
