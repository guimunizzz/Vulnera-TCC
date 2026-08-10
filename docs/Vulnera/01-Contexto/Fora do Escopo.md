---
type: contexto
tags: [core]
status: ativo
---

# Fora do Escopo

## O que o projeto não faz

### Segurança
- execução real de ataques contra sistemas
- exploração automatizada de vulnerabilidades
- integração com scanners comerciais (Burp Pro, Acunetix, Nessus)
- bloqueio automático em CI/CD do cliente baseado em resultado de análise
- coleta automática de CVEs externos (NVD, Mitre)

### Negócio e Legal
- laudos com validade jurídica ou certificação formal
- gateway de pagamento real (os planos são simulados)
- multitenancy corporativo avançado (org → subsidiárias → unidades)

### Mobile
- app mobile para Admin ou Pentester (mobile é exclusivo para CLIENT)
- criação ou edição de projetos no mobile
- chat em tempo real no mobile (apenas notificação push)
- abertura de tickets de suporte pelo mobile
- qualquer função administrativa no mobile

### Automação e IA
- IA autônoma — Gemini é assistivo, todas as sugestões requerem aprovação humana
- automação de análise de segurança sem intervenção de analista

### Cortes do prazo de 3 meses (2026-07-26)
- chat em tempo real e Socket.IO — comentários em finding cobrem a necessidade via `VulnerabilityComment`
- tickets de suporte — entidade `SupportTicket` removida do schema
- e-mail transacional e reset de senha — `AuditLog` cobre a rastreabilidade
- Prometheus, Grafana e stack de observabilidade
- testes E2E automatizados (Playwright) — integração + smoke manual cobrem
- deploy em produção
- Redis, filas e workers
- i18n

>[!info] Item removido desta lista em 2026-08-09
> **Alternância de tema** constava aqui como cortada pelo prazo. Foi
> **restaurada na Fase 6.5** — ver [[ADR-024 - Sistema de temas com tokens OKLCH]].
>
> O motivo da reversão: o corte foi feito quando "tema" significava *uma
> funcionalidade a mais*. Na Fase 6.5 o problema mudou de natureza — a exigência
> era um design system com tokens semânticos, e um sistema de tokens semânticos
> bem-feito **já é** um sistema de temas. A camada de indireção
> (`--color-surface` → `--neutral-900`) precisa existir de qualquer forma para o
> mobile da Fase 7 consumir; o segundo tema é consequência quase gratuita dela.
>
> O `i18n` **continua fora**.

Ver [[ADR-014 - Escopo reduzido para prazo de 3 meses]].

### Adiado para pós-MVP (marcado `[FUTURO]` no código)
- validação com zod (hoje: `if` manual no controller)
- middleware global de tratamento de erro (hoje: `try/catch` por método)

## Decisões relacionadas
- [[ADR-001 - Plataforma foca gestao e nao execucao real]] — justifica o foco em gestão vs execução
- [[ADR-004 - Mobile cliente e read-mostly]] — justifica escopo reduzido do mobile
- [[ADR-014 - Escopo reduzido para prazo de 3 meses]] — justifica os cortes de prazo

## Uso
Esta nota deve ser consultada antes de propor novas funcionalidades.
Qualquer proposta que viole este limite deve ser marcada como expansão futura e não como parte do escopo atual.

## Relacionado
[[Visao Geral]]
[[Diferenciais e Posicionamento]]