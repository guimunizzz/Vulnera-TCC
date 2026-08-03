---
type: decisao
tags: [decision, architecture]
status: vigente
codigo: ADR-019
data: 2026-08-03
---

# ADR-019 - Factory Method confirmado

## Contexto

O [[ADR-010 - Factory Method pendente de confirmacao]] deixou em aberto (flag F-01) se o Factory Method permanecia na arquitetura, porque a cadeia de camadas redefinida em [[ADR-009 - Pastas no plural e cadeia de camadas]] não o incluía. Havia dúvida se a omissão era intencional.

Uma auditoria da árvore real do repositório em 2026-08-03 mostrou que o padrão **está implementado e em uso**: existem factories para `auth`, `company`, `plan` e `user`, cada uma montando Repository → Service → Controller e consumida apenas pelo arquivo de rotas do recurso.

O `CLAUDE.md` na raiz também é explícito: o Factory Method é padrão avaliado pelo professor, e PR sem factory é rejeitada.

## Decisão

**O Factory Method permanece.** A camada `factories/` é parte da arquitetura e todo recurso novo precisa da sua.

Cadeia de camadas corrigida:

```
config → database → repositories → models → services → controllers → factories → routes → server
                                                                         ↕
                                                                    middlewares
```

Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller()`, consumida **apenas** pelo arquivo de rotas do recurso. Cabeçalho pedagógico comentado em PT-BR é obrigatório — a banca lê.

Isso encerra a flag **F-01**.

## Justificativa

- é critério explícito de avaliação acadêmica
- já está implementado em quatro recursos; remover seria trabalho para perder nota
- centraliza a árvore de dependências e permite factory-irmã de teste com mock

## Consequências

- `factories/` entra formalmente na cadeia de camadas do [[Contexto Mestre v4]]
- o checklist de novo CRUD do `CLAUDE.md` mantém o passo da factory
- [[ADR-010 - Factory Method pendente de confirmacao]] fica encerrada

## Relacionado

[[Contexto Mestre v4]] · [[ADR-010 - Factory Method pendente de confirmacao]] · [[ADR-009 - Pastas no plural e cadeia de camadas]] · [[Back-end Express]]
