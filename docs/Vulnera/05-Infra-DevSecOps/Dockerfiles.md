---
type: documentacao-tecnica
tags: [devsecops, infra]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Dockerfiles

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

## Considerações de segurança
- sem variáveis de ambiente sensíveis no Dockerfile — tudo via `ENV` em runtime ou `.env` injetado no `docker run`
- imagem base `node:20-alpine` — menor superfície de ataque que `node:20`
- usuário não-root previne escalada de privilégio dentro do container

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
[[MOC - Arquitetura]]
