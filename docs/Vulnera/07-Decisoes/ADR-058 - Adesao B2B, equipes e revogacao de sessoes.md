---
type: decisao
tags: [decision, security, onboarding, tenancy]
status: vigente
codigo: ADR-058
data: 2026-11-25
---

# ADR-058 · Adesão B2B, equipes e revogação de sessões

## Contexto

A Issue #51 condicionou a criação de contas à aprovação administrativa. O fluxo legado ainda apresentava um segundo onboarding para criar a empresa e solicitar uma assinatura. Uma equipe empresarial precisa integrar colaboradores no mesmo tenant, com delegação limitada ao OWNER e revogação capaz de invalidar sessões já emitidas.

## Decisão

- A adesão de uma empresa registra os dados analisados e congela as condições do plano escolhido no envio. A aprovação vincula essas condições ao convite. A ativação revalida o plano, a solicitação e a unicidade sob as regras transacionais da operação. Cria Company, CLIENT/OWNER e Subscription ACTIVE e registra o consumo e a auditoria em uma transação.
- Uma alteração material ou a inativação do plano impede nova aprovação, reenvio e ativação. O ADMIN pode encerrar uma aprovação incompatível com motivo, revogar o convite e liberar a reserva para uma nova adesão. O evento anterior de aprovação continua consultável.
- CompanyInvitation registra em domínio próprio o destinatário, emissor, empresa, hash, validade e estado. A associação ao tenant vem da empresa do OWNER autorizado. A ativação consome o convite e cria exclusivamente CLIENT/MEMBER na empresa existente. A entrega SMTP ocorre após o commit.
- A API confere o estado e o papel persistidos em toda requisição autenticada. O campo `sessionVersion` torna definitiva a invalidação de JWT anterior à desativação. Tokens legados com assinatura e validade corretas usam versão 0. A rotação de refresh revoga o token anterior e registra o sucessor na mesma transação.
- A desativação conserva a identidade histórica e invalida também refresh e notificações push. O último OWNER ativo recebe proteção transacional. A recuperação explícita por ADMIN reativa o OWNER histórico apenas na empresa original e quando ela estiver sem OWNER ativo.
- A recuperação de onboarding exige uma permissão persistida, concedida a CLIENT sem empresa na migration ou pela ativação de pedido anterior à wave sem snapshot. O vínculo à empresa consome a permissão.
- Novas escritas de CNPJ usam 14 dígitos. As consultas de colisão abrangem a forma com e sem máscara. Registros anteriores preservam sua representação. O CNPJ é opcional e a validação de formato tem finalidade cadastral.

## Concorrência

Operações de equipe e comerciais que alteram uma empresa existente bloqueiam Company antes das identidades envolvidas. Múltiplos usuários são bloqueados por ID em ordem estável. A autenticação bloqueia User antes de RefreshToken. A adesão começa pelo pedido e pelo convite, revalida o plano sob lock e cria uma nova empresa. A constraint de CNPJ canônico julga corridas entre novas escritas. As decisões comerciais legadas serializam a leitura e atualização das assinaturas pela empresa.

## Consequências

As respostas de ativação terminam em 204 e o login inicia a sessão. O escopo de cada endpoint usa identidade ativa, papéis persistidos e vínculo ao recurso. ADMIN tem exceções explícitas. PENTESTER mantém autorização por ProjectMember nas superfícies vinculadas a tenants e a exceção global prévia de agendamento DAST por URL sem empresa, aplicação ou projeto.

Cada alteração de plano ativa para novas adesões pode exigir resolução dos pedidos compatíveis com a oferta anterior. Planos de assinaturas ativas conservam condições materiais. Há uma janela de falha de entrega após o commit SMTP, coberta por reenvio.

## Atualização de 2026-11-28

A consulta de equipe pode ser usada pelo MEMBER com ID, nome e papel dos integrantes ativos da própria empresa. O diretório legado de usuários entrega só ID e nome na listagem e na leitura de colegas pelo CLIENT sem papel OWNER. O perfil próprio continua completo. OWNER e ADMIN preservam as projeções de gestão dentro de seus escopos.

## Relacionado

- [[ADR-057 - Fundacao do acesso controlado]]
- [[ADR-056 - Fila BullMQ com worker desacoplavel e scans DAST agendados]]
- [[Padrao - Autenticacao e JWT]]
