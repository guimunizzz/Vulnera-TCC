---
type: decisao
tags: [decision, architecture]
status: vigente
codigo: ADR-009
data: 2026-07-26
---

# ADR-009 - Pastas no plural e cadeia de camadas

## Contexto
A convenção anterior (registrada no `CLAUDE.md` v3, decisão D2) exigia pastas no **singular** — `service/`, `factory/`, `middleware/` — para alinhar com `controller/` e `repository/`. Na revisão de 2026-07-26 essa convenção foi reavaliada.

Além disso, a cadeia de camadas nunca havia sido escrita de forma explícita e canônica; ela era inferida do texto do `CLAUDE.md`.

## Decisão

**Pastas no plural quando contêm mais de um arquivo.**

```
src/
├── config/          # singular por convenção
├── database/        # singular por convenção
├── repositories/
├── models/
├── services/
├── controllers/
├── routes/
├── middlewares/
├── utils/
└── server.ts
```

**Cadeia de camadas canônica:**

```
config → database → repositories → models → services → controllers → routes → server
                                                            ↕
                                                       middlewares
```

A nomenclatura de **arquivos** permanece `kebab.role.ts` (D3 mantida).

## Consequências
- inverte a decisão D2 — todo import de pasta refatorada precisa ser atualizado
- `config/` e `database/` ficam no singular por convenção fixa, independente da contagem de arquivos, para evitar renomeações em cascata quando um segundo arquivo é adicionado
- o Factory Method não aparece na cadeia — ver [[ADR-010 - Factory Method pendente de confirmacao]]

## Substitui
Decisão D2 do `DECISIONS.md` (pastas no singular), de 2026-06-10.

## Relacionado
[[Contexto Mestre v4]]
[[Back-end Express]]
[[Estrutura - API Express]]
[[Guia de Estilo de Codigo]]
