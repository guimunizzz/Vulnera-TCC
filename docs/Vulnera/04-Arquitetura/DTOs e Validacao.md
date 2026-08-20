---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# DTOs e Validacao

## Resumo
Os DTOs (Data Transfer Objects) são a camada de contrato de entrada e saída da API. No Vulnera, são implementados com `class-validator` e `class-transformer` no Express, validando e transformando dados antes de chegarem ao Service. Toda entrada de usuário é tratada como não confiável até passar pela validação do DTO.

## Papel na arquitetura
- primeira linha de defesa contra dados malformados ou inválidos
- define contratos explícitos entre clientes e a API
- isola as regras de validação de entrada das regras de negócio do Service
- gera documentação OpenAPI automaticamente via `express`

## Tecnologias
- **`class-validator`**: decorators de validação (ex: `@IsEmail`, `@IsUUID`, `@IsEnum`, `@IsString`, `@Min`, `@Max`)
- **`class-transformer`**: transformação de tipos (ex: `@Type(() => Number)`, `@Transform`)
- **`express`**: geração automática de documentação via `@ApiProperty`

## Configuração global (ValidationPipe)

```ts
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,        // remove campos não declarados no DTO
  forbidNonWhitelisted: true, // rejeita requests com campos extras
  transform: true,        // converte tipos automaticamente
}))
```

A opção `whitelist: true` é crítica para segurança: garante que apenas campos esperados passem para o Service.

## Padrões de DTO

### DTO de entrada (Create / Update)
```ts
export class CreateVulnerabilityDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string

  @ApiProperty({ enum: OwaspCategory })
  @IsEnum(OwaspCategory)
  owaspCategory: OwaspCategory

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cvssVector?: string

  @ApiProperty({ enum: Severity })
  @IsEnum(Severity)
  severityFinal: Severity
}
```

### DTO de resposta (Response)
DTOs de resposta selecionam explicitamente os campos a expor — nunca retornar o objeto Prisma diretamente.

```ts
export class VulnerabilityResponseDto {
  id: string
  title: string
  severity: string
  status: string
  createdAt: Date
  // NÃO incluir: campos internos, hashes, dados sensíveis
}
```

## Organização por módulo
Cada módulo do back-end tem seu diretório de DTOs:

```
src/
├── vulnerabilities/
│   ├── dto/
│   │   ├── create-vulnerability.dto.ts
│   │   ├── update-vulnerability.dto.ts
│   │   └── vulnerability-response.dto.ts
│   ├── vulnerabilities.controller.ts
│   ├── vulnerabilities.service.ts
│   └── vulnerabilities.module.ts
```

## Validações críticas por domínio

| Entidade | Validações obrigatórias |
|---|---|
| User | email válido, senha com comprimento mínimo |
| Vulnerability | severity enum válido, OWASP category enum válido |
| Subscription | plan_id existente, company_id da própria company |
| Evidence | arquivo validado no upload (MIME, tamanho, extensão) |
| MaturityScore | score entre 1 e 5 |
| ChatMessage | content não vazio, project_id UUID válido |

## Considerações de segurança
- `whitelist: true` e `forbidNonWhitelisted: true` são obrigatórios — sem eles, campos extras passam silenciosamente para o banco
- **nunca aceitar `userId`, `companyId` ou `role` pelo corpo da requisição** — esses valores devem vir sempre do JWT decodificado no middlewares
- campos `enum` devem ser validados com `@IsEnum` — impede valores arbitrários
- campos de texto livre (`description`, `content`, `notes`) devem ter `@MaxLength` para prevenir DoS por payload muito grande
- DTOs de resposta devem ser usados para remover campos sensíveis (`passwordHash`, `tokenHash`) antes de serializar

## Riscos e cuidados
- não usar o objeto Prisma retornado diretamente como resposta — expõe campos internos
- `@IsOptional()` combinado com `@IsString()` sem `@Transform` pode aceitar `null` onde não esperado — verificar
- validações complexas de negócio (ex: plano ativo, limite de aplicações) **não pertencem ao DTO** — ficam no Service

## Links relacionados
[[API REST]]
[[Back-end Express]]
[[Middlewares e Ownership]]
[[Seguranca da Aplicacao]]
[[Padrao - Validacao de Entradas]]
[[MOC - Arquitetura]]
