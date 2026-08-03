---
type: jornada
tags: [feature, journey]
status: ativo
---

# Jornada - Admin

## Perfil principal
Usuário com `role = ADMIN`. Operador da consultoria responsável por gestão de clientes, aprovação de assinaturas, atribuição de projetos e operação geral.

## Objetivo do usuário
Garantir que a operação da consultoria funcione: clientes atendidos, projetos bem atribuídos, findings de qualidade, maturidade avaliada e projetos encerrados com relatório.

## Etapas principais

### Gestão de assinaturas
- recebe notificação de nova assinatura de cliente
- acessa a fila de assinaturas pendentes
- revisa os dados da empresa (CNPJ, razão social, contato)
- aprova (ativa) ou rejeita com justificativa
- ao aprovar, envia e-mail de boas-vindas automaticamente

### Atribuição de projetos
- visualiza novos projetos em status `REQUESTED`
- inicia triagem → `TRIAGE`
- valida escopo com o cliente se necessário
- aprova o escopo → `PLANNED`
- atribui um ou mais Pentesters ao projeto
- Pentesters são notificados

### Operação diária
- monitora projetos em andamento via dashboard
- responde tickets de suporte dos clientes
- acompanha projetos em `IN_REVIEW` aguardando aprovação
- encerra projetos (`CLOSED`) após entrega e confirmação

### Maturidade
- acessa projetos ou empresas para avaliação de maturidade
- preenche domínios e subcontroles no `MaturityAssessment`
- define scores (1-5) e flag de conformidade por controle
- o score consolidado e o nível (Básico/Intermediário/Avançado) são calculados automaticamente
- cliente visualiza o resultado e a tendência histórica

### Monitoramento técnico (Fase 7)
- acessa dashboards Prometheus/Grafana para métricas de operação
- acompanha latência, erros e volume de requisições
- monitora criação de findings por severidade ao longo do tempo

## Dores e riscos

| Dor | Mitigação no Vulnera |
|-----|---------------------|
| Não saber de novas assinaturas | Notificação por e-mail e in-app (RN22) |
| Perder rastreabilidade de quem moveu qual status | AuditLog registra todos os overrides de Admin (RN15) |
| Avaliação de maturidade subjetiva e inconsistente | Estrutura de domínios e controles padronizados, score calculado automaticamente |
| Projetos sem andamento visível | Dashboard global com status, kanban e filtros |
| Tickets de suporte ignorados | E-mail com link direto ao abrir ticket (RN23) |

## Plataformas utilizadas
- **Web Admin**: todas as funções administrativas
- **Mobile**: Admin não usa o mobile (fora do escopo do MVP)

## Relacionado
[[Fluxo - Contratacao]]
[[Fluxo - Abertura de Projeto]]
[[Maturidade]]
[[Dashboard]]
[[Tickets]]
[[Web Admin]]
[[Publico-Alvo]]
[[Regras de Ownership]]
