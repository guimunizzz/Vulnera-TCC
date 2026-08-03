---
type: decisao
tags: [decision, operacao]
status: vigente
codigo: ADR-014
data: 2026-07-26
---

# ADR-014 - Escopo reduzido para prazo de 3 meses

## Contexto

O prazo do projeto foi revisado sucessivamente: **7 meses** (concepção original, [[vulnera]]) → **4 meses** → **3 meses** (revisão de 2026-07-26).

Com 3 de 9 fases concluídas, restam 6 fases para ~13 semanas.

## Decisão

Escopo cortado nos seguintes pontos, todos já refletidos em [[Fora do Escopo]]:

| Removido | Motivo |
|---|---|
| Chat em tempo real (Socket.IO) | não é diferencial para a banca; `VulnerabilityComment` cobre a necessidade de comunicação |
| Tickets de suporte | escopo administrativo sem valor de demonstração |
| E-mail transacional | `AuditLog` cobre a rastreabilidade exigida |
| Prometheus + Grafana | observabilidade não é critério de avaliação |
| Testes E2E (Playwright) | testes de integração + smoke manual cobrem o necessário |

Os models `ChatMessage` e `SupportTicket` já não existem no `schema.prisma`.

## Consequências
- roadmap recalculado para 13 semanas — ver [[Roadmap Fases]]
- notas correspondentes marcadas com `status: fora-de-escopo`, preservadas como material de "trabalho futuro" na monografia
- a redução de escopo é, ela própria, material de defesa: demonstra priorização consciente sob restrição de prazo

## Relacionado
[[Contexto Mestre v4]]
[[Fora do Escopo]]
[[Roadmap Fases]]
[[Riscos]]
