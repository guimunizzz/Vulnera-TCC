---
type: padrao-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Padrao - Logs e Dados Sensiveis

## Objetivo
Garantir observabilidade sem vazamento de dados sensíveis.

## Regras
- logs devem ser estruturados
- logs não devem conter senhas, tokens, segredos ou payloads sensíveis completos
- dados pessoais e evidências devem ser minimizados em logs
- mensagens de erro devem ser úteis, mas não revelar detalhes internos desnecessários
- stack traces completos não devem ser expostos a clientes em produção

## O que evitar logar
- senha
- token
- refresh token
- segredo JWT
- chave API
- conteúdo completo de evidência
- payloads sensíveis sem sanitização

---

## Implementação no Vulnera (Pino + nestjs-pino)

### Configuração com redact automático

```ts
// logger.module.ts
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'body.password',
        'body.passwordHash',
        'body.token',
        'body.tokenHash',
        'body.newPassword',
        'body.currentPassword',
      ],
      remove: true, // remove completamente — não substitui por [Redacted]
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        // NÃO incluir: body completo, headers de auth, query params com dados sensíveis
      }),
    },
  },
})
```

### O que logar por nível

```ts
// INFO — eventos de negócio relevantes
this.logger.log(`Project created: ${projectId} by user ${userId}`)
this.logger.log(`Subscription approved: ${subscriptionId}`)

// WARN — situações anômalas recuperáveis
this.logger.warn(`Rate limit reached for user ${userId}`)
this.logger.warn(`Invalid JWT attempt from IP ${ip}`)

// ERROR — falhas inesperadas
this.logger.error(`Email delivery failed for ${eventType}: ${error.message}`)
this.logger.error(`Gemini API error: ${error.message}`) // NÃO logar o prompt

// DEBUG — apenas em desenvolvimento
this.logger.debug(`Repository query: findProjectsByCompany companyId=${companyId}`)
```

### Tabela de campos — logar vs não logar

| Campo | Logar? | Alternativa |
|---|---|---|
| `userId` | Sim (identificador) | — |
| `projectId`, `vulnerabilityId` | Sim (rastreabilidade) | — |
| `email` | Com cautela | Logar apenas quando essencial para diagnóstico |
| `password` | Nunca | — |
| `passwordHash` | Nunca | — |
| `tokenHash` | Nunca | — |
| `JWT_SECRET` | Nunca | — |
| `GEMINI_API_KEY` | Nunca | — |
| `content` do chat | Nunca | Logar apenas `messageId` |
| Prompt/resposta Gemini | Nunca | Dados do cliente |
| `cvssVector` completo | Com cautela | Logar apenas severidade final |
| `diff_json` do AuditLog | Parcialmente | Omitir campos sensíveis do diff |

### Separação: log técnico vs AuditLog de negócio

```ts
// Log técnico (Pino) — para diagnóstico de sistema
this.logger.log(`Vulnerability status changed to ${newStatus}`)

// AuditLog de negócio (banco) — para rastreabilidade de ações de usuário
await this.auditLogRepository.create({
  actorId: user.sub,
  entityType: 'Vulnerability',
  entityId: vulnerabilityId,
  action: 'STATUS_CHANGED',
  diffJson: JSON.stringify({ from: oldStatus, to: newStatus }),
})
```

Os dois são complementares. O AuditLog é consultável pelo Admin na interface.

### Erros de API — não vazar internos

```ts
// Express exception filter — garantir que stack trace não vai para o cliente
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse()
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR

    // logar internamente com detalhe
    this.logger.error(exception instanceof Error ? exception.message : String(exception))

    // responder ao cliente sem detalhe interno
    response.status(status).json({
      statusCode: status,
      message: status === 500 ? 'Internal server error' : (exception as HttpException).message,
    })
  }
}
```

---

## Relacionado
[[Logs Estruturados]]
[[AuditLog]]
[[Seguranca da Aplicacao]]
[[Padrao - Segredos e Variaveis Sensiveis]]
[[Back-end Express]]
[[Politica de Desenvolvimento Seguro]]