---
type: fluxo
tags: [feature, flow]
status: ativo
---

# Fluxo - Contratacao

## Objetivo
Descrever o processo de aprovação (ou rejeição) de uma assinatura pelo Admin após o cadastro do cliente.

## Ator principal
Admin (aprovação) · Cliente OWNER (lado do cliente)

## Pré-condições
- `Subscription` existe com status `PENDING_APPROVAL` (criada no [[Fluxo - Onboarding]])
- Admin recebeu notificação por e-mail e in-app

## Passos principais

### Caminho: aprovação
1. Admin acessa a lista de assinaturas pendentes
2. Admin revisa os dados da empresa (razão social, CNPJ, contato)
3. Admin aprova a assinatura
4. Sistema muda status da `Subscription` para `ACTIVE`
5. Sistema envia e-mail de boas-vindas ao cliente OWNER
6. Cliente recebe notificação in-app e pode começar a usar a plataforma

### Caminho: rejeição
1. Admin revisa os dados e identifica problema (dados inválidos, duplicidade, etc.)
2. Admin rejeita com justificativa
3. Sistema muda status para `REJECTED`
4. Cliente recebe e-mail/notificação com justificativa

### Add-on: Remediação inclusa (ao criar projeto)
- se o plano inclui `includes_remediation`, projetos podem ter `hasRemediationService = true` por padrão
- isso altera quem pode transicionar status de findings (ver [[RN13 - Fluxo com remediation service]])

## Regras de negócio relacionadas
- [[RN07 - Projeto exige assinatura ativa]] — até aqui, nenhum projeto pode ser aberto
- [[RN22 - Nova assinatura notifica Admin]] — gatilho do fluxo
- [[RN03 - Limite de aplicacoes por plano]] — o plano aprovado define limites a partir de agora

## Pós-condições (aprovação)
- `Subscription.status = ACTIVE`
- cliente pode cadastrar Applications (respeitando limite do plano)
- cliente pode abrir Projects

## Pós-condições (rejeição)
- `Subscription.status = REJECTED`
- cliente não pode operar na plataforma

## Relacionado
[[Fluxo - Onboarding]]
[[Fluxo - Criacao de Aplicacao]]
[[Assinaturas]]
[[Plan]]
[[Subscription]]
[[Maquina - Subscription]]
[[RN13 - Fluxo com remediation service]]
[[RN14 - Fluxo sem remediation service]]
