---
type: checklist-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Checklist de Seguranca por Feature

## Uso
Este checklist deve ser consultado antes de propor, documentar ou implementar qualquer nova feature.

## Checklist

### Entradas
- [ ] toda entrada foi validada?
- [ ] há limites de tamanho?
- [ ] enums estão fechados?
- [ ] campos livres foram tratados?

### Autenticação e autorização
- [ ] a feature exige autenticação?
- [ ] a role foi validada?
- [ ] ownership foi validado?
- [ ] há risco de bypass?

### Exposição de dados
- [ ] a resposta retorna apenas o necessário?
- [ ] há risco de vazamento de dados sensíveis?
- [ ] mensagens de erro estão seguras?

### Persistência e injection
- [ ] há risco de query insegura?
- [ ] filtros e ordenações estão controlados?
- [ ] caminhos e nomes de arquivo estão protegidos?

### Front-end / renderização
- [ ] existe risco de XSS?
- [ ] conteúdo renderizado foi sanitizado?
- [ ] HTML arbitrário foi evitado?

### Dependências
- [ ] alguma nova biblioteca é realmente necessária?
- [ ] ela é oficial ou consolidada?
- [ ] existe alternativa mais segura?

### Logs e segredos
- [ ] segredos foram mantidos fora do código?
- [ ] logs evitam dados sensíveis?
- [ ] tokens e chaves não aparecem em erros ou documentação?

## Como usar
1. Antes de documentar ou implementar uma feature, percorra cada seção
2. Marque cada item com `[x]` quando verificado
3. Se um item não se aplicar, marque com `[N/A]` e anote o motivo
4. Itens críticos (`*`) não podem ser pulados — devem ser `[x]` ou `[N/A com justificativa]`

---

## Checklist expandido

### Entradas
- [ ] * toda entrada de usuário (body, params, query, headers) tem DTO com validação explícita?
- [ ] * `ValidationPipe` está ativo com `whitelist: true` e `forbidNonWhitelisted: true`?
- [ ] campos de texto livre têm `@MaxLength` definido?
- [ ] enums são fechados com `@IsEnum`?
- [ ] IDs são validados como `@IsUUID` antes de qualquer query?
- [ ] uploads têm validação de MIME, tamanho e extensão?

### Autenticação e autorização
- [ ] * a rota exige autenticação (middlewares `JwtAuthGuard`)?
- [ ] * a role foi validada (middlewares `RolesGuard`)?
- [ ] * ownership foi verificado (company, project, vulnerability)?
- [ ] `userId`, `companyId` e `role` vêm exclusivamente do JWT — nunca do corpo da requisição?
- [ ] há risco de bypass via mudança de parâmetro de URL?
- [ ] o endpoint de reset/refresh está protegido contra força bruta (rate limiting)?

### Exposição de dados
- [ ] * a resposta usa DTO de saída explícito (não retorna entidade Prisma direta)?
- [ ] campos sensíveis (`passwordHash`, `tokenHash`) estão excluídos da resposta?
- [ ] mensagens de erro não revelam detalhes internos de implementação?
- [ ] erros 404 vs 403 estão sendo usados corretamente (não vazar existência de recurso)?

### Persistência e injection
- [ ] * queries usam Prisma (parametrizadas) — sem interpolação de string com input?
- [ ] filtros e ordenações dinâmicos estão contra lista permitida de campos?
- [ ] caminhos de arquivo são construídos pelo sistema, não pelo input do usuário?
- [ ] se usar `$queryRaw`, está usando `Prisma.sql` tagged template?

### Front-end / renderização
- [ ] campos de texto livre (chat, comentários, notas) são renderizados com escape automático do React?
- [ ] se houver renderização markdown, está usando biblioteca com sanitização (ex: rehype-sanitize)?
- [ ] `dangerouslySetInnerHTML` está ausente ou tem sanitização DOMPurify antes?
- [ ] relatórios PDF gerados client-side não executam HTML arbitrário do servidor?

### Dependências
- [ ] alguma nova biblioteca foi adicionada?
  - [ ] é oficial ou consolidada no ecossistema?
  - [ ] tem manutenção ativa (commits recentes, issues respondidas)?
  - [ ] há alternativa nativa ou já usada no projeto?

### Logs e segredos
- [ ] * segredos não aparecem em nenhum log (`redact` configurado)?
- [ ] tokens, hashes e chaves não aparecem em respostas de erro?
- [ ] nenhum segredo real foi adicionado ao código ou `.env.example`?
- [ ] a feature gera logs úteis no nível correto (`info` para eventos de negócio, `error` para falhas)?

### Auditoria de negócio
- [ ] se a ação é sensível (criar/alterar finding, mudar severidade, baixar relatório), gera `AuditLog`?
- [ ] o `AuditLog` captura `actorId`, `entityType`, `entityId`, `action` e `diff`?

---

## Áreas de atenção específica no Vulnera

| Feature | Risco principal |
|---|---|
| Upload de evidência | MIME falso, path traversal, tamanho ilimitado |
| Chat do projeto | XSS em conteúdo livre, validação de room ownership |
| Sugestão IA (Gemini) | Rate limit, não logar prompt/resposta, aiAssisted flag |
| Reset de senha | Enumeração de usuários, token de longa duração |
| Refresh token | Reutilização após logout, expiração, rotação |
| Maturity assessment | Escrita exclusiva do Admin (RN19) |
| Relatório PDF | Client-side — não executar HTML do servidor no gerador |
| Filtros de listagem | Injection via query params, bypass de ownership |

---

## Relacionado
[[Politica de Desenvolvimento Seguro]]
[[Padrao - Autenticacao e JWT]]
[[Padrao - Validacao de Entradas]]
[[Padrao - Prevencao de Injection]]
[[Padrao - Prevencao de XSS]]
[[Padrao - Upload Seguro]]
[[Padrao - Logs e Dados Sensiveis]]
[[Padrao - Segredos e Variaveis Sensiveis]]
[[Middlewares e Ownership]]
[[AuditLog]]