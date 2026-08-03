---
type: padrao-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Padrao - Segredos e Variaveis Sensiveis

## Objetivo
Evitar exposição de segredos, chaves, tokens e credenciais.

## Regras
- segredos devem existir apenas em variáveis de ambiente ou mecanismo seguro equivalente
- nunca commitar segredos no repositório
- nunca documentar valores reais de chave
- exemplos em documentação devem usar placeholders
- logs não devem exibir segredos
- respostas da API não devem refletir segredos
- arquivos `.env` reais devem ficar fora do controle de versão

## Tipos de dado sensível
- JWT secret
- API keys
- credenciais SMTP
- credenciais de banco
- tokens de integração
- chaves privadas
- segredos de serviços externos

---

## Implementação no Vulnera

### Variáveis de ambiente obrigatórias

```env
# .env.example — ÚNICO arquivo que vai ao repositório
# Valores são placeholders — nunca valores reais

# Banco de dados
DATABASE_URL=mysql://user:password@localhost:5432/vulnera

# JWT
JWT_SECRET=change-me-to-a-long-random-string
JWT_REFRESH_SECRET=change-me-to-another-long-random-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# SMTP
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@vulnera.local

# Gemini
GEMINI_API_KEY=your-gemini-api-key-here

# App
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3001
```

**Regra:** o arquivo `.env` real está no `.gitignore`. Apenas `.env.example` existe no repositório.

### Acesso seguro a variáveis no Express

Usar `ConfigService` com `getOrThrow` — falha no startup se variável obrigatória estiver ausente:

```ts
// config.service.ts ou direto no módulo
const jwtSecret = this.config.getOrThrow<string>('JWT_SECRET')
const geminiKey = this.config.getOrThrow<string>('GEMINI_API_KEY')
```

Nunca acessar `process.env.X` diretamente fora do módulo de configuração.

### Secrets no CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET }}         # ✅ via GitHub Secrets
  DATABASE_URL: ${{ secrets.DATABASE_URL }}       # ✅ via GitHub Secrets

# NUNCA:
env:
  JWT_SECRET: "meu-segredo-aqui"  # ❌ exposto no código
```

Secrets configurados em: Settings → Secrets and variables → Actions do repositório.

### O que nunca deve aparecer em código ou documentação

| Item | Por quê |
|---|---|
| `JWT_SECRET` com valor real | Permite forjar tokens de qualquer usuário |
| `GEMINI_API_KEY` real | Uso não autorizado gera custos e vazamento de dados |
| Credenciais SMTP reais | Permite envio de e-mail em nome da plataforma |
| `DATABASE_URL` com senha real | Acesso direto ao banco de produção |
| Hash de senha de usuário real | Permite ataque offline de força bruta |

### Geração de secrets seguros

```bash
# JWT secret (32 bytes = 256 bits de entropia)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Refresh token secret (diferente do access)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Relacionado
[[Integracao Gemini]]
[[Autenticacao]]
[[RefreshToken]]
[[Email SMTP]]
[[Seguranca da Aplicacao]]
[[Logs Estruturados]]
[[Padrao - Autenticacao e JWT]]
[[Politica de Desenvolvimento Seguro]]