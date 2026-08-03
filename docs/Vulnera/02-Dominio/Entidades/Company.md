---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# Company

## Definição
Representa a empresa cliente contratante dos serviços do Vulnera.

## Papel no sistema
Agrupa usuários cliente, aplicações, assinaturas, projetos, tickets e avaliações de maturidade.

## Relacionamentos
- possui múltiplos [[User]]
- possui múltiplas [[Application]]
- possui múltiplas [[Subscription]]
- possui [[SupportTicket]]
- possui [[MaturityAssessment]]

## Regras associadas
- [[RN01 - Empresa pode ter multiplos usuarios cliente]]
- [[RN03 - Limite de aplicacoes por plano]]
- [[RN07 - Projeto exige assinatura ativa]]
- [[RN16 - Cliente so ve dados da propria Company]]

## Observações
A Company é o limite principal de escopo de acesso para o cliente.