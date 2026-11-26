# Evidências — análises e comentários do Security Graph (ADR-061)

Capturas de 25/11/2026 na stack Docker (:8086) com o código da branch
`feat/grafo-postura` já integrada à `dev` (#83), banco com o `db:seed:all`.
Chrome a 1440×900.

| Arquivo | O que mostra | Quem |
|---|---|---|
| `01-combinacoes-toxicas.jpg` | 13 combinações; o grafo destaca as aplicações e categorias envolvidas; chips de agravante (Internet, crítica, KEV, dado restrito, produção) | CLIENT (TechNova Owner) |
| `02-raio-de-impacto-bson.jpg` | `bson@1.0.9` em 3 aplicações, 2 expostas, destacadas no grafo | CLIENT |
| `03-maquina-do-tempo.jpg` | O grafo em 17/10/2026: 28 abertas (5 a mais hoje), reconstruído do AuditLog | CLIENT |
| `04-comentario-exposure-graph.jpg` | Comentário no nó Portal E-commerce; o nó passa a anunciar "1 comentário" | CLIENT |
| `05-comentario-grafo-do-scan-dast.jpg` | Comentário no nó do alvo no CyberGraph do scan DAST | ADMIN |

Os comentários de teste foram apagados depois da captura (o apagar também foi exercitado).
