---
type: decisao
tags: [decision, architecture]
status: vigente
codigo: ADR-015
data: 2026-07-26
---

# ADR-015 - MySQL definitivo

## Contexto

O [[ADR-008 - MySQL temporario com migracao planejada para PostgreSQL]] tratava o MySQL como escolha provisória, com migração para PostgreSQL planejada. A concepção original do projeto ([[vulnera]]) previa PostgreSQL 16.

Com a redução do prazo para 3 meses ([[ADR-014 - Escopo reduzido para prazo de 3 meses]]), essa migração foi reavaliada.

## Decisão

**MySQL 8 é o banco definitivo do projeto.** A migração para PostgreSQL está cancelada.

## Justificativa

- migrar de banco no meio do desenvolvimento não é critério de avaliação da banca
- o tempo consumido sairia do núcleo do produto (Fases 4 e 5), que é o que a banca efetivamente avalia
- o Prisma abstrai o dialeto: trocar de banco depois do TCC continua sendo uma alteração de uma linha no `datasource` mais regeneração de migrations
- o ambiente local, o CI e as migrations já estão estáveis em MySQL

## Consequências

- toda referência a PostgreSQL no vault passa a ser histórica
- a nota [[Banco de Dados MySQL]] é a canônica
- caso o projeto continue após o TCC, a migração volta a ser avaliada — registrar como "trabalho futuro" na monografia

## Substitui
[[ADR-008 - MySQL temporario com migracao planejada para PostgreSQL]]

## Relacionado
[[Contexto Mestre v4]]
[[Banco de Dados MySQL]]
[[ORM Prisma]]
