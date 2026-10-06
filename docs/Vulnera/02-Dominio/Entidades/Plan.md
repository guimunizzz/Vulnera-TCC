---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Plan

## Definição
Catálogo de planos de assinatura disponíveis na plataforma. Define os limites de uso que serão aplicados às empresas que assinarem aquele plano.

## Papel no sistema
Plano é a base do modelo comercial SaaS simulado do Vulnera. Cada `Subscription` está vinculada a um `Plan`, e os limites do plano são verificados em tempo de execução para controlar criação de aplicações e projetos simultâneos.

## Campos principais

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Identificador único |
| `name` | string | Nome do plano: `BASIC`, `PRO`, `Enterprise` |
| `app_limit` | int | Número máximo de `Application` ativas |
| `concurrent_project_limit` | int | Número máximo de `Project` simultâneos |
| `includes_remediation` | boolean | Define se o serviço de remediação está incluso |
| `monthly_price` | decimal | Valor mensal simulado (sem cobrança real) |
| `is_active` | boolean | Indica se o plano está disponível para novas assinaturas |

## Planos previstos no MVP

| Plano | Aplicações | Projetos simultâneos | Remediação | Suporte |
|---|---|---|---|---|
| `BASIC` | 2 | 1 | Não | Suporte básico |
| `PRO` | 5 | 3 | Sim | Suporte padrão |
| `Enterprise` | Ilimitado | Ilimitado | Sim | Suporte prioritário |

> Valores monetários são simulados. Não há integração com gateway de pagamento.

## Relacionamentos
- possui múltiplas [[Subscription]] vinculadas
- limites definidos aqui são verificados ao criar [[Application]] e [[Project]]

## Regras associadas
- [[RN03 - Limite de aplicacoes por plano]]
- [[RN07 - Projeto exige assinatura ativa]]

## Estados / enums
`Plan` não possui máquina de estados própria. O campo `is_active` controla se o plano está disponível para novas contratações sem excluir assinaturas existentes.

## Permissões / visibilidade
- leitura pública: qualquer visitante pode ver os planos disponíveis (landing page)
- escrita: exclusiva do ADMIN (criação, edição, ativação/desativação de planos)
- CLIENT e PENTESTER podem consultar apenas o plano vinculado à sua Subscription

## Riscos de inconsistência
- alterar `app_limit` em um plano ativo pode criar divergência com assinaturas em andamento que já ultrapassaram o novo limite — recomendado aplicar mudança apenas a novas assinaturas
- desativar um plano (`is_active = false`) não cancela assinaturas existentes; apenas impede novas contratações
- `concurrent_project_limit` deve ser verificado no momento da criação do Project, não na assinatura

## Nota de implementação — Issue #20 (decisão em 2026-10-01)

O schema vigente chama os campos de `maxProjects` e `includesRemediation`. Para
Project, `maxProjects` conta os estados simultâneos `PENDING`, `IN_PROGRESS` e
`IN_REVIEW`; `COMPLETED` não ocupa capacidade. A opção `hasRemediation` só pode
ser solicitada quando `includesRemediation` do Plan da subscription `ACTIVE` da
empresa da Application for verdadeiro. A subscription e o Plan são resolvidos
pela empresa da Application selecionada, inclusive quando quem cria é ADMIN.

**Implementação — CP-3 da Issue #20 (validada em 2026-10-01):** o serviço usa o
Plan da subscription `ACTIVE` da empresa da Application escolhida. `maxProjects`
considera apenas `PENDING`, `IN_PROGRESS` e `IN_REVIEW`; `COMPLETED` não ocupa
capacidade. A criação e a transição de `hasRemediation: false` para `true` só
passam quando o plano inclui o serviço. Testes focais API: 24/24; cobertura de
`project.service`: 100% linhas/funções, 84,31% branches, 93,2% statements; build
API host aprovado.

A contagem de capacidade e a verificação RN05 não são serializadas com create;
concorrência pode exceder o limite ou produzir duplicidade e continua sem
garantia nesta entrega. Detalhes: [[ADR-044 - Regras comerciais para criar Project]].

## Links relacionados
[[Subscription]]
[[RN03 - Limite de aplicacoes por plano]]
[[RN07 - Projeto exige assinatura ativa]]
[[Assinaturas]]
[[MOC - Dominio]]
