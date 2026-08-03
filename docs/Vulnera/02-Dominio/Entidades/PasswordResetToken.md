---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# PasswordResetToken

## Definição
Representa um token temporário gerado para permitir que um usuário redefina sua senha sem precisar de autenticação. Vinculado a um usuário e com validade limitada no tempo.

## Papel no sistema
`PasswordResetToken` é o mecanismo de recuperação de acesso da plataforma. Quando um usuário solicita redefinição de senha, um token único é gerado, armazenado com hash no banco e enviado por e-mail. O token é consumido uma única vez e expira em tempo determinado.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `user_id` | uuid FK | [[User]] ao qual o token pertence |
| `token_hash` | string | Hash do token (nunca armazenar o token em claro) |
| `expires_at` | datetime | Momento de expiração |
| `used_at` | datetime | Momento em que foi utilizado (nullable) |
| `created_at` | datetime | Momento de criação |

## Relacionamentos
- pertence a um [[User]]
- um usuário pode ter no máximo um token ativo por vez (tokens anteriores devem ser invalidados)

## Regras associadas
- token deve ter validade curta (recomendado: 15 a 60 minutos)
- o token enviado por e-mail nunca deve ser armazenado em claro no banco — apenas o hash
- ao usar o token, deve ser marcado como utilizado (`used_at`) e não deve poder ser reutilizado
- ao solicitar novo token, tokens anteriores não utilizados do mesmo usuário devem ser invalidados

## Estados / enums
`PasswordResetToken` possui estado implícito derivado dos campos:

| Estado | Condição |
|---|---|
| Válido | `used_at IS NULL` e `expires_at > now()` |
| Expirado | `expires_at <= now()` |
| Utilizado | `used_at IS NOT NULL` |

## Permissões / visibilidade
- criação: sistema (endpoint público de "esqueci minha senha") — sem autenticação prévia
- uso/consumo: sistema via endpoint público de redefinição de senha
- leitura direta: apenas sistema interno — nunca expor via API
- Admin não deve ter acesso direto aos tokens

## Considerações de segurança
- **nunca armazenar o token em claro** — usar hash (ex: SHA-256) antes de persistir
- token enviado por e-mail deve ser suficientemente longo e aleatório (mínimo 32 bytes de entropia)
- endpoint de reset não deve indicar se o e-mail existe ou não (prevenção de enumeração de usuários)
- rate limiting deve ser aplicado ao endpoint de solicitação de reset para prevenir abuso
- ao validar o token, comparar o hash do token recebido com o `token_hash` armazenado

## Riscos de inconsistência
- não invalidar tokens anteriores ao gerar novo permite que múltiplos tokens coexistam — janela de exploração maior
- expiração muito longa (horas/dias) aumenta a janela de exploração em caso de interceptação de e-mail
- `user_id` sem FK estrita permite token orfão se usuário for deletado — cascade delete recomendado

## Links relacionados
[[User]]
[[Autenticacao]]
[[Padrao - Autenticacao e JWT]]
[[MOC - Dominio]]
