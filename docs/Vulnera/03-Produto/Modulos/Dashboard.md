---
type: funcionalidade
tags: [feature]
status: ativo
---

# Dashboard

## Objetivo
Exibir indicadores e visão geral da operação, diferenciados por perfil de usuário.

## Usuários envolvidos
- **Admin**: visão global da consultoria
- **Pentester**: visão dos projetos atribuídos
- **Cliente**: visão dos próprios projetos e maturidade

## Visão por perfil

### Dashboard Admin
- total de projetos ativos por status (kanban ou contagem)
- novas assinaturas pendentes de aprovação
- findings abertos por severidade (crítico, alto, médio, baixo)
- projetos com SLA próximo do vencimento
- tickets de suporte abertos
- resumo de maturidade médio das empresas ativas
- tendência de criação de findings (semana/mês)

### Dashboard Pentester
- projetos atribuídos e seus status
- total de findings abertos nos projetos ativos
- distribuição de severidade dos findings nos projetos atribuídos
- projetos com revalidação pendente

### Dashboard Cliente
- projetos da empresa por status
- findings por severidade (dos próprios projetos)
- score de maturidade atual + tendência histórica
- número de findings em REVALIDATION ou FIXED aguardando fechamento
- download de relatórios disponíveis

## Indicadores técnicos (para Admin — observabilidade)
Integração com Prometheus/Grafana (Fase 7 do roadmap) expõe:
- `active_projects` — gauge de projetos em andamento
- `vulnerability_created_total{severity}` — criação por severidade
- latência e erros de requisição

## Dependências técnicas
- dados agregados via queries no back-end (não há tabela de cache de dashboard no MVP)
- `GET /dashboard` ou queries específicas por recurso com parâmetros de contagem
- front-end usa Recharts para gráficos (incluindo radar de maturidade no dashboard do cliente)

## Relacionado
[[Project]]
[[Vulnerability]]
[[MaturityAssessment]]
[[Subscription]]
[[SupportTicket]]
[[Observabilidade]]
[[Web Admin]]
[[Web Cliente]]
