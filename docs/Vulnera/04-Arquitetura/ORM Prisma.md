---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# ORM Prisma

## Resumo
Prisma é o ORM utilizado no back-end do Vulnera para modelagem de schema, geração de migrations e acesso tipado ao MySQL. Substitui SQL manual e fornece segurança de tipos em tempo de compilação.

## Papel na arquitetura
- define o schema centralizado do banco em `prisma/schema.prisma`
- gera o Prisma Client — API type-safe para acesso ao banco
- gerencia o histórico de migrations em `prisma/migrations/`
- é consumido exclusivamente pela camada `repository`

## Estrutura de arquivos

```
apps/api/
└── prisma/
    ├── schema.prisma       # schema do banco (fonte de verdade)
    ├── migrations/         # histórico de migrations
    │   └── 20240101_init/
    │       └── migration.sql
    └── seed.ts             # seed inicial (Plans, MaturityDomains)
```

## Comandos principais

| Comando | Uso |
|---|---|
| `npx prisma migrate dev` | Cria migration a partir de mudanças no schema (dev) |
| `npx prisma migrate deploy` | Aplica migrations pendentes (CI/prod) |
| `npx prisma generate` | Regenera o Prisma Client após mudança no schema |
| `npx prisma db seed` | Executa o seed inicial |
| `npx prisma studio` | Interface visual do banco (dev) |

## Convenções do schema

```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  passwordHash String
  name        String
  role        Role
  companyRole CompanyRole?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company     Company? @relation(fields: [companyId], references: [id])
  companyId   String?
}

enum Role {
  ADMIN
  PENTESTER
  CLIENT
}
```

Padrões:
- nomes de campos em `camelCase` no schema Prisma (mapeado para `snake_case` no banco via `@map`)
- PKs sempre UUID
- timestamps `createdAt` / `updatedAt` em todas as entidades principais
- enums centralizados no schema

## Seed inicial
O seed popula dados de catálogo que não mudam com o projeto:
- `Plans`: BASIC, PRO, Enterprise com limites configurados
- `MaturityDomain` e `MaturityControl`: catálogo base de avaliação de maturidade

```ts
// prisma/seed.ts
await prisma.plan.createMany({ data: plans, skipDuplicates: true })
await prisma.maturityDomain.createMany({ data: domains, skipDuplicates: true })
```

## Integração com a camada repository
O Prisma Client é injetado via Express DI em um `PrismaService`:

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect()
  }
}
```

Cada `repository` injeta o `PrismaService` — nunca o usa diretamente no `service`.

## Considerações de segurança
- Prisma gera queries parametrizadas por padrão — imune a SQL injection
- nunca construir queries com template strings e valores de usuário
- `$queryRaw` e `$executeRaw` devem ser evitados; se necessário, usar `Prisma.sql` tagged template
- não expor o Prisma Client diretamente fora da camada repository

## Riscos e cuidados
- migrations sem rollback: o Prisma Migrate não tem `down migrations` automáticas — planejar mudanças de schema com cuidado
- alterações em enums no MySQL via Prisma requerem atenção — criar novo enum e migrar dados é mais seguro que renomear
- `prisma generate` deve ser executado após qualquer mudança no schema antes de compilar o projeto

## Links relacionados
[[Banco de Dados MySQL]]
[[Repositorios]]
[[Back-end Express]]
[[MOC - Arquitetura]]
