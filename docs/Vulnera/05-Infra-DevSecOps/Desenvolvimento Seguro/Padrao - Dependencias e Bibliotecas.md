---
type: padrao-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Padrao - Dependencias e Bibliotecas

## Objetivo
Definir critérios de adoção segura de bibliotecas e dependências.

## Regras
- preferir bibliotecas oficiais ou amplamente reconhecidas
- evitar bibliotecas abandonadas ou sem manutenção visível
- evitar dependências desnecessárias para funções simples
- verificar compatibilidade com a stack oficial do projeto
- evitar pacotes obscuros quando houver alternativa consolidada
- toda nova dependência deve ter justificativa funcional

## Critérios de avaliação
- manutenção ativa
- adoção pela comunidade
- documentação clara
- compatibilidade com TypeScript
- compatibilidade com Express, React + Vite ou Expo quando aplicável
- histórico de segurança aceitável

## O que evitar
- pacotes com poucas garantias de manutenção
- forks obscuros sem necessidade
- pacotes que prometem “atalhos mágicos” em segurança
- libs que exigem desabilitar proteções do framework

---

## Stack oficial do Vulnera — bibliotecas aprovadas

### Back-end (Express)

| Finalidade | Biblioteca aprovada |
|---|---|
| Framework | `express`, `express` |
| ORM | `@prisma/client`, `prisma` |
| Autenticação | `express`, `jsonwebtoken`, `bcrypt` |
| Validação | `class-validator`, `class-transformer` |
| Upload | `multer`, `@types/multer` |
| Rate limiting | `express` |
| Headers HTTP | `helmet` |
| Logging | `pino`, `nestjs-pino` |
| E-mail | `nodemailer`, `@types/nodemailer` |
| IA | `@google/generative-ai` (SDK oficial Google) |
| WebSocket | `socket.io`, `express.io`, `socket.io` |
| Config | `express` |
| Docs | `express` |
| Testes | `jest`, `supertest`, `express` |

### Front-end (React + Vite)

| Finalidade | Biblioteca aprovada |
|---|---|
| Framework | `next`, `react`, `react-dom` |
| Estilo | `tailwindcss`, `shadcn/ui` |
| HTTP client | `axios` |
| Estado/cache | `@tanstack/react-query` ou `zustand` |
| Gráficos | `recharts` |
| PDF | `pdf-lib` |
| WebSocket | `socket.io-client` |
| Sanitização | `dompurify` + `@types/dompurify` |
| Markdown | `react-markdown` + `rehype-sanitize` |

### Mobile (Expo)

| Finalidade | Biblioteca aprovada |
|---|---|
| Framework | `expo`, `react-native` |
| Navegação | `expo-router` |
| HTTP client | `axios` |
| Estado/cache | `@tanstack/react-query` |
| Push | `expo-notifications` |
| Estilo | `nativewind` (opcional) |

---

## Processo de adoção de nova dependência

Antes de adicionar qualquer biblioteca não listada acima:

1. **Verificar necessidade real** — a função pode ser feita nativamente ou com biblioteca já instalada?
2. **Avaliar manutenção** — commits recentes no GitHub, issues respondidas, última versão?
3. **Avaliar adoção** — downloads semanais no npm, uso em projetos conhecidos?
4. **Verificar TypeScript** — tipos incluídos (`@types/`) ou via `DefinitelyTyped`?
5. **Verificar histórico de segurança** — CVEs conhecidos? Dependências problemáticas?
6. **Verificar licença** — MIT, Apache 2.0 ou ISC são aceitáveis

### Red flags que bloqueiam adoção

- pacote com < 1.000 downloads/semana sem justificativa de nicho
- último commit há mais de 12 meses em feature crítica
- CVE não corrigido em versão ativa
- dependências com chain de pacotes obscuros
- pacote que exige desabilitar `strict` do TypeScript
- fork não oficial de biblioteca conhecida sem razão clara

---

## Dependências a evitar no contexto do projeto

| Tentação | Por quê evitar | Alternativa |
|---|---|---|
| `express-validator` | Projeto já usa `class-validator` — duplicar esforço | `class-validator` |
| `passport` + strategies | Pode ser feito com `express` diretamente | `express` + middlewares manual |
| `serialize-javascript` | Desnecessário com Prisma + TypeScript | Prisma nativo |
| Qualquer "jwt decoder online" | Expõe tokens — nunca usar ferramentas online com dados reais | `jwt.io` apenas com dados de teste |

---

## Relacionado
[[Back-end Express]]
[[Front-end Web React]]
[[Mobile Expo]]
[[Seguranca da Aplicacao]]
[[Politica de Desenvolvimento Seguro]]
[[GitHub Actions CI]]