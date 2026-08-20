---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# RefreshToken

## Definição
Representa um token de longa duração utilizado para renovar o access token JWT sem exigir nova autenticação completa. Persiste no banco para permitir invalidação centralizada (logout, revogação por suspeita de comprometimento).

## Papel no sistema
`RefreshToken` é o mecanismo de sessão persistida da plataforma. O fluxo JWT do Vulnera usa tokens de curta duração (access token) + tokens de longa duração (refresh token). O refresh token permite renovar o acesso sem re-login, e sua persistência no banco permite revogar sessões individuais — fundamental para logout seguro e resposta a incidentes.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `user_id` | uuid FK | [[User]] dono da sessão |
| `token_hash` | string | Hash do refresh token (nunca armazenar em claro) |
| `expires_at` | datetime | Momento de expiração do refresh token |
| `revoked_at` | datetime | Momento de revogação manual (nullable) |
| `created_at` | datetime | Momento de emissão |
| `device_info` | string | Informações do dispositivo/agente (opcional, para auditoria) |

## Relacionamentos
- pertence a um [[User]]
- um usuário pode ter múltiplos RefreshTokens ativos (múltiplos dispositivos/sessões)

## Fluxo de uso

1. Login → emite access token (curto, ex: 15min) + refresh token (longo, ex: 7 dias)
2. Access token expira → cliente envia refresh token → sistema valida hash, expiração e revogação → emite novo access token
3. Logout → refresh token é revogado (`revoked_at = now()`)
4. Suspeita de comprometimento → Admin pode revogar todos os tokens do usuário

## Estados / enums

| Estado | Condição |
|---|---|
| Válido | `revoked_at IS NULL` e `expires_at > now()` |
| Expirado | `expires_at <= now()` |
| Revogado | `revoked_at IS NOT NULL` |

## Permissões / visibilidade
- criação: sistema no momento do login bem-sucedido
- uso: endpoint público de refresh — validação interna pelo sistema
- revogação: sistema no logout; ADMIN pode revogar todos os tokens de um usuário
- leitura direta: apenas sistema interno — nunca expor via API

## Considerações de segurança
- **nunca armazenar o token em claro** — usar hash (ex: SHA-256) antes de persistir
- o refresh token deve ser transmitido via cookie HttpOnly, não em localStorage ou body de resposta
- ao usar o refresh token para renovar acesso, rotacionar o refresh token (invalidar o anterior e emitir novo) — previne reutilização após comprometimento
- refresh token deve ter entropia suficiente (mínimo 32 bytes aleatórios)
- rate limiting no endpoint de refresh para prevenir força bruta
- `device_info` é opcional mas ajuda em auditoria de sessões suspeitas

## Riscos de inconsistência
- não rotacionar o refresh token permite que um token roubado seja usado indefinidamente até a expiração
- múltiplas sessões por usuário sem controle de quantidade podem acumular tokens expirados — limpeza periódica recomendada
- `user_id` sem cascade delete pode gerar tokens órfãos se usuário for deletado

## Links relacionados
[[User]]
[[Autenticacao]]
[[Padrao - Autenticacao e JWT]]
[[Middlewares e Ownership]]
[[MOC - Dominio]]
