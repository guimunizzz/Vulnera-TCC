---
type: decisao
tags: [decision]
status: vigente
codigo: ADR-003
---

# ADR-003 - PDF gerado no cliente

## Contexto
Relatórios são parte central do produto e poderiam gerar carga extra no servidor.

## Decisão
A geração de PDF será client-side.

## Consequências
- reduz superfície de ataque e custo computacional no back-end
- simplifica operação do servidor
- exige cuidado com experiência do front-end

## Relacionado
[[Relatorios]]
[[Client-side PDF]]