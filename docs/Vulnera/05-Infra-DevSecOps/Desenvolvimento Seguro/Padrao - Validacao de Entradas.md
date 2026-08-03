---
type: padrao-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Padrao - Validacao de Entradas

## Objetivo
Garantir que toda entrada externa seja validada antes de ser usada pelo sistema.

## Escopo
Aplicável a:
- body
- query
- params
- headers
- uploads
- payloads de integração
- mensagens de chat/comentários

## Regras
- toda entrada deve possuir contrato explícito
- validação deve ocorrer na borda da aplicação
- tipos, formatos, tamanhos e obrigatoriedade devem ser validados
- valores inesperados devem ser rejeitados
- campos livres devem ter limites de tamanho
- enums devem ser fechados e explícitos
- IDs e referências devem ser validados antes de uso

## O que evitar
- usar input cru diretamente em lógica de negócio
- confiar que o front-end já validou
- aceitar payloads abertos sem schema
- aceitar campos extras sem necessidade

---

## Implementação no Vulnera (Express + class-validator)

### ValidationPipe global

```ts
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // remove campos não declarados no DTO
  forbidNonWhitelisted: true,   // rejeita requests com campos extras (400)
  transform: true,              // converte tipos automaticamente (string → number)
  transformOptions: {
    enableImplicitConversion: false, // conversões explícitas apenas
  },
}))
```

`whitelist: true` é crítico: sem ele, campos extras passam silenciosamente para o banco.

### Decorators de validação por tipo de campo

```ts
// String obrigatória com limite
@IsString()
@IsNotEmpty()
@MaxLength(255)
title: string

// String opcional com limite
@IsString()
@IsOptional()
@MaxLength(2000)
description?: string

// Enum fechado
@IsEnum(Severity)
severityFinal: Severity

// UUID de referência
@IsUUID('4')
projectId: string

// Email
@IsEmail()
email: string

// Número com range
@IsInt()
@Min(1)
@Max(5)
score: number

// Boolean
@IsBoolean()
isActive: boolean
```

### Campos que nunca devem vir do body

Os campos abaixo **nunca** são aceitos como input — sempre extraídos do JWT ou derivados internamente:

```ts
// ERRADO — nunca fazer isso:
@Post('vulnerabilities')
create(@Body() dto: CreateVulnerabilityDto & { createdBy: string }) // ❌

// CORRETO:
@Post('vulnerabilities')
create(@Body() dto: CreateVulnerabilityDto, @CurrentUser() user: JwtPayload) {
  return this.service.create(dto, user.sub) // userId vem do JWT
}
```

Campos que NUNCA vêm do body: `userId`, `createdBy`, `companyId`, `role`, `ownerId`.

### Validação de uploads

```ts
// multer.config.ts
export const evidenceUploadOptions: MulterOptions = {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain']
    if (!allowed.includes(file.mimetype)) {
      return cb(new throw new Error("INVALID_<FIELD>")('Tipo de arquivo não permitido'), false)
    }
    cb(null, true)
  },
}
```

### Validação de params e query strings

```ts
// params com UUID
@Get(':id')
findOne(@Param('id', ParseUUIDPipe) id: string) { ... }

// query com tipo e limite
export class FindVulnerabilitiesQueryDto {
  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20
}
```

### Campos de texto livre — limites recomendados

| Campo | MaxLength |
|---|---|
| `title` (vulnerability, ticket) | 255 |
| `description` (curta) | 2.000 |
| `description` (longa, findings) | 10.000 |
| `content` (chat, comentário) | 4.000 |
| `notes` | 5.000 |
| `recommendation` | 10.000 |

---

## Relacionado
[[DTOs e Validacao]]
[[API REST]]
[[Back-end Express]]
[[Padrao - Prevencao de Injection]]
[[Padrao - Prevencao de XSS]]
[[Padrao - Upload Seguro]]
[[Politica de Desenvolvimento Seguro]]