---
type: documentacao-tecnica
tags: [devsecops, infra, observabilidade, fora-de-escopo]
status: fora-de-escopo
---

> [!warning] Fora do escopo do MVP — revisado em 2026-07-26
> Grafana saiu do escopo do MVP (decisão D9).
>
> A nota é mantida como registro histórico e material de "trabalho futuro" para a monografia. **Não implementar.**
> Fonte da decisão: [[Contexto Mestre v4]] §14.

# Grafana

## Objetivo
Visualizar as métricas coletadas pelo Prometheus em dashboards interativos. Permite acompanhar o comportamento operacional da API e métricas de negócio do Vulnera de forma visual.

## Papel no projeto
- interface visual sobre os dados do Prometheus
- dashboards separados por perspectiva: operacional e de negócio
- material visual para demonstração na banca do TCC
- parte da camada de observabilidade (Fase 7 do roadmap)

## Como se encaixa no Vulnera

Grafana roda junto com Prometheus no `docker-compose.observability.yml`:

```bash
docker compose -f docker-compose.yml -f docker-compose.observability.yml up -d
```

Acesso: `http://localhost:3002` (porta 3002 para não conflitar com a web em 3001).
Login padrão: `admin / vulnera` (definido em `GF_SECURITY_ADMIN_PASSWORD`).

## Configuração da fonte de dados

Na primeira entrada, configurar o Prometheus como data source:
- URL: `http://prometheus:9090` (nome do serviço no Docker Compose)
- Access: Server (default)

## Dashboards planejados

### Dashboard Operacional

Foco em saúde técnica da API:

| Painel | Métrica | Tipo |
|---|---|---|
| Requisições por segundo | `rate(http_requests_total[5m])` | Gráfico de linha |
| Latência média (p50/p95) | `http_request_duration_seconds` histogram | Gráfico de linha |
| Erros 4xx e 5xx | `http_requests_total{status=~"[45].."}` | Gráfico de barras |
| Top rotas por volume | `topk(10, rate(http_requests_total[5m]))` | Tabela |
| Uso de memória | `nodejs_heap_used_bytes` | Gauge |
| CPU | `rate(process_cpu_seconds_total[5m])` | Gráfico de linha |

### Dashboard de Negócio

Foco em indicadores do domínio Vulnera:

| Painel | Métrica | Tipo |
|---|---|---|
| Projetos ativos | `active_projects` | Stat / Gauge |
| Findings criados (7 dias) | `increase(vulnerability_created_total[7d])` | Stat |
| Findings por severidade | `vulnerability_created_total` por label `severity` | Pizza / Barras |
| Assinaturas aprovadas (total) | `subscription_approved_total` | Stat |
| Tickets abertos (7 dias) | `increase(support_ticket_opened_total[7d])` | Stat |

## Provisionamento de dashboards (opcional)

Para não reconfigurar manualmente a cada `docker compose down -v`, os dashboards podem ser provisionados via arquivos JSON:

```
infra/grafana/
  provisioning/
    datasources/
      prometheus.yml
    dashboards/
      dashboard.yml
  dashboards/
    operacional.json
    negocio.json
```

```yaml
# infra/grafana/provisioning/datasources/prometheus.yml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```

## Simplificações do TCC
- sem alertas configurados no Grafana (Alerting) — sem on-call
- sem autenticação avançada — login padrão com senha simples para ambiente local
- dashboards básicos são suficientes — não é necessário observabilidade enterprise
- sem persistência entre `docker compose down -v` a menos que provisionamento seja configurado

## Valor para a banca
- screenshots dos dashboards são evidência visual forte
- dashboard de negócio conecta a plataforma ao domínio do projeto (findings, projetos, assinaturas)
- demonstra visão holística de engenharia além do código-fonte

## Riscos e cuidados
- a porta 3002 pode conflitar com outros serviços locais — verificar antes de subir
- sem TLS local — Grafana acessível em HTTP no desenvolvimento; aceitável em contexto acadêmico
- volumes Docker com dados do Grafana são apagados em `docker compose down -v` — fazer export dos dashboards antes se relevante

## Links relacionados
[[Prometheus]]
[[Observabilidade]]
[[Logs Estruturados]]
[[Docker Compose]]
[[Back-end Express]]
[[MOC - Arquitetura]]
