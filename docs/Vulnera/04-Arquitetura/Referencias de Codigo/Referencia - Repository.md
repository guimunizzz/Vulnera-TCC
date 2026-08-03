---
type: referencia-codigo
tags: [backend, code-style, repository]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Referencia - Repository

## Objetivo

Registrar o estilo esperado para repositories no Vulnera, usando exemplos do autor como referência de separação da persistência.

## Papel desta nota

Esta nota orienta o Claude a interpretar repositories antigos criados com TypeScript, Express e MySQL/MySQL2, adaptando o padrão para Prisma e MySQL.

## Contexto dos exemplos legados

Os exemplos antigos do autor podem conter:

- repositories com MySQL/MySQL2
- `connection.execute`
- queries SQL parametrizadas
- métodos como `findById`, `create`, `update`, `delete`
- transações com `BEGIN`, `COMMIT`, `ROLLBACK`
- separação entre service e persistência

Esses exemplos devem orientar a separação de responsabilidades, não a tecnologia final.

## Stack oficial do Vulnera

No Vulnera, repositories devem usar:

- Prisma Client
- PrismaService
- MySQL
- métodos claros
- queries encapsuladas
- retorno previsível

## Regra principal

Repositories isolam acesso a dados.

Eles não devem conter regra de negócio.

## O que pertence ao repository

- criar registros
- buscar por ID
- buscar por filtros
- contar registros
- atualizar registros
- aplicar includes/selects
- executar transações de persistência quando necessário

## O que não pertence ao repository

- validar regra de plano
- decidir status inicial com lógica complexa
- validar ownership de negócio, salvo filtro de escopo simples
- lançar regra de negócio de domínio
- enviar notificação
- registrar auditoria por decisão própria
- montar resposta HTTP

## Mapeamento MySQL/MySQL2 para Prisma

| MySQL/MySQL2 legado | Prisma no Vulnera |
|---|---|
| `connection.execute(...)` | `this.prisma.model.findMany()` |
| `SELECT * FROM tabela WHERE id = ?` | `findUnique({ where: { id } })` |
| `INSERT INTO tabela...` | `create({ data })` |
| `UPDATE tabela SET...` | `update({ where, data })` |
| `DELETE FROM tabela...` | `delete()` ou soft delete |
| `BEGIN/COMMIT/ROLLBACK` | `this.prisma.$transaction()` |
| rows brutas | objetos tipados do Prisma |
| SQL manual | Prisma Client |

## Exemplo legado do autor

Cole aqui um exemplo antigo de repository usado em projetos anteriores.

```ts
import { db } from '../database/connection.database';
import { Estoque } from '../models/estoque.model';
import { ResultSetHeader } from 'mysql2';

export class EstoqueRepository {

    /**
     * Retorna todos os registros da tabela Estoque.
     * @returns Promise com os dados de todos os estoques.
     */
    async selectTodos(): Promise<ResultSetHeader> {
        const sql = 'SELECT * FROM Estoque';
        const [rows] = await db.execute<ResultSetHeader>(sql);
        return rows;
    }

    /**
     * Retorna um registro de estoque pelo seu ID.
     * @param id - ID do estoque a ser buscado.
     * @returns Promise com os dados do estoque encontrado.
     */
    async selectById(id: number): Promise<ResultSetHeader> {
        const sql = 'SELECT * FROM Estoque WHERE id_estoque = ?';
        const values = [id];
        const [rows] = await db.execute<ResultSetHeader>(sql, values);
        return rows;
    }

    /**
     * Insere um novo registro de estoque no banco de dados.
     * @param dados - Instância de Estoque com os dados a serem inseridos.
     * @returns Promise com o resultado da operação de inserção.
     */
    async adicionarEstoque(dados: Estoque): Promise<ResultSetHeader> {
        const sql = 'INSERT INTO Estoque (id_produto, quantidade_atual) VALUES (?, ?)';
        const values = [dados.IdProduto, dados.QuantidadeAtual];
        const [rows] = await db.execute<ResultSetHeader>(sql, values);
        return rows;
    }

    /**
     * Atualiza a quantidade e a data de atualização de um registro de estoque.
     * @param id - ID do estoque a ser atualizado.
     * @param dados - Instância de Estoque com os novos dados.
     * @returns Promise com o resultado da operação de atualização.
     */
    async editarEstoque(id: number, dados: Estoque): Promise<ResultSetHeader> {
        const sql = 'UPDATE Estoque SET quantidade_atual = ?, dt_ultima_atualizacao = CURRENT_TIMESTAMP WHERE id_estoque = ?';
        const values = [dados.QuantidadeAtual, id];
        const [rows] = await db.execute<ResultSetHeader>(sql, values);
        return rows;
    }

    /**
     * Remove um registro de estoque pelo seu ID.
     * @param id - ID do estoque a ser deletado.
     * @returns Promise com o resultado da operação de exclusão.
     */
    async deletarEstoque(id: number): Promise<ResultSetHeader> {
        const sql = 'DELETE FROM Estoque WHERE id_estoque = ?';
        const values = [id];
        const [rows] = await db.execute<ResultSetHeader>(sql, values);
        return rows;
    }
}

```

## O que o Claude deve aprender com o exemplo

- separar acesso ao banco
- nomear métodos claramente
- não colocar query no controller
- não colocar query complexa no service
- isolar persistência
- manter código simples e rastreável

## O que não deve ser copiado literalmente

- MySQL2
- SQL manual simples
- conexão manual
- nomes de tabelas antigas
- regras de negócio no repository
- retorno de dados sensíveis
- queries concatenadas

## Exemplo adaptado para Prisma

```ts
@Injectable()
export class ApplicationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ApplicationUncheckedCreateInput) {
    return this.prisma.application.create({
      data,
    });
  }

  findById(id: string) {
    return this.prisma.application.findUnique({
      where: { id },
    });
  }

  findManyByCompanyId(companyId: string) {
    return this.prisma.application.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  countActiveByCompanyId(companyId: string) {
    return this.prisma.application.count({
      where: {
        companyId,
        isActive: true,
      },
    });
  }

  softDelete(id: string) {
    return this.prisma.application.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

## Exemplo de transação com Prisma

```ts
@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  createWithMembers(data: {
    project: Prisma.ProjectUncheckedCreateInput;
    pentesterIds: string[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: data.project,
      });

      if (data.pentesterIds.length > 0) {
        await tx.projectMember.createMany({
          data: data.pentesterIds.map((userId) => ({
            projectId: project.id,
            userId,
          })),
        });
      }

      return project;
    });
  }
}
```

## Padrões de nome recomendados

Usar nomes claros:

- `findById`
- `findManyByCompanyId`
- `findActiveByCompanyId`
- `countActiveByCompanyId`
- `create`
- `update`
- `softDelete`
- `findByEmail`
- `existsById`

Evitar nomes vagos:

- `getData`
- `doQuery`
- `execute`
- `handle`
- `process`

## Segurança em repositories

Repositories devem:

- usar Prisma Client
- evitar SQL manual
- não concatenar input
- usar filtros claros
- usar `select` quando precisar limitar retorno
- não retornar senha/hash por padrão
- não expor refresh token
- não retornar campos sensíveis sem necessidade

## Exemplo com `select`

```ts
findSafeUserById(id: string) {
  return this.prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      companyId: true,
      isActive: true,
    },
  });
}
```

## Quando usar SQL bruto

Evitar SQL bruto por padrão.

Só considerar `prisma.$queryRaw` quando:

- Prisma não cobrir bem o caso
- houver necessidade real de performance
- a query for parametrizada
- a decisão estiver documentada
- não houver input concatenado

## Relação com domínio

Repositories manipulam entidades como:

- [[User]]
- [[Company]]
- [[Application]]
- [[Project]]
- [[ProjectMember]]
- [[Vulnerability]]
- [[Evidence]]
- [[Subscription]]
- [[Report]]
- [[Notification]]
- [[AuditLog]]

## Relação com arquitetura

- [[Back-end Express]]
- [[ORM Prisma]]
- [[Banco de Dados MySQL]]
- [[Repositorios]]
- [[Referencia - Adaptacao para Prisma]]

## Relação com segurança

- [[Padrao - Prevencao de Injection]]
- [[Padrao - Logs e Dados Sensiveis]]
- [[Politica de Desenvolvimento Seguro]]

## Checklist para o Claude

Antes de aceitar um repository, verificar:

- [ ] usa Prisma?
- [ ] não contém regra de negócio?
- [ ] não concatena input?
- [ ] métodos têm nomes claros?
- [ ] dados sensíveis são evitados?
- [ ] queries complexas estão encapsuladas?
- [ ] service continua responsável pelas decisões?
- [ ] transações usam `$transaction` quando necessário?

## Regra final para o Claude

Usar repositories legados como referência de separação da persistência.

No Vulnera, adaptar para Prisma e MySQL, evitando SQL manual e mantendo regras de negócio nos services.

## Nota sobre a origem dos exemplos

Os exemplos de código desta nota foram escritos originalmente com **TypeScript, Express e MySQL/MySQL2 (connection.execute, SQL manual)**.

Eles representam o estilo de repository do autor: um método por operação, nomes claros, persistência isolada da regra de negócio.

**Não representam a stack do Vulnera.**

Ao implementar repositories no Vulnera, sempre adaptar para:
- `PrismaService` injetado via constructor
- Prisma Client methods no lugar de SQL manual
- `prisma.$transaction()` no lugar de `BEGIN / COMMIT / ROLLBACK`
- `select` no Prisma para evitar retorno de campos sensíveis
- sem SQL concatenado com input de usuário

Guia completo de adaptação: [[Referencia - Adaptacao para Prisma]]
