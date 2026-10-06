---
type: decisao
tags: [decision, application, authorization, multi-tenant]
status: vigente
codigo: ADR-043
data: 2026-09-30
---

# ADR-043 - Alvo administrativo explícito na criação de Application

## Contexto

`User.companyId` é opcional e ADMIN opera sobre várias empresas. `Application`,
por sua vez, exige um `companyId`. O fluxo original derivava esse vínculo do
usuário autenticado, o que funciona para CLIENT mas impede ADMIN sem empresa de
criar uma aplicação para clientes existentes. A Issue #19 pede seleção
explícita da empresa no formulário administrativo e preservação do isolamento
de CLIENT.

O guia do projeto proíbe aceitar `companyId` do body como regra geral. O alvo
administrativo é uma exceção restrita ao caso de criação e precisa ser
documentada para não se tornar um caminho genérico de escolha de tenant.

## Decisão

- No `POST /api/applications`, ADMIN informa a empresa de destino em
  `companyId`. O service valida que a empresa existe e aplica a ela as regras
  comerciais vigentes: assinatura `ACTIVE` e vaga no limite de aplicações do
  plano ativo.
- CLIENT continua derivando a empresa de `User.companyId` carregado do banco.
  Qualquer `companyId` enviado por CLIENT é ignorado; usuário sem vínculo não
  pode escolher uma empresa no body.
- PENTESTER continua sem permissão para criar aplicações.
- `companyId` não é campo de update. Uma aplicação mantém a empresa de origem
  após a criação, conforme RN04.
- A UI de ADMIN precisa exigir seleção explícita, inclusive quando o usuário
  administrador tem um `companyId` associado. A ausência de empresas deve ser
  apresentada como estado vazio próprio do ADMIN.

Para a UI, o formulário de ADMIN usa um `<select>` nativo dentro do `Dialog`,
estilizado com `CLASSES_CONTROLE`. O `Select` customizado existente monta seu
painel em portal sibling fora do conteúdo do modal (`z-dropdown` abaixo de
`z-modal`); o modal aplica `inert` aos siblings e o dismiss trata interação no
portal externo como clique fora, bloqueando a seleção. A solução fica local a
esta tela e mantém foco e teclado dentro do diálogo. A correção geral da
coordenação entre portais e overlays segue como L-19 no backlog.

Esta exceção não autoriza `companyId` em DTO genérico, atualização, query,
header ou outras rotas. A autorização e a resolução efetiva do tenant continuam
sendo responsabilidade do service; a validação do formulário é complementar.

## Consequências

- ADMIN sem empresa vinculada pode criar aplicações em empresas existentes,
  sem receber um tenant artificial no JWT.
- CLIENT continua limitado à própria empresa, mesmo que altere manualmente a
  requisição.
- A empresa selecionada precisa cumprir RN03/RN07; existir no catálogo não
  implica ter assinatura ativa ou vaga disponível.
- O schema, migrations e JWT não precisam mudar.
- O contrato web de update deve excluir `companyId`, e a rota de update deve
  continuar ignorando esse campo.

## Alternativas consideradas

**Derivar o alvo de `User.companyId` para todos os papéis.** Rejeitada: ADMIN
global pode não ter empresa vinculada e precisa escolher entre os clientes.

**Usar `Company.planId` ou confiar em qualquer `companyId` do cliente.**
Rejeitada: o plano vigente vem de `Subscription.status === ACTIVE`, e um CLIENT
não pode escolher o tenant de outra empresa.

**Adicionar endpoint ou migration para o seletor.** Rejeitada: `GET
/api/companies` já lista empresas para ADMIN; as relações e gates necessários
já existem no schema e nos services.

## Relacionado

- `docs/Vulnera/02-Dominio/Regras de Negocio/RN04 - Application pertence a uma unica Company.md`
- `docs/Vulnera/02-Dominio/Regras de Negocio/RN16 - Cliente so ve dados da propria Company.md`
- `Discovery-Planejamento-Issue-19-Vulnera.md`
- [Issue #19](https://github.com/guimunizzz/Vulnera-TCC/issues/19)
