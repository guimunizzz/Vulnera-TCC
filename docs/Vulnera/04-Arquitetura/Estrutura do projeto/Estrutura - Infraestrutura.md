---
type: estrutura-projeto
tags: [architecture, devsecops, infra]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Estrutura - Infraestrutura

## Objetivo

Definir a estrutura de infraestrutura do Vulnera.

A pasta `infra/` contém recursos de apoio ao desenvolvimento, observabilidade e deploy de referência.

## Estrutura

```text
infra/
├── docker-compose.yml
├── docker-compose.prod.yml
├── prometheus/
├── grafana/
└── nginx/
```

## `docker-compose.yml`

Ambiente de desenvolvimento.

Deve conter, no mínimo:

- MySQL
- SonarQube
- Mailhog

## `docker-compose.prod.yml`

Referência futura de produção.

No contexto do TCC, não precisa ser totalmente finalizado.

## `prometheus/`

Configuração de coleta de métricas.

```text
prometheus/
└── prometheus.yml
```

## `grafana/`

Configuração de dashboards.

```text
grafana/
├── provisioning/
│   ├── dashboards/
│   └── datasources/
└── grafana.ini
```

## `nginx/`

Configuração de reverse proxy.

```text
nginx/
└── nginx.conf
```

## Relação com DevSecOps

Esta estrutura se relaciona com:

- [[Docker Compose]]
- [[Dockerfiles]]
- [[Prometheus]]
- [[Grafana]]
- [[Observabilidade]]
- [[SonarQube]]
- [[OWASP ZAP]]

## Regra para o Claude

Ao gerar infraestrutura, o Claude deve lembrar que o Vulnera é um TCC.

Portanto:

- priorizar simplicidade
- não criar arquitetura de produção complexa demais
- manter Docker Compose útil para desenvolvimento
- documentar claramente o que é obrigatório e o que é referência futura