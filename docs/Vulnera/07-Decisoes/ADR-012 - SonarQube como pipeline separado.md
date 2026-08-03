---
type: decisao
tags: [decision, devsecops]
status: vigente
codigo: ADR-012
data: 2026-07-26
---

# ADR-012 - SonarQube como pipeline separado

## Contexto

O SonarQube estava declarado como serviço no `docker-compose.yml`, junto de MySQL e Mailhog. O container consome recursos significativos de memória no ambiente de desenvolvimento local, sem que a análise estática precise rodar a cada `docker compose up`.

## Decisão

**O SonarQube sai do Docker Compose e passa a rodar como pipeline independente no GitHub Actions.**

Composição resultante:

| Ambiente | Conteúdo |
|---|---|
| `docker-compose.yml` | MySQL 8 + Mailhog |
| GitHub Actions — pipeline principal | lint → build → test (com serviço MySQL) |
| GitHub Actions — pipeline Sonar | análise estática independente |

## Consequências
- ambiente local mais leve
- análise estática automatizada em vez de execução manual
- evidência para a banca gerada pelo CI, não por captura de tela local
- ajusta [[ADR-007 - Sonar informativo e ZAP manual]]: o Sonar deixa de ser manual; o ZAP permanece manual

## Relacionado
[[Contexto Mestre v4]]
[[SonarQube]]
[[Docker Compose]]
[[GitHub Actions CI]]
[[ADR-007 - Sonar informativo e ZAP manual]]
