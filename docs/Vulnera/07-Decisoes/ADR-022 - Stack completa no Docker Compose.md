---
type: decisao
tags: [decision, infra, docker]
status: vigente
codigo: ADR-022
data: 2026-08-08
---

# ADR-022 - Stack completa no Docker Compose

## Contexto

O [[ADR-005 - Desenvolvimento local com Docker minimo]] estabeleceu que o Docker Compose serviria apenas para **MySQL + Mailhog**, e que API e frontend rodariam direto na máquina (`npm run dev`). A razão era prática: menos coisas para dar errado numa máquina de desenvolvimento e ciclo de feedback mais rápido, sem rebuild de imagem a cada alteração.

Na sessão de 2026-08-07 (commit `c131aef`, mensagem literal "unificando docker — não finalizado") o `docker-compose.yml` da raiz foi ampliado para incluir também os serviços `api` e `web`, com healthcheck encadeado (`web` depende de `api` saudável, que depende de `db` saudável), volume nomeado para as evidências e `VITE_API_URL` passada como build arg. O trabalho ficou funcional mas **sem ADR**.

Havia ainda um problema de numeração: o comentário no topo do `docker-compose.yml` referenciava um "ADR-021 - Stack completa no Docker Compose" que nunca foi escrito, e o número **021 foi ocupado** no mesmo dia por outra decisão ([[ADR-021 - Maquina de Vulnerability com 4 estados]]). O próprio comentário registrou a colisão e reservou o número 022 para este documento.

Uma segunda divergência apareceu na Fase 6.5: o prompt de execução instruía `cd app/api && docker compose up -d db mailhog`, mas **não existe `docker-compose.yml` em `app/api`** — o arquivo sempre esteve na raiz do repositório, que é o único lugar de onde ele enxerga os contextos de build de `app/api` e `app/web` ao mesmo tempo.

## Decisão

**O `docker-compose.yml` da raiz é o único, e descreve a stack COMPLETA:** `db` (MySQL 8), `mailhog`, `api` e `web`.

**Dois modos de uso, ambos suportados e documentados:**

| Modo | Comando | Quando usar |
|---|---|---|
| **Desenvolvimento** (padrão) | `docker compose up -d db mailhog` + `npm run dev` em cada app | Dia a dia. Hot reload no front e no back; o Docker só provê a infraestrutura. É o modo do [[ADR-005 - Desenvolvimento local com Docker minimo]], preservado. |
| **Stack completa** | `docker compose up --build` | Demonstração, validação de imagem, e prova para a banca de que o projeto sobe num comando em máquina limpa. |

**Portas e endereços:** web `:3000` · API `:3001/api` · MySQL `:3307` (host) → `3306` (container) · Mailhog `:8025`.

**Duas decisões de rede que costumam ser erradas e ficam registradas aqui:**

1. A API acessa o banco por `db:3306` (nome do serviço na rede interna do compose), **não** por `localhost:3307`. O `3307` é só o mapeamento para o host, existente porque a porta `3306` local já é usada pelo serviço Windows `MySQL80`.
2. O `VITE_API_URL` do `web` é `http://localhost:3001/api` — o endereço que o **navegador** usa, não o nome do serviço Docker. O Vite embute esse valor em *build time*, e não há como trocá-lo depois sem rebuild.

**O `ADR-021` referenciado no comentário do compose é este documento, ADR-022.** O comentário foi mantido no arquivo como registro da colisão.

## Consequências

- `docker compose up --build` sobe a stack inteira em máquina limpa. É a forma de demonstrar o projeto sem depender do ambiente Node local.
- O `.env` de `app/api` continua sendo a fonte de verdade do **modo de desenvolvimento**; no modo completo, as variáveis vêm do próprio compose. Duas fontes para a mesma configuração é uma fricção conhecida e aceita — unificá-las exigiria `env_file`, que quebraria o `DATABASE_URL` (diferente nos dois modos: `db:3306` × `localhost:3307`).
- As evidências sobrevivem a `docker compose down` graças ao volume nomeado `vulnera-api-uploads` (mas não a `down -v`).
- Um `docker-compose.yml` em `app/api` **não deve ser criado**. Se algum prompt ou documento pedir, está desatualizado — o arquivo da raiz é o único.
- O SonarQube continua fora do compose ([[ADR-012 - SonarQube como pipeline separado]]).

## Alternativa descartada

**Manter só banco e Mailhog no compose, como no ADR-005.** Descartada porque a defesa do TCC se beneficia de "o projeto inteiro sobe com um comando", e porque a imagem da API é a única prova de que o build de produção funciona. O modo de desenvolvimento não foi removido — os dois convivem.

## Relacionado
[[ADR-005 - Desenvolvimento local com Docker minimo]]
[[ADR-012 - SonarQube como pipeline separado]]
[[ADR-021 - Maquina de Vulnerability com 4 estados]]
