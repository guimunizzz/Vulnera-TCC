---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Back-end Express

## Resumo
O back-end do Vulnera será desenvolvido em **Express com TypeScript**, seguindo uma organização inspirada no padrão estrutural que utilizo em projetos backend: separação clara entre configuração, controllers, services, repositórios, rotas, modelos e documentação auxiliar.

No contexto do Vulnera, essa estrutura será adaptada para o ecossistema **Express + Prisma + MySQL**, preservando clareza arquitetural, baixo acoplamento e facilidade de manutenção.

## Objetivo da arquitetura
A estrutura do back-end deve:
- facilitar navegação e manutenção
- separar responsabilidades por camada
- centralizar configuração e acesso a ambiente
- permitir crescimento modular
- manter coerência entre domínio, regras de negócio e implementação
- favorecer testes, auditoria e segurança

## Princípios adotados
- organização por responsabilidade
- regras de negócio concentradas em services
- persistência isolada em repositories
- configuração centralizada
- documentação técnica próxima da implementação
- uploads e integrações com tratamento específico
- estrutura simples, previsível e escalável

## Estrutura de referência

```text
app/api/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── enum/
│   │   │   └── EnvKeys.ts
│   │   └── EnvVar.ts
│   ├── database/
│   │   └── prisma.database.ts
│   ├── repositories/        # única camada que toca Prisma
│   ├── models/              # 1 arquivo por recurso (type + DTO + entity)
│   ├── services/            # regras de negócio
│   ├── controllers/         # entrada HTTP
│   ├── routes/
│   │   └── routes.ts        # centralizador — único ponto de registro
│   ├── middlewares/         # auth, require-role
│   ├── utils/               # jwt, hash, cvss
│   ├── app.ts               # cria o app Express, exporta sem listen (teste)
│   └── server.ts            # importa app e chama listen
├── tests/
│   └── integration/
├── uploads/                 # evidências: {companyId}/{vulnId}/
├── .env.example
├── package.json
└── tsconfig.json
```

> Pastas no **plural** quando contêm mais de um arquivo — ver [[ADR-009 - Pastas no plural e cadeia de camadas]].
> `config/` e `database/` ficam no singular por convenção fixa.

🚩 A pasta `factories/` não consta nesta estrutura — decisão pendente em [[ADR-010 - Factory Method pendente de confirmacao]].

## Cadeia de camadas

```
config → database → repositories → models → services → controllers → routes → server
                                                            ↕
                                                       middlewares
```

## Relacionado
[[Contexto Mestre v4]]
[[API REST]]
[[Middlewares e Ownership]]
[[DTOs e Validacao]]
[[Repositorios]]
[[Logs Estruturados]]
[[Estrutura - API Express]]
