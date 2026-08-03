---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Repositorios

## Resumo
A camada de repositórios encapsula o acesso a dados e isola a persistência das regras de negócio. No Vulnera, os repositórios são wrappers sobre o Prisma Client — centralizando queries complexas e reduzindo o acoplamento direto entre o Service e o ORM.

## Papel na arquitetura
- único ponto de acesso ao Prisma dentro de um módulo
- abstrai queries complexas (filtros por escopo, joins, paginação)
- facilita testes unitários de Service (o repository pode ser mockado)
- preserva organização modular — cada módulo tem seu próprio repository

## Posição no fluxo
```
Controller → Service (regra de negócio) → Repository → PrismaService → MySQL
```

O Service **nunca** chama o PrismaService diretamente — passa sempre pelo Repository.

## Estrutura recomendada

```
src/
├── projects/
│   ├── projects.repository.ts
│   ├── projects.service.ts
│   └── projects.controller.ts
├── vulnerabilities/
│   ├── vulnerabilities.repository.ts
│   └── ...
```

## Exemplo de implementação

```ts
@Injectable()
export class ProjectsRepository {
  constructor(private prisma: PrismaService) {}

  async findByCompany(companyId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { application: { companyId } },
      include: { application: true, members: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findByMember(userId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: { application: true },
    })
  }

  async findById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({ where: { id } })
  }
}
```

## Módulos com repositório dedicado

| Módulo | Repository |
|---|---|
| Auth | `auth.repository.ts` — busca por email, refresh tokens, reset tokens |
| Companies | `companies.repository.ts` — CRUD de empresas |
| Applications | `applications.repository.ts` — com filtro por company |
| Projects | `projects.repository.ts` — com filtro por company ou por membro |
| Vulnerabilities | `vulnerabilities.repository.ts` — com filtro por project |
| Reports | `reports.repository.ts` — metadados de relatórios |
| Notifications | `notifications.repository.ts` — com filtro por user |
| Maturity | `maturity.repository.ts` — assessments, domains, controls, scores |

## Regras de camada
- **repository não contém regra de negócio** — apenas queries e persistência
- **service não espalha queries Prisma complexas** — delega ao repository
- **repository devolve dados coerentes ao caso de uso** — pode projetar campos via `select`
- **filtros de ownership são aplicados no repository** quando derivam de condições de banco (ex: `WHERE company_id = ?`)

## Considerações de segurança
- filtros de escopo (company, project) devem ser aplicados no repository — nunca confiar que o Service já filtrou
- ao retornar dados, usar `select` explícito quando o caso de uso não precisa de todos os campos — evita expor `passwordHash` ou `tokenHash` acidentalmente

## Links relacionados
[[ORM Prisma]]
[[Back-end Express]]
[[Middlewares e Ownership]]
[[API REST]]
[[Banco de Dados MySQL]]
[[MOC - Arquitetura]]
