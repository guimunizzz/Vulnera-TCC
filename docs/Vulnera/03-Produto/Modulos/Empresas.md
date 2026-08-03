---
type: funcionalidade
tags: [feature]
status: ativo
---

# Empresas

## Objetivo
Gerenciar as empresas-cliente da consultoria: cadastro, visualização, usuários vinculados e histórico de projetos.

## Usuários envolvidos
- **Admin**: CRUD completo; vê todas as empresas
- **Cliente OWNER**: vê e edita apenas a própria empresa, convida usuários

## Capacidades

### Visão Admin
- listar todas as empresas-cliente com filtros (ativas, com assinatura pendente, etc.)
- visualizar dados da empresa (razão social, CNPJ, contato, plano ativo, data de assinatura, limite de aplicações)
- ver histórico de projetos da empresa
- gerenciar usuários vinculados à empresa

### Visão Cliente (OWNER)
- visualizar dados da própria empresa
- editar informações de contato da empresa
- convidar novos usuários (cria MEMBER) via e-mail
- visualizar usuários vinculados e seus papéis

## Campos principais da Company
- `legal_name`, `trade_name`, `cnpj` (único), `contact_email`, `contact_phone`
- plano ativo e status da assinatura (derivado da Subscription)
- contagem de Applications (vs limite do plano)

## Regras associadas
- [[RN01 - Empresa pode ter multiplos usuarios cliente]]
- [[RN02 - Usuario pertence a no maximo uma Company]]
- [[RN16 - Cliente so ve dados da propria Company]]

## Fluxos relacionados
- [[Fluxo - Onboarding]] — criação inicial da empresa
- [[Fluxo - Contratacao]] — ativação da assinatura
- [[Fluxo - Criacao de Aplicacao]] — próximo passo após ativação

## Dependências técnicas
- `GET /companies` (admin) · `GET /companies/:id` · `PUT /companies/:id`
- `GET /companies/:id/users` · `POST /companies/:id/users/invite`
- guard de ownership: CLIENT só acessa sua própria `company_id`

## Relacionado
[[Company]]
[[User]]
[[CompanyRole]]
[[Subscription]]
[[Application]]
