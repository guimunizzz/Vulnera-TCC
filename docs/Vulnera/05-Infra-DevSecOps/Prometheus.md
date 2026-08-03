---
type: documentacao-tecnica
tags: [devsecops, infra, observabilidade, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> Prometheus saiu do escopo do MVP (decisão D9).
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# Prometheus

## Objetivo
Coletar e armazenar séries temporais de métricas expostas pela API do Vulnera. Serve como backend de dados para os dashboards do Grafana.

## Papel no projeto
- coleta periódica (scrape) das métricas expostas pela API Express via `/metrics`
- armazenamento de séries temporais para consulta pelo Grafana
- parte da camada de observabilidade do Vulnera (Fase 7 do roadmap)

## Como se encaixa no Vulnera

Prometheus faz parte do `docker-compose.observability.yml` separado. Não roda por padrão — sobe apenas quando a camada de observabilidade está sendo usada.

### Configuração Docker

```yaml
# docker-compose.observability.yml
services:
  prometheus:
    image: prom/prometheus:v2.50.0
    container_name: vulnera-prometheus
    volumes:
      - ./infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - vulnera-prometheus-data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=15d'

  grafana:
    image: grafana/grafana:10.3.0
    container_name: vulnera-grafana
    ports:
      - "3002:3000"
    volumes:
      - vulnera-grafana-data:/var/lib/grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: vulnera
    depends_on:
      - prometheus

volumes:
  vulnera-prometheus-data:
  vulnera-grafana-data:
```

### Arquivo de configuração (`infra/prometheus/prometheus.yml`)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'vulnera-api'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'
```

Prometheus faz scrape do endpoint `/metrics` da API a cada 15 segundos.

## Métricas coletadas

### Métricas técnicas (automáticas via `prom-client`)

| Métrica | Descrição |
|---|---|
| `http_requests_total` | Total de requisições HTTP por método, rota e status |
| `http_request_duration_seconds` | Latência das requisições (histogram) |
| `nodejs_heap_used_bytes` | Memória heap usada pelo Node.js |
| `nodejs_active_handles_total` | Handles ativos (conexões, timers) |
| `process_cpu_seconds_total` | CPU consumido pelo processo |

### Métricas de negócio (customizadas no Express)

| Métrica | Tipo | Descrição |
|---|---|---|
| `vulnerability_created_total{severity}` | Counter | Findings criados por severidade |
| `active_projects` | Gauge | Projetos em `IN_PROGRESS` |
| `subscription_approved_total` | Counter | Assinaturas aprovadas |
| `support_ticket_opened_total` | Counter | Tickets de suporte abertos |

### Configuração no Express (prom-client)

```ts
// No módulo de métricas:
import { collectDefaultMetrics, register } from 'prom-client'

// Coleta métricas padrão do Node.js
collectDefaultMetrics({ register })
```

## Acesso à interface
- Prometheus UI: `http://localhost:9090`
- Útil para testar queries PromQL antes de configurar no Grafana

## Exemplos de queries PromQL

```promql
# Taxa de requisições por segundo (últimos 5 minutos)
rate(http_requests_total[5m])

# Latência média por rota
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Erros 5xx nas últimas 24h
increase(http_requests_total{status=~"5.."}[24h])

# Projetos ativos agora
active_projects

# Findings críticos criados na última semana
increase(vulnerability_created_total{severity="CRITICAL"}[7d])
```

## Simplificações do TCC
- retenção de 15 dias (`--storage.tsdb.retention.time=15d`) — suficiente para acompanhar o desenvolvimento
- sem alertas configurados (AlertManager) — sem on-call em projeto acadêmico
- sem federação ou alta disponibilidade — instância única local
- `host.docker.internal` funciona em Mac/Windows; Linux pode precisar de ajuste no scrape target

## Riscos e cuidados
- o endpoint `/metrics` expõe informações técnicas da aplicação — considerar adicionar autenticação básica em ambiente externo
- Prometheus consome RAM ao crescer o volume de séries — com retenção de 15 dias e poucas métricas, é negligenciável
- scrape interval de 15s é adequado para desenvolvimento — em produção real poderia ser menor

## Links relacionados
[[Observabilidade]]
[[Grafana]]
[[Logs Estruturados]]
[[Back-end Express]]
[[Docker Compose]]
[[MOC - Arquitetura]]
