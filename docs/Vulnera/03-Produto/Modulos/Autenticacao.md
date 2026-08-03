---
type: funcionalidade
tags: [feature]
status: ativo
---

# Autenticacao

## Objetivo
Permitir login seguro, renovação de token, logout e recuperação de senha.

## Principais elementos
- JWT access token
- refresh token
- logout com invalidação
- reset por e-mail

## Regras associadas
- autenticação via e-mail e senha
- refresh token armazenado de forma segura
- expiração curta para access token

## Relacionado
[[User]]
[[RefreshToken]]
[[PasswordResetToken]]
[[API REST]]
[[Seguranca da Aplicacao]]