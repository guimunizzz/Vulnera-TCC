---
type: decisao
tags: [decision, source-of-truth, substituida]
status: substituida
codigo: ADR-008
data: 2026-05-18
---

> [!warning] Decisão substituída em 2026-07-26
> **O MySQL deixou de ser temporário — passou a ser a escolha definitiva do projeto.** A migração planejada para PostgreSQL foi cancelada.
>
> Motivo: com o prazo reduzido para 3 meses, migrar de banco no meio do desenvolvimento não agrega valor de avaliação e consome tempo do núcleo do produto. O Prisma mantém a troca barata caso o projeto continue após o TCC.
>
> Nota mantida como registro histórico. Ver [[Contexto Mestre v4]] e [[ADR-015 - MySQL definitivo]].

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# ADR-008 - MySQL temporario com migracao planejada para MySQL

## Contexto

A documentação canônica do Vulnera ([[Banco de Dados MySQL]], [[ORM Prisma]], [[ADR-005 - Desenvolvimento local com Docker minimo]]) define **MySQL** como o banco oficial do projeto. O `docker-compose.yml` em `infra/` provisiona o MySQL como serviço auxiliar do ambiente de desenvolvimento.

Na sessão 16 (Onda 2: autenticação + usuários + empresas), a máquina de desenvolvimento atual estava sem:

- Docker Desktop / Docker Engine instalado
- MySQL nativo
- MySQL/MariaDB nativo

A escolha era:

- **Esperar a infraestrutura**: bloquear a implementação até o ambiente ficar pronto
- **Implementar contra MySQL mesmo sem rodar**: arriscar code drift e usar features que depois não funcionam
- **Implementar contra MySQL temporariamente**: usar o ORM como abstração e escrever código portável

O Prisma suporta MySQL e MySQL com a mesma API de cliente. As diferenças relevantes para nossa modelagem atual são:

- enums nativos: MySQL tem; MySQL emula via `ENUM(...)` da DDL
- `@db.Uuid` e `gen_random_uuid()`: específicos do MySQL
- tipo `Decimal`: ambos suportam
- `Boolean`, `DateTime`, `String`: ambos suportam de forma equivalente

Como nossos "enums" do domínio já são pequenos conjuntos (`ADMIN | PENTESTER | CLIENT`, `OWNER | MEMBER`, `PENDING_APPROVAL | ACTIVE | ...`), eles podem ser representados como `String` e validados em camada TypeScript/`class-validator` sem perda funcional.

## Decisão

**Usar MySQL como banco temporário durante a Onda 2.** O `provider` em `apps/api/prisma/schema.prisma` foi setado para `"mysql"` e o `DATABASE_URL` em `.env.example` aponta para uma instância MySQL local.

**A migração para MySQL é mandatória antes da entrega do TCC** e ficou descrita como mudança trivial:

1. trocar `provider = "mysql"` por `provider = "postgresql"` em `schema.prisma`
2. ajustar `DATABASE_URL` em `.env`
3. rodar `npx prisma migrate dev` em ambiente limpo

Para que esse passo seja realmente trivial, **nenhuma feature exclusiva do MySQL é usada no código atual**:

- ❌ não usar `@db.Uuid`
- ❌ não usar `gen_random_uuid()`
- ❌ não usar `enum` nativo do Prisma (que vira `ENUM` no MySQL e `ENUM` no MySQL — funcionariam em ambos, mas decidimos uniformizar como String)
- ❌ não usar `JSONB` (`Json` do Prisma) — quando precisarmos de JSON, será via `Json` simples ou `String` serializada
- ❌ não usar arrays nativos do MySQL

PKs são `cuid()` (string) — funciona idêntico em ambos os bancos.

## Alternativas consideradas

### Alternativa A: Bloquear a Onda 2 até ter MySQL rodando
- **Prós**: zero divergência com a documentação canônica; nenhuma migração futura
- **Contras**: bloqueio total de progresso enquanto o ambiente não fica pronto; perde-se tempo de TCC

### Alternativa B: Implementar contra MySQL no schema mesmo sem rodar
- **Prós**: nenhuma migração futura
- **Contras**: código nunca exercitado; risco de descobrir bugs apenas quando o ambiente ficar pronto; ainda assim, o seed e migrations não poderiam ser testados

### Alternativa C (adotada): MySQL temporário + portabilidade no código
- código exercitado num banco real (qualquer MySQL/MariaDB de desenvolvimento é trivial de subir)
- migração final para MySQL é uma troca de uma linha no schema + nova migration
- mantém-se a velocidade da Onda 2

### Alternativa D: SQLite temporário
- **Prós**: zero infraestrutura
- **Contras**: comportamento bem diferente de MySQL/MySQL em índices, transações, tipos; encoraja códigos que quebram em produção

## Consequências positivas

- Onda 2 implementada sem aguardar infraestrutura
- O código gerado é portável: nenhum import específico do dialeto, nenhuma `Prisma.sql` "raw" amarrada ao MySQL
- A camada de domínio fica menos acoplada ao banco — `String` + validação em TypeScript é mais explícito que ENUM nativo e mais fácil de evoluir
- A migração de retorno ao MySQL é uma operação documentada e mecânica

## Trade-offs e limitações

- **Discrepância com documentação canônica**: enquanto o ADR estiver vigente, `Banco de Dados MySQL` e o `provider` real divergem. Resolução: pinned via este ADR + comentário no `schema.prisma`.
- **Migration history**: as migrations geradas contra MySQL **não devem ser commitadas** para a branch principal. Quando voltarmos ao MySQL, regeraremos a migration inicial (`init`). Por isso `prisma/migrations/` continua vazia no repo.
- **Tipos sutis**: `Decimal(10, 2)` se comporta levemente diferente em MySQL e MySQL. Aceito para o MVP.
- **Recursos não usados**: não podemos aproveitar índices `GIN`, JSONB, full-text MySQL, etc., até a migração. Nenhum desses recursos é necessário para a Onda 2.
- **Performance**: irrelevante no contexto acadêmico do TCC.

## Impacto no sistema

| Área | Impacto |
|---|---|
| `schema.prisma` | `provider = "mysql"` (temporário) |
| `.env.example` | `DATABASE_URL` com prefixo `mysql://...` |
| `infra/docker-compose.yml` | continua com MySQL — quando o ambiente for atualizado, voltamos a usar o compose |
| Migrations versionadas | suspensas até a migração final para MySQL |
| Documentação | este ADR + nota em `Banco de Dados MySQL` |
| Código de aplicação | nenhum acoplamento — usa Prisma Client normalmente |

## Critérios para reverter a decisão (voltar a MySQL)

Reverter assim que **qualquer** dos seguintes for verdade:

- Docker Desktop está instalado e funcional na máquina de desenvolvimento principal
- MySQL está disponível nativamente (instalação local funcional)
- Vamos começar a Onda 3 (CRUD de Plans e Subscriptions com fluxo de aprovação) — esta onda merece a base "definitiva"

Procedimento de reversão (estimado em < 30 min):

1. confirmar que o repo não tem migrations commitadas em `prisma/migrations/`
2. trocar `provider = "mysql"` por `"postgresql"` em `schema.prisma`
3. trocar `DATABASE_URL` em `.env` local
4. `rm -rf node_modules/.prisma` (cache do client)
5. `npx prisma migrate dev --name init` em ambiente limpo
6. `npx prisma db seed` (com hash bcrypt real)
7. rodar fluxo de login para validar
8. atualizar este ADR para `status: revertido` e logar no changelog

## Links relacionados
[[Banco de Dados MySQL]]
[[ORM Prisma]]
[[ADR-005 - Desenvolvimento local com Docker minimo]]
[[Changelog do Projeto]]
[[Tarefas Abertas]]
[[MOC - Arquitetura]]
