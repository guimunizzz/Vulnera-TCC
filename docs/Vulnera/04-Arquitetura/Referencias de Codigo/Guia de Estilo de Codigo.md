---
type: guia-codigo
tags: [architecture, code-style]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Guia de Estilo de Codigo

## Objetivo
Registrar exemplos e preferências de estilo de código usados pelo autor do projeto, para orientar o Claude na implementação do Vulnera.

## Papel desta nota
Esta nota não define regras de negócio.
Ela define preferências de implementação, simplicidade e organização.

## Princípios de estilo

### 1. Código simples e legível
Preferir código direto, fácil de explicar na banca e sustentável para equipe pequena.

Evitar:
- abstrações excessivas
- patterns complexos sem necessidade
- arquitetura enterprise desproporcional
- excesso de camadas sem ganho claro

### 2. Separação clara de responsabilidades
Manter a separação entre:
- controller
- service
- repository
- model
- config
- middleware
- routes
- lib

No Vulnera com Express, isso deve ser adaptado para:
- controller
- service
- repository
- dto
- module
- config
- common

### 3. Regras de negócio no service
Controllers devem ser finos.
Repositories devem acessar dados.
Services devem conter as regras e orquestrações.

### 4. Código didático
Como o Vulnera é um TCC, o código deve ser:
- compreensível
- explicável
- organizado
- não excessivamente abstrato
- alinhado à documentação

### 5. Segurança sem exagero de complexidade
Aplicar boas práticas de segurança, mas sem transformar o projeto em uma arquitetura pesada demais.

## Referências legadas do autor

Algumas referências de código usadas neste vault foram criadas originalmente com:

- TypeScript
- Express
- MySQL / MySQL2
- estrutura controller → service → repository
- rotas manuais
- middlewares Express
- conexão manual com banco

Esses exemplos representam o estilo de implementação do autor, principalmente:

- simplicidade
- separação clara de responsabilidades
- nomes diretos
- organização em camadas
- services concentrando regras
- repositories concentrando persistência
- controllers finos
- configuração centralizada
- tratamento explícito de erros

## Regra de adaptação para o Vulnera

No Vulnera, a stack oficial é diferente:

- Express no lugar de Express
- Prisma no lugar de MySQL2 manual
- MySQL no lugar de MySQL
- módulos Express no lugar de rotas manuais
- DTOs, middlewares, Pipes e Interceptors no lugar de parte dos middlewares manuais

Portanto, o Claude deve usar os exemplos como referência de estilo, mas adaptar a implementação para a stack oficial do Vulnera.

## O que deve ser seguido dos exemplos

- organização por responsabilidade
- controller fino
- service com regra de negócio
- repository isolando acesso a dados
- configuração de ambiente centralizada
- tratamento de upload separado
- mensagens de erro simples
- código didático e fácil de explicar

## O que deve ser adaptado

| Exemplo legado | No Vulnera |
|---|---|
| Express router | Express Controller |
| `server.ts` Express | `main.ts` Express |
| Middleware Express | middlewares, Pipe, Interceptor ou Middleware Express |
| MySQL2 Pool | PrismaService |
| SQL manual | Prisma Client |
| `routes.ts` | módulos e decorators do Express |
| model class simples | entidades/tipos/DTOs + schema Prisma |
| Multer Express | Multer integrado ao Express |

## O que não deve ser copiado literalmente

- conexão MySQL2
- queries SQL manuais, salvo documentação ou exemplo didático
- rotas Express
- estrutura de `server.ts` Express
- dependências específicas não usadas no Vulnera
- nomes de entidades de projetos antigos
- regras de negócio que não existem no Vulnera

## Regra final para o Claude

Ao implementar o Vulnera, seguir o estilo dos exemplos do autor, mas traduzir a solução para:

- Express
- Prisma
- MySQL
- arquitetura modular
- política de desenvolvimento seguro
- documentação canônica do vault

## Relação com o Vulnera
O Claude deve usar estes exemplos como norte de estilo, mas sempre respeitando:
- [[Back-end Express]]
- [[API REST]]
- [[Politica de Desenvolvimento Seguro]]
- [[Checklist de Seguranca por Feature]]
- [[ADR-005 - Desenvolvimento local com Docker minimo]]

## Regra para o Claude
Ao implementar código, usar estas referências para manter simplicidade e estilo, mas adaptar para a stack oficial do Vulnera.

## Guia de adaptação completo

Para ver como adaptar cada camada legada (Express, MySQL) para a stack oficial (Express, Prisma), consultar:

- [[Referencia - Adaptacao para Prisma]]

Esta nota contém:
- mapeamento completo de camadas
- exemplos de `server.ts` → `main.ts`
- adaptação de `routes` → `Controller + Module`
- adaptação de `middleware` → `middlewares, Pipe, Interceptor`
- adaptação de `database/connection` → `PrismaService`
- adaptação de `config/EnvVar` → `ConfigModule + ConfigService`
- adaptação de `models` → `DTOs + schema Prisma`
- adaptação de `multer config` → `MulterModule`
- tabela de exceptions Express → Express
