---
type: padrao-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Padrao - Prevencao de Injection

## Objetivo
Prevenir injection em consultas, filtros, comandos, renderização e integrações.

## Riscos considerados
- SQL injection
- NoSQL-style injection conceitual em filtros dinâmicos
- command injection
- path manipulation
- template injection
- abuso de filtros e ordenações dinâmicas

## Regras
- nunca montar queries concatenando input cru
- usar ORM com consultas parametrizadas
- validar campos usados em filtros e ordenações
- não interpolar input do usuário em comandos de sistema
- não construir caminhos de arquivo diretamente com input externo
- listas permitidas devem ser preferidas a entrada livre

## Aplicação no Vulnera
Especial cuidado em:
- filtros de projetos
- busca por findings
- uploads e paths
- exportações e relatórios
- integrações com IA

---

## Implementação no Vulnera

### SQL injection — Prisma como proteção principal

O Prisma gera queries parametrizadas automaticamente. Todo acesso ao banco via `PrismaClient` é seguro por padrão:

```ts
// SEGURO — Prisma parametriza automaticamente
const user = await prisma.user.findUnique({ where: { email } })
const vulns = await prisma.vulnerability.findMany({
  where: { projectId, severity: severityFilter },
})
```

**Nunca fazer:**
```ts
// PERIGOSO — SQL raw com interpolação direta
await prisma.$executeRaw(`SELECT * FROM users WHERE email = '${email}'`) // ❌
```

**Se precisar de raw query, usar tagged template:**
```ts
// SEGURO — Prisma.sql parametriza corretamente
await prisma.$queryRaw(Prisma.sql`SELECT * FROM users WHERE email = ${email}`)
```

### Filtros e ordenações dinâmicas

Campos de ordenação vindos do usuário devem ser validados contra uma lista de campos permitidos:

```ts
const ALLOWED_SORT_FIELDS = ['createdAt', 'severity', 'status'] as const
type SortField = typeof ALLOWED_SORT_FIELDS[number]

// validar antes de usar:
if (!ALLOWED_SORT_FIELDS.includes(sortBy as SortField)) {
  throw new throw new Error("INVALID_<FIELD>")('Campo de ordenação inválido')
}

// usar com segurança:
await prisma.vulnerability.findMany({
  orderBy: { [sortBy]: order },
})
```

### Path traversal em uploads

O nome do arquivo enviado pelo usuário nunca deve ser usado diretamente como caminho:

```ts
// PERIGOSO:
const path = `uploads/${req.file.originalname}` // ❌ — permite ../../etc/passwd

// SEGURO — reescrever com UUID
import { v4 as uuidv4 } from 'uuid'
import { extname } from 'path'

const ext = extname(req.file.originalname).toLowerCase()
const safeName = `${uuidv4()}${ext}`
const dest = join(UPLOAD_BASE_DIR, safeName)
```

O `UPLOAD_BASE_DIR` deve ser um caminho absoluto fixo — nunca derivado de input.

### Template injection na integração com Gemini

O prompt enviado ao Gemini deve ser construído pelo sistema, com o input do usuário inserido em posições controladas — nunca como template string livre:

```ts
// SEGURO — input inserido em posição controlada
const prompt = [
  'Você é um analista sênior de segurança.',
  `Título do finding: ${sanitize(dto.title)}`,
  `Contexto: ${sanitize(dto.appContext)}`,
  'Retorne JSON estrito com os campos: description, owaspCategory, cvssVector, recommendation.',
].join('\n')
```

Nunca deixar o usuário controlar a estrutura do prompt.

### Filtros de listagem — ownership como proteção adicional

Filtros por `companyId` ou `projectId` não são apenas regras de negócio — são prevenção de acesso cruzado:

```ts
// SEGURO — companyId vem do JWT, não do body/query
async findProjects(user: JwtPayload) {
  if (user.role === Role.CLIENT) {
    return this.repo.findMany({ where: { application: { companyId: user.companyId } } })
  }
  if (user.role === Role.PENTESTER) {
    return this.repo.findMany({ where: { members: { some: { userId: user.sub } } } })
  }
  return this.repo.findMany() // ADMIN
}
```

---

## Relacionado
[[ORM Prisma]]
[[API REST]]
[[Back-end Express]]
[[Padrao - Validacao de Entradas]]
[[Padrao - Upload Seguro]]
[[Middlewares e Ownership]]
[[Politica de Desenvolvimento Seguro]]