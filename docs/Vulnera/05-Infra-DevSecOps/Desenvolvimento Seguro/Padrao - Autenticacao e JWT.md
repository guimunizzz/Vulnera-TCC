---
type: padrao-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Padrao - Autenticacao e JWT

## Objetivo
Definir o padrão seguro de autenticação e uso de JWT no Vulnera.

## Regras
- access token com expiração curta
- refresh token com expiração controlada
- refresh token armazenado de forma segura e preferencialmente hasheado no banco
- logout deve invalidar o refresh token
- JWT nunca deve conter dados sensíveis além do necessário
- claims devem ser mínimas
- assinatura e segredo devem ser mantidos fora do código
- rotação ou revogação deve ser considerada no fluxo de sessão

## O que incluir no token
- userId
- role
- companyId, se realmente necessário
- informações mínimas para autorização contextual

## O que não incluir no token
- senhas
- hashes
- segredos
- dados sensíveis de negócio
- payload excessivo

## Cuidados
- nunca logar token completo
- nunca expor segredo JWT em documentação
- nunca confiar apenas no front-end para controlar sessão
- proteger o fluxo de refresh contra abuso

---

## Implementação no Vulnera (Express)

### Configuração do módulo JWT

```ts
// auth.module.ts
JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow('JWT_SECRET'),
    signOptions: { expiresIn: '15m' },
  }),
})
```

Variáveis de ambiente obrigatórias:
```env
JWT_SECRET=<string aleatória longa — mínimo 32 chars>
JWT_REFRESH_SECRET=<string diferente do access secret>
```

### Estrutura do payload

```ts
interface JwtPayload {
  sub: string      // userId
  role: Role       // ADMIN | PENTESTER | CLIENT
  companyId?: string
  iat: number
  exp: number
}
```

Não incluir: nome, email, senha, hashes, dados de negócio.

### Hash de senha (bcrypt)

```ts
// cost 12 — equilíbrio entre segurança e performance
const hash = await bcrypt.hash(password, 12)
const valid = await bcrypt.compare(input, hash)
```

### Refresh token — armazenamento seguro

O refresh token é emitido como string aleatória, enviado ao cliente, e armazenado **hasheado** no banco:

```ts
import { randomBytes, createHash } from 'crypto'

const raw = randomBytes(40).toString('hex')
const hashed = createHash('sha256').update(raw).digest('hex')

// salvar hashed no banco (RefreshToken.token_hash)
// retornar raw ao cliente via cookie HttpOnly
```

Validação no refresh:
```ts
const hashed = createHash('sha256').update(rawFromCookie).digest('hex')
const token = await prisma.refreshToken.findFirst({
  where: { tokenHash: hashed, revokedAt: null },
})
if (!token || token.expiresAt < new Date()) throw new throw new Error("UNAUTHORIZED")()
```

### Rotação de refresh token

A cada uso do refresh token, o token atual é revogado e um novo par (access + refresh) é emitido. Isso previne reutilização de token comprometido.

```ts
// ao usar refresh token:
await prisma.refreshToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } })
// emitir novo refresh token e salvar novo hash
```

### Cookie HttpOnly para refresh token

O refresh token nunca deve ir para o localStorage. Configurar como cookie:

```ts
res.cookie('refresh_token', rawToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias em ms
})
```

### Rate limiting no login

```ts
// throttler middlewares aplicado ao endpoint de login
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
@Post('login')
async login(@Body() dto: LoginDto) { ... }
```

### middlewares

```ts
// JwtAuthGuard — verifica token e popula req.user
@UseGuards(JwtAuthGuard)

// RolesGuard — verifica role mínima
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)

// Ownership — verificado no service, não no middlewares
const project = await this.projectsRepository.findById(id)
if (project.application.companyId !== user.companyId) throw new throw new Error("FORBIDDEN")()
```

---

## Reset de senha

Fluxo seguro:
1. POST `/auth/forgot-password` → gera `PasswordResetToken` (hash, TTL 30 min)
2. Envia e-mail com `?token=<raw>` — link expira em 30 min
3. POST `/auth/reset-password` → valida hash, atualiza senha, invalida token
4. Endpoint não revela se o e-mail existe (resposta sempre 200)

Ver: [[PasswordResetToken]]

---

## Relacionado
[[Autenticacao]]
[[User]]
[[RefreshToken]]
[[PasswordResetToken]]
[[Middlewares e Ownership]]
[[Seguranca da Aplicacao]]
[[Padrao - Segredos e Variaveis Sensiveis]]
[[Logs Estruturados]]