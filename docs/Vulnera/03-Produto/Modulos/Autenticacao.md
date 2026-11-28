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
- refresh persistido por hash, com rotação transacional no uso
- expiração curta para access token
- estado, papel e versão da sessão conferidos no banco em cada requisição autenticada
- desativação revoga sessões e preserva a identidade no histórico

## Entrada de novas identidades

A adesão de empresa depende de verificação de e-mail e decisão administrativa sobre responsável, empresa e plano. Um OWNER ativo também pode convidar MEMBER para a própria empresa. Cada link pertence a um propósito, tem prazo e consumo único. A ativação define a senha. O login emite a sessão.

## Relacionado
[[User]]
[[RefreshToken]]
[[PasswordResetToken]]
[[API REST]]
[[Seguranca da Aplicacao]]
[[ADR-058 - Adesao B2B, equipes e revogacao de sessoes]]
