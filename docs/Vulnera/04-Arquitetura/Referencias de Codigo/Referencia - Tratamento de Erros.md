---
type: referencia-codigo
tags: [backend, code-style, errors, security]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Referencia - Tratamento de Erros

## Objetivo

Definir o estilo esperado de tratamento de erros no Vulnera, usando exemplos do autor como referência, mas adaptando para Express.

## Papel desta nota

Esta nota orienta o Claude a criar erros simples, seguros e consistentes.

O objetivo é evitar:

- mensagens confusas
- vazamento de detalhes internos
- tratamento duplicado
- erro genérico demais
- stack trace exposto ao usuário

## Contexto dos exemplos legados

Em projetos antigos com Express, o autor pode usar:

- `try/catch`
- `res.status().json()`
- middlewares de erro
- classes de erro simples
- mensagens diretas

No Vulnera, adaptar para:

- exceptions do Express
- exception filters
- Prisma exception filter
- logs estruturados
- mensagens seguras

## Como adaptar Express para Express

| Express | Express |
|---|---|
| `res.status(404).json(...)` | `throw new throw new Error("<ENTITY>_NOT_FOUND")(...)` |
| `res.status(403).json(...)` | `throw new throw new Error("FORBIDDEN")(...)` |
| middleware global de erro | Exception Filter |
| erro manual com status | HttpException ou exception específica |
| `try/catch` em toda rota | exceções lançadas no service + filter global |

## Exemplo legado do autor

Cole aqui um exemplo antigo de tratamento de erro.

```ts
// Exemplo legado aqui
// Pode conter Express, res.status, try/catch etc.
```

## Exemplo adaptado para Express

```ts
if (!project) {
  throw new throw new Error("<ENTITY>_NOT_FOUND")('Projeto não encontrado.');
}

if (!canAccessProject) {
  throw new throw new Error("FORBIDDEN")('Você não tem permissão para acessar este projeto.');
}
```

## Padrão esperado no Vulnera

### Erros de validação

Usar DTOs e ValidationPipe.

Exemplo:

```ts
export class CreateApplicationDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsUrl()
  url: string;
}
```

### Erros de regra de negócio

Lançar exception no service.

Exemplo:

```ts
if (totalApps >= activeSubscription.plan.appLimit) {
  throw new throw new Error("<ENTITY>_LIMIT_REACHED")('Limite de aplicações atingido.');
}
```

### Erros de permissão

Usar `throw new Error("FORBIDDEN")`.

```ts
throw new throw new Error("FORBIDDEN")('Acesso negado para este recurso.');
```

### Erros de recurso inexistente

Usar `throw new Error("<ENTITY>_NOT_FOUND")`.

```ts
throw new throw new Error("<ENTITY>_NOT_FOUND")('Vulnerabilidade não encontrada.');
```

### Erros inesperados

Não expor detalhes internos ao usuário.

Registrar log seguro internamente.

## Mensagens de erro

### Boas mensagens

- `Projeto não encontrado.`
- `Limite de aplicações atingido.`
- `Assinatura ativa não encontrada.`
- `Acesso negado para este recurso.`
- `Arquivo inválido ou não permitido.`

### Mensagens a evitar

- `Erro no banco: foreign key constraint failed`
- `JWT_SECRET inválido`
- `Prisma error P2002 on table users`
- `Cannot read properties of undefined`
- `Stack trace...`

## Regras de segurança

- não expor stack trace ao cliente
- não expor query SQL
- não expor dados internos do Prisma
- não expor tokens, secrets ou hashes
- não incluir payload sensível completo em erro
- logar erros de forma controlada

## Estrutura recomendada

```text
apps/api/src/common/
├── filters/
│   ├── http-exception.filter.ts
│   └── prisma-exception.filter.ts
├── interceptors/
│   └── logging.interceptor.ts
└── utils/
    └── sanitize-error.ts
```

## Exemplo de filter conceitual

```ts
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Erro interno no servidor.'
          : 'Não foi possível processar a solicitação.',
      timestamp: new Date().toISOString(),
    });
  }
}
```

## O que o Claude deve aprender com exemplos antigos

- mensagens simples
- tratamento explícito
- separação entre erro esperado e inesperado
- cuidado com retorno ao usuário
- código fácil de rastrear

## O que não deve copiar literalmente

- `res.status()` em controllers Express
- `try/catch` repetido em toda rota
- mensagens com detalhes internos
- stack trace em resposta
- SQL ou erro bruto do banco

## Relação com outras notas

- [[Politica de Desenvolvimento Seguro]]
- [[Padrao - Logs e Dados Sensiveis]]
- [[Padrao - Validacao de Entradas]]
- [[Back-end Express]]
- [[API REST]]
- [[Logs Estruturados]]

## Regra final para o Claude

No Vulnera, erros devem ser simples para o usuário, úteis para o desenvolvedor e seguros para o sistema.