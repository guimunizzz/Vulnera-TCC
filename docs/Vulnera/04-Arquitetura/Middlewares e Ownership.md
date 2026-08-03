---
type: documentacao-tecnica
tags: [architecture, source-of-truth, security]
status: ativo
---

> [!info] Nota reescrita em 2026-07-26
> A versão anterior descrevia Guards do NestJS (`CanActivate`, `Reflector`, decorators). Em Express, a mesma responsabilidade é dividida entre **middlewares** (autenticação e role) e **services** (ownership fino).

# Middlewares e Ownership

## Princípio

A verificação de acesso acontece em **dois níveis**, e a distinção importa:

| Nível | Onde | O que verifica |
|---|---|---|
| **Grosso** | `middlewares/` | O usuário está autenticado? Tem a role certa para esta rota? |
| **Fino** | `services/` | Este usuário específico pode tocar **neste registro** específico? |

Middleware não sabe qual empresa é dona do recurso — isso exige uma consulta ao banco, e consulta é responsabilidade do service via repository.

## Middlewares

### `auth.middleware.ts`

Valida o access token JWT e popula `req.user`.

```
Authorization: Bearer <token>
        ↓
  verifica assinatura HS256 + expiração
        ↓
  req.user = { userId, role }
```

Falhas: token ausente ou malformado → `401 UNAUTHORIZED`; token inválido ou expirado → `401 INVALID_TOKEN`.

Não é aplicado em `auth.routes.ts` (login/register/refresh são públicas) nem no `GET /api/plans` (catálogo público).

### `require-role.middleware.ts`

Recebe as roles permitidas e compara com `req.user.role`.

```
router.post("/", authMiddleware, requireRole("ADMIN"), (req, res) => ...)
```

Falha: `403 FORBIDDEN`.

## Ownership no service

Toda regra que depende de **qual registro** está sendo acessado vive no service. Padrão:

```
1. service busca o recurso pelo id
2. se não existe → throw new Error("<ENTITY>_NOT_FOUND")
3. compara o dono do recurso com req.user (recebido como parâmetro, não como req)
4. se não bate → throw new Error("FORBIDDEN")
5. só então executa a operação
```

> O service recebe `{ userId, role }` como argumento. **Nunca recebe `req`** — isso quebraria a regra de que service não conhece HTTP.

### Regras de ownership por ator

| Ator | Alcance |
|---|---|
| `ADMIN` | todos os recursos, todas as empresas |
| `CLIENT` | apenas recursos da própria `Company` |
| `PENTESTER` | apenas `Project` onde é membro (via `ProjectMember`), e os findings desses projetos |

Detalhamento em [[Regras de Ownership]] e [[Matriz de Permissoes]].

## Isolamento multi-tenant

A regra de ouro do sistema: **toda query de listagem filtra por `companyId` antes de qualquer outro critério.**

Camadas de defesa:

1. FK em cascata — `Vulnerability` → `Project` → `Application` → `Company`
2. `companyId` desnormalizado em `Vulnerability` — evita join de três tabelas em toda listagem
3. Service valida o ator antes de devolver qualquer coisa
4. Canários `TEN-01..06` em CI garantem que empresa A nunca enxerga dado de B

Ver [[Multi-tenancy por escopo]] e [[RN16 - Cliente so ve dados da propria Company]].

## Anti-patterns

- ❌ verificar ownership no middleware (exigiria consulta ao banco fora do repository)
- ❌ passar `req` para o service
- ❌ confiar no frontend para esconder dados de outra empresa
- ❌ aceitar `companyId` vindo do body — sempre derivar do recurso pai ou do `req.user`

## Relacionado
[[Contexto Mestre v4]]
[[Back-end Express]]
[[Roles]]
[[Regras de Ownership]]
[[Matriz de Permissoes]]
[[Ownership]]
[[Multi-tenancy por escopo]]
[[Padrao - Autenticacao e JWT]]
