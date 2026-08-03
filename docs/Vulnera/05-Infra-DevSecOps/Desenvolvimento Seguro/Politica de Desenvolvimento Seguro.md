---
type: politica-seguranca
tags: [devsecops, architecture, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Politica de Desenvolvimento Seguro

## Propósito
O Vulnera é uma plataforma de segurança. Qualquer fragilidade técnica da plataforma em si contradiz diretamente seu propósito e compromete a credibilidade do produto perante clientes e banca avaliadora.

Esta política define os princípios e controles mínimos que devem ser respeitados em todo o ciclo de desenvolvimento — desde a documentação até a implementação.

---

## Princípios fundamentais

### 1. Segurança por padrão
Toda nova feature deve ser implementada segura por default. Permissões abertas, validações ausentes e exposição de dados não são "fases seguintes" — são bugs.

### 2. Defesa em profundidade
Múltiplas camadas de proteção independentes. Uma falha em uma camada não deve comprometer o sistema inteiro:
- Perímetro: HTTPS, CORS, Helmet
- Requisição: rate limiting, validação de DTOs
- Autenticação: JWT de curta duração, refresh token hasheado
- Autorização: middlewares de role e ownership
- Dados: queries parametrizadas, sanitização
- Upload: validação de MIME, magic number, nome reescrito
- Auditoria: logs estruturados sem dados sensíveis, AuditLog de negócio

### 3. Mínimo privilégio
Cada ator acessa apenas o que precisa:
- CLIENT vê apenas dados da própria Company
- PENTESTER vê apenas Projects atribuídos
- ADMIN tem acesso operacional, não irrestrito a dados de outros tenants

### 4. Não confiar no front-end
Todo dado que chega pela API é tratado como não confiável, independentemente de validação client-side:
- body, params, query e headers são validados pelo DTO + ValidationPipe
- `userId`, `companyId` e `role` nunca são aceitos pelo corpo — vêm do JWT
- uploads são revalidados no servidor

### 5. Segredos fora do código
Nenhum segredo, chave, token ou credencial pode existir no código-fonte ou documentação com valores reais. Toda configuração sensível usa variáveis de ambiente.

---

## Controles obrigatórios por camada

### Autenticação
- JWT access token com expiração curta (15 min)
- Refresh token com expiração de 7 dias, armazenado hasheado no banco
- Rotação de refresh token a cada uso
- bcrypt com cost 12 para senhas
- Reset de senha com token de curto prazo (15–60 min), invalidado após uso

Ver: [[Padrao - Autenticacao e JWT]]

### Validação de entrada
- `ValidationPipe` global com `whitelist: true` e `forbidNonWhitelisted: true`
- DTOs com `class-validator` para todo endpoint
- Campos de enum fechados com `@IsEnum`
- Campos de texto com `@MaxLength`
- IDs validados como UUID antes de qualquer query

Ver: [[Padrao - Validacao de Entradas]]

### Prevenção de injection
- Prisma ORM com queries parametrizadas — nunca SQL raw com interpolação
- Filtros e ordenações dinâmicos validados contra lista de campos permitidos
- Nomes de arquivo reescritos com UUID — nunca usados diretamente

Ver: [[Padrao - Prevencao de Injection]]

### Prevenção de XSS
- React escapa HTML por padrão — não usar `dangerouslySetInnerHTML` sem necessidade
- Campos de texto livre (descrições, comentários, chat) sanitizados com DOMPurify no front
- Content Security Policy (CSP) configurada via Helmet

Ver: [[Padrao - Prevencao de XSS]]

### Segredos e variáveis sensíveis
- `.env` real no `.gitignore` — apenas `.env.example` no repositório
- Secrets do CI/CD via GitHub Secrets — nunca em workflow YAML
- Nenhum valor real documentado no vault ou no código

Ver: [[Padrao - Segredos e Variaveis Sensiveis]]

### Logs
- Pino estruturado com redact automático de campos sensíveis
- Nunca logar: senha, token, refresh token, chave API, conteúdo de chat
- Stack traces completos apenas em desenvolvimento

Ver: [[Padrao - Logs e Dados Sensiveis]]

### Upload de arquivos
- Validação de MIME type + magic number (não confiar apenas na extensão)
- Limite de tamanho (máximo 10 MB por evidência)
- Nome de arquivo reescrito com UUID
- Tipos permitidos: imagens (JPEG, PNG, GIF, WebP), PDF, texto

Ver: [[Padrao - Upload Seguro]]

### Dependências
- Preferir bibliotecas oficiais do ecossistema Express/React + Vite/Expo
- Toda nova dependência com justificativa funcional explícita
- Sem forks obscuros ou pacotes sem manutenção ativa

Ver: [[Padrao - Dependencias e Bibliotecas]]

---

## Checklist obrigatório antes de qualquer feature

Ver: [[Checklist de Seguranca por Feature]]

---

## Referências da stack

| Controle | Tecnologia |
|---|---|
| Autenticação | `jsonwebtoken`, `bcrypt`, `express` |
| Validação | `class-validator`, `class-transformer` |
| ORM seguro | Prisma (queries parametrizadas) |
| Headers HTTP | `helmet` |
| Rate limiting | `express` |
| Upload | `multer` com filtros de MIME |
| Logging | Pino com `nestjs-pino` |
| Sanitização HTML | DOMPurify (front-end) |

---

## Responsabilidade
Todo membro da equipe é responsável por respeitar esta política.
Decisões que enfraqueçam segurança devem ser documentadas como decisão técnica explícita com justificativa e risco registrado em `07-Decisoes`.

---

## Links relacionados
[[Seguranca da Aplicacao]]
[[Checklist de Seguranca por Feature]]
[[Padrao - Autenticacao e JWT]]
[[Padrao - Validacao de Entradas]]
[[Padrao - Prevencao de Injection]]
[[Padrao - Prevencao de XSS]]
[[Padrao - Segredos e Variaveis Sensiveis]]
[[Padrao - Logs e Dados Sensiveis]]
[[Padrao - Dependencias e Bibliotecas]]
[[Padrao - Upload Seguro]]
[[Middlewares e Ownership]]
[[DTOs e Validacao]]
[[Logs Estruturados]]
[[AuditLog]]
[[MOC - Arquitetura]]
