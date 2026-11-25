---
type: conceito
tags: [domain, seguranca]
status: ativo
---

# Multi-tenancy por escopo

## Definição
Modelo de isolamento de dados em que múltiplas organizações (tenants) compartilham a mesma instância da aplicação e banco de dados, mas cada uma acessa **apenas seus próprios dados**.

No Vulnera, o tenant é a `Company`. Todas as entidades operacionais (Application, Project, Vulnerability, Report, etc.) pertencem a uma Company e são invisíveis para outras Companies.

## Como o isolamento funciona no Vulnera

A API consulta a identidade persistida antes de determinar os papéis e o tenant permitido. Company, Project e demais relações do recurso prevalecem sobre valores do corpo da requisição. Convites e decisões comerciais revalidam vínculos na transação. Jobs que executam em nome de um usuário conferem sua identidade ativa e as relações do escopo ao assumir o trabalho.

A matriz desta wave registra operações, papéis e evidência de cobertura. [[ADR-058 - Adesao B2B, equipes e revogacao de sessoes]]

O isolamento é implementado em três camadas:

### 1. Guards de role
Verificam se o usuário tem a role mínima para acessar a rota.

### 2. Ownership check no service
Após autenticar, o service verifica se o recurso acessado pertence à Company do usuário:
```ts
// CLIENT só acessa projetos da própria company
if (project.application.companyId !== user.companyId) throw new NotFoundException()
```

### 3. Filtros de query no repository
Queries já incluem o filtro de Company na busca:
```ts
// Nunca retorna projetos de outra company
findMany({ where: { application: { companyId: user.companyId } } })
```

## Regras de negócio associadas
- [[RN16 - Cliente so ve dados da propria Company]]
- [[RN17 - Pentester so ve Projects atribuidos]]

## Risco principal
Vazamento cross-tenant é o erro mais grave possível no sistema — dados de um cliente visíveis para outro. Os testes canário multi-tenant protegem especificamente esse risco.

Ver: [[Testes]] (seção canários TEN-01 a TEN-08)

## Links relacionados
[[Company]]
[[Middlewares e Ownership]]
[[Regras de Ownership]]
[[RN16 - Cliente so ve dados da propria Company]]
[[RN17 - Pentester so ve Projects atribuidos]]
