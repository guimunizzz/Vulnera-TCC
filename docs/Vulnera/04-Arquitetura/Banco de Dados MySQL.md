---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Banco de Dados MySQL

## Resumo
O MySQL 8 é o banco de dados principal do Vulnera. Toda a persistência de negócio passa por ele — usuários, projetos, vulnerabilidades, evidências, tokens, notificações e logs de auditoria. O acesso é gerenciado exclusivamente via Prisma ORM.

## Papel na arquitetura
- único repositório de verdade do estado do sistema
- acesso exclusivo pela camada `repository` via Prisma
- nunca acessado diretamente por controller ou service

## Configuração local (Docker Compose)

```yaml
db:
  image: mysql:8-alpine
  container_name: vulnera-db
  environment:
    POSTGRES_USER: vulnera
    POSTGRES_PASSWORD: vulnera
    POSTGRES_DB: vulnera
  ports:
    - "5432:5432"
  volumes:
    - vulnera-db-data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U vulnera"]
    interval: 5s
    timeout: 5s
    retries: 5
```

Connection string de desenvolvimento:
```
mysql://vulnera:vulnera@localhost:5432/vulnera
```

## Entidades persistidas
Todas as entidades do domínio:
[[User]] · [[Company]] · [[Plan]] · [[Subscription]] · [[Application]] · [[Project]] · [[ProjectMember]] · [[Vulnerability]] · [[Evidence]] · [[VulnerabilityComment]] · [[ChatMessage]] · [[SupportTicket]] · [[MaturityAssessment]] · [[MaturityDomain]] · [[MaturityControl]] · [[MaturityScore]] · [[Report]] · [[Notification]] · [[AuditLog]] · [[PasswordResetToken]] · [[RefreshToken]]

## Estratégia de migrations
- migrations gerenciadas pelo Prisma Migrate
- cada migration é um arquivo versionado em `prisma/migrations/`
- em desenvolvimento: `npx prisma migrate dev`
- em CI: `npx prisma migrate deploy`
- rollback: sem rollback automático no MVP — migrations são cumulativas e planejadas para não quebrar

## Convenções de schema
- chaves primárias: UUID (`@id @default(uuid())`)
- datas: `DateTime` com `@default(now())`
- enums: definidos no schema Prisma e mapeados para strings no MySQL
- campos sensíveis: nunca armazenar em claro — usar hash para tokens e bcrypt para senhas

## Considerações de segurança
- Prisma gera queries parametrizadas nativamente — eliminando risco de SQL injection
- credenciais do banco armazenadas em variáveis de ambiente (`.env`) — nunca em código
- banco não é exposto externamente em produção — apenas a API tem acesso
- volume de dados com auditoria completa via [[AuditLog]]
- backups não estão no escopo do MVP mas devem ser considerados para produção

## Riscos e cuidados
- sem índices explícitos além das FKs: pode degradar performance em queries de listagem com filtros compostos — avaliar ao crescer o volume
- UUIDs como PKs têm overhead comparado a integers sequenciais — aceitável no escopo do MVP
- soft delete não é padrão no schema atual: exclusão de entidades-catálogo (MaturityDomain, MaturityControl) deve ser tratada com cuidado para não quebrar histórico

## Links relacionados
[[ORM Prisma]]
[[Back-end Express]]
[[Repositorios]]
[[AuditLog]]
[[Docker Compose]]
[[MOC - Arquitetura]]
