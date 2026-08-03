---
type: fluxo
tags: [feature, flow]
status: ativo
---

# Fluxo - Onboarding

## Objetivo
Permitir que uma empresa contratante se cadastre na plataforma pela primeira vez, criando sua conta e selecionando um plano de análise.

## Ator principal
Cliente (futuro `OWNER` de uma Company)

## Pré-condições
- nenhuma autenticação necessária
- o visitante acessou a landing page pública

## Passos principais

1. Visitante acessa a landing page e compara planos disponíveis
2. Clica em "Contratar" ou "Criar conta"
3. Preenche formulário com dados da empresa (`legal_name`, `trade_name`, `cnpj`, `contact_email`, `contact_phone`)
4. Preenche dados pessoais (nome, e-mail, senha) — cria o primeiro `User` com `companyRole = OWNER`
5. Seleciona o plano desejado (Basic, Pro, Pro+)
6. Sistema cria a `Company`, o `User` OWNER e a `Subscription` com status `PENDING_APPROVAL`
7. Sistema dispara notificação para o Admin (e-mail + in-app) sobre nova assinatura
8. Cliente recebe confirmação de cadastro e instrução de aguardar aprovação
9. Enquanto aguarda, cliente tem acesso limitado à plataforma (sem criar applications ou projetos)

## Regras de negócio relacionadas
- [[RN01 - Empresa pode ter multiplos usuarios cliente]] — o OWNER criado pode convidar MEMBERs depois
- [[RN02 - Usuario pertence a no maximo uma Company]] — o OWNER está vinculado a esta Company
- [[RN07 - Projeto exige assinatura ativa]] — nada pode ser criado antes da aprovação
- [[RN22 - Nova assinatura notifica Admin]] — Admin recebe alerta imediato

## Pós-condições
- `Company` criada no banco
- `User` OWNER criado e vinculado à Company
- `Subscription` em status `PENDING_APPROVAL`
- Admin notificado para revisar

## Notas e riscos
- a aprovação é manual — o cliente pode esperar horas ou dias
- se o Admin rejeitar, o cliente recebe justificativa
- o fluxo de contratação continua em [[Fluxo - Contratacao]] (aprovação pelo Admin)

## Relacionado
[[Fluxo - Contratacao]]
[[Autenticacao]]
[[Assinaturas]]
[[Company]]
[[User]]
[[Subscription]]
[[Maquina - Subscription]]
