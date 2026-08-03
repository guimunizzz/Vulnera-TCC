---
type: estrutura-projeto
tags: [architecture, reference]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Legenda de Arquivos

## Objetivo

Explicar o significado dos principais tipos de arquivo usados na estrutura do Vulnera.

## Express

| Padrão | Significado |
|---|---|
| `*.module.ts` | Módulo Express; registra providers, controllers e imports |
| `*.controller.ts` | Camada HTTP; define rotas e chama services |
| `*.service.ts` | Lógica de negócio e orquestração |
| `*.repository.ts` | Acesso a dados e queries |
| `*.service.spec.ts` | Teste unitário do service com Jest |
| `*.dto.ts` | Data Transfer Object; validação de entrada |
| `*.gateway.ts` | WebSocket gateway com Socket.IO |
| `*.middlewares.ts` | middlewares de autenticação ou autorização |
| `*.decorator.ts` | Decorator customizado |
| `*.filter.ts` | Exception filter para formatar erros |
| `*.interceptor.ts` | Interceptor para logging, auditoria ou transformação |
| `*.pipe.ts` | Pipe de validação ou transformação |

## React + Vite

| Padrão | Significado |
|---|---|
| `page.tsx` | Página roteável no App Router |
| `layout.tsx` | Layout compartilhado por grupo de rotas |
| `error.tsx` | Página de erro de rota |
| `not-found.tsx` | Página de 404 |
| `(grupo)` | Route group sem afetar URL |
| `[id]` | Segmento dinâmico de rota |

## Expo Router

| Padrão | Significado |
|---|---|
| `_layout.tsx` | Layout ou navegador compartilhado |
| `index.tsx` | Página inicial da rota |
| `[id].tsx` | Tela dinâmica baseada em parâmetro |
| `(auth)` | Grupo de telas de autenticação |
| `(app)` | Grupo de telas autenticadas |

## Configuração

| Arquivo | Papel |
|---|---|
| `.env.example` | Exemplo de variáveis sem segredos reais |
| `.gitignore` | Ignora arquivos sensíveis e gerados |
| `package.json` | Dependências e scripts |
| `tsconfig.json` | Configuração TypeScript |
| `Dockerfile` | Build de imagem |
| `docker-compose.yml` | Orquestração local |
| `README.md` | Introdução do projeto |

## Regra para o Claude

Quando gerar arquivos, o Claude deve respeitar esta legenda para manter nomes previsíveis e fáceis de navegar.