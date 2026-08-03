---
type: permissao
tags: [domain, source-of-truth]
status: ativo
---

# CompanyRole

## Definição
`CompanyRole` é o papel interno de um usuário dentro de uma `Company`. Aplica-se apenas a usuários com role `CLIENT`.

Não é uma role global do sistema — é uma subrole de escopo empresarial.

## Valores

### OWNER
- é o responsável comercial da empresa na plataforma
- pode editar os dados da própria empresa
- pode convidar novos usuários para a empresa
- é o interlocutor primário com o Admin
- normalmente é quem fez o cadastro (onboarding)

### MEMBER
- usuário convidado pelo OWNER
- acesso de leitura e acompanhamento
- pode comentar em findings, abrir tickets e baixar relatórios
- não pode editar a empresa nem convidar outros usuários

## Atribuição
- OWNER: definido no momento do onboarding (cadastro da empresa)
- MEMBER: atribuído pelo OWNER via convite na plataforma

## Campo no banco
Campo `company_role` na tabela `USER`:
- tipo: enum `OWNER | MEMBER | null`
- valor `null` para usuários que não são CLIENT (Admin, Pentester)

## Regras relacionadas
- [[RN01 - Empresa pode ter multiplos usuarios cliente]] — mais de um CLIENT por Company
- [[RN02 - Usuario pertence a no maximo uma Company]] — cada usuário tem no máximo um companyRole

## Relacionado
[[Roles]]
[[Matriz de Permissoes]]
[[Regras de Ownership]]
[[User]]
[[Company]]
