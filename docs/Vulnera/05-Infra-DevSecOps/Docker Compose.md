---
type: documentacao-tecnica
tags: [devsecops]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Docker Compose

> [!warning] Nota atualizada em 2026-09-10 — a estratégia mudou desde a v1
> O texto anterior descrevia o desenho do [[ADR-005 - Desenvolvimento local com Docker minimo]]: só infra auxiliar em container (MySQL, SonarQube, Mailhog) e o código rodando no host. **A stack completa passou a subir no compose** ([[ADR-022 - Stack completa no Docker Compose]]) e, com o módulo [[DAST]], ganhou socket do Docker e rede de nome fixo.

## Papel
Subir a stack inteira do projeto com um comando: `docker compose up -d` na raiz.

## Serviços (estado real em 2026-09-10)

| Serviço | Container | Porta no host |
|---|---|---|
| `db` | `vulnera-db` (MySQL 8) | `3307` → 3306 |
| `api` | `vulnera-api` (Express) | `3001` |
| `web` | `vulnera-web` (Vite preview) | **`8086`** → 3000 — é a porta de entrada do app |
| `mailhog` | `vulnera-mail` | `1025` (SMTP) e `8025` (UI) |

O SonarQube **não** faz parte deste compose — roda como pipeline separado ([[ADR-012 - SonarQube como pipeline separado]]).

Volumes nomeados: `vulnera-db-data`, `vulnera-api-uploads`, `vulnera-api-dast-reports`.

## O que o módulo DAST acrescentou

- **Socket do Docker montado na API** (`/var/run/docker.sock`) — é o que permite à API subir o container do ZAP (DooD). Risco assumido em [[ADR-028 - Execucao do ZAP via Docker spawn]].
- **Rede com nome fixo `vulnera-net`** — sem isso o compose geraria `vulnera-tcc_default`, que depende do nome da pasta; o nome precisa ser previsível porque a API o repassa ao `docker run --network` do ZAP (`DAST_ZAP_NETWORK`).
- **Volume `vulnera-api-dast-reports`** para os relatórios JSON/HTML de cada scan.
- **Variáveis do módulo** declaradas no serviço `api` (`DAST_MAX_CONCURRENT_SCANS`, `DAST_ZAP_MEMORY`, `DAST_ZAP_CPUS`, `DAST_SCAN_TIMEOUT_MS`, `DAST_ALLOW_PRIVATE_TARGETS`, …) — ver [[OWASP ZAP]] §"Limites operacionais".

⚠️ A imagem da API instala `docker-cli` e roda como usuário `vulnera` no GID 0, porque o socket do Docker Desktop é `root:root 0660`. Em host Linux, o correto é `group_add` com o GID do grupo `docker` — ver [[Dockerfiles]] e [[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]].

## Decisões associadas
[[ADR-005 - Desenvolvimento local com Docker minimo]] (superada no ponto da estratégia)
[[ADR-022 - Stack completa no Docker Compose]]
[[ADR-028 - Execucao do ZAP via Docker spawn]]
[[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]]