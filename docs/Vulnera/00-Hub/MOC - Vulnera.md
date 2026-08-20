---
type: moc
tags: [core]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# MOC - Vulnera

## Fonte de verdade
[[Contexto Mestre v4]] ← **começar por aqui**

## Fonte original (histórico)
[[Fonte Original - MVP Vulnera]]
[[vulnera]]

## Identidade do projeto
[[Visao Geral]]
[[Problema e Oportunidade]]
[[Objetivos]]
[[Publico-Alvo]]
[[Proposta de Valor]]
[[Diferenciais e Posicionamento]]
[[Fora do Escopo]]

## Núcleo do domínio
[[MOC - Dominio]]
[[Company]]
[[User]]
[[Plan]]
[[Subscription]]
[[Application]]
[[Project]]
[[ProjectMember]]
[[Vulnerability]]
[[Evidence]]
[[VulnerabilityComment]]
[[MaturityAssessment]]
[[MaturityDomain]]
[[MaturityControl]]
[[MaturityScore]]
[[Report]]
[[Notification]]
[[AuditLog]]
[[PasswordResetToken]]
[[RefreshToken]]

## Produto
[[MOC - Produto]]
[[Autenticacao]]
[[Empresas]]
[[Aplicacoes]]
[[Assinaturas]]
[[Projetos]]
[[Findings]]
[[Evidencias]]
[[Maturidade]]
[[Relatorios]]
[[Notificacoes]]
[[Dashboard]]
[[IA Gemini]]
[[Web Admin]]
[[Web Cliente]]
[[Mobile Cliente]]

## Arquitetura
[[MOC - Arquitetura]]
[[Visao Geral]]
[[Back-end Express]]
[[Front-end Web React]]
[[Mobile Expo]]
[[Banco de Dados MySQL]]
[[ORM Prisma]]
[[API REST]]
[[Middlewares e Ownership]]
[[DTOs e Validacao]]
[[Repositorios]]
[[Logs Estruturados]]
[[Integracao Gemini]]
[[Expo Push]]

## DevSecOps
[[Docker Compose]]
[[Dockerfiles]]
[[GitHub Actions CI]]
[[SonarQube]]
[[OWASP ZAP]]
[[Seguranca da Aplicacao]]

## Desenvolvimento seguro
[[Politica de Desenvolvimento Seguro]]
[[Checklist de Seguranca por Feature]]
[[Padrao - Autenticacao e JWT]]
[[Padrao - Validacao de Entradas]]
[[Padrao - Prevencao de Injection]]
[[Padrao - Prevencao de XSS]]
[[Padrao - Segredos e Variaveis Sensiveis]]
[[Padrao - Logs e Dados Sensiveis]]
[[Padrao - Dependencias e Bibliotecas]]
[[Padrao - Upload Seguro]]

## Decisões
[[ADR-001 - Plataforma foca gestao e nao execucao real]]
[[ADR-002 - Project 1 para 1 com Application]]
[[ADR-003 - PDF gerado no cliente]]
[[ADR-004 - Mobile cliente e read-mostly]]
[[ADR-005 - Desenvolvimento local com Docker minimo]]
[[ADR-006 - Gemini com rate limit agressivo]]
[[ADR-007 - Sonar informativo e ZAP manual]]
[[ADR-008 - MySQL temporario com migracao planejada para PostgreSQL]] (substituída)
[[ADR-009 - Pastas no plural e cadeia de camadas]]
[[ADR-010 - Factory Method pendente de confirmacao]] 🚩
[[ADR-011 - Provedor de IA em revisao]] 🚩
[[ADR-012 - SonarQube como pipeline separado]]
[[ADR-013 - Dominios de maturidade em aberto]] 🚩
[[ADR-014 - Escopo reduzido para prazo de 3 meses]]
[[ADR-015 - MySQL definitivo]]

## Dados e modelagem
[[MER Conceitual]]
[[Entidades e Relacionamentos]]
[[Campos Criticos]]
[[Convenios de Nome]]
[[Enum - Roles]]
[[Enum - CompanyRole]]
[[Enum - ProjectStatus]]
[[Enum - VulnerabilityStatus]]
[[Enum - SubscriptionStatus]]
[[Enum - TicketStatus]]
[[Enum - AnalysisType e Level]]

## Operação
[[MOC - Operacao]]
[[Roadmap MVP]]
[[Roadmap Fases]]
[[Riscos]]
[[Changelog do Projeto]]
[[Decisoes Recentes]]
[[Tarefas Abertas]]

## TCC
[[Estrutura da Monografia]]
[[Evidencias para Banca]]
[[Casos Didaticos]]
[[Metodologia]]
[[Distribuicao da Equipe]]
[[Testes]]
[[Referencias e Bases Teoricas]]

## Contexto para IA
[[Claude - Guia Operacional]]

## Fora do escopo (notas históricas)
[[ChatMessage]] · [[SupportTicket]] · [[Chat e Comentarios]] · [[Tickets]] · [[WebSocket e Tempo Real]] · [[Email SMTP]] · [[Prometheus]] · [[Grafana]] · [[Observabilidade]]
