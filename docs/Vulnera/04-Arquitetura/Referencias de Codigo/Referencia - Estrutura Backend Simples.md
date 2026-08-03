---
type: referencia-codigo
tags: [architecture, code-style, backend]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Referencia - Estrutura Backend Simples

## Objetivo
Registrar a estrutura backend simples usada como inspiração pelo autor do projeto.

## Estrutura de referência

```text
docs/
├── atividade.md
├── db.sql
├── insomnia.json
├── testes.md
└── diagram.md

src/
├── config/
│   ├── enum/
│   │   └── EnvKey.ts
│   ├── EnvVar.ts
│   └── produto.multer.ts
├── controllers/
├── database/
├── middleware/
├── models/
├── repository/
├── routes/
├── services/
└── server.ts

uploads/
└── images/

.gitignore
package.json
tsconfig.json

## Contexto dos exemplos

Esta estrutura foi criada originalmente com **TypeScript, Express e MySQL/MySQL2**.

Ela representa o estilo de organização do autor: separação clara de responsabilidades, pastas por tipo de camada, configuração centralizada.

**Não representa a stack do Vulnera.**

## Stack usada nos exemplos

- TypeScript
- Express
- MySQL / MySQL2
- rotas manuais (`routes/`)
- middlewares Express (`middleware/`)
- conexão manual com banco (`database/`)
- models como classes TypeScript (`models/`)
- enum de chaves de ambiente (`config/enum/EnvKey.ts`)
- variáveis de ambiente centralizadas (`config/EnvVar.ts`)

## Stack oficial do Vulnera

- Express
- Prisma
- MySQL
- arquitetura modular por domínio

## Mapeamento para Express

| Pasta legada (Express) | Equivalente no Vulnera (Express) |
|---|---|
| `server.ts` | `main.ts` + `AppModule` |
| `routes/` | controllers + modules Express |
| `controllers/` | `*.controller.ts` com decorators |
| `services/` | `*.service.ts` com `@Injectable()` |
| `repository/` | `*.repository.ts` com PrismaService |
| `models/` | DTOs + schema Prisma |
| `middleware/` | middlewares, Pipes, Interceptors, Filters |
| `database/` | `PrismaService` |
| `config/EnvVar.ts` | `ConfigModule` + `ConfigService` |
| `config/EnvKey.ts` | enum de chaves (pode ser mantido) |
| `config/produto.multer.ts` | `MulterModule` registrado no módulo |
| `uploads/` | `uploads/` (mantido, com validação segura) |
| `docs/` | `docs/` (mantido) |

## Estrutura equivalente no Vulnera

```text
apps/api/src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   ├── users/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.repository.ts
│   │   ├── users.module.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   └── ...
├── common/
│   ├── middlewares/
│   ├── decorators/
│   ├── filters/
│   └── interceptors/
├── config/
│   └── (ConfigModule global)
├── prisma/
│   └── prisma.service.ts
└── main.ts
```

## O que preservar do estilo original

- um arquivo por camada por recurso
- nome claro por responsabilidade
- configuração separada de lógica
- documentação próxima do código
- uploads em pasta dedicada

## O que adaptar

- rotas manuais → controllers Express
- conexão manual → PrismaService
- middlewares Express → middlewares/Pipes/Interceptors
- models simples → DTOs + Prisma schema

## Relação com outras notas

- [[Guia de Estilo de Codigo]]
- [[Referencia - Adaptacao para Prisma]]
- [[Back-end Express]]
- [[Estrutura - API Express]]
- [[Regras para o Claude ao Gerar Codigo]]
