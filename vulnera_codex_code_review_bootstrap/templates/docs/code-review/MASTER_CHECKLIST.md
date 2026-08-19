# Vulnera — Checklist Mestre de Implementação

> **Finalidade:** reconstruir, com rastreabilidade, tudo que o Vulnera deve possuir segundo a documentação fornecida. Este documento foi preparado para uma etapa posterior de auditoria contra o código.
>
> **Regra desta versão:** nenhum item está marcado como concluído. `BACKLOG.md`, `PRD_VIVO.md`, históricos de fase e o código serviram para entender decisões e contratos atuais, mas **não** para transformar esta checklist em auditoria de implementação.
>
> **Marcadores:** `⚠️ Especificação incompleta ou ambígua` = falta decisão suficiente; `⚠️ Conflito de especificação` = fontes descrevem comportamentos incompatíveis; `🚧 Fora do MVP / trabalho futuro` = existe documentação, mas decisão posterior retirou o item da entrega atual.

---

## 0. Critérios de leitura, precedência e rastreabilidade

- [ ] Tratar `docs/Vulnera/00-Hub/Contexto Mestre v4.md` como a nota central de contexto e domínio, verificando decisões posteriores antes de aplicar qualquer trecho antigo.
  - **Fonte(s):** `00-Hub/Contexto Mestre v4.md`; `00-Hub/Claude - Guia Operacional.md`
- [ ] Consultar `PRD_VIVO.md`, `CLAUDE.md`, `Contexto Mestre v4` e `app/api/prisma/schema.prisma` como conjunto operacional para entender o estado/contratos atuais.
  - **Fonte(s):** `ROADMAP_PROMPTS.md` — leitura obrigatória por fase
- [ ] Usar `schema.prisma` como autoridade para nomes e campos físicos reais quando uma nota conceitual usar nomenclatura diferente.
  - **Fonte(s):** `ROADMAP_PROMPTS.md`; `app/api/prisma/schema.prisma`
- [ ] Não usar `vulnera.md`, `Fonte Original - MVP Vulnera.md` ou `repomix-output.xml` histórico para orientar implementação quando contradisserem a versão atual.
  - **Fonte(s):** `ROADMAP_PROMPTS.md`; `Fonte Original - MVP Vulnera.md`
- [ ] Preservar documentos históricos como material de evolução do TCC e como evidência de decisões de escopo, sem promovê-los silenciosamente a requisito vigente.
- [ ] Quando ADR posterior declarar que uma decisão anterior foi substituída/encerrada, aplicar a decisão posterior e registrar a evolução.
- [ ] Quando duas fontes vigentes não tiverem relação explícita de substituição, registrar `⚠️ Conflito de especificação` em vez de escolher arbitrariamente.
- [ ] Quando faltar informação essencial para comportamento/contrato, registrar `⚠️ Especificação incompleta ou ambígua` e não inventar requisito.
- [ ] Consolidar requisitos duplicados e listar múltiplas fontes em um único item sempre que possível.
- [ ] Manter as mudanças estruturais sincronizadas entre nota canônica, Changelog, ADR e MOC quando aplicável.
  - **Fonte(s):** `08-Operacao/Runbooks/Como atualizar o contexto mestre.md`

## 1. Identidade, objetivo e limites do produto

- [ ] Implementar o Vulnera como plataforma de **gestão, acompanhamento e entrega de análises de segurança**, e não como plataforma de execução real de ataques.
  - **Fonte(s):** `01-Contexto/Visao Geral.md`; ADR-001
- [ ] Centralizar cadastro de empresas, usuários, aplicações, projetos, findings, evidências, relatórios e auditoria.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Objetivos.md`
- [ ] Permitir contratação simulada de planos e aprovação administrativa de assinaturas.
  - **Fonte(s):** `03-Produto/Modulos/Assinaturas.md`; Fase 3
- [ ] Permitir abertura e acompanhamento de análises de segurança associadas a aplicações da empresa.
  - **Fonte(s):** `03-Produto/Modulos/Projetos.md`; RN05–RN07
- [ ] Permitir registro de findings com CVSS v3.1 e categoria OWASP Top 10 2021.
  - **Fonte(s):** `03-Produto/Modulos/Findings.md`; RN09–RN11
- [ ] Permitir anexação/consulta segura de evidências por finding.
  - **Fonte(s):** `03-Produto/Modulos/Evidencias.md`; Fase 5
- [ ] Permitir comunicação assíncrona por comentários em findings.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Gerar relatório executivo e relatório técnico em PDF no cliente.
  - **Fonte(s):** ADR-003; `03-Produto/Modulos/Relatorios.md`; Fase 6
- [ ] Disponibilizar dashboards diferentes para ADMIN, CLIENT e PENTESTER.
  - **Fonte(s):** `03-Produto/Modulos/Dashboard.md`; Fase 6
- [ ] Disponibilizar painel analítico por Application com postura, evolução, insights e comparação.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Disponibilizar avaliação simplificada de maturidade de segurança.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Disponibilizar aplicativo mobile read-only/read-mostly para CLIENT.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Disponibilizar push mobile para eventos ratificados no escopo.
  - **Fonte(s):** `04-Arquitetura/Expo Push.md`; Fase 7
- [ ] Garantir rastreabilidade de ações sensíveis com AuditLog.
  - **Fonte(s):** `02-Dominio/Conceitos/Auditoria.md`; RN15/RN20/RN21
- [ ] Garantir isolamento multi-tenant por Company e por membership de Project.
  - **Fonte(s):** RN16; RN17; `Multi-tenancy por escopo.md`
- [ ] Manter o projeto demonstrável como TCC e laboratório didático com aplicações/casos realistas.
  - **Fonte(s):** `09-TCC/Casos Didaticos.md`; Fase 8

### 1.1 Problemas que a solução deve endereçar

- [ ] Evitar escopo de análise mal registrado ou dissociado da aplicação alvo.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Proposta de Valor.md`
- [ ] Evitar evidências dispersas sem contexto do finding.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Proposta de Valor.md`
- [ ] Preservar histórico de alterações de status e severidade.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Proposta de Valor.md`
- [ ] Dar ao cliente clareza sobre andamento, risco e entregáveis.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Proposta de Valor.md`
- [ ] Padronizar documentação técnica de findings e recomendações.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Proposta de Valor.md`
- [ ] Separar visão executiva dos detalhes técnicos.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Proposta de Valor.md`
- [ ] Permitir ao time demonstrar isolamento de dados entre empresas.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Proposta de Valor.md`
- [ ] Permitir demonstrar práticas DevSecOps e desenvolvimento seguro na própria solução.
  - **Fonte(s):** `01-Contexto/Problema e Oportunidade.md`; `01-Contexto/Proposta de Valor.md`

## 2. Atores, roles, company roles e autorização


### 2.1 Roles globais

- [ ] Suportar exatamente as roles globais `ADMIN`, `CLIENT` e `PENTESTER` no MVP.
  - **Fonte(s):** `02-Dominio/Permissoes/Roles.md`; `CompanyRole.md`; RN02
- [ ] Impedir que registro público defina role administrativa ou de pentester.
  - **Fonte(s):** `02-Dominio/Permissoes/Roles.md`; `CompanyRole.md`; RN02
- [ ] Associar `companyRole` apenas a usuários CLIENT.
  - **Fonte(s):** `02-Dominio/Permissoes/Roles.md`; `CompanyRole.md`; RN02
- [ ] Suportar `companyRole=OWNER` e `companyRole=MEMBER`.
  - **Fonte(s):** `02-Dominio/Permissoes/Roles.md`; `CompanyRole.md`; RN02
- [ ] Manter ADMIN e PENTESTER sem Company direta, salvo decisão futura explícita.
  - **Fonte(s):** `02-Dominio/Permissoes/Roles.md`; `CompanyRole.md`; RN02
- [ ] Impedir usuário CLIENT de pertencer simultaneamente a mais de uma Company.
  - **Fonte(s):** `02-Dominio/Permissoes/Roles.md`; `CompanyRole.md`; RN02

### 2.2 ADMIN

- [ ] Permitir visão global das Companies e do estado operacional da consultoria.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Permitir CRUD/gestão do catálogo de Plans.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Permitir aprovação e rejeição de Subscriptions.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Permitir atribuição e remoção de PENTESTER em Projects.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Permitir visualizar Projects/Findings de qualquer Company.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Permitir escrita administrativa em Findings conforme regras do recurso.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Permitir gerar/baixar Reports de Projects elegíveis.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Permitir preencher MaturityAssessment.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Permitir visualizar dashboard global e métricas permitidas.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19
- [ ] Auditar ações administrativas sensíveis.
  - **Fonte(s):** `Matriz de Permissoes.md`; `Jornada - Admin.md`; RN15/RN19

### 2.3 CLIENT

- [ ] Restringir todo CLIENT aos dados da própria Company.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8
- [ ] Permitir listar e consultar Applications da própria Company.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8
- [ ] Permitir listar e consultar Projects da própria Company.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8
- [ ] Permitir consultar Findings da própria Company.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8
- [ ] Manter CLIENT read-only para criação/edição/transição/override de Vulnerability no MVP.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8
- [ ] Permitir CLIENT comentar em findings visíveis.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8
- [ ] Permitir CLIENT gerar/baixar relatório quando o Project estiver elegível.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8
- [ ] Permitir CLIENT visualizar maturidade da própria Company.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8
- [ ] Permitir CLIENT usar o aplicativo mobile do MVP.
  - **Fonte(s):** RN16; `Matriz de Permissoes.md`; Fases 5–8

### 2.4 OWNER e MEMBER

- [ ] Fazer o primeiro CLIENT criado/vinculado pelo onboarding tornar-se `OWNER`.
  - **Fonte(s):** RN01; `Regras de Ownership.md`; `Matriz de Permissoes.md`; `Empresas.md`
- [ ] Permitir OWNER editar os dados administrativos autorizados da própria Company.
  - **Fonte(s):** RN01; `Regras de Ownership.md`; `Matriz de Permissoes.md`; `Empresas.md`
- [ ] Permitir OWNER visualizar usuários vinculados à própria Company.
  - **Fonte(s):** RN01; `Regras de Ownership.md`; `Matriz de Permissoes.md`; `Empresas.md`
- [ ] Permitir OWNER convidar novos usuários `MEMBER` se essa capacidade permanecer no MVP.
  - **Fonte(s):** RN01; `Regras de Ownership.md`; `Matriz de Permissoes.md`; `Empresas.md`
- [ ] Impedir convite/vínculo de usuário que já pertença a outra Company.
  - **Fonte(s):** RN01; `Regras de Ownership.md`; `Matriz de Permissoes.md`; `Empresas.md`
- [ ] Dar a MEMBER o escopo de leitura tenant-wide previsto na matriz, sem privilégios administrativos do OWNER.
  - **Fonte(s):** RN01; `Regras de Ownership.md`; `Matriz de Permissoes.md`; `Empresas.md`
- [ ] Permitir MEMBER cadastrar Application se a matriz canônica permanecer vigente.
  - **Fonte(s):** RN01; `Regras de Ownership.md`; `Matriz de Permissoes.md`; `Empresas.md`
- [ ] Permitir MEMBER abrir Project se a matriz canônica permanecer vigente e os gates de plano/assinatura forem satisfeitos.
  - **Fonte(s):** RN01; `Regras de Ownership.md`; `Matriz de Permissoes.md`; `Empresas.md`
- [ ] ⚠️ Especificação incompleta ou ambígua — fechar o contrato de convite de MEMBER: token, expiração, aceite, senha inicial, reenvio, revogação e comportamento para e-mail já cadastrado.
  - **Fonte(s):** `Empresas.md`; RN01; roadmap v4 não possui checkpoint específico

### 2.5 PENTESTER

- [ ] Permitir listar somente Projects nos quais exista ProjectMember para o PENTESTER.
  - **Fonte(s):** RN17; Fases 4–7
- [ ] Permitir consultar Findings apenas em Projects atribuídos.
  - **Fonte(s):** RN17; Fases 4–7
- [ ] Permitir criar/editar findings apenas em Projects atribuídos.
  - **Fonte(s):** RN17; Fases 4–7
- [ ] Permitir anexar Evidence apenas em Projects atribuídos.
  - **Fonte(s):** RN17; Fases 4–7
- [ ] Permitir comentar em findings visíveis.
  - **Fonte(s):** RN17; Fases 4–7
- [ ] Permitir gerar relatório de Project atribuído quando elegível.
  - **Fonte(s):** RN17; Fases 4–7
- [ ] Impedir gerenciar catálogo de Applications da Company no escopo atual.
  - **Fonte(s):** RN17; Fases 4–7
- [ ] Impedir uso do app mobile do MVP.
  - **Fonte(s):** RN17; Fases 4–7

### 2.6 Multi-tenancy e ownership

- [ ] Tratar Company como fronteira principal de tenant.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Aplicar isolamento no backend; nunca depender de filtro visual do frontend.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Derivar `companyId` do ator/recurso pai quando possível, e não confiar no body.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Filtrar listagens CLIENT por Company antes de retornar dados.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Filtrar listagens PENTESTER por membership.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Validar ownership também em leitura individual por ID.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Validar Project → Application → Company antes de ações sensíveis.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Validar Vulnerability → Project/Application/Company antes de leitura/escrita.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Ignorar/rejeitar mass assignment de `companyId`, `projectId`, `applicationId`, `createdBy`, `severityFinal` e outros campos derivados.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Manter testes canário `TEN-*` para provar isolamento cross-tenant.
  - **Fonte(s):** `Middlewares e Ownership.md`; RN06/RN16/RN17; Fase 5 hardening
- [ ] Documentar o trade-off de responder 403 em acesso cross-tenant, em vez de esconder existência com 404.
  - **Fonte(s):** `BACKLOG.md` L-04; `DECISIONS.md` D16.1

## 3. Arquitetura do monorepo e padrão de camadas


### 3.1 Estrutura

- [ ] Manter monorepo com `app/api`, `app/web` e `app/mobile`.
  - **Fonte(s):** `architecture.md`; ADR-009; `Estrutura Geral do Monorepo.md`
- [ ] Manter `config/` e `database/` no singular.
  - **Fonte(s):** `architecture.md`; ADR-009; `Estrutura Geral do Monorepo.md`
- [ ] Manter `controllers/`, `models/`, `repositories/`, `services/`, `factories/` e `middlewares/` no plural.
  - **Fonte(s):** `architecture.md`; ADR-009; `Estrutura Geral do Monorepo.md`
- [ ] Manter `routes/` e `utils/` conforme arquitetura atual.
  - **Fonte(s):** `architecture.md`; ADR-009; `Estrutura Geral do Monorepo.md`
- [ ] Manter schema e migrations Prisma em `app/api/prisma/`.
  - **Fonte(s):** `architecture.md`; ADR-009; `Estrutura Geral do Monorepo.md`
- [ ] Manter infraestrutura de execução versionada na raiz/infra conforme ADR vigente.
  - **Fonte(s):** `architecture.md`; ADR-009; `Estrutura Geral do Monorepo.md`

### 3.2 Backend Express

- [ ] Usar TypeScript strict.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Usar Express como framework HTTP.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Usar Prisma como ORM.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Usar MySQL 8 como banco definitivo.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Fazer apenas Repository acessar Prisma em lógica de domínio, salvo exceção técnica documentada.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Fazer Service conter regra de negócio sem depender de Express `Request/Response`.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Fazer Controller receber HTTP, validar entrada e traduzir erros.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Centralizar rotas em `routes/routes.ts`.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Registrar rotas literais (`/me`, `/pending`, `/current`, etc.) antes de `/:id`.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`
- [ ] Serializar respostas por DTO/Entity para evitar vazamento de campos internos.
  - **Fonte(s):** `Back-end Express.md`; ADR-009; `architecture.md`

### 3.3 Factory Method

- [ ] Manter `factories/` como camada obrigatória.
  - **Fonte(s):** ADR-019; `CLAUDE.md`; `DECISIONS.md` D1
- [ ] Criar factory para todo recurso com Controller.
  - **Fonte(s):** ADR-019; `CLAUDE.md`; `DECISIONS.md` D1
- [ ] Adotar arquivo `<recurso>.factory.ts`.
  - **Fonte(s):** ADR-019; `CLAUDE.md`; `DECISIONS.md` D1
- [ ] Adotar função `make<Recurso>Controller()`.
  - **Fonte(s):** ADR-019; `CLAUDE.md`; `DECISIONS.md` D1
- [ ] Montar Repository → Service → Controller na factory.
  - **Fonte(s):** ADR-019; `CLAUDE.md`; `DECISIONS.md` D1
- [ ] Consumir factory a partir da rota do recurso.
  - **Fonte(s):** ADR-019; `CLAUDE.md`; `DECISIONS.md` D1
- [ ] Manter cabeçalho pedagógico/documentação de camada conforme requisito acadêmico do repositório.
  - **Fonte(s):** ADR-019; `CLAUDE.md`; `DECISIONS.md` D1

### 3.4 Convenções de código

- [ ] Usar arquivos `<recurso>.<role>.ts` em kebab/lowercase consistente.
  - **Fonte(s):** `DECISIONS.md` D3/D4; `Guia de Estilo de Codigo.md`
- [ ] Usar classes em PascalCase.
  - **Fonte(s):** `DECISIONS.md` D3/D4; `Guia de Estilo de Codigo.md`
- [ ] Manter type + DTOs + Entity no mesmo `<recurso>.model.ts` enquanto o arquivo permanecer pequeno.
  - **Fonte(s):** `DECISIONS.md` D3/D4; `Guia de Estilo de Codigo.md`
- [ ] Evitar abstrações novas que não agreguem valor ao TCC/MVP.
  - **Fonte(s):** `DECISIONS.md` D3/D4; `Guia de Estilo de Codigo.md`
- [ ] Evitar lógica de negócio em rotas/controllers.
  - **Fonte(s):** `DECISIONS.md` D3/D4; `Guia de Estilo de Codigo.md`
- [ ] Evitar resposta HTTP em Repository.
  - **Fonte(s):** `DECISIONS.md` D3/D4; `Guia de Estilo de Codigo.md`

### 3.5 Validação e tratamento de erro

- [ ] Manter validação manual explícita no Controller no MVP atual.
  - **Fonte(s):** `DECISIONS.md` D5–D7; `Contexto Mestre v4.md`
- [ ] Validar obrigatoriedade, tipo, formato e tamanho antes de executar regra de negócio.
  - **Fonte(s):** `DECISIONS.md` D5–D7; `Contexto Mestre v4.md`
- [ ] Fazer Service lançar códigos estáveis em SCREAMING_SNAKE_CASE.
  - **Fonte(s):** `DECISIONS.md` D5–D7; `Contexto Mestre v4.md`
- [ ] Mapear erros no Controller para status HTTP e envelope de erro.
  - **Fonte(s):** `DECISIONS.md` D5–D7; `Contexto Mestre v4.md`
- [ ] Manter `try/catch` por método enquanto middleware global de erro estiver adiado.
  - **Fonte(s):** `DECISIONS.md` D5–D7; `Contexto Mestre v4.md`
- [ ] Não colocar mensagem humana/localizada como contrato do Service.
  - **Fonte(s):** `DECISIONS.md` D5–D7; `Contexto Mestre v4.md`
- [ ] Mapear código de erro a mensagem amigável no frontend.
  - **Fonte(s):** `DECISIONS.md` D5–D7; `Contexto Mestre v4.md`
- [ ] ⚠️ Conflito de especificação — definir um envelope de erro único: documentos antigos usam `{ error: "CODE" }`; Controllers atuais usam `code/message` em vários pontos.
  - **Fonte(s):** `DECISIONS.md` × contratos atuais do repositório
- [ ] ⚠️ Conflito de especificação — notas antigas de DTO/segurança ainda exigem NestJS `ValidationPipe`, `class-validator` e UUID; a arquitetura atual usa Express + validação manual + `cuid()`.
  - **Fonte(s):** `DTOs e Validacao.md`; `Padrao - Validacao de Entradas.md` × ADR/stack atual

## 4. Configuração, ambiente e infraestrutura


### 4.1 MySQL e Prisma

- [ ] Usar MySQL 8 como banco definitivo do MVP.
  - **Fonte(s):** ADR-015; `Banco de Dados MySQL.md`; `ORM Prisma.md`
- [ ] Tratar ADR-008 (migração futura obrigatória para PostgreSQL) como substituída por ADR-015.
  - **Fonte(s):** ADR-015; `Banco de Dados MySQL.md`; `ORM Prisma.md`
- [ ] Manter migrations Prisma versionadas.
  - **Fonte(s):** ADR-015; `Banco de Dados MySQL.md`; `ORM Prisma.md`
- [ ] Gerar Prisma Client antes de build/test que dependa dos tipos.
  - **Fonte(s):** ADR-015; `Banco de Dados MySQL.md`; `ORM Prisma.md`
- [ ] Usar `prisma migrate dev` no desenvolvimento e `prisma migrate deploy` no ambiente automatizado apropriado.
  - **Fonte(s):** ADR-015; `Banco de Dados MySQL.md`; `ORM Prisma.md`
- [ ] Manter seed base reproduzível/idempotente.
  - **Fonte(s):** ADR-015; `Banco de Dados MySQL.md`; `ORM Prisma.md`

### 4.2 Docker Compose

- [ ] Manter **um único** `docker-compose.yml` na raiz.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Suportar modo desenvolvimento com infraestrutura em containers e apps locais em hot reload.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Suportar modo demonstração com `docker compose up --build` para stack completa.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Incluir serviço MySQL `db`.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Incluir serviço `api` no modo stack completa.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Incluir serviço `web` no modo stack completa.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Manter Mailhog apenas como infraestrutura reservada/futura enquanto e-mail estiver fora do MVP.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Manter healthcheck do banco e dependência adequada da API.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Persistir banco em volume nomeado.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Persistir uploads em volume nomeado.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Usar hostname interno `db:3306` entre API e banco no Compose.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Usar endereço acessível do host para o browser chamar a API.
  - **Fonte(s):** ADR-022; `Docker Compose.md`; `docker-compose.yml`
- [ ] Não criar compose adicional em `app/api`.
  - **Fonte(s):** ADR-022

### 4.3 Variáveis de ambiente

- [ ] Manter `DATABASE_URL` em ambiente.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Manter segredo de access JWT em ambiente.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Manter segredo de refresh JWT em ambiente.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Configurar TTL de access token.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Configurar TTL de refresh token.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Configurar `BCRYPT_COST`.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Configurar `PORT` e `NODE_ENV`.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Configurar `CORS_ORIGIN`.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Configurar `UPLOADS_DIR`.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Configurar `VITE_API_URL` no web.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Configurar `EXPO_PUBLIC_API_URL` no mobile.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Não commitar `.env` real.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Manter `.env.example` sem segredos.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7
- [ ] Documentar uso de IP da LAN para aparelho físico Expo, não `localhost`.
  - **Fonte(s):** `.env.example`; ADR-020; Fase 7

### 4.4 Limites de infraestrutura

- [ ] 🚧 Não exigir deploy cloud/produção como parte do MVP.
  - **Fonte(s):** `Fora do Escopo.md`; ADR-014
- [ ] 🚧 Não introduzir Kubernetes.
  - **Fonte(s):** `Fora do Escopo.md`; ADR-014
- [ ] 🚧 Não introduzir Redis apenas para rate limiting/filas.
  - **Fonte(s):** `Fora do Escopo.md`; ADR-014
- [ ] 🚧 Não introduzir workers/queues/scheduler se não houver requisito vigente.
  - **Fonte(s):** `Fora do Escopo.md`; ADR-014

## 5. Modelo de dados e integridade


### 5.1 Regras gerais

- [ ] Manter o conjunto de models necessário ao domínio atual em `schema.prisma`.
  - **Fonte(s):** `schema.prisma`; `Campos Criticos.md`; `Entidades e Relacionamentos.md`
- [ ] Usar `cuid()` como estratégia física de ID enquanto o schema atual permanecer vigente.
  - **Fonte(s):** `schema.prisma`; `Campos Criticos.md`; `Entidades e Relacionamentos.md`
- [ ] Manter strings validadas pela aplicação para estados/roles conforme filosofia atual do schema, salvo migration futura.
  - **Fonte(s):** `schema.prisma`; `Campos Criticos.md`; `Entidades e Relacionamentos.md`
- [ ] Criar índices para filtros de tenant/status/relacionamentos usados com frequência.
  - **Fonte(s):** `schema.prisma`; `Campos Criticos.md`; `Entidades e Relacionamentos.md`
- [ ] Criar constraints de unicidade somente quando compatíveis com a regra de negócio final.
  - **Fonte(s):** `schema.prisma`; `Campos Criticos.md`; `Entidades e Relacionamentos.md`
- [ ] Usar cascata somente quando apagar o pai deve realmente apagar os filhos.
  - **Fonte(s):** `schema.prisma`; `Campos Criticos.md`; `Entidades e Relacionamentos.md`
- [ ] Nunca serializar hash de senha, refresh hash ou token de reset.
  - **Fonte(s):** `schema.prisma`; `Campos Criticos.md`; `Entidades e Relacionamentos.md`
- [ ] Nunca aceitar campos derivados/ownership como autoridade do payload.
  - **Fonte(s):** `schema.prisma`; `Campos Criticos.md`; `Entidades e Relacionamentos.md`

### 5.2 User

- [ ] Persistir `id`, `email` único, `password` contendo hash, `name` e `role`.
  - **Fonte(s):** `User.md`; `schema.prisma`
- [ ] Persistir `companyId` opcional.
  - **Fonte(s):** `User.md`; `schema.prisma`
- [ ] Persistir `companyRole` opcional.
  - **Fonte(s):** `User.md`; `schema.prisma`
- [ ] Persistir `expoPushToken` opcional.
  - **Fonte(s):** `User.md`; `schema.prisma`
- [ ] Manter timestamps.
  - **Fonte(s):** `User.md`; `schema.prisma`
- [ ] Manter relações com Company, tokens, membership, autoria, evidências, comentários e auditoria.
  - **Fonte(s):** `User.md`; `schema.prisma`
- [ ] Indexar `companyId`.
  - **Fonte(s):** `User.md`; `schema.prisma`

### 5.3 RefreshToken

- [ ] Persistir somente hash SHA-256 do refresh token.
  - **Fonte(s):** `RefreshToken.md`; `schema.prisma`; Auth atual
- [ ] Relacionar refresh ao User.
  - **Fonte(s):** `RefreshToken.md`; `schema.prisma`; Auth atual
- [ ] Registrar expiração.
  - **Fonte(s):** `RefreshToken.md`; `schema.prisma`; Auth atual
- [ ] Registrar revogação.
  - **Fonte(s):** `RefreshToken.md`; `schema.prisma`; Auth atual
- [ ] Permitir múltiplas sessões se essa política atual for mantida.
  - **Fonte(s):** `RefreshToken.md`; `schema.prisma`; Auth atual
- [ ] Remover tokens quando User for apagado, conforme relação física.
  - **Fonte(s):** `RefreshToken.md`; `schema.prisma`; Auth atual

### 5.4 PasswordResetToken

- [ ] 🚧 Manter model apenas como reserva/trabalho futuro enquanto recuperação de senha por e-mail estiver fora do MVP.
  - **Fonte(s):** `PasswordResetToken.md`; `Fora do Escopo.md`
- [ ] Se o fluxo voltar ao escopo, armazenar apenas hash, expiração e consumo/revogação, nunca token reutilizável em claro.
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`

### 5.5 Plan

- [ ] Persistir `name` único.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Persistir `maxApplications`.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Persistir `maxProjects`.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Persistir `includesRemediation`.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Persistir `price`.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Persistir `isActive`.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Seedar BASIC com limites previstos.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Seedar PRO com limites previstos.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Seedar Enterprise.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] Manter BASIC/PRO/Enterprise como nomes atuais, não PRO_PLUS legado.
  - **Fonte(s):** `Plan.md`; `schema.prisma`; `seed.ts`; Fase 3
- [ ] ⚠️ Especificação incompleta ou ambígua — formalizar a semântica de “ilimitado” do Enterprise; seed usa valor alto sentinela, mas o domínio não define contrato.
  - **Fonte(s):** `Plan.md`; `seed.ts`

### 5.6 Company

- [ ] Persistir identificador e nome da Company.
  - **Fonte(s):** `Company.md`; `schema.prisma`
- [ ] Persistir CNPJ único quando informado.
  - **Fonte(s):** `Company.md`; `schema.prisma`
- [ ] Manter `planId` apenas como vínculo/atalho se o schema o exige, sem substituir a Subscription ACTIVE como fonte comercial.
  - **Fonte(s):** `Company.md`; `schema.prisma`
- [ ] Manter relações com Users, Subscriptions, Applications, Projects, Vulnerabilities e AuditLogs.
  - **Fonte(s):** `Company.md`; `schema.prisma`
- [ ] ⚠️ Conflito de especificação — notas de produto/modelagem pedem razão social, nome fantasia, e-mail e telefone de contato; schema atual usa essencialmente `name`, `cnpj`, `planId`. Ratificar campos finais.
  - **Fonte(s):** `Empresas.md`; `Entidades e Relacionamentos.md` × `schema.prisma`

### 5.7 Subscription

- [ ] Persistir `companyId`, `planId`, `status`, `startDate`, `endDate` e `approvedBy` conforme schema.
  - **Fonte(s):** `Subscription.md`; `schema.prisma`; Fase 3
- [ ] Usar `PENDING_APPROVAL` como estado físico inicial atual.
  - **Fonte(s):** `Subscription.md`; `schema.prisma`; Fase 3
- [ ] Indexar `(companyId, status)`.
  - **Fonte(s):** `Subscription.md`; `schema.prisma`; Fase 3
- [ ] Garantir logicamente no Service no máximo uma Subscription ACTIVE por Company.
  - **Fonte(s):** `Subscription.md`; `schema.prisma`; Fase 3
- [ ] Revalidar unicidade de ACTIVE tanto na solicitação quanto na aprovação.
  - **Fonte(s):** `Subscription.md`; `schema.prisma`; Fase 3

### 5.8 Application

- [ ] Persistir `companyId`, `name`, `url`, `environment`, `techStack`, `description`, `isActive` e timestamps conforme schema atual.
  - **Fonte(s):** `Application.md`; RN04; `schema.prisma`
- [ ] Suportar environments `PROD`, `HOMOL` e `DEV`.
  - **Fonte(s):** `Application.md`; RN04; `schema.prisma`
- [ ] Indexar Company e atividade.
  - **Fonte(s):** `Application.md`; RN04; `schema.prisma`
- [ ] Usar soft delete (`isActive=false`).
  - **Fonte(s):** `Application.md`; RN04; `schema.prisma`
- [ ] Manter Company imutável após criação.
  - **Fonte(s):** `Application.md`; RN04; `schema.prisma`

### 5.9 Project

- [ ] Persistir `name`, `description`, `applicationId`, `companyId` e `status`.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4
- [ ] Persistir `analysisType`.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4
- [ ] Suportar `SAST`, `DAST`, `MATURITY`, `COMBO` como valores físicos atuais.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4
- [ ] Não introduzir `PENTEST` como analysisType sem nova decisão.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4
- [ ] Persistir `analysisLevel` com `BASIC`, `INTERMEDIATE`, `ADVANCED`.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4
- [ ] Persistir `hasRemediation`.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4
- [ ] Persistir `scopeIn`, `scopeOut` e `notes`.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4
- [ ] Persistir `requestedAt`, `startedAt`, `closedAt`.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4
- [ ] Indexar Company, Application e status.
  - **Fonte(s):** `Project.md`; `schema.prisma`; Fase 4

### 5.10 ProjectMember

- [ ] Persistir `projectId`, `userId` e timestamp de atribuição.
  - **Fonte(s):** `ProjectMember.md`; RN08; `schema.prisma`
- [ ] Impor unicidade `(projectId,userId)`.
  - **Fonte(s):** `ProjectMember.md`; RN08; `schema.prisma`
- [ ] Permitir apenas User com role PENTESTER como membro.
  - **Fonte(s):** `ProjectMember.md`; RN08; `schema.prisma`
- [ ] Permitir vários Pentesters em um Project.
  - **Fonte(s):** `ProjectMember.md`; RN08; `schema.prisma`
- [ ] Permitir um Pentester em vários Projects.
  - **Fonte(s):** `ProjectMember.md`; RN08; `schema.prisma`
- [ ] Preservar histórico de findings após remoção de membership.
  - **Fonte(s):** `ProjectMember.md`; RN08; `schema.prisma`

### 5.11 Vulnerability

- [ ] Persistir título, descrição, categoria OWASP, vetor e score CVSS.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017
- [ ] Persistir `severityCalculated` e `severityFinal` separadamente.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017
- [ ] Persistir motivo de override quando houver.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017
- [ ] Persistir impacto e recomendação.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017
- [ ] Persistir status.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017
- [ ] Manter `aiAssisted=false` enquanto IA estiver fora do MVP.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017
- [ ] Persistir Project/Application/Company e autoria de forma consistente.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017
- [ ] Permitir assignee opcional se esse campo permanecer no schema.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017
- [ ] Indexar Project/Application/Company/status/severidade.
  - **Fonte(s):** `Vulnerability.md`; `schema.prisma`; ADR-017

### 5.12 Evidence

- [ ] Persistir `vulnerabilityId`.
  - **Fonte(s):** `Evidence.md`; `schema.prisma`; Fase 5
- [ ] Persistir nome gerado pelo sistema e nome original sanitizado.
  - **Fonte(s):** `Evidence.md`; `schema.prisma`; Fase 5
- [ ] Persistir caminho controlado.
  - **Fonte(s):** `Evidence.md`; `schema.prisma`; Fase 5
- [ ] Persistir MIME detectado pelo conteúdo.
  - **Fonte(s):** `Evidence.md`; `schema.prisma`; Fase 5
- [ ] Persistir tamanho em bytes.
  - **Fonte(s):** `Evidence.md`; `schema.prisma`; Fase 5
- [ ] Persistir `proof` obrigatório.
  - **Fonte(s):** `Evidence.md`; `schema.prisma`; Fase 5
- [ ] Persistir `uploadedBy` derivado do ator.
  - **Fonte(s):** `Evidence.md`; `schema.prisma`; Fase 5
- [ ] Usar cascade compatível com hard delete de Vulnerability.
  - **Fonte(s):** `Evidence.md`; `schema.prisma`; Fase 5

### 5.13 VulnerabilityComment

- [ ] Persistir `vulnerabilityId`, `authorId`, `content` e timestamp.
  - **Fonte(s):** `VulnerabilityComment.md`; `schema.prisma`
- [ ] Indexar `vulnerabilityId`.
  - **Fonte(s):** `VulnerabilityComment.md`; `schema.prisma`
- [ ] Usar cascade compatível com remoção da Vulnerability.
  - **Fonte(s):** `VulnerabilityComment.md`; `schema.prisma`

### 5.14 AuditLog

- [ ] Persistir `actorId`, `companyId` opcional, `entityType`, `entityId`, `action`, `diffJson` e timestamp.
  - **Fonte(s):** `AuditLog.md`; ADR-025; `schema.prisma`
- [ ] Indexar entidade, Company e ator conforme consultas atuais.
  - **Fonte(s):** `AuditLog.md`; ADR-025; `schema.prisma`
- [ ] Tratar AuditLog como append-only.
  - **Fonte(s):** `AuditLog.md`; ADR-025; `schema.prisma`
- [ ] Não armazenar senha/token/segredo em `diffJson`.
  - **Fonte(s):** `AuditLog.md`; ADR-025; `schema.prisma`
- [ ] Usar AuditLog como fonte histórica para métricas de transição.
  - **Fonte(s):** `AuditLog.md`; ADR-025; `schema.prisma`

### 5.15 Maturidade

- [ ] Manter `MaturityDomain` como catálogo seedado.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] Manter `MaturityControl` como pergunta/controle pertencente a um Domain.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] Manter `MaturityAssessment` associado à Company e avaliador.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] Manter `MaturityScore` associado a assessment/control.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] Impor unicidade `(assessmentId,controlId)`.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] Validar score 1–5.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] Calcular média simples por domínio e geral segundo ADR-018.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] Não usar pesos no MVP.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] Não usar comparativo histórico no MVP.
  - **Fonte(s):** ADR-018; Fase 8; `schema.prisma`
- [ ] ⚠️ Conflito de especificação — schema ainda contém campos legados `level`/`isCompliant`, enquanto ADR-018 remove níveis nomeados e simplifica o cálculo. Definir se ficam apenas como legado ou serão removidos.
  - **Fonte(s):** ADR-018 × `schema.prisma`
- [ ] ⚠️ Conflito de especificação — documento antigo de MaturityAssessment associa avaliação a Project e prevê penalização por findings; Fase 8/schema tratam a avaliação como Company-level e média simples.
  - **Fonte(s):** `MaturityAssessment.md`; `Maturidade.md` × ADR-018/Fase 8

### 5.16 Notification

- [ ] Manter campos userId/category/title/message/isRead/sentAsPush/sentAsEmail se o model continuar no schema.
  - **Fonte(s):** `Notification.md`; `schema.prisma`
- [ ] Não interpretar `sentAsEmail` como e-mail funcional enquanto e-mail estiver fora do MVP.
  - **Fonte(s):** `Notification.md`; `schema.prisma`
- [ ] ⚠️ Especificação incompleta ou ambígua — model e RN22 preveem Notification in-app, mas roadmap atual não fecha endpoints/inbox web. Ratificar escopo.
  - **Fonte(s):** `Notification.md`; RN22; Fases 3/7

### 5.17 Report

- [ ] Persistir somente metadados do relatório, não o binário do PDF.
  - **Fonte(s):** `Report.md`; ADR-003; `schema.prisma`
- [ ] Persistir `projectId`, `type`, `title`, `generatedBy` e timestamp.
  - **Fonte(s):** `Report.md`; ADR-003; `schema.prisma`
- [ ] Suportar `EXECUTIVE` e `TECHNICAL`.
  - **Fonte(s):** `Report.md`; ADR-003; `schema.prisma`
- [ ] Indexar `projectId`.
  - **Fonte(s):** `Report.md`; ADR-003; `schema.prisma`

## 6. Autenticação, sessão e usuários


### 6.1 Registro

- [ ] Expor `POST /api/auth/register`.
  - **Fonte(s):** `Autenticacao.md`; `DECISIONS.md` D8; Auth atual
- [ ] Validar nome, e-mail e senha.
  - **Fonte(s):** `Autenticacao.md`; `DECISIONS.md` D8; Auth atual
- [ ] Normalizar e-mail de forma consistente.
  - **Fonte(s):** `Autenticacao.md`; `DECISIONS.md` D8; Auth atual
- [ ] Rejeitar e-mail duplicado.
  - **Fonte(s):** `Autenticacao.md`; `DECISIONS.md` D8; Auth atual
- [ ] Hash de senha com bcrypt cost configurado (12 no desenho atual).
  - **Fonte(s):** `Autenticacao.md`; `DECISIONS.md` D8; Auth atual
- [ ] Criar registro público como CLIENT por padrão.
  - **Fonte(s):** `Autenticacao.md`; `DECISIONS.md` D8; Auth atual
- [ ] Impedir escalada de role via payload.
  - **Fonte(s):** `Autenticacao.md`; `DECISIONS.md` D8; Auth atual
- [ ] Emitir tokens após registro se esse continuar sendo o contrato oficial.
  - **Fonte(s):** `Autenticacao.md`; `DECISIONS.md` D8; Auth atual

### 6.2 Login

- [ ] Expor `POST /api/auth/login`.
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`; `DECISIONS.md`; BACKLOG 8.10
- [ ] Validar credenciais obrigatórias.
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`; `DECISIONS.md`; BACKLOG 8.10
- [ ] Usar resposta equivalente para e-mail inexistente/senha incorreta.
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`; `DECISIONS.md`; BACKLOG 8.10
- [ ] Comparar senha com bcrypt.
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`; `DECISIONS.md`; BACKLOG 8.10
- [ ] Emitir access token de curta duração (~15 min).
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`; `DECISIONS.md`; BACKLOG 8.10
- [ ] Emitir refresh token (~7 dias).
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`; `DECISIONS.md`; BACKLOG 8.10
- [ ] Persistir somente hash do refresh.
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`; `DECISIONS.md`; BACKLOG 8.10
- [ ] Adicionar rate limiting de login na etapa final.
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md`; `DECISIONS.md`; BACKLOG 8.10

### 6.3 JWT e middleware

- [ ] Assinar JWT com segredo fora do código.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Padrao - Autenticacao e JWT.md`
- [ ] Usar payload mínimo de identidade/role.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Padrao - Autenticacao e JWT.md`
- [ ] Não incluir senha/hash/segredo.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Padrao - Autenticacao e JWT.md`
- [ ] Validar assinatura e expiração.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Padrao - Autenticacao e JWT.md`
- [ ] Retornar 401 para ausência/token inválido conforme contrato.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Padrao - Autenticacao e JWT.md`
- [ ] Popular ator autenticado para controllers/services sem acoplar Service ao Express.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Padrao - Autenticacao e JWT.md`

### 6.4 Refresh e rotação

- [ ] Expor `POST /api/auth/refresh`.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] Validar assinatura/expiração do refresh recebido.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] Calcular hash e localizar sessão no banco.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] Rejeitar token revogado.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] Revogar token antigo na rotação.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] Gerar novo par de tokens.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] Impedir reutilização do refresh antigo.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] No web, garantir que requests 401 concorrentes compartilhem um único refresh em andamento.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] Repetir requests enfileirados após refresh bem-sucedido.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue
- [ ] Limpar auth local se refresh falhar.
  - **Fonte(s):** Fase 2/3; `ROADMAP_PROMPTS.md` client refresh queue

### 6.5 Logout

- [ ] Expor `POST /api/auth/logout`.
  - **Fonte(s):** `Autenticacao.md`; Auth atual
- [ ] Revogar refresh correspondente.
  - **Fonte(s):** `Autenticacao.md`; Auth atual
- [ ] Fazer logout idempotente.
  - **Fonte(s):** `Autenticacao.md`; Auth atual
- [ ] Limpar estado/tokens do cliente.
  - **Fonte(s):** `Autenticacao.md`; Auth atual

### 6.6 Armazenamento de tokens

- [ ] Mobile deve armazenar sessão via `expo-secure-store`.
  - **Fonte(s):** Fase 7
- [ ] ⚠️ Conflito de especificação — secure-dev antigo recomenda refresh em cookie HttpOnly; web atual persiste access/refresh em Zustand/localStorage e envia refresh no body. Ratificar o trade-off final.
  - **Fonte(s):** `Padrao - Autenticacao e JWT.md` × Fase 3/cliente web atual

### 6.7 Recuperação de senha

- [ ] 🚧 Não exigir `forgot-password` no MVP atual.
  - **Fonte(s):** `Fora do Escopo.md`; ADR-014
- [ ] 🚧 Não exigir `reset-password` por e-mail no MVP atual.
  - **Fonte(s):** `Fora do Escopo.md`; ADR-014
- [ ] 🚧 Manter PasswordResetToken apenas como reserva enquanto o corte de escopo estiver vigente.
  - **Fonte(s):** `Fora do Escopo.md`; ADR-014

### 6.8 User CRUD

- [ ] Expor endpoint de usuário atual (`/users/me`).
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual
- [ ] Permitir ADMIN listar usuários globalmente.
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual
- [ ] Permitir CLIENT listar apenas usuários da própria Company, se necessário ao módulo Empresas.
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual
- [ ] Não dar a PENTESTER listagem global de usuários.
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual
- [ ] Permitir leitura individual apenas conforme autorização/ownership.
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual
- [ ] Permitir atualização do próprio perfil dentro dos campos autorizados.
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual
- [ ] Restringir ações administrativas de usuário a ADMIN/OWNER conforme regra final.
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual
- [ ] Nunca retornar hash de senha ou tokens.
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual
- [ ] Definir política de exclusão e impedir autoexclusão perigosa se essa proteção permanecer no contrato.
  - **Fonte(s):** `User.md`; `Matriz de Permissoes.md`; User API atual

## 7. Planos, Company, onboarding e Subscription


### 7.1 Catálogo de Plans

- [ ] Expor `GET /api/plans` publicamente.
  - **Fonte(s):** `Plan.md`; Fase 3
- [ ] Expor `GET /api/plans/:id` publicamente.
  - **Fonte(s):** `Plan.md`; Fase 3
- [ ] Restringir create/update/delete a ADMIN.
  - **Fonte(s):** `Plan.md`; Fase 3
- [ ] Validar limites e preço.
  - **Fonte(s):** `Plan.md`; Fase 3
- [ ] Impedir nome duplicado.
  - **Fonte(s):** `Plan.md`; Fase 3
- [ ] Impedir novas contratações de plano inativo.
  - **Fonte(s):** `Plan.md`; Fase 3
- [ ] Não cancelar automaticamente subscriptions já existentes ao desativar Plan.
  - **Fonte(s):** `Plan.md`; Fase 3
- [ ] Exibir BASIC, PRO e Enterprise na página pública.
  - **Fonte(s):** `Plan.md`; Fase 3
- [ ] Destacar PRO conforme jornada comercial atual.
  - **Fonte(s):** `Plan.md`; Fase 3

### 7.2 Onboarding

- [ ] Permitir visitante visualizar planos antes de autenticar.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Permitir cadastro de conta CLIENT.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Coletar dados mínimos da Company ratificados.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Permitir pré-seleção do plano via query string.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Implementar wizard simples de onboarding.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Criar/vincular Company ao primeiro CLIENT.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Definir primeiro CLIENT como OWNER.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Criar Subscription PENDING_APPROVAL.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Redirecionar ao dashboard/estado de aprovação.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Bloquear recursos que exigem ACTIVE enquanto assinatura estiver pendente.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Exibir feedback de assinatura pendente.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3

### 7.3 Company API

- [ ] Registrar `/companies/me` antes de `/:id`.
  - **Fonte(s):** Fase 3; `Company.md`; `Empresas.md`
- [ ] Permitir CLIENT consultar própria Company.
  - **Fonte(s):** Fase 3; `Company.md`; `Empresas.md`
- [ ] Permitir ADMIN listar/consultar Companies.
  - **Fonte(s):** Fase 3; `Company.md`; `Empresas.md`
- [ ] Validar CNPJ único.
  - **Fonte(s):** Fase 3; `Company.md`; `Empresas.md`
- [ ] Validar formato do CNPJ sem cálculo de dígito verificador no MVP.
  - **Fonte(s):** Fase 3; `Company.md`; `Empresas.md`
- [ ] Derivar vínculo do usuário criador.
  - **Fonte(s):** Fase 3; `Company.md`; `Empresas.md`
- [ ] Restringir edição da Company conforme OWNER/Admin ratificados.
  - **Fonte(s):** Fase 3; `Company.md`; `Empresas.md`
- [ ] ⚠️ Especificação incompleta ou ambígua — definir semântica de DELETE de Company e impacto em histórico de Projects/Findings/Reports antes de considerar a rota obrigatória.
  - **Fonte(s):** `Company.md`; contrato técnico atual

### 7.4 Gestão de membros da Company

- [ ] Exibir usuários da Company.
  - **Fonte(s):** RN01; `Empresas.md`; `Regras de Ownership.md`
- [ ] Distinguir OWNER de MEMBER.
  - **Fonte(s):** RN01; `Empresas.md`; `Regras de Ownership.md`
- [ ] Implementar convite de MEMBER se ratificado para o MVP.
  - **Fonte(s):** RN01; `Empresas.md`; `Regras de Ownership.md`
- [ ] Impedir takeover de usuário já vinculado a outra Company.
  - **Fonte(s):** RN01; `Empresas.md`; `Regras de Ownership.md`
- [ ] Definir revogação/reenvio/expiração do convite.
  - **Fonte(s):** RN01; `Empresas.md`; `Regras de Ownership.md`

### 7.5 Subscription

- [ ] Expor `POST /api/subscriptions` para solicitação.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Derivar Company do ator.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Validar Plan existente/ativo.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Criar `PENDING_APPROVAL`.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Registrar `SUBSCRIPTION_REQUESTED` em AuditLog.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Expor `/subscriptions/pending` para ADMIN.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Expor `/subscriptions/current` para a Company do usuário.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Expor `/subscriptions/active` para ADMIN quando usado pelo dashboard.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Expor `/:id/approve` para ADMIN.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Expor `/:id/reject` para ADMIN.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Permitir approve somente de estado elegível.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Permitir reject somente de estado elegível.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Revalidar 1 ACTIVE por Company no approve.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Registrar data/ator de aprovação conforme campos físicos atuais.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Registrar AuditLog de approve/reject.
  - **Fonte(s):** `Subscription.md`; Fase 3
- [ ] Tratar tentativa de segunda ACTIVE com erro estável.
  - **Fonte(s):** `Subscription.md`; Fase 3

### 7.6 Tela de aprovação

- [ ] Criar tela ADMIN de subscriptions pendentes.
  - **Fonte(s):** Fase 3
- [ ] Buscar via TanStack Query.
  - **Fonte(s):** Fase 3
- [ ] Exibir ações Aprovar/Rejeitar.
  - **Fonte(s):** Fase 3
- [ ] Usar confirmação antes de ação.
  - **Fonte(s):** Fase 3
- [ ] Invalidar/refazer query após mutação.
  - **Fonte(s):** Fase 3
- [ ] Exibir estado vazio amigável.
  - **Fonte(s):** Fase 3
- [ ] Impedir CLIENT/PENTESTER de acessar a rota administrativa.
  - **Fonte(s):** Fase 3

### 7.7 Estados adicionais da Subscription

- [ ] ⚠️ Conflito de especificação — domínio define `SUSPENDED` e `CANCELED`; roadmap v4 implementa apenas request/approve/reject/current. Ratificar se suspensão/cancelamento entram no MVP.
  - **Fonte(s):** `Maquina - Subscription.md` × Fase 3
- [ ] Se `SUSPENDED` permanecer vigente, definir quem suspende, quem reativa e efeitos sobre criação de Application/Project.
  - **Fonte(s):** `Maquina - Subscription.md`
- [ ] Se `CANCELED` permanecer vigente, definir quem cancela, irreversibilidade e efeitos sobre dados existentes.
  - **Fonte(s):** `Maquina - Subscription.md`

### 7.8 Notificação de assinatura

- [ ] ⚠️ Conflito de especificação — RN22 exige Notification in-app para ADMIN, mas o roadmap não fecha inbox/endpoints web.
  - **Fonte(s):** RN22 × Fases 3/7
- [ ] 🚧 Não enviar e-mail transacional de nova assinatura enquanto corte de escopo estiver vigente.
  - **Fonte(s):** ADR-014; `Fora do Escopo.md`

## 8. Applications


### 8.1 API e regras

- [ ] Expor listagem de Applications.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Expor consulta individual.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Expor criação.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Expor atualização.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Expor desativação/DELETE lógico.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Exigir autenticação.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Derivar `companyId` para CLIENT.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Permitir ADMIN conforme visão global.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Impedir PENTESTER de gerenciar catálogo no escopo atual.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Exigir Subscription ACTIVE antes de criar.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Contar Applications ativas da Company.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Comparar contagem com `Plan.maxApplications`.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Retornar erro estável para ausência de assinatura ativa.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Retornar erro estável para limite de plano.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Validar URL quando informada.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Validar environment.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Não permitir mudança de Company.
  - **Fonte(s):** RN03/RN04; Fase 4
- [ ] Usar soft delete para preservar histórico.
  - **Fonte(s):** RN03/RN04; Fase 4

### 8.2 Web

- [ ] Criar página de Applications.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Exibir lista/tabela tenant-scoped.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Permitir busca/filtros pertinentes.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Oferecer ação “Nova aplicação”.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Coletar nome.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Coletar URL.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Coletar descrição.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Coletar environment/techStack se permanecerem no formulário final.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Tratar `PLAN_LIMIT_REACHED` com mensagem amigável e contexto do limite.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5
- [ ] Permitir navegação da Application para seu dashboard analítico.
  - **Fonte(s):** `Aplicacoes.md`; Fase 4/6.5

## 9. Projects e ProjectMember


### 9.1 Criação e dados

- [ ] Exigir Application existente e visível ao ator.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Exigir Subscription ACTIVE da Company.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Aplicar limite de Projects simultâneos se `maxProjects` permanecer regra vigente.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Herdar `companyId` da Application.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Nunca aceitar `companyId` arbitrário do body.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Coletar `analysisType` válido.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Coletar `analysisLevel` válido.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Coletar `scopeIn`/`scopeOut`/notas.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Coletar `hasRemediation` quando aplicável.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Criar no estado inicial ratificado.
  - **Fonte(s):** RN05–RN07; Fase 4
- [ ] Impedir conflito de Project ativo para a mesma Application conforme regra final.
  - **Fonte(s):** RN05–RN07; Fase 4

### 9.2 Relação Application ↔ Project

- [ ] ⚠️ Conflito de especificação — ADR-002 descreve **um Project ativo por Application, com reutilização histórica após encerramento**, enquanto notas/constraints 1:1 podem sugerir unicidade absoluta.
  - **Fonte(s):** ADR-002; RN04/RN05; MER/schema
- [ ] Ratificar se uma Application pode receber novo Project depois do anterior encerrado.
- [ ] Se puder, implementar constraint/regra de “no máximo um ativo” sem impedir histórico.
- [ ] Se não puder, atualizar ADR-002/RN04 para refletir 1:1 absoluto.

### 9.3 Máquina de Project

- [ ] ⚠️ Conflito de especificação — ratificar uma única máquina de estados de Project.
  - **Fonte(s):** `Maquina - Project.md` × Fase 4/schema atual
- [ ] Alternativa documental longa: `REQUESTED → TRIAGE → PLANNED → IN_PROGRESS → IN_REVIEW → DELIVERED → CLOSED`, com retornos definidos na nota canônica.
- [ ] Alternativa operacional v4: `PENDING → IN_PROGRESS → IN_REVIEW → COMPLETED`, permitindo `IN_REVIEW → IN_PROGRESS`.
- [ ] Rejeitar transições fora da máquina escolhida.
  - **Fonte(s):** `Maquina - Project.md`; Fase 4; RN18
- [ ] Registrar `STATUS_CHANGE` em AuditLog.
  - **Fonte(s):** `Maquina - Project.md`; Fase 4; RN18
- [ ] Preencher `startedAt` na entrada em execução.
  - **Fonte(s):** `Maquina - Project.md`; Fase 4; RN18
- [ ] Preencher `closedAt` no estado terminal.
  - **Fonte(s):** `Maquina - Project.md`; Fase 4; RN18
- [ ] Aplicar a mesma nomenclatura de estados em RN18, dashboards, relatórios e UI.
  - **Fonte(s):** `Maquina - Project.md`; Fase 4; RN18

### 9.4 API/visibilidade

- [ ] Expor listagem de Projects.
  - **Fonte(s):** Fase 4; RN16/RN17
- [ ] Expor consulta individual.
  - **Fonte(s):** Fase 4; RN16/RN17
- [ ] Expor criação.
  - **Fonte(s):** Fase 4; RN16/RN17
- [ ] Expor atualização de metadados autorizados.
  - **Fonte(s):** Fase 4; RN16/RN17
- [ ] Expor endpoint `/transition`.
  - **Fonte(s):** Fase 4; RN16/RN17
- [ ] CLIENT lista somente Company própria.
  - **Fonte(s):** Fase 4; RN16/RN17
- [ ] PENTESTER lista somente membership.
  - **Fonte(s):** Fase 4; RN16/RN17
- [ ] ADMIN lista globalmente.
  - **Fonte(s):** Fase 4; RN16/RN17
- [ ] Não hard-delete Project no MVP sem regra explícita.
  - **Fonte(s):** Fase 4; RN16/RN17

### 9.5 ProjectMember

- [ ] Montar subrota `/projects/:projectId/members`.
  - **Fonte(s):** RN08; Fase 4
- [ ] Permitir GET a atores que possam visualizar o Project.
  - **Fonte(s):** RN08; Fase 4
- [ ] Restringir POST a ADMIN.
  - **Fonte(s):** RN08; Fase 4
- [ ] Restringir DELETE de membership a ADMIN.
  - **Fonte(s):** RN08; Fase 4
- [ ] Validar que usuário alvo seja PENTESTER.
  - **Fonte(s):** RN08; Fase 4
- [ ] Rejeitar membership duplicada.
  - **Fonte(s):** RN08; Fase 4
- [ ] Aplicar ownership do Project antes de listar membros.
  - **Fonte(s):** RN08; Fase 4

### 9.6 Web do Project

- [ ] Criar wizard “Nova análise”.
  - **Fonte(s):** Fase 4
- [ ] Passo de seleção de Application.
  - **Fonte(s):** Fase 4
- [ ] Passo de tipo de análise.
  - **Fonte(s):** Fase 4
- [ ] Passo de nível/escopo.
  - **Fonte(s):** Fase 4
- [ ] Passo de remediação quando aplicável.
  - **Fonte(s):** Fase 4
- [ ] Criar Project e tratar erros de gate.
  - **Fonte(s):** Fase 4
- [ ] Criar página/listagem de Projects.
  - **Fonte(s):** Fase 4
- [ ] Criar ProjectDetail.
  - **Fonte(s):** Fase 4
- [ ] Exibir status e ações permitidas.
  - **Fonte(s):** Fase 4
- [ ] Exibir aba Visão geral.
  - **Fonte(s):** Fase 4
- [ ] Exibir membros.
  - **Fonte(s):** Fase 4
- [ ] Permitir ADMIN gerir membros.
  - **Fonte(s):** Fase 4
- [ ] Exibir aba Findings.
  - **Fonte(s):** Fase 4
- [ ] Exibir aba Relatórios.
  - **Fonte(s):** Fase 4
- [ ] Exibir breadcrumb Company → Application → Project.
  - **Fonte(s):** Fase 4

## 10. Findings / Vulnerability


### 10.1 Conceito e ownership

- [ ] Tratar cada Vulnerability como instância individual, não como catálogo compartilhado de CVEs.
  - **Fonte(s):** `DECISIONS.md` D11; RN09; Fase 5
- [ ] Vincular cada Vulnerability a exatamente um Project.
  - **Fonte(s):** `DECISIONS.md` D11; RN09; Fase 5
- [ ] Herdar Application e Company do Project.
  - **Fonte(s):** `DECISIONS.md` D11; RN09; Fase 5
- [ ] Nunca criar finding sem Project.
  - **Fonte(s):** `DECISIONS.md` D11; RN09; Fase 5
- [ ] Não deduplicar automaticamente findings de Companies distintas por título/CVE.
  - **Fonte(s):** `DECISIONS.md` D11; RN09; Fase 5

### 10.2 CVSS v3.1

- [ ] Implementar parser de vetor base CVSS 3.1.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Validar prefixo/versão `CVSS:3.1` quando usado.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Validar métricas AV, AC, PR, UI, S, C, I, A.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Rejeitar métrica faltante.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Rejeitar métrica duplicada.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Rejeitar valor inválido.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Rejeitar métricas temporais/ambientais se não suportadas.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Implementar fórmulas oficiais e arredondamento Roundup.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Garantir score em [0,10].
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Mapear LOW 0.1–3.9.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Mapear MEDIUM 4.0–6.9.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Mapear HIGH 7.0–8.9.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Mapear CRITICAL 9.0–10.0.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Definir explicitamente representação de score 0.0/NONE na UI/API.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Validar vetor canônico 9.8 CRITICAL.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening
- [ ] Manter cálculo front/back idêntico.
  - **Fonte(s):** `CVSS.md`; Fase 5 hardening

### 10.3 Criação

- [ ] Expor POST de Vulnerability.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Permitir criação a ADMIN ou PENTESTER membro.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Rejeitar CLIENT.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Exigir Project.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Exigir título/descrição/categoria OWASP/CVSS conforme contrato.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Calcular CVSS no backend, independentemente do frontend.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Derivar `severityCalculated`.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Inicializar `severityFinal=severityCalculated`.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Derivar Application/Company/createdBy.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Ignorar campos derivados forjados.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Registrar `AuditLog CREATE`.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7
- [ ] Avaliar gatilho de push quando severidade final for CRITICAL.
  - **Fonte(s):** RN09–RN11/RN20; Fase 5/7

### 10.4 OWASP Top 10 2021

- [ ] Exigir categoria OWASP em todo finding.
  - **Fonte(s):** RN11; `OWASP Top 10.md`; `DESIGN_SYSTEM.md`
- [ ] Aceitar somente A01–A10 da versão 2021 definida.
  - **Fonte(s):** RN11; `OWASP Top 10.md`; `DESIGN_SYSTEM.md`
- [ ] Exibir rótulo legível.
  - **Fonte(s):** RN11; `OWASP Top 10.md`; `DESIGN_SYSTEM.md`
- [ ] Permitir filtro por OWASP.
  - **Fonte(s):** RN11; `OWASP Top 10.md`; `DESIGN_SYSTEM.md`
- [ ] Incluir categoria nos PDFs.
  - **Fonte(s):** RN11; `OWASP Top 10.md`; `DESIGN_SYSTEM.md`
- [ ] Não usar cor de severidade para representar categoria OWASP.
  - **Fonte(s):** RN11; `OWASP Top 10.md`; `DESIGN_SYSTEM.md`

### 10.5 Edição, severidade e auditoria

- [ ] Permitir PUT somente a ator com escrita no Project.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Recalcular CVSS se vetor mudar.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Atualizar `severityCalculated`.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Resetar override anterior quando o vetor mudar.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Fazer `severityFinal` voltar à calculada após reset.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Limpar justificativa que deixou de valer.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Registrar `SEVERITY_CHANGE` com vetor/score/severidade de origem e destino.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Registrar `SEVERITY_OVERRIDE_RESET` quando aplicável.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Aplicar limites de tamanho de título/descrição/impacto/recomendação.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16
- [ ] Não aceitar ownership/severidade calculada como autoridade do body.
  - **Fonte(s):** RN21; Fase 5 hardening; `DECISIONS.md` D16

### 10.6 Override manual

- [ ] Expor endpoint de override de severidade.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Permitir somente ator com escrita.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Exigir nova severidade válida.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Exigir justificativa.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Exigir no mínimo 20 caracteres.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Limitar justificativa a 1000 caracteres.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Persistir severidade final sem apagar calculada.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Persistir motivo.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Registrar AuditLog com antes/depois.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening
- [ ] Exibir calculada e final separadamente na UI quando divergirem.
  - **Fonte(s):** RN10/RN21; Fase 5 hardening

### 10.7 Máquina de Vulnerability — MVP

- [ ] Usar `OPEN` como estado inicial.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Permitir `OPEN → IN_PROGRESS`.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Permitir `IN_PROGRESS → FIXED`.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Permitir `FIXED → CLOSED`.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Tratar CLOSED como terminal no MVP.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Não permitir retorno no fluxo MVP atual.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Permitir transição a ADMIN e PENTESTER membro.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Rejeitar CLIENT.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Registrar `STATUS_CHANGE`.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] Retornar erro estável para transição inválida.
  - **Fonte(s):** ADR-021; Fase 5 hardening
- [ ] 🚧 Não exigir `REVALIDATION` no MVP atual.
  - **Fonte(s):** ADR-021; RN13/RN14
- [ ] 🚧 Não exigir `RISK_ACCEPTED` no MVP atual.
  - **Fonte(s):** ADR-021; RN13/RN14
- [ ] 🚧 Manter RN13/RN14 como trabalho futuro dependente da máquina ampliada e regras de aceite de risco.
  - **Fonte(s):** ADR-021; RN13/RN14
- [ ] ⚠️ Conflito de especificação — RN15 afirma que ADMIN pode mover status fora do fluxo com auditoria; ADR-021/Service simplificado aplicam a máquina. Ratificar bypass administrativo.
  - **Fonte(s):** RN15 × ADR-021

### 10.8 DELETE

- [ ] Restringir DELETE de Vulnerability a ADMIN no contrato atual.
  - **Fonte(s):** Fase 5 histórico/hardening
- [ ] Registrar AuditLog DELETE.
  - **Fonte(s):** Fase 5 histórico/hardening
- [ ] Garantir tratamento consistente de Evidence/Comments via cascade.
  - **Fonte(s):** Fase 5 histórico/hardening
- [ ] Documentar que Vulnerability usa hard delete, diferentemente de Application soft delete.
  - **Fonte(s):** Fase 5 histórico/hardening

### 10.9 Listagem e filtros

- [ ] Expor listagem e consulta individual.
  - **Fonte(s):** Fase 5
- [ ] Aplicar role/tenant scope.
  - **Fonte(s):** Fase 5
- [ ] Permitir filtro por Project.
  - **Fonte(s):** Fase 5
- [ ] Permitir filtro por severidade.
  - **Fonte(s):** Fase 5
- [ ] Permitir filtro por status.
  - **Fonte(s):** Fase 5
- [ ] Permitir filtro por OWASP.
  - **Fonte(s):** Fase 5
- [ ] Permitir paginação quando necessário.
  - **Fonte(s):** Fase 5
- [ ] Exibir contador de críticos abertos no Project.
  - **Fonte(s):** Fase 5

## 11. Evidence e upload seguro


### 11.1 Upload

- [ ] Montar rota nested sob Vulnerability.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Exigir autenticação e escrita no finding.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Receber multipart.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Limitar a um arquivo por request no backend atual.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Permitir seleção múltipla no frontend por múltiplas requisições.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Exigir campo `proof`.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Limitar arquivo a 10 MB.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Limitar quantidade de fields/files/parts do multipart.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Detectar tipo pelo conteúdo.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Ignorar `Content-Type` declarado como autoridade.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Aceitar PNG.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Aceitar JPEG.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Aceitar PDF.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Aceitar texto simples UTF-8 segundo detector endurecido.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Rejeitar executável/binário disfarçado.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Rejeitar bytes de controle em texto fora de TAB/LF/CR.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Rejeitar arquivo vazio.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Gerar nome UUID/seguro.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Derivar extensão do tipo detectado.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Sanitizar/truncar nome original.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Armazenar em caminho segregado por Company/Vulnerability.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Usar `UPLOADS_DIR` configurável.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Validar contenção sob uploads root na escrita.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`
- [ ] Bloquear path traversal e caminhos absolutos.
  - **Fonte(s):** Fase 5 + hardening; `Padrao - Upload Seguro.md`

### 11.2 Download

- [ ] Exigir autenticação.
  - **Fonte(s):** Fase 5 hardening
- [ ] Buscar metadado no banco antes de resolver arquivo.
  - **Fonte(s):** Fase 5 hardening
- [ ] Validar acesso ao tenant/finding.
  - **Fonte(s):** Fase 5 hardening
- [ ] Validar contenção do caminho na leitura.
  - **Fonte(s):** Fase 5 hardening
- [ ] Servir como attachment.
  - **Fonte(s):** Fase 5 hardening
- [ ] Enviar `X-Content-Type-Options: nosniff`.
  - **Fonte(s):** Fase 5 hardening
- [ ] Usar MIME detectado/persistido.
  - **Fonte(s):** Fase 5 hardening
- [ ] Nunca aceitar path arbitrário fornecido pelo cliente.
  - **Fonte(s):** Fase 5 hardening

### 11.3 Exclusão

- [ ] Implementar DELETE de Evidence como pendência final da Fase 8.
  - **Fonte(s):** BACKLOG 8.9 / L-05
- [ ] Definir roles autorizadas para excluir Evidence.
  - **Fonte(s):** BACKLOG 8.9 / L-05
- [ ] Validar ownership antes da exclusão.
  - **Fonte(s):** BACKLOG 8.9 / L-05
- [ ] Remover banco e arquivo físico de forma consistente.
  - **Fonte(s):** BACKLOG 8.9 / L-05
- [ ] Definir comportamento quando arquivo físico já estiver ausente.
  - **Fonte(s):** BACKLOG 8.9 / L-05
- [ ] Considerar AuditLog da exclusão.
  - **Fonte(s):** BACKLOG 8.9 / L-05

### 11.4 Limitações aceitas

- [ ] Documentar ausência de antivírus/malware scanning.
  - **Fonte(s):** BACKLOG L-01/L-02/L-03/L-06/L-08
- [ ] Documentar possibilidade de polyglot com assinatura válida.
  - **Fonte(s):** BACKLOG L-01/L-02/L-03/L-06/L-08
- [ ] Documentar rejeição intencional de PDF cujo `%PDF` não esteja no offset 0.
  - **Fonte(s):** BACKLOG L-01/L-02/L-03/L-06/L-08
- [ ] Documentar que TXT pode conter código textual, mas é servido como attachment/nosniff.
  - **Fonte(s):** BACKLOG L-01/L-02/L-03/L-06/L-08
- [ ] Documentar armazenamento em disco/volume local sem versionamento externo.
  - **Fonte(s):** BACKLOG L-01/L-02/L-03/L-06/L-08
- [ ] ⚠️ Conflito de especificação — upload seguro antigo inclui GIF/WebP; Fase 5 endurecida restringe a PNG/JPEG/PDF/TXT. Usar whitelist endurecida até decisão de expansão.
  - **Fonte(s):** `Padrao - Upload Seguro.md` × Fase 5

## 12. Comentários em findings

- [ ] Montar GET/POST comments sob Vulnerability.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Paginar GET.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Permitir comentário a qualquer ator que possa visualizar o finding.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Permitir CLIENT comentar.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Derivar `authorId` do ator.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Validar conteúdo não vazio.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Aplicar limite de tamanho.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Ordenar timeline determinística.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Permitir DELETE ao próprio autor.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Permitir DELETE a ADMIN.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Impedir terceiro comum de apagar comentário alheio.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5
- [ ] Aplicar tenancy antes de qualquer ação.
  - **Fonte(s):** `VulnerabilityComment.md`; Fase 5

## 13. AuditLog e rastreabilidade

- [ ] Registrar criação de Vulnerability.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar transição de Vulnerability.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar override de severidade.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar mudança automática de severidade por CVSS.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar reset de override.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar DELETE de Vulnerability.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar mudança de status de Project.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar solicitação de Subscription.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar aprovação de Subscription.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar rejeição de Subscription.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar geração de Report.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar ator real.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar Company quando aplicável.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar entityType/entityId.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Registrar diff mínimo suficiente para explicar a ação.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Não incluir segredo/token/senha/binário no diff.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025
- [ ] Não permitir update/delete arbitrário de AuditLog.
  - **Fonte(s):** `AuditLog.md`; RN15/RN20/RN21; ADR-025

## 14. Relatórios e PDFs


### 14.1 Report data

- [ ] Expor `GET /api/projects/:id/report-data`.
  - **Fonte(s):** RN18; Fase 6
- [ ] Validar Project e autorização.
  - **Fonte(s):** RN18; Fase 6
- [ ] Permitir ADMIN.
  - **Fonte(s):** RN18; Fase 6
- [ ] Permitir CLIENT da Company.
  - **Fonte(s):** RN18; Fase 6
- [ ] Permitir PENTESTER membro.
  - **Fonte(s):** RN18; Fase 6
- [ ] Aplicar RN18 antes de entregar payload.
  - **Fonte(s):** RN18; Fase 6
- [ ] Retornar erro 422 estável quando Project não estiver apto.
  - **Fonte(s):** RN18; Fase 6
- [ ] Retornar Project, Company e Application.
  - **Fonte(s):** RN18; Fase 6
- [ ] Retornar Vulnerabilities.
  - **Fonte(s):** RN18; Fase 6
- [ ] Retornar total e distribuições por severidade/status/OWASP.
  - **Fonte(s):** RN18; Fase 6
- [ ] Retornar Top 5 risks por score.
  - **Fonte(s):** RN18; Fase 6
- [ ] Retornar maturity quando disponível.
  - **Fonte(s):** RN18; Fase 6

### 14.2 Metadata de Report

- [ ] Expor POST `/api/reports`.
  - **Fonte(s):** `Report.md`; Fase 6
- [ ] Validar projectId/type.
  - **Fonte(s):** `Report.md`; Fase 6
- [ ] Revalidar RN18.
  - **Fonte(s):** `Report.md`; Fase 6
- [ ] Derivar `generatedBy`.
  - **Fonte(s):** `Report.md`; Fase 6
- [ ] Registrar metadata após geração/download.
  - **Fonte(s):** `Report.md`; Fase 6
- [ ] Registrar `REPORT_GENERATED`.
  - **Fonte(s):** `Report.md`; Fase 6
- [ ] Expor listagem por projectId.
  - **Fonte(s):** `Report.md`; Fase 6
- [ ] Aplicar tenancy.
  - **Fonte(s):** `Report.md`; Fase 6

### 14.3 Geração client-side

- [ ] Gerar PDF no browser com `pdf-lib`.
  - **Fonte(s):** ADR-003; Fase 6 + hardening
- [ ] Não exigir serviço server-side de PDF.
  - **Fonte(s):** ADR-003; Fase 6 + hardening
- [ ] Usar A4.
  - **Fonte(s):** ADR-003; Fase 6 + hardening
- [ ] Criar helpers reutilizáveis de texto/página/cabeçalho/rodapé.
  - **Fonte(s):** ADR-003; Fase 6 + hardening
- [ ] Implementar quebra de linha e paginação.
  - **Fonte(s):** ADR-003; Fase 6 + hardening
- [ ] Sanitizar caracteres não representáveis pelas StandardFonts.
  - **Fonte(s):** ADR-003; Fase 6 + hardening
- [ ] Exibir aviso não bloqueante no editor para caracteres que virarão `?`.
  - **Fonte(s):** ADR-003; Fase 6 + hardening
- [ ] Não deixar emoji/seta derrubar a geração inteira.
  - **Fonte(s):** ADR-003; Fase 6 + hardening

### 14.4 PDF Executivo

- [ ] Criar capa.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Criar sumário executivo.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Exibir KPIs.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Exibir gráfico de severidade.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Exibir Top 5 riscos.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Exibir recomendação curta.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Exibir conclusão.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Incluir maturidade após Fase 8.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Incluir tabela de médias por domínio.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Desenhar radar manualmente em pdf-lib.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Corrigir sobreposição de título longo no Top 5.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11
- [ ] Reservar/truncar espaço para CVSS/OWASP.
  - **Fonte(s):** Fase 6/8; BACKLOG 8.11

### 14.5 PDF Técnico

- [ ] Criar capa e sumário.
  - **Fonte(s):** Fase 6
- [ ] Criar seção por finding.
  - **Fonte(s):** Fase 6
- [ ] Exibir severidade calculada/final.
  - **Fonte(s):** Fase 6
- [ ] Exibir vetor/score CVSS.
  - **Fonte(s):** Fase 6
- [ ] Exibir OWASP.
  - **Fonte(s):** Fase 6
- [ ] Exibir descrição, impacto e recomendação.
  - **Fonte(s):** Fase 6
- [ ] Embutir PNG/JPEG quando possível.
  - **Fonte(s):** Fase 6
- [ ] Representar PDF/TXT por referência/fallback apropriado.
  - **Fonte(s):** Fase 6
- [ ] Incluir comentários relevantes.
  - **Fonte(s):** Fase 6
- [ ] Incluir glossário/apêndice.
  - **Fonte(s):** Fase 6
- [ ] Ter fallback gracioso se Evidence não carregar.
  - **Fonte(s):** Fase 6

### 14.6 Fluxo UI

- [ ] Exibir gate visual se Project não estiver apto.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] Oferecer botão Executivo.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] Oferecer botão Técnico.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] Buscar report-data ao gerar.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] Gerar Blob no browser.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] Disparar download.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] Registrar metadata.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] Exibir histórico de Reports.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] Permitir CLIENT gerar/baixar quando autorizado.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] 🚧 Não agendar relatórios.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] 🚧 Não exportar CSV no MVP.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`
- [ ] 🚧 Não enviar relatório por e-mail.
  - **Fonte(s):** Fase 6; `Fora do Escopo.md`

## 15. Dashboards por perfil


### 15.1 CLIENT

- [ ] Exibir total de findings no tenant.
  - **Fonte(s):** Fase 6; `Dashboard.md`
- [ ] Exibir percentual remediado conforme estados vigentes.
  - **Fonte(s):** Fase 6; `Dashboard.md`
- [ ] Exibir críticos abertos.
  - **Fonte(s):** Fase 6; `Dashboard.md`
- [ ] Exibir donut por severidade.
  - **Fonte(s):** Fase 6; `Dashboard.md`
- [ ] Exibir findings recentes.
  - **Fonte(s):** Fase 6; `Dashboard.md`
- [ ] Incluir maturidade quando houver dados.
  - **Fonte(s):** Fase 6; `Dashboard.md`
- [ ] Nunca agregar outra Company.
  - **Fonte(s):** Fase 6; `Dashboard.md`

### 15.2 PENTESTER

- [ ] Exibir Projects atribuídos e status.
  - **Fonte(s):** Fase 6; RN17
- [ ] Exibir findings registrados na semana.
  - **Fonte(s):** Fase 6; RN17
- [ ] Não incluir Projects sem membership.
  - **Fonte(s):** Fase 6; RN17

### 15.3 ADMIN

- [ ] Exibir Companies ativas derivadas de Subscription ACTIVE.
  - **Fonte(s):** Fase 6
- [ ] Exibir subscriptions pendentes e link para aprovação.
  - **Fonte(s):** Fase 6
- [ ] Exibir críticos abertos globalmente.
  - **Fonte(s):** Fase 6
- [ ] Exibir top Companies por volume.
  - **Fonte(s):** Fase 6
- [ ] Não depender de `Company.isActive` inexistente.
  - **Fonte(s):** Fase 6

### 15.4 Itens legados

- [ ] 🚧 Não incluir tickets de suporte nos KPIs do MVP.
  - **Fonte(s):** ADR-014; `Fora do Escopo.md`
- [ ] 🚧 Não incluir Prometheus/Grafana nos dashboards do MVP.
  - **Fonte(s):** ADR-014; `Fora do Escopo.md`
- [ ] ⚠️ Especificação incompleta ou ambígua — nota antiga de Dashboard cita SLA de Project, mas schema/roadmap atual não têm campos/regra de SLA. Não implementar sem definição.
  - **Fonte(s):** `Dashboard.md`

## 16. Painel analítico por Application


### 16.1 Backend

- [ ] Expor endpoint de summary por Application.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Expor endpoint de timeseries.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Expor endpoint de insights.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Expor comparação entre Applications da Company.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Aplicar ownership igual ao de Application.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Fazer agregação no banco.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Usar Prisma aggregate/groupBy/count quando possível.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Parametrizar SQL raw.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Usar `JSON_VALID` antes de extrair JSON do AuditLog.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Reconstruir histórico a partir de `Vulnerability.createdAt` + `AuditLog STATUS_CHANGE`.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Usar buckets em UTC.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Manter desempenho dentro do alvo documentado (<500ms no cenário de teste).
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Manter canários TEN-14..17.
  - **Fonte(s):** ADR-025; Fase 6.5

### 16.2 Risk score

- [ ] Calcular summary como Σ(cvss²/10) sobre findings abertos.
  - **Fonte(s):** ADR-025; BACKLOG L-11
- [ ] Tratar finding sem score como contribuição zero.
  - **Fonte(s):** ADR-025; BACKLOG L-11
- [ ] Documentar que a métrica é interna do Vulnera.
  - **Fonte(s):** ADR-025; BACKLOG L-11
- [ ] Fazer score cair quando findings são resolvidos.
  - **Fonte(s):** ADR-025; BACKLOG L-11
- [ ] Rotular a série temporal histórica como aproximada.
  - **Fonte(s):** ADR-025; BACKLOG L-11
- [ ] Não apresentar a aproximação histórica como valor absoluto exato.
  - **Fonte(s):** ADR-025; BACKLOG L-11

### 16.3 MTTR e aging

- [ ] Calcular MTTR por mediana, não média.
  - **Fonte(s):** ADR-025
- [ ] Exibir quantidade de amostras.
  - **Fonte(s):** ADR-025
- [ ] Derivar resolução do AuditLog.
  - **Fonte(s):** ADR-025
- [ ] Não inventar duração para itens sem trilha suficiente.
  - **Fonte(s):** ADR-025
- [ ] Calcular aging em `<7d`, `7–30d`, `30–90d`, `>90d`.
  - **Fonte(s):** ADR-025

### 16.4 Postura atual

- [ ] Exibir KPIs de abertos, risk score, taxa de remediação e críticos abertos.
  - **Fonte(s):** Dashboard analytics spec; Fase 6.5
- [ ] Exibir delta vs período anterior quando habilitado.
  - **Fonte(s):** Dashboard analytics spec; Fase 6.5
- [ ] Usar micro-sparklines.
  - **Fonte(s):** Dashboard analytics spec; Fase 6.5
- [ ] Definir semanticamente se aumento é positivo/negativo por KPI.
  - **Fonte(s):** Dashboard analytics spec; Fase 6.5
- [ ] Exibir donut clicável por severidade.
  - **Fonte(s):** Dashboard analytics spec; Fase 6.5
- [ ] Exibir aging clicável.
  - **Fonte(s):** Dashboard analytics spec; Fase 6.5
- [ ] Exibir MTTR por severidade.
  - **Fonte(s):** Dashboard analytics spec; Fase 6.5

### 16.5 Evolução

- [ ] Exibir burndown de findings abertos.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Exibir criados × resolvidos.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Exibir risk score temporal.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Exibir referência/média quando definida.
  - **Fonte(s):** ADR-025; Fase 6.5
- [ ] Sinalizar aproximação histórica.
  - **Fonte(s):** ADR-025; Fase 6.5

### 16.6 Insights

- [ ] Gerar insights determinísticos, sem IA.
  - **Fonte(s):** ADR-017; ADR-025
- [ ] Ordenar crítico → atenção → neutro → positivo.
  - **Fonte(s):** ADR-017; ADR-025
- [ ] Associar insight a filtro reproduzível.
  - **Fonte(s):** ADR-017; ADR-025
- [ ] Reutilizar o mesmo vocabulário de filtros do painel.
  - **Fonte(s):** ADR-017; ADR-025
- [ ] Cobrir situações como crítico envelhecido, concentração OWASP, reabertura e ausência de críticos.
  - **Fonte(s):** ADR-017; ADR-025

### 16.7 Comparativo

- [ ] Comparar Applications da mesma Company.
  - **Fonte(s):** Fase 6.5 / Dashboard
- [ ] Exibir risk score.
  - **Fonte(s):** Fase 6.5 / Dashboard
- [ ] Exibir críticos abertos.
  - **Fonte(s):** Fase 6.5 / Dashboard
- [ ] Exibir taxa de remediação.
  - **Fonte(s):** Fase 6.5 / Dashboard
- [ ] Exibir MTTR.
  - **Fonte(s):** Fase 6.5 / Dashboard
- [ ] Permitir ordenação.
  - **Fonte(s):** Fase 6.5 / Dashboard
- [ ] Destacar Application atual.
  - **Fonte(s):** Fase 6.5 / Dashboard

### 16.8 Filtros

- [ ] Usar query string como fonte principal.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Oferecer presets 7d/30d/90d/1 ano/tudo.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Permitir intervalo customizado.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Multi-select severidade.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Multi-select status.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Multi-select OWASP.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Mostrar contagem das opções considerando filtros cruzados.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Busca textual com debounce ~300ms.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Toggle de comparação com período anterior.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Clicar em donut aplica filtro global.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Clicar em aging aplica filtro global.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Exibir chips de filtros ativos.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Permitir remover chip individual.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Permitir limpar todos.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Memorizar filtros por Application em localStorage.
  - **Fonte(s):** Fase 6.5; ADR-025
- [ ] Fazer URL vencer localStorage quando ambos existirem.
  - **Fonte(s):** Fase 6.5; ADR-025

### 16.9 Estados dos gráficos

- [ ] Todo gráfico deve ter estado vazio.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; Fase 6.5
- [ ] Skeleton deve reservar a forma final.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; Fase 6.5
- [ ] Tooltip deve apresentar valor absoluto.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; Fase 6.5
- [ ] Tooltip deve apresentar proporção/relativo quando aplicável.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; Fase 6.5
- [ ] Gráficos devem ter legenda/eixo/rótulo suficiente.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; Fase 6.5
- [ ] Em tela estreita, usar representação alternativa quando o gráfico ficar ilegível.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; Fase 6.5

## 17. Design System web


### 17.1 Direção visual

- [ ] Tratar UI como instrumento profissional denso, não painel de marketing.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar fundo slate-azulado profundo no dark, não preto puro.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Reservar violeta para ação/interação.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar vermelho para CRITICAL/erro/destrutivo.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar laranja para HIGH.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar âmbar para MEDIUM/atenção.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar azul para LOW.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar verde para sucesso/remediado.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Não usar verde genericamente para “clicável”.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Não comunicar estado somente por cor.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar `tabular-nums` em métricas/tabelas.
  - **Fonte(s):** `DESIGN_SYSTEM.md`

### 17.2 Tokens e contraste

- [ ] Manter `app/web/src/styles/tokens.css` como fonte única de tokens.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Separar primitivos e semânticos.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Proibir componente de consumir primitivo diretamente.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Expor semânticos via Tailwind.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Permitir exceção de primitivo apenas no styleguide.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Manter rampas OKLCH.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Manter semânticos de superfície/texto/borda/ação/estado/severidade/gráfico.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Usar `-ink` para texto e `-surface` para fundo tingido.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Manter texto normal ≥4,5:1.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Manter elementos gráficos/controles ≥3:1 quando aplicável.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024
- [ ] Rodar checker matemático de contraste no build/check.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; ADR-024

### 17.3 Tipografia, espaçamento e geometria

- [ ] Usar Archivo na interface web.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar JetBrains Mono para CVSS, IDs e valores conferíveis.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Respeitar escala tipográfica definida.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar espaçamento em múltiplos de 4px da escala.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Evitar meio-passo removido da config.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Garantir alvo de toque mínimo de 44px.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar radius por intenção (`control/container/overlay/full`).
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar elevation por intenção.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] No dark, representar elevação também por lightness.
  - **Fonte(s):** `DESIGN_SYSTEM.md`

### 17.4 Temas

- [ ] Manter temas baseados em tokens semânticos.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`
- [ ] Manter as opções de tema definidas no design system atual.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`
- [ ] Evitar flash de tema na inicialização.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`
- [ ] Persistir preferência.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`
- [ ] Respeitar opção de sistema quando existente.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`
- [ ] Exigir conjunto completo de semânticos em tema novo.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`
- [ ] Adicionar tema ao TypeScript e bootstrap inline.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`
- [ ] Rodar contraste antes de aceitar tema.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`
- [ ] Mostrar tema no styleguide.
  - **Fonte(s):** ADR-024; `DESIGN_SYSTEM.md`

### 17.5 Biblioteca própria

- [ ] Não depender de Radix na biblioteca atual.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter componentes próprios em `components/ui/`.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Não reexportar `_internal/`.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter Button/LinkButton/Input/Textarea/Field.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter Checkbox/Radio/RadioGroup/Switch/Slider.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter Select/Combobox.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter Dialog/Drawer/Popover/Tooltip.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter DropdownMenu/ContextMenu quando necessário.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter ToastProvider/useToast.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter Card/Tabs/Accordion/Table.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter Badge/SeverityBadge/StatusBadge/Progress/Avatar.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter Breadcrumb/Pagination/ScrollArea.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`
- [ ] Manter Skeleton/RegiaoCarregando/EmptyState/ErrorState/Alert/Separator.
  - **Fonte(s):** ADR-023; `DESIGN_SYSTEM.md`

### 17.6 Acessibilidade

- [ ] Documentar contrato de acessibilidade por componente interativo.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Preferir elemento HTML nativo.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Usar `:focus-visible`.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Mover foco para overlay ao abrir.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Prender foco em overlay modal.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Restaurar foco ao gatilho ao fechar.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Aplicar `inert` ao restante da árvore em modal.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Exigir rótulo em botão só-ícone.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Não depender apenas de cor para estado.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Garantir alvo de toque.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Usar live region preexistente.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Manter estratégia de teclado correta em Select/Combobox/Menu.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Manter estratégia de teclado correta em Tabs/ThemeToggle.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Usar ativação manual em Tabs que disparam requests.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Rodar `axe-core`.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Testar foco/teclado.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09
- [ ] Executar validação manual com leitor de tela antes de afirmar paridade real.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG L-09

### 17.7 Movimento

- [ ] Usar movimento somente para compreensão/feedback.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Centralizar reduced-motion em `useMotion()`.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Remover deslocamento/escala em reduced motion, mantendo feedback de opacidade.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Manter spinner funcionando em versão reduzida.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar tokens de duração.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Não inventar duração em componente.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar spring para movimento espacial.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Usar duração/easing para cor/opacidade.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Animar preferencialmente transform/opacity.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Evitar width/height, salvo Accordion controlado.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Evitar reanimar lista/gráfico a cada refetch.
  - **Fonte(s):** `DESIGN_SYSTEM.md`

### 17.8 Styleguide

- [ ] Manter `/styleguide` somente em desenvolvimento.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Exibir rampas/tokens.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Exibir componentes.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Exibir temas.
  - **Fonte(s):** `DESIGN_SYSTEM.md`
- [ ] Garantir remoção da rota no build de produção.
  - **Fonte(s):** `DESIGN_SYSTEM.md`

## 18. Frontend web — infraestrutura e telas


### 18.1 Stack

- [ ] Usar React + Vite.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Usar React Router.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Usar TanStack Query para estado de servidor.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Usar Zustand para auth/estado cliente.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Usar Axios.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Usar Recharts.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Usar pdf-lib.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Usar motion no web.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Usar Tailwind integrado aos tokens semânticos.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Não usar Next.js/App Router.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Não usar Socket.IO no MVP.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Configurar Axios por env.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Anexar access token automaticamente.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Implementar refresh queue.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Centralizar QueryClient.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Centralizar mapeamento de erros da API.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Criar ProtectedRoute e gates por role.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5
- [ ] Não tratar gate do frontend como mecanismo de segurança suficiente.
  - **Fonte(s):** ADR-020/023/024; Fases 3–6.5

### 18.2 Rotas públicas

- [ ] Disponibilizar entrada/landing pública.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Disponibilizar Plans pública.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Disponibilizar Login.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Disponibilizar Register.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Disponibilizar Onboarding.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3
- [ ] Preservar plano escolhido entre Plans/Register/Onboarding.
  - **Fonte(s):** `Fluxo - Onboarding.md`; Fase 3

### 18.3 Rotas autenticadas

- [ ] Dashboard por role.
  - **Fonte(s):** Fases 4–8
- [ ] Applications.
  - **Fonte(s):** Fases 4–8
- [ ] Projects.
  - **Fonte(s):** Fases 4–8
- [ ] NewAnalysis.
  - **Fonte(s):** Fases 4–8
- [ ] ProjectDetail.
  - **Fonte(s):** Fases 4–8
- [ ] FindingDetail.
  - **Fonte(s):** Fases 4–8
- [ ] FindingEditor para perfis de escrita.
  - **Fonte(s):** Fases 4–8
- [ ] Application analytics.
  - **Fonte(s):** Fases 4–8
- [ ] MaturityAssessment após Fase 8.
  - **Fonte(s):** Fases 4–8
- [ ] Navegação/sidebar coerente com role.
  - **Fonte(s):** Fases 4–8
- [ ] Breadcrumb em fluxos hierárquicos.
  - **Fonte(s):** Fases 4–8

### 18.4 Admin

- [ ] PendingSubscriptions.
  - **Fonte(s):** Fases 3/4/6/8
- [ ] Aprovar/rejeitar Subscription.
  - **Fonte(s):** Fases 3/4/6/8
- [ ] Gerir ProjectMember.
  - **Fonte(s):** Fases 3/4/6/8
- [ ] Visualizar dashboard global.
  - **Fonte(s):** Fases 3/4/6/8
- [ ] Preencher maturidade.
  - **Fonte(s):** Fases 3/4/6/8
- [ ] ⚠️ Especificação incompleta ou ambígua — `Empresas.md` descreve tela administrativa completa de Companies/usuários, mas roadmap v4 não fecha uma página dedicada completa.
  - **Fonte(s):** `Empresas.md` × roadmap v4

### 18.5 Estados de UX e responsividade

- [ ] Toda tela assíncrona deve ter loading.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Preferir skeleton com a forma do conteúdo final.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Toda lista relevante deve ter estado vazio.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Erros recuperáveis devem oferecer retry.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Mutações devem oferecer feedback de sucesso/erro.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Evitar saltos de layout.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Manter foco após fechar modal/overlay.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Validar layout em 375px.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Validar layout em 768px.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Validar layout em 1440px.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Inspecionar console real sem erros.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10
- [ ] Completar polimento de skeleton/vazio/erro nas telas que receberam apenas migração mecânica de tokens.
  - **Fonte(s):** `DESIGN_SYSTEM.md`; BACKLOG 6.5.11/L-10

## 19. Mobile CLIENT


### 19.1 Escopo

- [ ] Manter app exclusivo para CLIENT.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Bloquear ADMIN no login mobile.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Bloquear PENTESTER no login mobile.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Manter fluxo read-only/read-mostly.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Não criar/editar Application no mobile.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Não criar/editar Project no mobile.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Não criar/editar Vulnerability no mobile.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Não fazer upload.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Não gerar PDF.
  - **Fonte(s):** ADR-004; Fase 7
- [ ] Não criar telas administrativas.
  - **Fonte(s):** ADR-004; Fase 7

### 19.2 Stack e autenticação

- [ ] Usar Expo/React Native.
  - **Fonte(s):** Fase 7
- [ ] Usar Expo Router.
  - **Fonte(s):** Fase 7
- [ ] Usar Axios.
  - **Fonte(s):** Fase 7
- [ ] Usar TanStack Query.
  - **Fonte(s):** Fase 7
- [ ] Usar SecureStore.
  - **Fonte(s):** Fase 7
- [ ] Usar expo-notifications.
  - **Fonte(s):** Fase 7
- [ ] Consumir API pela env `EXPO_PUBLIC_API_URL`.
  - **Fonte(s):** Fase 7

### 19.3 Telas

- [ ] Login.
  - **Fonte(s):** Fase 7
- [ ] Home com lista de Projects da Company.
  - **Fonte(s):** Fase 7
- [ ] ProjectDetail com metadados.
  - **Fonte(s):** Fase 7
- [ ] ProjectDetail com lista de Findings.
  - **Fonte(s):** Fase 7
- [ ] FindingDetail read-only.
  - **Fonte(s):** Fase 7
- [ ] Exibir severidade.
  - **Fonte(s):** Fase 7
- [ ] Exibir descrição/dados relevantes.
  - **Fonte(s):** Fase 7
- [ ] Exibir Evidence em carrossel com autenticação.
  - **Fonte(s):** Fase 7
- [ ] Exibir Comments.
  - **Fonte(s):** Fase 7
- [ ] Settings.
  - **Fonte(s):** Fase 7
- [ ] Logout.
  - **Fonte(s):** Fase 7
- [ ] Exibir status de push.
  - **Fonte(s):** Fase 7
- [ ] Pull-to-refresh quando aplicável.
  - **Fonte(s):** Fase 7
- [ ] Loading/vazio/erro consistentes.
  - **Fonte(s):** Fase 7

### 19.4 Design/a11y mobile

- [ ] Portar tokens semânticos de cor.
  - **Fonte(s):** `DESIGN_SYSTEM.md` §8; Fase 7
- [ ] Converter OKLCH→hex uma vez na paleta mobile.
  - **Fonte(s):** `DESIGN_SYSTEM.md` §8; Fase 7
- [ ] Portar escala de tipografia/espaçamento/raio.
  - **Fonte(s):** `DESIGN_SYSTEM.md` §8; Fase 7
- [ ] Portar vocabulário `-ink`/`-surface`.
  - **Fonte(s):** `DESIGN_SYSTEM.md` §8; Fase 7
- [ ] Adaptar alvo de toque ao mobile.
  - **Fonte(s):** `DESIGN_SYSTEM.md` §8; Fase 7
- [ ] Usar accessibilityRole/accessibilityLabel/accessibilityState nos controles.
  - **Fonte(s):** `DESIGN_SYSTEM.md` §8; Fase 7
- [ ] ⚠️ Waiver de escopo — Design System recomenda Archivo/JetBrains Mono e reduced-motion no mobile; Fase 7 registrou conscientemente que fontes/motion não foram portados no app enxuto.
  - **Fonte(s):** `DESIGN_SYSTEM.md` §8 × histórico Fase 7
- [ ] 🚧 Tratar paridade completa de fonte/motion/a11y do mobile como trabalho futuro salvo reabertura de escopo.

### 19.5 Validação

- [ ] Rodar TypeScript sem erros.
  - **Fonte(s):** Fase 7; pendência de smoke físico
- [ ] Rodar lint.
  - **Fonte(s):** Fase 7; pendência de smoke físico
- [ ] Rodar `expo-doctor`.
  - **Fonte(s):** Fase 7; pendência de smoke físico
- [ ] Garantir bundle/export Android sem erro.
  - **Fonte(s):** Fase 7; pendência de smoke físico
- [ ] Fazer smoke manual no Expo Go em aparelho físico.
  - **Fonte(s):** Fase 7; pendência de smoke físico
- [ ] Testar login/navegação/evidence/logout.
  - **Fonte(s):** Fase 7; pendência de smoke físico
- [ ] Testar push real no aparelho.
  - **Fonte(s):** Fase 7; pendência de smoke físico

## 20. Push notifications


### 20.1 Registro

- [ ] Manter `User.expoPushToken`.
  - **Fonte(s):** Fase 7; `Expo Push.md`
- [ ] Expor `POST /api/notifications/register-push`.
  - **Fonte(s):** Fase 7; `Expo Push.md`
- [ ] Exigir autenticação.
  - **Fonte(s):** Fase 7; `Expo Push.md`
- [ ] Validar token Expo.
  - **Fonte(s):** Fase 7; `Expo Push.md`
- [ ] Salvar token no usuário autenticado.
  - **Fonte(s):** Fase 7; `Expo Push.md`
- [ ] Mobile deve pedir permissão.
  - **Fonte(s):** Fase 7; `Expo Push.md`
- [ ] Mobile deve capturar token.
  - **Fonte(s):** Fase 7; `Expo Push.md`
- [ ] Mobile deve registrar token no backend.
  - **Fonte(s):** Fase 7; `Expo Push.md`
- [ ] Permissão negada não deve quebrar o app.
  - **Fonte(s):** Fase 7; `Expo Push.md`

### 20.2 Envio

- [ ] Usar `expo-server-sdk`.
  - **Fonte(s):** Fase 7
- [ ] Resolver CLIENTs da Company com token.
  - **Fonte(s):** Fase 7
- [ ] Disparar push para criação de finding CRITICAL segundo escopo atual.
  - **Fonte(s):** Fase 7
- [ ] Incluir `data` suficiente para identificar contexto sem vazar dado sensível.
  - **Fonte(s):** Fase 7
- [ ] Tratar envio em try/catch.
  - **Fonte(s):** Fase 7
- [ ] Nunca falhar criação do finding por falha de push.
  - **Fonte(s):** Fase 7
- [ ] Ignorar token inválido com segurança.
  - **Fonte(s):** Fase 7
- [ ] Tratar ticket/erro do Expo.
  - **Fonte(s):** Fase 7
- [ ] Não chamar Expo real nos testes CI.
  - **Fonte(s):** Fase 7

### 20.3 Preferências por categoria

- [ ] ⚠️ Conflito de especificação — RN24 exige preferência por categoria e toggles; Fase 7 implementa essencialmente registro/status e trigger CRITICAL.
  - **Fonte(s):** RN24 × Fase 7
- [ ] Definir categorias realmente suportadas no MVP.
  - **Fonte(s):** RN24; `Fora do Escopo.md`
- [ ] Definir armazenamento das preferências se RN24 permanecer vigente.
  - **Fonte(s):** RN24; `Fora do Escopo.md`
- [ ] Definir defaults.
  - **Fonte(s):** RN24; `Fora do Escopo.md`
- [ ] Filtrar envio pela preferência.
  - **Fonte(s):** RN24; `Fora do Escopo.md`
- [ ] Criar toggles em Settings se o recurso for mantido.
  - **Fonte(s):** RN24; `Fora do Escopo.md`
- [ ] Remover referência a `CHAT_MESSAGE` das categorias atuais se chat continuar fora do MVP.
  - **Fonte(s):** RN24; `Fora do Escopo.md`

## 21. Maturidade — Fase 8


### 21.1 Modelo simplificado

- [ ] Implementar checklist de perguntas objetivas.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Usar aproximadamente 7 domínios.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Usar 3–4 perguntas por domínio.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Usar escala 1–5.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Permitir observação opcional.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Calcular média simples por domínio.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Calcular média geral simples.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Não aplicar pesos.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Não penalizar por findings.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Não exigir nível BASIC/INTERMEDIATE/ADVANCED como resultado do score.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Não implementar comparativo histórico no MVP.
  - **Fonte(s):** ADR-018; Fase 8

### 21.2 Conteúdo sugerido

- [ ] Domínio Gestão de Acesso.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Domínio Backup e Recuperação/Continuidade.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Domínio Segurança de Rede.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Domínio Gestão de Vulnerabilidades.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Domínio Monitoramento e Logs/Resposta.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Domínio Conscientização/Cultura.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Domínio Segurança no Código/Gestão de Código e Dependências.
  - **Fonte(s):** ADR-018; Fase 8
- [ ] Escrever perguntas objetivas e defensáveis para cada domínio.
  - **Fonte(s):** ADR-018; Fase 8

### 21.3 Backend

- [ ] Seedar Domains e perguntas.
  - **Fonte(s):** RN19; Fase 8
- [ ] Expor POST `/api/maturity/assessments`.
  - **Fonte(s):** RN19; Fase 8
- [ ] Criar assessment para Company.
  - **Fonte(s):** RN19; Fase 8
- [ ] Derivar avaliador ADMIN.
  - **Fonte(s):** RN19; Fase 8
- [ ] Restringir escrita a ADMIN.
  - **Fonte(s):** RN19; Fase 8
- [ ] Expor POST batch `/api/maturity/assessments/:id/scores`.
  - **Fonte(s):** RN19; Fase 8
- [ ] Validar `controlId`.
  - **Fonte(s):** RN19; Fase 8
- [ ] Validar score 1–5.
  - **Fonte(s):** RN19; Fase 8
- [ ] Persistir notes opcionais.
  - **Fonte(s):** RN19; Fase 8
- [ ] Recalcular overallScore.
  - **Fonte(s):** RN19; Fase 8
- [ ] Expor latest por Company.
  - **Fonte(s):** RN19; Fase 8
- [ ] Aplicar isolamento por Company.
  - **Fonte(s):** RN19; Fase 8
- [ ] Permitir CLIENT visualizar própria Company.
  - **Fonte(s):** RN19; Fase 8
- [ ] ⚠️ Especificação incompleta ou ambígua — RN19 permite leitura a PENTESTER atribuído, mas assessment atual é Company-level e não tem projectId. Definir como comprovar autorização de leitura.
  - **Fonte(s):** RN19 × schema/Fase 8

### 21.4 Frontend/PDF

- [ ] Criar página MaturityAssessment.
  - **Fonte(s):** Fase 8
- [ ] Exibir navegação por domínios.
  - **Fonte(s):** Fase 8
- [ ] Exibir perguntas do domínio ativo.
  - **Fonte(s):** Fase 8
- [ ] Exibir seletor 1–5.
  - **Fonte(s):** Fase 8
- [ ] Exibir campo de observação.
  - **Fonte(s):** Fase 8
- [ ] Exibir média do domínio.
  - **Fonte(s):** Fase 8
- [ ] Exibir média geral.
  - **Fonte(s):** Fase 8
- [ ] Salvar batch.
  - **Fonte(s):** Fase 8
- [ ] Exibir radar Recharts de ~7 eixos.
  - **Fonte(s):** Fase 8
- [ ] Fornecer visualização read-only para CLIENT.
  - **Fonte(s):** Fase 8
- [ ] Incluir maturidade no dashboard/relatório quando houver dados.
  - **Fonte(s):** Fase 8
- [ ] Desenhar radar do PDF manualmente com pdf-lib.
  - **Fonte(s):** Fase 8

## 22. Notificações in-app

- [ ] ⚠️ Especificação incompleta ou ambígua — decidir se a central de Notification in-app faz parte da entrega final.
  - **Fonte(s):** `Notification.md`; `Notificacoes.md`; RN22
- [ ] Se fizer parte: definir endpoint de listagem do usuário.
  - **Fonte(s):** `Notification.md`; RN22; roadmap atual
- [ ] Se fizer parte: definir paginação.
  - **Fonte(s):** `Notification.md`; RN22; roadmap atual
- [ ] Se fizer parte: definir endpoint de marcar como lida.
  - **Fonte(s):** `Notification.md`; RN22; roadmap atual
- [ ] Se fizer parte: garantir filtro por userId/tenant.
  - **Fonte(s):** `Notification.md`; RN22; roadmap atual
- [ ] Se fizer parte: criar Notification de nova Subscription para ADMIN.
  - **Fonte(s):** `Notification.md`; RN22; roadmap atual
- [ ] Se fizer parte: definir outros eventos cobertos.
  - **Fonte(s):** `Notification.md`; RN22; roadmap atual
- [ ] Se fizer parte: integrar central/badge no web.
  - **Fonte(s):** `Notification.md`; RN22; roadmap atual
- [ ] Se não fizer parte: atualizar RN22/Notificacoes para model reservado/trabalho futuro.
  - **Fonte(s):** `Notification.md`; RN22; roadmap atual

## 23. Segurança da aplicação


### 23.1 AuthN/AuthZ

- [ ] Aplicar auth middleware em toda rota privada.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Politica de Desenvolvimento Seguro.md`
- [ ] Aplicar requireRole nas ações restritas.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Politica de Desenvolvimento Seguro.md`
- [ ] Aplicar ownership no Service após consulta do recurso.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Politica de Desenvolvimento Seguro.md`
- [ ] Não fazer lógica fina de tenant apenas no frontend.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Politica de Desenvolvimento Seguro.md`
- [ ] Não passar `req` para Service.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Politica de Desenvolvimento Seguro.md`
- [ ] Não aceitar role/company/autor derivados via body.
  - **Fonte(s):** `Middlewares e Ownership.md`; `Politica de Desenvolvimento Seguro.md`

### 23.2 Validação de entrada

- [ ] Definir contrato para body/params/query relevantes.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`
- [ ] Validar tipo.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`
- [ ] Validar formato.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`
- [ ] Validar tamanho.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`
- [ ] Fechar enums.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`
- [ ] Validar IDs conforme `cuid()` atual, não UUID legado.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`
- [ ] Bloquear mass assignment manualmente.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`
- [ ] Limitar campos de texto livre.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`
- [ ] Não confiar em validação client-side.
  - **Fonte(s):** `Campos Criticos.md`; `Padrao - Validacao de Entradas.md`

### 23.3 Injection e XSS

- [ ] Usar Prisma parametrizado.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] Não concatenar SQL com input.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] Parametrizar `$queryRaw`.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] White-list de campos de ordenação/filtro dinâmico.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] Não interpolar input em comando do sistema.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] Não montar filesystem path a partir de input sem containment.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] Usar escape padrão do React para texto.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] Evitar `dangerouslySetInnerHTML`.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] Se rich text/markdown surgir, sanitizar explicitamente.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`
- [ ] Tratar comentários/descrições/notas como dados não confiáveis.
  - **Fonte(s):** `Padrao - Prevencao de Injection.md`; `Padrao - Prevencao de XSS.md`

### 23.4 Headers e CORS

- [ ] Configurar CORS via env.
  - **Fonte(s):** ADR-020; Fase 5; `OWASP ZAP.md`
- [ ] Não usar wildcard com credenciais se esse modo for utilizado.
  - **Fonte(s):** ADR-020; Fase 5; `OWASP ZAP.md`
- [ ] Testar origem indevida.
  - **Fonte(s):** ADR-020; Fase 5; `OWASP ZAP.md`
- [ ] Manter `nosniff` em downloads de Evidence.
  - **Fonte(s):** ADR-020; Fase 5; `OWASP ZAP.md`
- [ ] Validar security headers no ZAP.
  - **Fonte(s):** ADR-020; Fase 5; `OWASP ZAP.md`
- [ ] ⚠️ Especificação incompleta ou ambígua — política secure-dev antiga trata Helmet/CSP como obrigatórios, mas roadmap/package atual não fecha a implementação. Ratificar Helmet ou equivalente com base no scan final.
  - **Fonte(s):** `Seguranca da Aplicacao.md`; secure-dev × stack atual

### 23.5 Rate limiting

- [ ] Adicionar rate limiting ao login.
  - **Fonte(s):** BACKLOG 8.10 / L-07
- [ ] Adicionar rate limiting ao upload.
  - **Fonte(s):** BACKLOG 8.10 / L-07
- [ ] Definir janela e limite.
  - **Fonte(s):** BACKLOG 8.10 / L-07
- [ ] Usar mecanismo compatível com MVP sem exigir Redis.
  - **Fonte(s):** BACKLOG 8.10 / L-07
- [ ] Garantir que limiter não inviabilize testes.
  - **Fonte(s):** BACKLOG 8.10 / L-07
- [ ] Documentar limite distribuído como futuro se necessário.
  - **Fonte(s):** BACKLOG 8.10 / L-07

### 23.6 Segredos e dados sensíveis

- [ ] Não commitar JWT secrets.
  - **Fonte(s):** `Padrao - Segredos e Variaveis Sensiveis.md`; `Campos Criticos.md`
- [ ] Não commitar credenciais reais de banco.
  - **Fonte(s):** `Padrao - Segredos e Variaveis Sensiveis.md`; `Campos Criticos.md`
- [ ] Não commitar SONAR_TOKEN.
  - **Fonte(s):** `Padrao - Segredos e Variaveis Sensiveis.md`; `Campos Criticos.md`
- [ ] Não documentar chave real.
  - **Fonte(s):** `Padrao - Segredos e Variaveis Sensiveis.md`; `Campos Criticos.md`
- [ ] Não logar token completo.
  - **Fonte(s):** `Padrao - Segredos e Variaveis Sensiveis.md`; `Campos Criticos.md`
- [ ] Não expor expoPushToken em respostas desnecessárias.
  - **Fonte(s):** `Padrao - Segredos e Variaveis Sensiveis.md`; `Campos Criticos.md`
- [ ] Usar GitHub Secrets em CI.
  - **Fonte(s):** `Padrao - Segredos e Variaveis Sensiveis.md`; `Campos Criticos.md`

### 23.7 Dependências

- [ ] Adicionar dependência somente com necessidade clara.
  - **Fonte(s):** `Padrao - Dependencias e Bibliotecas.md`; Fase 5 hardening
- [ ] Preferir biblioteca oficial/consolidada.
  - **Fonte(s):** `Padrao - Dependencias e Bibliotecas.md`; Fase 5 hardening
- [ ] Verificar manutenção e compatibilidade.
  - **Fonte(s):** `Padrao - Dependencias e Bibliotecas.md`; Fase 5 hardening
- [ ] Verificar CVEs.
  - **Fonte(s):** `Padrao - Dependencias e Bibliotecas.md`; Fase 5 hardening
- [ ] Verificar licença.
  - **Fonte(s):** `Padrao - Dependencias e Bibliotecas.md`; Fase 5 hardening
- [ ] Rodar audit/revisão antes do fechamento.
  - **Fonte(s):** `Padrao - Dependencias e Bibliotecas.md`; Fase 5 hardening
- [ ] Documentar riscos aceitos que não forem corrigidos.
  - **Fonte(s):** `Padrao - Dependencias e Bibliotecas.md`; Fase 5 hardening

## 24. Logs técnicos e tratamento de falhas

- [ ] Diferenciar log técnico de AuditLog de negócio.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Definir logger estruturado do backend.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Usar níveis adequados.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Redigir senha/token/segredos.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Não logar payload sensível desnecessário.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Mostrar stack completa somente em desenvolvimento.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Logar falha de push sem interromper criação do finding.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Tratar Evidence ausente no PDF com fallback.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Tratar logout como idempotente.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Diferenciar vazio de erro no frontend.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Manter erro específico para upload/CVSS/override/estado.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] Evitar tempestade de refresh em 401 concorrente.
  - **Fonte(s):** `Logs Estruturados.md`; Fases 3–7
- [ ] ⚠️ Especificação incompleta ou ambígua — `Logs Estruturados.md` define Pino, mas stack/package/roadmap atuais não o consolidam. Ratificar Pino ou atualizar a nota.
  - **Fonte(s):** `Logs Estruturados.md` × package/roadmap atual

## 25. Testes automatizados


### 25.1 Estratégia

- [ ] Toda feature CRUD relevante deve ter testes de integração.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Cobrir happy path.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Cobrir validações do Controller.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Cobrir regra de negócio do Service.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Cobrir autorização.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Cobrir tenancy.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Manter coverage de Services ≥80% como baseline.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Usar banco de teste separado.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Limpar banco na ordem correta de FKs.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`
- [ ] Rodar `npm test`/check antes de merge.
  - **Fonte(s):** `DECISIONS.md` D10; `09-TCC/Testes.md`

### 25.2 Auth

- [ ] Register feliz
  - **Fonte(s):** Auth tests/Fase 2
- [ ] E-mail duplicado
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Senha fraca
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Login feliz
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Credencial inválida
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Refresh feliz
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Rotação invalida token antigo
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Logout revoga
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Token revogado não renova
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Sem token retorna 401
  - **Fonte(s):** Auth tests/Fase 2
- [ ] Role indevida retorna 403
  - **Fonte(s):** Auth tests/Fase 2

### 25.3 Plan/Company/Subscription

- [ ] PLAN GET público
  - **Fonte(s):** Fase 3
- [ ] PLAN POST não-admin bloqueado
  - **Fonte(s):** Fase 3
- [ ] PLAN limite inválido
  - **Fonte(s):** Fase 3
- [ ] PLAN nome duplicado
  - **Fonte(s):** Fase 3
- [ ] PLAN update/delete admin
  - **Fonte(s):** Fase 3
- [ ] COMP cria e vincula owner
  - **Fonte(s):** Fase 3
- [ ] COMP CNPJ inválido
  - **Fonte(s):** Fase 3
- [ ] COMP CNPJ duplicado
  - **Fonte(s):** Fase 3
- [ ] COMP cross-company bloqueado
  - **Fonte(s):** Fase 3
- [ ] COMP /me
  - **Fonte(s):** Fase 3
- [ ] COMP admin lista todas
  - **Fonte(s):** Fase 3
- [ ] SUB cria PENDING_APPROVAL
  - **Fonte(s):** Fase 3
- [ ] SUB segunda ACTIVE bloqueada
  - **Fonte(s):** Fase 3
- [ ] SUB approve + AuditLog
  - **Fonte(s):** Fase 3
- [ ] SUB approve de estado inválido
  - **Fonte(s):** Fase 3
- [ ] SUB reject
  - **Fonte(s):** Fase 3
- [ ] SUB non-admin approve bloqueado
  - **Fonte(s):** Fase 3
- [ ] SUB /pending admin-only
  - **Fonte(s):** Fase 3

### 25.4 Application/Project/Member

- [ ] APP limite de plano
  - **Fonte(s):** Fase 4
- [ ] APP sem ACTIVE
  - **Fonte(s):** Fase 4
- [ ] APP URL inválida
  - **Fonte(s):** Fase 4
- [ ] APP soft delete
  - **Fonte(s):** Fase 4
- [ ] TEN Application cross-company
  - **Fonte(s):** Fase 4
- [ ] PROJ exclusividade por Application
  - **Fonte(s):** Fase 4
- [ ] PROJ companyId herdado
  - **Fonte(s):** Fase 4
- [ ] PROJ máquina feliz
  - **Fonte(s):** Fase 4
- [ ] PROJ transição inválida
  - **Fonte(s):** Fase 4
- [ ] TEN Pentester não-membro
  - **Fonte(s):** Fase 4
- [ ] Member alvo não-PENTESTER
  - **Fonte(s):** Fase 4
- [ ] Member duplicado
  - **Fonte(s):** Fase 4
- [ ] Member leitura conforme Project
  - **Fonte(s):** Fase 4

### 25.5 CVSS/Vulnerability/Evidence/Comment

- [ ] CVSS vetores oficiais
  - **Fonte(s):** Fase 5 + hardening
- [ ] CVSS versão inválida
  - **Fonte(s):** Fase 5 + hardening
- [ ] CVSS métrica duplicada
  - **Fonte(s):** Fase 5 + hardening
- [ ] CVSS paridade front/back
  - **Fonte(s):** Fase 5 + hardening
- [ ] Score/severidade derivados
  - **Fonte(s):** Fase 5 + hardening
- [ ] Override sem justificativa
  - **Fonte(s):** Fase 5 + hardening
- [ ] Override curto
  - **Fonte(s):** Fase 5 + hardening
- [ ] Override válido audita
  - **Fonte(s):** Fase 5 + hardening
- [ ] Override reset em mudança de vetor
  - **Fonte(s):** Fase 5 + hardening
- [ ] Transição inválida
  - **Fonte(s):** Fase 5 + hardening
- [ ] Upload executável bloqueado
  - **Fonte(s):** Fase 5 + hardening
- [ ] Upload válido
  - **Fonte(s):** Fase 5 + hardening
- [ ] MIME declarado forjado ignorado
  - **Fonte(s):** Fase 5 + hardening
- [ ] Texto com bytes de controle bloqueado
  - **Fonte(s):** Fase 5 + hardening
- [ ] Path traversal bloqueado
  - **Fonte(s):** Fase 5 + hardening
- [ ] Nome original longo tratado
  - **Fonte(s):** Fase 5 + hardening
- [ ] Multipart excessivo bloqueado
  - **Fonte(s):** Fase 5 + hardening
- [ ] TEN Vulnerability cross-company
  - **Fonte(s):** Fase 5 + hardening
- [ ] TEN Evidence cross-company
  - **Fonte(s):** Fase 5 + hardening
- [ ] TEN Comment cross-company
  - **Fonte(s):** Fase 5 + hardening
- [ ] TEN escrita cross-company
  - **Fonte(s):** Fase 5 + hardening
- [ ] TEN mass assignment ignorado
  - **Fonte(s):** Fase 5 + hardening
- [ ] CLIENT pode comentar
  - **Fonte(s):** Fase 5 + hardening
- [ ] Autor pode apagar comentário
  - **Fonte(s):** Fase 5 + hardening
- [ ] ADMIN pode apagar comentário
  - **Fonte(s):** Fase 5 + hardening
- [ ] Terceiro não pode apagar comentário
  - **Fonte(s):** Fase 5 + hardening

### 25.6 Reports

- [ ] Report-data confere com banco
  - **Fonte(s):** Fase 6 + hardening
- [ ] RN18 bloqueia Project não elegível
  - **Fonte(s):** Fase 6 + hardening
- [ ] Cross-company bloqueado
  - **Fonte(s):** Fase 6 + hardening
- [ ] Pentester não-membro bloqueado
  - **Fonte(s):** Fase 6 + hardening
- [ ] Report metadata criado
  - **Fonte(s):** Fase 6 + hardening
- [ ] AuditLog report criado
  - **Fonte(s):** Fase 6 + hardening
- [ ] Smoke PDF executivo
  - **Fonte(s):** Fase 6 + hardening
- [ ] Smoke PDF técnico
  - **Fonte(s):** Fase 6 + hardening
- [ ] Caractere não-WinAnsi não quebra PDF
  - **Fonte(s):** Fase 6 + hardening
- [ ] Evidence embutida validada no browser
  - **Fonte(s):** Fase 6 + hardening

### 25.7 Métricas e Design System

- [ ] MET summary
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET timeseries
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET insights
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET comparison
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET filtros/períodos
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET compare previous
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET JSON inválido resiliente
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET risk score
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET MTTR mediano
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET aging
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] MET performance com 500 findings
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] TEN-14..17
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] A11Y roles/ARIA
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] A11Y teclado/foco
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] axe-core
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] contraste de todos os temas
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] tokens de motion consistentes
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] ThemeToggle
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] Tabs
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] overlays
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM
- [ ] validação visual 375/768/1440
  - **Fonte(s):** Fase 6.5; ADR-025; DESIGN_SYSTEM

### 25.8 Push/mobile

- [ ] Register push token
  - **Fonte(s):** Fase 7
- [ ] Register push sem auth
  - **Fonte(s):** Fase 7
- [ ] Token inválido
  - **Fonte(s):** Fase 7
- [ ] CRITICAL chama sender
  - **Fonte(s):** Fase 7
- [ ] Não-CRITICAL não chama
  - **Fonte(s):** Fase 7
- [ ] CLIENT sem token não quebra criação
  - **Fonte(s):** Fase 7
- [ ] Token Expo inválido é ignorado
  - **Fonte(s):** Fase 7
- [ ] Ticket de erro tratado
  - **Fonte(s):** Fase 7
- [ ] Exceção SDK não propaga
  - **Fonte(s):** Fase 7
- [ ] Smoke real em aparelho
  - **Fonte(s):** Fase 7

### 25.9 Maturidade

- [ ] Batch persiste
  - **Fonte(s):** Fase 8; RN19
- [ ] Latest retorna mais recente
  - **Fonte(s):** Fase 8; RN19
- [ ] Isolamento por Company
  - **Fonte(s):** Fase 8; RN19
- [ ] CLIENT não escreve
  - **Fonte(s):** Fase 8; RN19
- [ ] PENTESTER não escreve
  - **Fonte(s):** Fase 8; RN19
- [ ] Média por domínio
  - **Fonte(s):** Fase 8; RN19
- [ ] Média geral
  - **Fonte(s):** Fase 8; RN19
- [ ] Score fora de 1–5 é rejeitado
  - **Fonte(s):** Fase 8; RN19

## 26. CI/CD e DevSecOps


### 26.1 GitHub Actions

- [ ] Rodar workflow em push/PR para branches definidas.
  - **Fonte(s):** `.github/workflows/build.yml`; `GitHub Actions CI.md`
- [ ] Rodar lint backend.
  - **Fonte(s):** `.github/workflows/build.yml`; `GitHub Actions CI.md`
- [ ] Rodar build backend.
  - **Fonte(s):** `.github/workflows/build.yml`; `GitHub Actions CI.md`
- [ ] Gerar Prisma Client.
  - **Fonte(s):** `.github/workflows/build.yml`; `GitHub Actions CI.md`
- [ ] Rodar testes backend com MySQL 8 de serviço.
  - **Fonte(s):** `.github/workflows/build.yml`; `GitHub Actions CI.md`
- [ ] Aplicar migrations no banco CI.
  - **Fonte(s):** `.github/workflows/build.yml`; `GitHub Actions CI.md`
- [ ] Usar secrets/vars de teste.
  - **Fonte(s):** `.github/workflows/build.yml`; `GitHub Actions CI.md`
- [ ] Falhar pipeline em lint/build/test quebrado.
  - **Fonte(s):** `.github/workflows/build.yml`; `GitHub Actions CI.md`
- [ ] ⚠️ Especificação incompleta ou ambígua — definir se `app/web` check/build e `app/mobile` typecheck/lint devem ser gates obrigatórios antes da tag v1.0.0.
  - **Fonte(s):** workflow atual × Fase 8

### 26.2 SonarQube

- [ ] Manter Sonar em pipeline separado do Compose.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8
- [ ] Configurar token por GitHub Secret.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8
- [ ] Executar análise após checks básicos.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8
- [ ] Tratar Quality Gate como evidência/informativo conforme ADR atual, salvo decisão nova.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8
- [ ] Revisar vulnerabilities/security hotspots.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8
- [ ] Capturar Quality Gate/cobertura/hotspots na Fase 8.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8
- [ ] Salvar evidências em `docs/evidencias/sonarqube/`.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8
- [ ] Corrigir achados graves e baratos.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8
- [ ] Documentar achados aceitos.
  - **Fonte(s):** ADR-007; ADR-012; Fase 8

### 26.3 OWASP ZAP

- [ ] Rodar ZAP baseline manualmente contra stack local.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Não usar full scan destrutivo no fluxo normal.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Validar CORS.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Validar security headers.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Validar disclosure.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Validar endpoints públicos inesperados.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Salvar relatório HTML em `docs/evidencias/zap/`.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Registrar contexto/data.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Classificar alerta como corrigido/aceito/falso positivo.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8
- [ ] Corrigir achados graves e baratos.
  - **Fonte(s):** ADR-007; `OWASP ZAP.md`; Fase 8

### 26.4 Observabilidade

- [ ] 🚧 Não exigir Prometheus no MVP.
  - **Fonte(s):** ADR-014; `Fora do Escopo.md`
- [ ] 🚧 Não exigir Grafana no MVP.
  - **Fonte(s):** ADR-014; `Fora do Escopo.md`
- [ ] 🚧 Não introduzir stack de observabilidade apenas porque notas históricas ainda a citam.
  - **Fonte(s):** ADR-014; `Fora do Escopo.md`
- [ ] Usar dashboards do domínio como produto, não confundi-los com observabilidade técnica.
  - **Fonte(s):** ADR-014; `Fora do Escopo.md`

## 27. Seed, dados de demonstração e reprodutibilidade


### 27.1 Seed base

- [ ] Seedar BASIC/PRO/Enterprise.
  - **Fonte(s):** `seed.ts`; Fases 1/3
- [ ] Seedar ADMIN de demonstração.
  - **Fonte(s):** `seed.ts`; Fases 1/3
- [ ] Seedar Company TechNova.
  - **Fonte(s):** `seed.ts`; Fases 1/3
- [ ] Seedar Subscription ACTIVE.
  - **Fonte(s):** `seed.ts`; Fases 1/3
- [ ] Seedar CLIENT OWNER.
  - **Fonte(s):** `seed.ts`; Fases 1/3
- [ ] Manter seed idempotente.
  - **Fonte(s):** `seed.ts`; Fases 1/3
- [ ] Não reutilizar credenciais de demo como credenciais de produção.
  - **Fonte(s):** `seed.ts`; Fases 1/3

### 27.2 Seed analítico

- [ ] Manter seed-demo determinístico.
  - **Fonte(s):** ADR-025; `seed-demo.ts`
- [ ] Gerar histórico coerente de Vulnerability/AuditLog para métricas.
  - **Fonte(s):** ADR-025; `seed-demo.ts`
- [ ] Bloquear execução do seed-demo em produção.
  - **Fonte(s):** ADR-025; `seed-demo.ts`
- [ ] Permitir volume elevado de dados para benchmark quando documentado.
  - **Fonte(s):** ADR-025; `seed-demo.ts`

### 27.3 Seed final da banca

- [ ] Criar 5 Applications realistas: e-commerce, app mobile, API B2B, sistema interno e portal do cliente.
  - **Fonte(s):** Fase 8
- [ ] Criar 10 findings.
  - **Fonte(s):** Fase 8
- [ ] Distribuir 2 CRITICAL, 3 HIGH, 3 MEDIUM e 2 LOW.
  - **Fonte(s):** Fase 8
- [ ] Usar vectors CVSS reais.
  - **Fonte(s):** Fase 8
- [ ] Variar OWASP.
  - **Fonte(s):** Fase 8
- [ ] Incluir Evidence.
  - **Fonte(s):** Fase 8
- [ ] Incluir Comments.
  - **Fonte(s):** Fase 8
- [ ] Criar 1 MaturityAssessment preenchida.
  - **Fonte(s):** Fase 8
- [ ] Criar 2 PENTESTER.
  - **Fonte(s):** Fase 8
- [ ] Criar 2 CLIENT.
  - **Fonte(s):** Fase 8
- [ ] Garantir idempotência ou documentar reset limpo.
  - **Fonte(s):** Fase 8

## 28. Documentação, demo e encerramento do TCC


### 28.1 README

- [ ] Explicar pitch/problema/solução.
  - **Fonte(s):** Fase 8
- [ ] Explicar stack atual.
  - **Fonte(s):** Fase 8
- [ ] Documentar setup do zero.
  - **Fonte(s):** Fase 8
- [ ] Documentar clone/dependências.
  - **Fonte(s):** Fase 8
- [ ] Documentar Docker.
  - **Fonte(s):** Fase 8
- [ ] Documentar migrate/seed.
  - **Fonte(s):** Fase 8
- [ ] Documentar API/web/mobile.
  - **Fonte(s):** Fase 8
- [ ] Incluir screenshots.
  - **Fonte(s):** Fase 8
- [ ] Incluir diagrama de arquitetura em Mermaid.
  - **Fonte(s):** Fase 8
- [ ] Incluir limitações conhecidas.
  - **Fonte(s):** Fase 8
- [ ] Incluir trabalho futuro.
  - **Fonte(s):** Fase 8
- [ ] Listar IA/chat/tickets/observabilidade como futuro.
  - **Fonte(s):** Fase 8
- [ ] Documentar limitações de upload.
  - **Fonte(s):** Fase 8
- [ ] Documentar aproximação do risk score histórico.
  - **Fonte(s):** Fase 8
- [ ] Documentar limites de a11y/validação visual.
  - **Fonte(s):** Fase 8

### 28.2 DEMO.md

- [ ] Criar roteiro ~10 min.
  - **Fonte(s):** Fase 8
- [ ] Cobrir landing/planos.
  - **Fonte(s):** Fase 8
- [ ] Cobrir registro/onboarding.
  - **Fonte(s):** Fase 8
- [ ] Cobrir aprovação ADMIN.
  - **Fonte(s):** Fase 8
- [ ] Cobrir Application/Project.
  - **Fonte(s):** Fase 8
- [ ] Cobrir atribuição de Pentester.
  - **Fonte(s):** Fase 8
- [ ] Cobrir criação de finding CRITICAL.
  - **Fonte(s):** Fase 8
- [ ] Cobrir push no mobile.
  - **Fonte(s):** Fase 8
- [ ] Cobrir Evidence/Comment.
  - **Fonte(s):** Fase 8
- [ ] Cobrir PDFs.
  - **Fonte(s):** Fase 8
- [ ] Cobrir maturidade.
  - **Fonte(s):** Fase 8
- [ ] Cobrir dashboards.
  - **Fonte(s):** Fase 8
- [ ] Documentar credenciais de demo apropriadamente.
  - **Fonte(s):** Fase 8
- [ ] Ensaiar do zero sem edição manual do banco.
  - **Fonte(s):** Fase 8

### 28.3 Docs vivos

- [ ] Atualizar PRD_VIVO.
  - **Fonte(s):** `Claude - Guia Operacional.md`; Fase 8
- [ ] Atualizar BACKLOG.
  - **Fonte(s):** `Claude - Guia Operacional.md`; Fase 8
- [ ] Atualizar ROADMAP_PROMPTS/histórico.
  - **Fonte(s):** `Claude - Guia Operacional.md`; Fase 8
- [ ] Atualizar Changelog.
  - **Fonte(s):** `Claude - Guia Operacional.md`; Fase 8
- [ ] Atualizar Contexto Mestre v4 com decisões pós-26/07.
  - **Fonte(s):** `Claude - Guia Operacional.md`; Fase 8
- [ ] Criar ADR para qualquer decisão estrutural nova.
  - **Fonte(s):** `Claude - Guia Operacional.md`; Fase 8
- [ ] Encerrar/remover flags F-01/F-02/F-03 que já têm decisões posteriores.
  - **Fonte(s):** `Claude - Guia Operacional.md`; Fase 8

### 28.4 Encerramento

- [ ] Rodar demo completa do zero e cronometrar.
  - **Fonte(s):** Fase 8
- [ ] Rodar check backend.
  - **Fonte(s):** Fase 8
- [ ] Rodar check/build web.
  - **Fonte(s):** Fase 8
- [ ] Rodar validações mobile.
  - **Fonte(s):** Fase 8
- [ ] Revisar Sonar.
  - **Fonte(s):** Fase 8
- [ ] Revisar ZAP.
  - **Fonte(s):** Fase 8
- [ ] Revisar limitações.
  - **Fonte(s):** Fase 8
- [ ] Criar PR final para develop.
  - **Fonte(s):** Fase 8
- [ ] Integrar develop → main.
  - **Fonte(s):** Fase 8
- [ ] Criar tag `v1.0.0` somente após aceite.
  - **Fonte(s):** Fase 8
- [ ] Organizar evidências para banca.
  - **Fonte(s):** Fase 8

## 29. Health, operação e manutenção

- [ ] Manter endpoint `/api/health` simples e previsível.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Usar healthcheck no Compose.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Documentar portas padrão.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Documentar modo dev e modo demo.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Manter uploads fora do Git.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Manter uploads de teste separados.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Limpar artefatos temporários de teste.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Não commitar evidência de usuário real.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Manter ordem de cleanup de banco compatível com FKs.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Manter scripts dev/build/lint/test/check documentados.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening
- [ ] Manter scripts de seed base/demo.
  - **Fonte(s):** `Docker Compose.md`; package scripts; Fase 5 hardening

## 30. Itens explicitamente fora do MVP atual

- [ ] 🚧 IA/Gemini para sugestão de finding.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Endpoint de IA e botão “Sugerir com IA”.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Chat em tempo real/Socket.IO.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 SupportTicket.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 E-mail transacional/Nodemailer.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 E-mail de aprovação/boas-vindas.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Reset de senha por e-mail.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Pagamento real.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Prometheus.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Grafana.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Redis.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Filas/workers/scheduler.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Playwright/E2E automatizado como requisito do MVP.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Deploy de produção/cloud.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 i18n.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Viewer de PDF interno no mobile.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Mobile ADMIN.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Mobile PENTESTER.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 SAMM completo.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Scoring ponderado/histórico de maturidade.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Antivírus/malware engine no upload.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Coleta automática de CVEs NVD/Mitre.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Integração com scanners comerciais.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos
- [ ] 🚧 Execução real de ataques/exploits pelo Vulnera.
  - **Fonte(s):** ADR-014/017/018; `Fora do Escopo.md`; BACKLOG removidos

## 31. Edge cases obrigatórios


### 31.1 Auth

- [ ] E-mail inexistente e senha errada não devem permitir enumeração fácil.
- [ ] Refresh revogado falha.
- [ ] Refresh expirado falha.
- [ ] Refresh rotacionado não pode ser reutilizado.
- [ ] Logout repetido permanece seguro/idempotente.
- [ ] 401 concorrente no web não dispara vários refreshes.
- [ ] Mobile continua funcional com push negado.

### 31.2 Tenancy

- [ ] CLIENT com ID válido de outra Company é bloqueado.
- [ ] PENTESTER com Project não atribuído é bloqueado.
- [ ] ID/ownership forjado no body é ignorado/rejeitado.
- [ ] Evidence cross-tenant é bloqueada.
- [ ] Comment cross-tenant é bloqueado.
- [ ] Métricas cross-tenant são bloqueadas.
- [ ] Report cross-tenant é bloqueado.

### 31.3 Plan/Subscription

- [ ] Company sem ACTIVE não cria Application.
- [ ] Company sem ACTIVE não cria Project.
- [ ] Approve revalida corrida de 1 ACTIVE.
- [ ] Plan desativado não invalida automaticamente contrato ativo.
- [ ] Redução de limite não apaga Applications existentes.
- [ ] Definir comportamento de Company já acima do novo limite.
- [ ] Enterprise “ilimitado” não pode ser interpretado incorretamente por sentinel.

### 31.4 Project

- [ ] Impedir segundo Project ativo conforme regra ratificada.
- [ ] Permitir novo Project após encerramento se reutilização histórica for ratificada.
- [ ] Remover Pentester preserva autoria/histórico.
- [ ] Pentester removido perde acesso futuro.
- [ ] Report permanece bloqueado antes do estado elegível.

### 31.5 Vulnerability

- [ ] CVSS inválido não cria finding.
- [ ] Override curto não salva.
- [ ] Override longo demais não salva.
- [ ] Mudança de vetor invalida override anterior.
- [ ] CLOSED permanece terminal no MVP atual.
- [ ] CLIENT não edita/transiciona.
- [ ] Texto longo gera erro controlado, não 500.
- [ ] Emoji/seta não quebra PDF.

### 31.6 Upload

- [ ] Arquivo >10MB é rejeitado.
- [ ] Arquivo vazio é rejeitado.
- [ ] Executável renomeado PNG é rejeitado.
- [ ] Content-Type forjado não passa.
- [ ] Nome original longo é tratado.
- [ ] Path traversal é bloqueado.
- [ ] Polyglot aceito permanece attachment/nosniff.
- [ ] PDF com header fora do offset 0 é rejeitado pela decisão atual.
- [ ] Arquivo físico ausente gera erro controlado.

### 31.7 Métricas/UI

- [ ] AuditLog com `diffJson` inválido não derruba query.
- [ ] Período sem dados mostra vazio, não números enganosos.
- [ ] MTTR sem amostra mostra ausência.
- [ ] Série aproximada fica rotulada.
- [ ] URL compartilhada reproduz filtros sem depender do localStorage do remetente.
- [ ] Erro de API não deixa página em branco.
- [ ] Loading não causa layout shift grande.
- [ ] Modal devolve foco.
- [ ] Botão só-ícone tem label.
- [ ] Severidade tem texto além da cor.
- [ ] Gráfico ilegível em tela estreita usa fallback.

## 32. Limitações conhecidas que devem permanecer documentadas

- [ ] L-01 — Sem malware scanning no upload.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-02 — Polyglot pode passar se tiver assinatura válida.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-03 — PDF com bytes antes do `%PDF` é recusado.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-04 — Acesso negado cross-tenant responde 403, não 404.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-05 — DELETE de Evidence é pendência da Fase 8.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-06 — text/plain pode conter código textual.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-07 — Rate limiting é pendência da Fase 8.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-08 — Uploads ficam em storage local/volume Docker.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-09 — A11y web foi provada em jsdom/axe, não leitor de tela real.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-10 — Validação visual real/responsiva ainda precisa ser fechada.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] L-11 — Risk score da série temporal é aproximação.
  - **Fonte(s):** `BACKLOG.md` — Limitações conhecidas
- [ ] Explicar no README/DEMO que limitações conhecidas são decisões conscientes de escopo, com mitigação e risco residual.

## 33. Registro mestre de conflitos e ambiguidades

- [ ] ⚠️ Conflito de especificação — **C-01:** Contexto Mestre v4 é declarado fonte máxima, mas ADRs 017–025 posteriores alteram flags/escopo/arquitetura; sincronizar o Contexto Mestre antes do fechamento.
  - **Fonte(s):** `Contexto Mestre v4 × ADRs 017–025`
- [ ] ⚠️ Conflito de especificação — **C-02:** IA ainda aparece em notas de objetivo/findings/fluxos; ADR-017 remove integralmente do MVP e mantém apenas `aiAssisted=false`.
  - **Fonte(s):** `ADR-017 × IA Gemini/Fluxo IA/RN11/RN20 antigos`
- [ ] ⚠️ Conflito de especificação — **C-03:** Factory aparece como pendente em trechos antigos; ADR-019 confirma como obrigatório.
  - **Fonte(s):** `ADR-010 × ADR-019`
- [ ] ⚠️ Conflito de especificação — **C-04:** Pastas singulares em DECISIONS/REFACTOR antigos versus plural confirmado por ADR-009 e código atual.
  - **Fonte(s):** `DECISIONS/REFACTOR × ADR-009`
- [ ] ⚠️ Conflito de especificação — **C-05:** Compose mínimo antigo versus stack completa posterior.
  - **Fonte(s):** `ADR-005/012 × ADR-022`
- [ ] ⚠️ Conflito de especificação — **C-06:** Sonar em compose em notas antigas versus pipeline separado em ADR-012.
  - **Fonte(s):** `SonarQube.md × ADR-012`
- [ ] ⚠️ Conflito de especificação — **C-07:** Project possui máquina longa de 7 estados na nota de domínio versus máquina v4 de 4 estados.
  - **Fonte(s):** `Maquina Project × Fase 4/schema`
- [ ] ⚠️ Conflito de especificação — **C-08:** Application↔Project é chamada 1:1, mas ADR-002 prevê reutilização histórica após fechamento.
  - **Fonte(s):** `RN04/RN05/MER × ADR-002`
- [ ] ⚠️ Conflito de especificação — **C-09:** Subscription canônica possui SUSPENDED/CANCELED; roadmap atual não implementa esses fluxos.
  - **Fonte(s):** `Maquina Subscription × Fase 3`
- [ ] ⚠️ Conflito de especificação — **C-10:** RN15 permite bypass administrativo de status; máquina simplificada atual não deixa isso inequívoco.
  - **Fonte(s):** `RN15 × ADR-021/Services`
- [ ] ⚠️ Conflito de especificação — **C-11:** Company docs pedem campos de razão social/nome fantasia/contatos ausentes do schema atual.
  - **Fonte(s):** `Empresas/Modelagem × schema`
- [ ] ⚠️ Conflito de especificação — **C-12:** Matriz diferencia OWNER/MEMBER, mas alguns checkpoints falam genericamente CLIENT editando a Company.
  - **Fonte(s):** `Matriz/Regras Ownership × Fase 3`
- [ ] ⚠️ Conflito de especificação — **C-13:** Convite de MEMBER é requisito de domínio, mas não tem fluxo técnico fechado no roadmap.
  - **Fonte(s):** `RN01/Empresas × roadmap`
- [ ] ⚠️ Conflito de especificação — **C-14:** Notification in-app é prevista por RN22/model, mas não tem inbox/endpoints fechados.
  - **Fonte(s):** `RN22/Notification × roadmap`
- [ ] ⚠️ Conflito de especificação — **C-15:** Fluxos/jornadas prometem e-mails, mas e-mail transacional foi cortado.
  - **Fonte(s):** `Fluxos/RN22/RN23 × ADR-014`
- [ ] ⚠️ Conflito de especificação — **C-16:** Auth antigo inclui reset de senha; escopo atual remove e-mail/reset.
  - **Fonte(s):** `Autenticacao/Secure-dev × Fora do Escopo`
- [ ] ⚠️ Conflito de especificação — **C-17:** Validação antiga usa tecnologias Nest/class-validator; stack atual é Express/manual.
  - **Fonte(s):** `DTOs/Validacao × decisões atuais`
- [ ] ⚠️ Conflito de especificação — **C-18:** Docs antigas validam UUID; schema atual usa cuid.
  - **Fonte(s):** `Dados/Secure-dev × schema`
- [ ] ⚠️ Conflito de especificação — **C-19:** Whitelist antiga de Evidence inclui GIF/WebP; hardening aceita PNG/JPEG/PDF/TXT.
  - **Fonte(s):** `Padrao Upload × Fase 5`
- [ ] ⚠️ Conflito de especificação — **C-20:** Maturidade antiga usa pesos/níveis/histórico/penalização; ADR-018 remove.
  - **Fonte(s):** `Maturidade antiga × ADR-018`
- [ ] ⚠️ Conflito de especificação — **C-21:** Maturity antigo liga assessment a Project; schema/Fase 8 usam Company-level.
  - **Fonte(s):** `MaturityAssessment.md × schema/Fase 8`
- [ ] ⚠️ Conflito de especificação — **C-22:** RN24 exige preferências de push; Fase 7 tem apenas trigger/status principal.
  - **Fonte(s):** `RN24 × Fase 7`
- [ ] ⚠️ Conflito de especificação — **C-23:** Logs estruturados cita Pino como padrão; package/roadmap atual não consolida dependência.
  - **Fonte(s):** `Logs Estruturados × stack atual`
- [ ] ⚠️ Conflito de especificação — **C-24:** Secure-dev exige Helmet/CSP; roadmap não fecha implementação explícita.
  - **Fonte(s):** `Seguranca Aplicacao × roadmap/package`
- [ ] ⚠️ Conflito de especificação — **C-25:** Envelope de erro diverge entre documentação e Controllers.
  - **Fonte(s):** `DECISIONS/Contexto × API atual`
- [ ] ⚠️ Conflito de especificação — **C-26:** Dashboard antigo cita tickets/Prometheus/REVALIDATION/histórico de maturidade removidos posteriormente.
  - **Fonte(s):** `Dashboard.md × ADR-014/018/021/025`
- [ ] ⚠️ Conflito de especificação — **C-27:** Design System recomenda fontes/motion no mobile; Fase 7 registra waiver consciente.
  - **Fonte(s):** `DESIGN_SYSTEM §8 × Fase 7`
- [ ] ⚠️ Conflito de especificação — **C-28:** Todas as telas migraram tokens/componentes, mas algumas ainda precisam polish de loading/vazio/erro.
  - **Fonte(s):** `BACKLOG 6.5.11`
- [ ] ⚠️ Conflito de especificação — **C-29:** A11y/visual real ainda possuem limitações L-09/L-10.
  - **Fonte(s):** `BACKLOG L-09/L-10`
- [ ] ⚠️ Conflito de especificação — **C-30:** CI atual é backend-centric; fechamento não define formalmente web/mobile como gates.
  - **Fonte(s):** `workflow atual × Fase 8`


- [ ] ⚠️ Conflito de especificação — **C-31:** `09-TCC/Testes.md` declara no topo que Playwright/E2E automatizado saiu do escopo, mas uma seção posterior ainda lista Playwright como “Fase 8”. Baseline atual: integração + smoke manual documentado.
  - **Fonte(s):** `09-TCC/Testes.md`; ADR-014/Fase 8
- [ ] ⚠️ Conflito de especificação — **C-32:** canários antigos em `09-TCC/Testes.md` esperam 404 em vários acessos cross-tenant, enquanto D16.1 fixou 403 como padrão consciente do projeto.
  - **Fonte(s):** `09-TCC/Testes.md` × `DECISIONS.md` D16.1 / BACKLOG L-04
- [ ] ⚠️ Conflito de especificação — **C-33:** `09-TCC/Evidencias para Banca.md` ainda exige demo/screenshots de chat, Gemini, Grafana, Prometheus e e-mails; todos foram cortados ou deixados fora do MVP por decisões posteriores.
  - **Fonte(s):** `09-TCC/Evidencias para Banca.md` × ADR-014/017/018/022
- [ ] ⚠️ Conflito de especificação — **C-34:** `Evidencias para Banca.md` contém checklist de portas/stack antiga; atualizar para as portas e serviços reais do Compose/README final antes da apresentação.
  - **Fonte(s):** `09-TCC/Evidencias para Banca.md` × ADR-022 / compose atual
- [ ] ⚠️ Especificação incompleta ou ambígua — **C-35:** `Riscos.md` descreve `packages/types/` compartilhado e CI das três aplicações como mitigação de dessincronização, mas a arquitetura atual não consolida esse package. Decidir se é requisito real ou apenas ideia histórica.
  - **Fonte(s):** `08-Operacao/Backlog/Riscos.md` × arquitetura/repomix atual
- [ ] Clarificar metas de cobertura: manter ≥80% nos Services novos/criticos conforme roadmap, enquanto a nota acadêmica cita 60% global monitorado no Sonar; documentar ambos por escopos diferentes.
  - **Fonte(s):** `09-TCC/Testes.md`; `ROADMAP_PROMPTS.md`

## 34. Checklist de aceite ponta a ponta


### 34.1 Público → assinatura

- [ ] Visitante abre plataforma
- [ ] Visualiza Plans sem token
- [ ] Registra CLIENT
- [ ] Executa onboarding
- [ ] Company é criada
- [ ] Usuário vira OWNER
- [ ] Subscription fica PENDING_APPROVAL
- [ ] CLIENT vê pendência
- [ ] ADMIN vê pendência
- [ ] ADMIN aprova
- [ ] Subscription vira ACTIVE
- [ ] CLIENT passa a criar Application

### 34.2 Application → Project

- [ ] CLIENT cria Application
- [ ] Limite do Plan é respeitado
- [ ] CLIENT abre análise
- [ ] Company é herdada
- [ ] Project entra no estado inicial
- [ ] ADMIN atribui PENTESTER
- [ ] PENTESTER vê Project
- [ ] PENTESTER não vê Project não atribuído

### 34.3 Finding

- [ ] PENTESTER cria finding
- [ ] CVSS calcula no frontend
- [ ] Backend recalcula
- [ ] OWASP é obrigatório
- [ ] AuditLog CREATE existe
- [ ] Evidence válida sobe
- [ ] Arquivo falso é bloqueado
- [ ] Comentário funciona
- [ ] CLIENT vê read-only
- [ ] CLIENT comenta
- [ ] Override exige justificativa
- [ ] Override audita
- [ ] Mudança CVSS reseta override
- [ ] Transições seguem máquina

### 34.4 Push

- [ ] CLIENT mobile registra token
- [ ] Finding CRITICAL é criado
- [ ] Criação termina mesmo se push falhar
- [ ] Push chega no aparelho em teste real
- [ ] Navegação do push não expõe outro tenant

### 34.5 Reports

- [ ] Project não elegível bloqueia report-data
- [ ] Project elegível libera
- [ ] PDF executivo baixa
- [ ] PDF técnico baixa
- [ ] Evidence embed/fallback funciona
- [ ] Report metadata é registrado
- [ ] AuditLog é registrado
- [ ] CLIENT baixa
- [ ] PENTESTER não-membro é bloqueado

### 34.6 Métricas

- [ ] Summary carrega
- [ ] Timeseries carrega
- [ ] Insights carrega
- [ ] Comparison carrega
- [ ] Filtros mudam URL
- [ ] Refresh preserva URL
- [ ] Link compartilhado reproduz filtro
- [ ] Cross-filter funciona
- [ ] Estado vazio funciona
- [ ] Série aproximada está identificada

### 34.7 Maturidade

- [ ] ADMIN cria assessment
- [ ] ADMIN preenche scores
- [ ] Médias são calculadas
- [ ] Radar aparece
- [ ] CLIENT visualiza
- [ ] CLIENT não edita
- [ ] PDF executivo incorpora maturidade

### 34.8 Demo final

- [ ] Reset/seed limpo
- [ ] Stack sobe em modo demo
- [ ] Web abre
- [ ] API health responde
- [ ] Banco fica healthy
- [ ] DEMO.md roda sem edição manual do banco
- [ ] Mobile conecta pelo endereço correto
- [ ] Push é demonstrável
- [ ] PDFs abrem
- [ ] Sonar/ZAP evidências existem
- [ ] README reproduz setup em máquina limpa

## 35. Critérios para considerar o MVP pronto

- [ ] Nenhum requisito crítico de tenancy depende do frontend.
- [ ] Nenhum segredo real está versionado.
- [ ] Nenhum hash/token sensível é devolvido desnecessariamente pela API.
- [ ] Auth/refresh/logout funcionam.
- [ ] Rate limit de login/upload está aplicado.
- [ ] Todos os endpoints privados têm autorização.
- [ ] Canários TEN passam.
- [ ] CVSS possui testes e paridade front/back.
- [ ] Upload respeita hardening.
- [ ] PDFs não quebram com dados realistas.
- [ ] Dashboard analítico apresenta dados coerentes.
- [ ] Maturidade simplificada funciona.
- [ ] Mobile CLIENT read-only funciona.
- [ ] Push real foi testado em aparelho.
- [ ] Web foi inspecionado nos breakpoints definidos.
- [ ] Design system passa contraste.
- [ ] Componentes críticos passam testes de a11y.
- [ ] Pipeline principal está verde.
- [ ] Sonar foi executado/evidenciado.
- [ ] ZAP baseline foi executado/evidenciado.
- [ ] Limitações conhecidas estão no README/DEMO.
- [ ] Documentação viva está sincronizada.
- [ ] Demo cronometrada passa do zero.
- [ ] Tag `v1.0.0` pode ser criada sem pendência bloqueante.


## 36. Evidências acadêmicas, monografia e preparação da banca

### 36.1 Atualizar o catálogo de evidências

- [ ] Atualizar `09-TCC/Evidencias para Banca.md` para refletir o MVP realmente entregue.
- [ ] Remover chat em tempo real da demo obrigatória enquanto chat estiver fora do escopo.
- [ ] Remover Gemini/IA da demo obrigatória enquanto ADR-017 estiver vigente.
- [ ] Remover Prometheus/Grafana da demo obrigatória enquanto observabilidade estiver fora do MVP.
- [ ] Remover Mailhog/e-mails do roteiro obrigatório enquanto e-mail transacional estiver fora do MVP.
- [ ] Atualizar portas, nomes de serviços e comandos para os valores reais do Compose/README final.
- [ ] Fazer o catálogo de evidências referenciar `docs/DEMO.md` como roteiro principal da apresentação.
  - **Fonte(s):** `09-TCC/Evidencias para Banca.md`; Fase 8

### 36.2 Evidências de produto funcional

- [ ] Capturar screenshot do dashboard ADMIN.
- [ ] Capturar screenshot do dashboard CLIENT.
- [ ] Capturar screenshot do dashboard/painel analítico por Application.
- [ ] Capturar tela de finding com CVSS, severidade final/calculada e histórico relevante.
- [ ] Capturar tela de maturidade com radar.
- [ ] Capturar PDF executivo.
- [ ] Capturar PDF técnico.
- [ ] Capturar mobile com lista de Projects e FindingDetail.
- [ ] Capturar evidência do push no mobile.
- [ ] Manter seed realista pré-carregado para a demo, evitando depender de digitação longa ao vivo.
  - **Fonte(s):** `09-TCC/Evidencias para Banca.md`; Fase 8

### 36.3 Evidências de qualidade e testes

- [ ] Capturar CI verde.
- [ ] Capturar output dos testes de integração/canários relevantes.
- [ ] Capturar relatório de cobertura.
- [ ] Capturar resultado do pipeline GitHub Actions.
- [ ] Capturar dashboard/resultado do SonarQube.
- [ ] Revisar todos os Security Hotspots antes da banca.
- [ ] Corrigir vulnerabilidades graves ou registrar justificativa técnica para risco residual.
- [ ] Salvar relatório ZAP baseline pré-banca.
- [ ] Justificar cada alerta ZAP relevante como corrigido, aceito ou falso positivo.
- [ ] Capturar screenshot/registro da execução do ZAP.
  - **Fonte(s):** `09-TCC/Evidencias para Banca.md`; `09-TCC/Testes.md`; Fase 8

### 36.4 Evidências de arquitetura

- [ ] Preparar diagrama de alto nível da arquitetura atual.
- [ ] Preparar diagrama do fluxo real de requisição `Route/Controller → Service → Repository → Prisma/MySQL`, incluindo middleware de auth/role onde pertinente.
- [ ] Preparar MER conceitual atualizado ao schema final.
- [ ] Preparar diagrama da máquina final de Project após resolver C-07.
- [ ] Preparar diagrama da máquina MVP de Vulnerability de 4 estados.
- [ ] Selecionar código representativo de ownership/tenancy sem usar exemplo obsoleto de Guard NestJS.
- [ ] Selecionar parser/Service de CVSS como código representativo.
- [ ] Selecionar Repository/consulta parametrizada como código representativo.
- [ ] Selecionar rate limiting final de login/upload como evidência, em vez de rate limiter do Gemini removido.
- [ ] Selecionar ADRs atuais com contexto, decisão e alternativas descartadas.
  - **Fonte(s):** `09-TCC/Evidencias para Banca.md`; ADRs atuais

### 36.5 Evidências de DevSecOps e segurança

- [ ] Mostrar `docker-compose.yml` atual e stack em execução.
- [ ] Capturar containers/serviços healthy no modo demo.
- [ ] Verificar branch protection de `main` se fizer parte da governança final.
- [ ] Manter evidência de PR/check bloqueado por falha de teste quando disponível.
- [ ] Demonstrar expiração curta do access JWT sem expor segredo.
- [ ] Demonstrar refresh token armazenado como hash no banco.
- [ ] Demonstrar logs sem dados sensíveis.
- [ ] Demonstrar AuditLog de ação sensível.
- [ ] Demonstrar resultado ZAP sem achado crítico não tratado/sem justificativa.
  - **Fonte(s):** `09-TCC/Evidencias para Banca.md`; `05-Infra-DevSecOps/`

### 36.6 Evidências do processo e plano B

- [ ] Capturar estrutura do vault/documentação como evidência do processo de engenharia.
- [ ] Capturar um ADR atual completo.
- [ ] Capturar histórico de Git/PRs/merges compatível com a metodologia realmente usada.
- [ ] Preparar screenshots como fallback para falha da demo ao vivo.
- [ ] Preparar vídeo de backup do fluxo crítico se a equipe considerar necessário.
- [ ] Garantir que seed possa restaurar rapidamente o ambiente de demonstração.
- [ ] Revisar e formatar a monografia.
- [ ] Garantir que slides reflitam apenas features realmente entregues.
- [ ] Ensaiar a apresentação mais de uma vez antes da banca.
  - **Fonte(s):** `09-TCC/Evidencias para Banca.md`; `09-TCC/Estrutura da Monografia.md`; `09-TCC/Metodologia.md`

## 37. Matriz resumida de rastreabilidade

| Domínio | Fontes principais |
|---|---|
| Escopo | Contexto Mestre v4; Fora do Escopo; ADR-014/017/018/019 |
| Arquitetura | architecture.md; ADR-009/019/020/022/023/024/025 |
| Auth | Autenticacao; DECISIONS D8; Padrao JWT; Fases 2/3 |
| Tenancy | Roles; Matriz de Permissoes; Ownership; RN16/RN17 |
| Comercial | Plan; Company; Subscription; RN01–RN03/RN07; Fase 3 |
| Application/Project | Application; Project; ProjectMember; RN04–RN08; ADR-002; Fase 4 |
| Findings | Vulnerability; RN09–RN15/RN20/RN21; ADR-021; Fase 5 |
| Evidence | Evidence; Padrao Upload; Fase 5 hardening; L-01..L-08 |
| Reports | Report; RN18; ADR-003; Fase 6 |
| Analytics | Dashboard; ADR-025; Fase 6.5 |
| Design | DESIGN_SYSTEM; ADR-023/024 |
| Mobile/Push | ADR-004; Mobile Cliente; RN24; Fase 7 |
| Maturidade | RN19; ADR-018; Fase 8 |
| DevSecOps | ADR-007/012; GitHub Actions; Sonar; ZAP |
| Segurança | Middlewares/Ownership; Campos Críticos; Desenvolvimento Seguro |
| Fechamento | BACKLOG; ROADMAP_PROMPTS; Guia Operacional |

## 38. Inventário do material analisado

### 38.1 Arquivos enviados separadamente

- `Markdown(1).md colado`
- `architecture(1).md`
- `BACKLOG(1).md`
- `DECISIONS(1).md`
- `DESIGN_SYSTEM(1).md`
- `REFACTOR_PLAN(1).md`
- `ROADMAP_PROMPTS(1).md`
- `repomix-output(1).md`
- `Vulnera(1).zip`

### 38.2 Conteúdo Markdown do ZIP Vulnera

> Inventário: **232 arquivos `.md`** dentro do ZIP. Arquivos históricos, fora de escopo, templates e notas vazias foram considerados para identificar contexto/conflitos, mas não foram automaticamente transformados em requisitos.

- `00-Hub/Claude - Guia Operacional.md`
- `00-Hub/Contexto Mestre v4.md`
- `00-Hub/Documentos do Repositorio/BACKLOG.md`
- `00-Hub/Documentos do Repositorio/README.md`
- `00-Hub/Documentos do Repositorio/VULNERA_MASTER.md`
- `00-Hub/Fonte Original - MVP Vulnera.md`
- `00-Hub/MOC - Arquitetura.md`
- `00-Hub/MOC - Dominio.md`
- `00-Hub/MOC - Operacao.md`
- `00-Hub/MOC - Produto.md`
- `00-Hub/MOC - TCC.md`
- `00-Hub/MOC - Vulnera.md`
- `01-Contexto/Diferenciais e Posicionamento.md`
- `01-Contexto/Fora do Escopo.md`
- `01-Contexto/Objetivos.md`
- `01-Contexto/Problema e Oportunidade.md`
- `01-Contexto/Proposta de Valor.md`
- `01-Contexto/Publico-Alvo.md`
- `01-Contexto/Visao Geral.md`
- `02-Dominio/Conceitos/Auditoria.md`
- `02-Dominio/Conceitos/CVSS.md`
- `02-Dominio/Conceitos/Client-side PDF.md`
- `02-Dominio/Conceitos/Maturidade.md`
- `02-Dominio/Conceitos/Multi-tenancy por escopo.md`
- `02-Dominio/Conceitos/OWASP Top 10.md`
- `02-Dominio/Conceitos/Ownership.md`
- `02-Dominio/Conceitos/Remediation Service.md`
- `02-Dominio/Entidades/Application.md`
- `02-Dominio/Entidades/AuditLog.md`
- `02-Dominio/Entidades/ChatMessage.md`
- `02-Dominio/Entidades/Company.md`
- `02-Dominio/Entidades/Evidence.md`
- `02-Dominio/Entidades/MaturityAssessment.md`
- `02-Dominio/Entidades/MaturityControl.md`
- `02-Dominio/Entidades/MaturityDomain.md`
- `02-Dominio/Entidades/MaturityScore.md`
- `02-Dominio/Entidades/Notification.md`
- `02-Dominio/Entidades/PasswordResetToken.md`
- `02-Dominio/Entidades/Plan.md`
- `02-Dominio/Entidades/Project.md`
- `02-Dominio/Entidades/ProjectMember.md`
- `02-Dominio/Entidades/RefreshToken.md`
- `02-Dominio/Entidades/Report.md`
- `02-Dominio/Entidades/Subscription.md`
- `02-Dominio/Entidades/SupportTicket.md`
- `02-Dominio/Entidades/User.md`
- `02-Dominio/Entidades/Vulnerability.md`
- `02-Dominio/Entidades/VulnerabilityComment.md`
- `02-Dominio/Estados/Maquina - Project.md`
- `02-Dominio/Estados/Maquina - Subscription.md`
- `02-Dominio/Estados/Maquina - SupportTicket.md`
- `02-Dominio/Estados/Maquina - Vulnerability.md`
- `02-Dominio/Permissoes/CompanyRole.md`
- `02-Dominio/Permissoes/Matriz de Permissoes.md`
- `02-Dominio/Permissoes/Regras de Ownership.md`
- `02-Dominio/Permissoes/Roles.md`
- `02-Dominio/Regras de Negocio/RN01 - Empresa pode ter multiplos usuarios cliente.md`
- `02-Dominio/Regras de Negocio/RN02 - Usuario pertence a no maximo uma Company.md`
- `02-Dominio/Regras de Negocio/RN03 - Limite de aplicacoes por plano.md`
- `02-Dominio/Regras de Negocio/RN04 - Application pertence a uma unica Company.md`
- `02-Dominio/Regras de Negocio/RN05 - Project 1 para 1 com Application.md`
- `02-Dominio/Regras de Negocio/RN06 - Project herda Company da Application.md`
- `02-Dominio/Regras de Negocio/RN07 - Projeto exige assinatura ativa.md`
- `02-Dominio/Regras de Negocio/RN08 - Projeto pode ter multiplos Pentesters.md`
- `02-Dominio/Regras de Negocio/RN09 - Vulnerability pertence a um Project.md`
- `02-Dominio/Regras de Negocio/RN10 - Severidade via CVSS com override justificado.md`
- `02-Dominio/Regras de Negocio/RN11 - Toda Vulnerability deve ter categoria OWASP.md`
- `02-Dominio/Regras de Negocio/RN12 - Transicoes seguem maquina de estados.md`
- `02-Dominio/Regras de Negocio/RN13 - Fluxo com remediation service.md`
- `02-Dominio/Regras de Negocio/RN14 - Fluxo sem remediation service.md`
- `02-Dominio/Regras de Negocio/RN15 - Admin pode sempre mover status com auditoria.md`
- `02-Dominio/Regras de Negocio/RN16 - Cliente so ve dados da propria Company.md`
- `02-Dominio/Regras de Negocio/RN17 - Pentester so ve Projects atribuidos.md`
- `02-Dominio/Regras de Negocio/RN18 - Relatorios exigem Project em IN_REVIEW ou superior.md`
- `02-Dominio/Regras de Negocio/RN19 - Maturidade e feita por Admin.md`
- `02-Dominio/Regras de Negocio/RN20 - Criacao de Vulnerability gera auditoria.md`
- `02-Dominio/Regras de Negocio/RN21 - Mudanca de severidade gera auditoria.md`
- `02-Dominio/Regras de Negocio/RN22 - Nova assinatura notifica Admin.md`
- `02-Dominio/Regras de Negocio/RN23 - Ticket de suporte gera email para Admin.md`
- `02-Dominio/Regras de Negocio/RN24 - Push mobile filtravel por categoria.md`
- `03-Produto/Fluxos/Fluxo - Abertura de Projeto.md`
- `03-Produto/Fluxos/Fluxo - Contratacao.md`
- `03-Produto/Fluxos/Fluxo - Criacao de Aplicacao.md`
- `03-Produto/Fluxos/Fluxo - Geracao de Relatorio.md`
- `03-Produto/Fluxos/Fluxo - Onboarding.md`
- `03-Produto/Fluxos/Fluxo - Registro de Finding.md`
- `03-Produto/Fluxos/Fluxo - Revalidacao.md`
- `03-Produto/Fluxos/Fluxo - Uso da IA.md`
- `03-Produto/Jornadas/Jornada - Admin.md`
- `03-Produto/Jornadas/Jornada - Cliente.md`
- `03-Produto/Jornadas/Jornada - Pentester.md`
- `03-Produto/Modulos/Aplicacoes.md`
- `03-Produto/Modulos/Assinaturas.md`
- `03-Produto/Modulos/Autenticacao.md`
- `03-Produto/Modulos/Chat e Comentarios.md`
- `03-Produto/Modulos/Dashboard.md`
- `03-Produto/Modulos/Empresas.md`
- `03-Produto/Modulos/Evidencias.md`
- `03-Produto/Modulos/Findings.md`
- `03-Produto/Modulos/IA Gemini.md`
- `03-Produto/Modulos/Maturidade.md`
- `03-Produto/Modulos/Notificacoes.md`
- `03-Produto/Modulos/Projetos.md`
- `03-Produto/Modulos/Relatorios.md`
- `03-Produto/Modulos/Tickets.md`
- `03-Produto/Plataformas/Mobile Cliente.md`
- `03-Produto/Plataformas/Web Admin.md`
- `03-Produto/Plataformas/Web Cliente.md`
- `04-Arquitetura/API REST.md`
- `04-Arquitetura/Back-end Express.md`
- `04-Arquitetura/Banco de Dados MySQL.md`
- `04-Arquitetura/DTOs e Validacao.md`
- `04-Arquitetura/Email SMTP.md`
- `04-Arquitetura/Estrutura do projeto/Escopo Realista para o TCC.md`
- `04-Arquitetura/Estrutura do projeto/Estrutura - API Express.md`
- `04-Arquitetura/Estrutura do projeto/Estrutura - Docs do Projeto.md`
- `04-Arquitetura/Estrutura do projeto/Estrutura - Infraestrutura.md`
- `04-Arquitetura/Estrutura do projeto/Estrutura - Mobile Expo.md`
- `04-Arquitetura/Estrutura do projeto/Estrutura - Packages Compartilhados.md`
- `04-Arquitetura/Estrutura do projeto/Estrutura - Web React.md`
- `04-Arquitetura/Estrutura do projeto/Estrutura Geral do Monorepo.md`
- `04-Arquitetura/Estrutura do projeto/Legenda de Arquivos.md`
- `04-Arquitetura/Estrutura do projeto/Regras para o Claude ao Gerar Codigo.md`
- `04-Arquitetura/Expo Push.md`
- `04-Arquitetura/Front-end Web React.md`
- `04-Arquitetura/Integracao Gemini.md`
- `04-Arquitetura/Logs Estruturados.md`
- `04-Arquitetura/Middlewares e Ownership.md`
- `04-Arquitetura/Mobile Expo.md`
- `04-Arquitetura/ORM Prisma.md`
- `04-Arquitetura/Referencias de Codigo/Guia de Estilo de Codigo.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Adaptacao para Prisma.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Config e Env.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Controller.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Estrutura Backend Simples.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Middleware Upload.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Model.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Padroes que Evitar.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Repository.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Service.md`
- `04-Arquitetura/Referencias de Codigo/Referencia - Tratamento de Erros.md`
- `04-Arquitetura/Repositorios.md`
- `04-Arquitetura/Visao Geral.md`
- `04-Arquitetura/WebSocket e Tempo Real.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Checklist de Seguranca por Feature.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Padrao - Autenticacao e JWT.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Padrao - Dependencias e Bibliotecas.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Padrao - Logs e Dados Sensiveis.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Padrao - Prevencao de Injection.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Padrao - Prevencao de XSS.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Padrao - Segredos e Variaveis Sensiveis.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Padrao - Upload Seguro.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Padrao - Validacao de Entradas.md`
- `05-Infra-DevSecOps/Desenvolvimento Seguro/Politica de Desenvolvimento Seguro.md`
- `05-Infra-DevSecOps/Docker Compose.md`
- `05-Infra-DevSecOps/Dockerfiles.md`
- `05-Infra-DevSecOps/GitHub Actions CI.md`
- `05-Infra-DevSecOps/Grafana.md`
- `05-Infra-DevSecOps/OWASP ZAP.md`
- `05-Infra-DevSecOps/Observabilidade.md`
- `05-Infra-DevSecOps/Politica de Desenvolvimento Seguro.md`
- `05-Infra-DevSecOps/Prometheus.md`
- `05-Infra-DevSecOps/Seguranca da Aplicacao.md`
- `05-Infra-DevSecOps/SonarQube.md`
- `06-Dados/Campos Criticos.md`
- `06-Dados/Convenios de Nome.md`
- `06-Dados/Entidades e Relacionamentos.md`
- `06-Dados/Enum - AnalysisType e Level.md`
- `06-Dados/Enum - CompanyRole.md`
- `06-Dados/Enum - ProjectStatus.md`
- `06-Dados/Enum - Roles.md`
- `06-Dados/Enum - SubscriptionStatus.md`
- `06-Dados/Enum - TicketStatus.md`
- `06-Dados/Enum - VulnerabilityStatus.md`
- `06-Dados/MER Conceitual.md`
- `07-Decisoes/ADR-001 - Plataforma foca gestao e nao execucao real.md`
- `07-Decisoes/ADR-002 - Project 1 para 1 com Application.md`
- `07-Decisoes/ADR-003 - PDF gerado no cliente.md`
- `07-Decisoes/ADR-004 - Mobile cliente e read-mostly.md`
- `07-Decisoes/ADR-005 - Desenvolvimento local com Docker minimo.md`
- `07-Decisoes/ADR-006 - Gemini com rate limit agressivo.md`
- `07-Decisoes/ADR-007 - Sonar informativo e ZAP manual.md`
- `07-Decisoes/ADR-008 - MySQL temporario com migracao planejada para PostgreSQL.md`
- `07-Decisoes/ADR-009 - Pastas no plural e cadeia de camadas.md`
- `07-Decisoes/ADR-010 - Factory Method pendente de confirmacao.md`
- `07-Decisoes/ADR-011 - Provedor de IA em revisao.md`
- `07-Decisoes/ADR-012 - SonarQube como pipeline separado.md`
- `07-Decisoes/ADR-013 - Dominios de maturidade em aberto.md`
- `07-Decisoes/ADR-014 - Escopo reduzido para prazo de 3 meses.md`
- `07-Decisoes/ADR-015 - MySQL definitivo.md`
- `07-Decisoes/ADR-020 - Stack final do frontend web e CORS.md`
- `07-Decisoes/ADR-021 - Maquina de Vulnerability com 4 estados.md`
- `07-Decisoes/ADR-022 - Stack completa no Docker Compose.md`
- `07-Decisoes/ADR-023 - Biblioteca de componentes propria em vez de Radix.md`
- `07-Decisoes/ADR-024 - Sistema de temas com tokens OKLCH.md`
- `07-Decisoes/ADR-025 - Metricas analiticas derivadas do AuditLog.md`
- `07-Decisoes/Adr 017 ia cortada do escopo do mvp.md`
- `07-Decisoes/Adr 018 maturidade como checklist simplificado.md`
- `07-Decisoes/Adr 019 factory method confirmado.md`
- `08-Operacao/Backlog/Riscos.md`
- `08-Operacao/Backlog/Roadmap Fases.md`
- `08-Operacao/Backlog/Roadmap MVP.md`
- `08-Operacao/Backlog/Tarefas Abertas.md`
- `08-Operacao/Mudancas/Changelog do Projeto.md`
- `08-Operacao/Mudancas/Decisoes Recentes.md`
- `08-Operacao/Mudancas/Hipoteses em Validacao.md`
- `08-Operacao/Mudancas/Historico de Ideias.md`
- `08-Operacao/Mudancas/Status de Preenchimento do Vault.md`
- `08-Operacao/Runbooks/Como adicionar nova regra de negocio.md`
- `08-Operacao/Runbooks/Como adicionar novo modulo.md`
- `08-Operacao/Runbooks/Como alterar maquina de estados.md`
- `08-Operacao/Runbooks/Como atualizar o contexto mestre.md`
- `08-Operacao/Runbooks/Como registrar decisao arquitetural.md`
- `09-TCC/Casos Didaticos.md`
- `09-TCC/Distribuicao da Equipe.md`
- `09-TCC/Estrutura da Monografia.md`
- `09-TCC/Evidencias para Banca.md`
- `09-TCC/Metodologia.md`
- `09-TCC/Referencias e Bases Teoricas.md`
- `09-TCC/Testes.md`
- `10-Templates/Template - Conceito.md`
- `10-Templates/Template - Decisao.md`
- `10-Templates/Template - Documentacao Tecnica.md`
- `10-Templates/Template - Entidade.md`
- `10-Templates/Template - Fluxo.md`
- `10-Templates/Template - Funcionalidade.md`
- `10-Templates/Template - Mudanca.md`
- `10-Templates/Template - Regra de Negocio.md`
- `10-Templates/Template - Tarefa.md`
- `99-Inbox/Capturas Rapidas.md`
- `99-Inbox/Ideias Brutas.md`
- `vulnera.md`

---

# Uso na próxima etapa de auditoria

Na comparação com o código, recomenda-se acrescentar a cada item uma classificação externa, sem alterar o texto da especificação: `IMPLEMENTADO`, `PARCIAL`, `PENDENTE`, `DIVERGENTE`, `N/A — fora do MVP` ou `BLOQUEADO POR CONFLITO`.

A separação é intencional: **esta versão descreve o que deve ser verificado; não declara o que já está implementado.**
