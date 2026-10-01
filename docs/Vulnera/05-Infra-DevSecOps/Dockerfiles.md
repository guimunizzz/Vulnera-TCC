---
type: documentacao-tecnica
tags: [devsecops, infra]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Dockerfiles

> [!warning] Atualizada em 2026-09-10 — os exemplos abaixo são de referência, não cópias do repositório
> Os blocos de código desta nota vêm do desenho original (era NestJS: `nest-cli.json`, `dist/main.js`, `npm ci`, `node:20-alpine`). O Dockerfile real da API hoje é **imagem única** sobre `node:22-alpine`, com `npm install` (sem lockfile, limitação registrada no [[ADR-022 - Stack completa no Docker Compose]]) e três acréscimos do módulo [[DAST]] — ver a seção "O que o módulo DAST acrescentou". Ao mexer em build, **o arquivo real manda**: `app/api/Dockerfile` e `app/web/Dockerfile`.

## Objetivo
Garantir que o projeto seja **construível** em ambiente controlado e que o build passe no CI. Os Dockerfiles do Vulnera não são usados no desenvolvimento do dia a dia — apenas validam que o código compila corretamente e serve como artefato de entrega.

## Papel no projeto
- validação de build em cada PR para `main` (via GitHub Actions CI)
- base para eventual deploy em ambiente de demonstração
- evidência de boa prática para a banca do TCC

## Simplificações do TCC
Os Dockerfiles são intencionalmente simples:
- sem multi-stage build complexo
- sem Nginx no container
- sem secrets management avançado
- sem configuração de produção real (SSL termination, scaling)

Isso é uma decisão documentada em [[ADR-005 - Desenvolvimento local com Docker minimo]].

## Dockerfiles do projeto

### `apps/api/Dockerfile` — Express

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Manifests primeiro para aproveitar cache de layer
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Só o necessário para build (sem arquivos de teste, docs, etc.)
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# Usuário não-root — boa prática de segurança
RUN addgroup -S vulnera && adduser -S vulnera -G vulnera
RUN chown -R vulnera:vulnera /app
USER vulnera

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### `apps/web/Dockerfile` — React + Vite

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY next.config.* tsconfig.json ./
COPY app ./app
COPY components ./components
COPY lib ./lib
COPY public ./public

RUN npm run build

RUN addgroup -S vulnera && adduser -S vulnera -G vulnera
RUN chown -R vulnera:vulnera /app
USER vulnera

EXPOSE 3001
CMD ["npm", "start"]
```

> O app mobile (Expo) não possui Dockerfile — Expo não é adequado para containerização e sempre roda localmente.

## Onde os Dockerfiles são usados

```
GitHub Actions CI
  └── job: docker-build
        ├── docker build -f apps/api/Dockerfile apps/api
        └── docker build -f apps/web/Dockerfile apps/web
```

O job falha se o build quebrar — impedindo merge de código que não compila.

## Boas práticas aplicadas

| Prática | Aplicação |
|---|---|
| Sem `COPY .` cru | Copia apenas arquivos necessários — evita vazar `.env`, `node_modules` desnecessários |
| `npm ci` em vez de `npm install` | Instalação determinística baseada no `package-lock.json` |
| Cache de layer | `COPY package*.json` antes do código — se deps não mudam, layer é reutilizado |
| Usuário não-root | `addgroup/adduser` antes do `CMD` — container não roda como root |
| `prisma generate` no build | Garante que o Prisma Client está compilado no artefato |

## O que o módulo DAST acrescentou (2026-09-09)

| Mudança | Motivo |
|---|---|
| `apk add --no-cache … docker-cli` | O runner chama `execFile("docker", …)`. Sem o **cliente** dentro da imagem, o `docker run` do ZAP falha com `ENOENT` e **todo** scan cai no fallback simulado. Quem executa os containers continua sendo o daemon do host, alcançado pelo socket montado (DooD) |
| `RUN npm install -g npm@11` | O npm 10.9.8 que vem no `node:22-alpine` tem bug conhecido no Arborist (`Cannot read properties of null (reading 'edgesOut')`) que quebra `npm install` sem lockfile — o que estes Dockerfiles fazem. Sem tocar em lockfile nem usar `--legacy-peer-deps` |
| `addgroup vulnera root` (GID 0) | ⚠️ No Docker Desktop o socket montado é `srw-rw---- root root`; sem GID 0 o processo leva `permission denied` e o scan volta pro simulado. É menos invasivo que rodar o container inteiro como root, **mas não é gratuito: quem fala com o socket do Docker controla o daemon do host** ([[ADR-028 - Execucao do ZAP via Docker spawn]], [[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]]) |
| `mkdir -p uploads dast-reports` | Diretórios de evidências e de relatórios de scan, com dono correto |

📌 **Em host Linux**, o socket costuma ser `root:docker` (GID 999/998) — nesse caso o certo é `group_add` no compose com o GID local, e não o GID 0 usado aqui.

---

## Considerações de segurança
- sem variáveis de ambiente sensíveis no Dockerfile — tudo via `ENV` em runtime ou `.env` injetado no `docker run`
- imagem base `node:20-alpine` — menor superfície de ataque que `node:20`
- usuário não-root previne escalada de privilégio dentro do container
- ⚠️ **exceção consciente:** na imagem da API o usuário está no GID 0 para alcançar o socket do Docker — o maior risco aceito do projeto, documentado nas ADRs 028 e 031

## Riscos e cuidados
- se o `prisma generate` falhar no build (schema com erro), o CI quebra — isso é intencional e desejável
- o Dockerfile não inclui migrations (`prisma migrate deploy`) — isso é responsabilidade do processo de inicialização da aplicação, não do build

## Links relacionados
[[Docker Compose]]
[[GitHub Actions CI]]
[[Back-end Express]]
[[Front-end Web React]]
[[ORM Prisma]]
[[ADR-005 - Desenvolvimento local com Docker minimo]]
[[ADR-022 - Stack completa no Docker Compose]]
[[ADR-031 - ZAP em modo daemon por scan e DooD na stack Docker]]
[[DAST]]
[[MOC - Arquitetura]]
