---
type: estrutura-projeto
tags: [architecture, backend, nestjs]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Estrutura - API Express

## Objetivo

Definir a estrutura esperada para o back-end do Vulnera.

O back-end usa:

- Express
- TypeScript
- Prisma
- MySQL
- JWT
- Socket.IO
- validação por DTO
- arquitetura modular

## Estrutura principal

```text
apps/api/
├── src/
│   ├── modules/
│   ├── common/
│   ├── config/
│   ├── database/
│   ├── app.module.ts
│   └── main.ts
├── prisma/
├── test/
├── uploads/
├── .env
├── .env.example
├── nest-cli.json
├── tsconfig.json
├── jest.config.ts
├── package.json
└── Dockerfile
```

## `src/modules/`

A pasta `modules` contém os módulos funcionais do sistema.

Cada módulo deve concentrar:

- module
- controller
- service
- repository, quando necessário
- DTOs
- testes

## Módulos previstos

```text
modules/
├── auth/
├── users/
├── companies/
├── applications/
├── projects/
├── vulnerabilities/
├── evidences/
├── maturity/
├── reports/
├── chat/
├── support/
├── notifications/
├── subscriptions/
└── ai/
```

## Padrão de módulo

Exemplo recomendado:

```text
modules/projects/
├── projects.module.ts
├── projects.controller.ts
├── projects.service.ts
├── projects.service.spec.ts
└── dto/
    ├── create-project.dto.ts
    ├── update-project.dto.ts
    ├── assign-pentester.dto.ts
    └── update-status.dto.ts
```

## Responsabilidade das camadas

### Controller

Responsável por:

- expor rotas HTTP
- receber DTOs
- aplicar decorators
- delegar para services

Não deve conter regra de negócio pesada.

### Service

Responsável por:

- regras de negócio
- orquestração
- validações de estado
- ownership
- chamadas ao repository ou Prisma
- auditoria e notificações quando aplicável

### Repository

Responsável por:

- encapsular consultas
- evitar query complexa espalhada no service
- centralizar acesso a dados

### DTO

Responsável por:

- validar entrada
- documentar contrato de API
- proteger a borda HTTP

## `src/common/`

Contém elementos transversais:

```text
common/
├── middlewares/
├── decorators/
├── filters/
├── interceptors/
├── pipes/
└── middleware/
```

## Itens importantes

### middlewares

- `jwt-auth.middlewares.ts`
- `roles.middlewares.ts`
- `ownership.middlewares.ts`

### Decorators

- `roles.decorator.ts`
- `current-user.decorator.ts`
- `public.decorator.ts`

### Filters

- `http-exception.filter.ts`
- `prisma-exception.filter.ts`

### Interceptors

- `logging.interceptor.ts`
- `audit.interceptor.ts`
- `transform.interceptor.ts`

## `src/config/`

Centraliza configurações:

```text
config/
├── app.config.ts
├── database.config.ts
├── jwt.config.ts
├── mail.config.ts
└── storage.config.ts
```

## `src/database/`

Contém integração com Prisma:

```text
database/
└── prisma.service.ts
```

## `prisma/`

Contém:

```text
prisma/
├── schema.prisma
├── seed.ts
└── migrations/
```

## `uploads/`

Armazena evidências enviadas no MVP.

Regras:

- deve estar no `.gitignore`
- usar `.gitkeep` para preservar pasta
- validar MIME
- validar tamanho
- reescrever nome do arquivo

## Relação com o domínio

A API deve respeitar:

- [[Company]]
- [[User]]
- [[Application]]
- [[Project]]
- [[Vulnerability]]
- [[Evidence]]
- [[Subscription]]
- [[AuditLog]]

## Regras críticas

- [[RN03 - Limite de aplicacoes por plano]]
- [[RN07 - Projeto exige assinatura ativa]]
- [[RN10 - Severidade via CVSS com override justificado]]
- [[RN12 - Transicoes seguem maquina de estados]]
- [[RN16 - Cliente so ve dados da propria Company]]
- [[RN17 - Pentester so ve Projects atribuidos]]

## Segurança obrigatória

Sempre consultar:

- [[Politica de Desenvolvimento Seguro]]
- [[Checklist de Seguranca por Feature]]
- [[Padrao - Autenticacao e JWT]]
- [[Padrao - Validacao de Entradas]]
- [[Padrao - Prevencao de Injection]]
- [[Padrao - Logs e Dados Sensiveis]]
- [[Padrao - Upload Seguro]]

## Regra para o Claude

Ao gerar back-end, o Claude deve:

- criar módulos pequenos e coesos
- evitar arquitetura complexa demais
- aplicar validação em toda entrada
- manter services como centro das regras
- evitar código duplicado
- atualizar documentação quando implementar uma feature