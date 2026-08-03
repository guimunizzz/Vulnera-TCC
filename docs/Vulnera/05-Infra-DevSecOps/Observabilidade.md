---
type: documentacao-tecnica
tags: [devsecops, infra, observabilidade, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> A stack de observabilidade (Prometheus + Grafana) saiu do escopo do MVP. Logs estruturados permanecem — ver [[Logs Estruturados]].
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# Observabilidade

## Objetivo
Ter visibilidade sobre o comportamento da aplicação em execução — latência, erros, volume de requisições e métricas de negócio. No Vulnera, observabilidade é uma camada **opcional** planejada para a fase 7 do roadmap, que não impede o funcionamento do MVP.

## Papel no projeto
- monitoramento operacional da API em tempo de execução
- dashboards de métricas técnicas (latência, throughput, erros) e de negócio (findings criados, projetos ativos)
- evidência de maturidade técnica para a banca
- base para identificar gargalos de performance antes da apresentação final

## Como se encaixa no Vulnera

### Posição no roadmap
Observabilidade é a **Fase 7** — implementada somente após as funcionalidades principais estarem estáveis. Não é pré-requisito para o MVP funcionar.

### Arquitetura de observabilidade

```
API Express (Pino logs + prom-client)
    │
    ├── /metrics (endpoint HTTP)  ──→  Prometheus (coleta e armazena métricas)
    │                                        │
    └── stdout (logs JSON)                   └──→  Grafana (dashboards)
```

Componentes:
- **`prom-client`** — biblioteca Node.js para expor métricas no formato Prometheus
- **Prometheus** — coleta e armazena séries temporais de métricas
- **Grafana** — visualização em dashboards configuráveis

### Infraestrutura separada

Prometheus e Grafana **não entram no `docker-compose.yml` principal** — em um arquivo separado para não aumentar a complexidade da subida padrão:

```bash
# Subida padrão (sempre)
docker compose up -d

# Subida com observabilidade (quando necessário)
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

Isso mantém o `docker compose up -d` rápido e sem dependências extras para o fluxo de desenvolvimento normal.

## Camadas de observabilidade no Vulnera

### 1. Logs estruturados (Pino)
Já implementado — ver [[Logs Estruturados]].
- JSON em produção, formatado em desenvolvimento
- redact automático de campos sensíveis
- base para rastreabilidade de erros

### 2. Métricas Prometheus (Fase 7)
Expostas via endpoint `/metrics` na API:
- métricas HTTP automáticas (prom-client + express-prom-bundle)
- métricas de negócio customizadas (counters e gauges)

### 3. Dashboards Grafana (Fase 7)
Visualização sobre as métricas coletadas pelo Prometheus.

## O que observar — métricas planejadas

### Métricas técnicas (via prom-client)

| Métrica | Tipo | Descrição |
|---|---|---|
| `http_requests_total{method,route,status}` | Counter | Volume de requisições por rota e status |
| `http_request_duration_seconds{route}` | Histogram | Latência das requisições |
| `nodejs_heap_used_bytes` | Gauge | Uso de memória da API |

### Métricas de negócio (customizadas)

| Métrica | Tipo | Descrição |
|---|---|---|
| `vulnerability_created_total{severity}` | Counter | Findings criados por severidade |
| `active_projects` | Gauge | Projetos com status `IN_PROGRESS` |
| `subscription_approved_total` | Counter | Assinaturas aprovadas |
| `support_ticket_opened_total` | Counter | Tickets de suporte abertos |

## Integração com Express

```ts
// metrics.controller.ts
import { register } from 'prom-client'

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: Response) {
    res.set('Content-Type', register.contentType)
    res.end(await register.metrics())
  }
}
```

Counter customizado para findings:
```ts
import { Counter } from 'prom-client'

const vulnerabilityCounter = new Counter({
  name: 'vulnerability_created_total',
  help: 'Total de vulnerabilidades criadas',
  labelNames: ['severity'],
})

// No service, ao criar finding:
vulnerabilityCounter.inc({ severity: vulnerability.severityFinal })
```

## Simplificações do TCC
- observabilidade é **opcional** — não bloqueia MVP nem apresentação
- sem alertas automáticos (PagerDuty, Slack) — projeto acadêmico sem on-call
- sem retenção de dados de longo prazo no Prometheus
- dashboards básicos são suficientes — não precisa de observabilidade enterprise
- o endpoint `/metrics` pode exigir proteção básica para não expor métricas publicamente (mas não é crítico em contexto acadêmico)

## Valor para a banca
- demonstra visão completa de engenharia além do código
- métricas de negócio mostram integração entre produto e infraestrutura
- dashboards do Grafana são material visual rico para apresentação

## Links relacionados
[[Prometheus]]
[[Grafana]]
[[Logs Estruturados]]
[[Back-end Express]]
[[Docker Compose]]
[[MOC - Arquitetura]]
