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
- é o responsável da adesão empresarial aprovada ou o usuário habilitado para recuperar um onboarding legado

### MEMBER
- usuário convidado pelo OWNER
- acesso de leitura e acompanhamento
- pode comentar em findings, abrir tickets e baixar relatórios
- não pode editar a empresa nem convidar outros usuários

## Atribuição
- OWNER: definido junto da empresa e da assinatura na ativação da adesão aprovada, ou na recuperação autorizada de onboarding legado
- MEMBER: associado à empresa do OWNER emissor no consumo de um convite empresarial

## Campo no banco
O campo `User.companyRole` aceita `OWNER`, `MEMBER` ou `null`. ADMIN e PENTESTER usam `null`.

## Regras relacionadas
- [[RN01 - Empresa pode ter multiplos usuarios cliente]] — mais de um CLIENT por Company
- [[RN02 - Usuario pertence a no maximo uma Company]] — cada usuário tem no máximo um companyRole

## Relacionado
[[Roles]]
[[Matriz de Permissoes]]
[[Regras de Ownership]]
[[User]]
[[Company]]
[[ADR-058 - Adesao B2B, equipes e revogacao de sessoes]]
