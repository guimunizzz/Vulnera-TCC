---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Logs Estruturados

## Resumo
O Vulnera usa **Pino** para logging estruturado no back-end. Logs são emitidos em JSON, com nível configurável por ambiente, e nunca incluem dados sensíveis. O objetivo é ter observabilidade útil sem comprometer a privacidade dos dados dos clientes.

## Papel na arquitetura
- rastreabilidade de operações em produção
- diagnóstico de erros sem depurador
- complementa (não substitui) o [[AuditLog]] de negócio — logs técnicos vs. trilha de auditoria de ações de usuário
- base para ingestão futura em Prometheus / Grafana (fase 7)

## Tecnologia
- **Pino** — logger estruturado de alta performance para Node.js
- Integração via `nestjs-pino` ou configuração manual no Express
- em desenvolvimento: saída formatada com `pino-pretty` (legível no terminal)
- em produção: saída JSON pura (ingestável por ferramentas de log)

## Configuração

```ts
// logger.module.ts
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
    redact: {
      paths: ['req.headers.authorization', 'body.password', 'body.token'],
      remove: true,
    },
  },
})
```

## Níveis de log

| Nível | Uso |
|---|---|
| `error` | Erros inesperados, falhas de integração |
| `warn` | Situações anômalas mas recuperáveis (ex: token expirado, rate limit atingido) |
| `info` | Eventos de negócio relevantes (ex: projeto criado, assinatura aprovada) |
| `debug` | Diagnóstico de fluxo — apenas em desenvolvimento |

## O que logar

**Logar:**
- início e conclusão de operações críticas: login, criação de projeto, mudança de status
- erros de integração (Gemini, SMTP, Expo Push) com contexto suficiente para diagnóstico
- requisições HTTP com método, path, status code e duração (via pino-http)
- eventos de segurança: tentativas de acesso negado (401/403), rate limit atingido

**Não logar:**
- senhas, hashes de senha ou tokens
- conteúdo de mensagens de chat ou comentários (dados do cliente)
- prompts e respostas do Gemini (dados sensíveis do cliente)
- dados pessoais desnecessários (CPF, endereço, etc.)
- `cvss_vector` completo em logs de erro — pode revelar detalhe técnico da vulnerabilidade

## Redact (remoção automática de campos sensíveis)

O Pino suporta `redact` para remover campos automaticamente antes de serializar o log:

```ts
redact: {
  paths: [
    'req.headers.authorization',
    'body.password',
    'body.passwordHash',
    'body.token',
    'body.tokenHash',
  ],
  remove: true,
}
```

## Separação entre log técnico e auditoria de negócio

| Tipo | Tecnologia | Propósito |
|---|---|---|
| Log técnico | Pino | Diagnóstico, erros, performance, rastreabilidade de sistema |
| Auditoria de negócio | [[AuditLog]] (banco) | Rastreabilidade de ações de usuário (quem fez o quê e quando) |

Os dois são complementares. O [[AuditLog]] é consultável por Admin na interface. Os logs técnicos ficam no sistema de log do servidor.

## Considerações de segurança
- **nunca logar dados de usuário que não sejam necessários para diagnóstico**
- o `userId` pode ser logado como identificador de rastreabilidade — sem nome, e-mail ou outros PII além do necessário
- logs não devem ser armazenados em local acessível a usuários da plataforma
- em produção, garantir que logs não sejam impressos no terminal onde usuários podem visualizar

## Riscos e cuidados
- logging excessivo em `debug` em produção pode revelar dados sensíveis — garantir que `LOG_LEVEL=info` em produção
- logs sem correlação de request (sem request ID) dificultam diagnóstico em concorrência — considerar adicionar `requestId` via middleware
- sem rotação de logs: em produção, logs crescem indefinidamente — considerar logrotate ou ingestão em serviço externo

## Links relacionados
[[AuditLog]]
[[Back-end Express]]
[[Seguranca da Aplicacao]]
[[Padrao - Logs e Dados Sensiveis]]
[[Observabilidade]]
[[MOC - Arquitetura]]
