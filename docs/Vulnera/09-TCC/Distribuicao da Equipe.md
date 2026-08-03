---
type: tcc
tags: [academico, equipe]
status: ativo
---

> [!info] Revisado em 2026-07-26
> A equipe de três (Rafael, Guilherme, Iann) é mantida para **delegação no JIRA**. A execução real opera em modo solo-delegado: Rafael supervisiona e o Claude Code implementa, com checkpoints por fase.
> Se as entregas voltarem a ser distribuídas de fato, os prompts de fase em `docs/ROADMAP_PROMPTS.md` precisam ser fatiados por responsável — hoje cada prompt assume um executor único do início ao fim da fase.

# Distribuicao da Equipe

## Composição

| Integrante | Papel principal |
|---|---|
| **Rafael** | Arquiteto técnico, responsável por auth, segurança, CI/CD, observabilidade e camadas críticas |
| **Guilherme** | Front-end web, mobile, chat, relatórios PDF e testes E2E |
| **Iann** | Documentação, seeds de dados, tickets, testes manuais e suporte geral |

---

## Matriz de responsabilidade

🔴 owner (entrega final) · 🟡 colaborador (contribuição ativa) · 🟢 sob mentoria (faz com apoio)

| Área | Rafael | Guilherme | Iann |
|---|---|---|---|
| Arquitetura geral | 🔴 | | |
| Auth + segurança JWT | 🔴 | | |
| Guards de role e ownership | 🔴 | | |
| Máquinas de estado (Project, Vuln, Subscription, Ticket) | 🔴 | | |
| Cálculo CVSS e override | 🔴 | | |
| Integração Gemini | 🔴 | 🟡 (UI) | |
| Docker rootless + docker-compose | 🔴 | | |
| CI/CD GitHub Actions | 🔴 | | |
| SonarQube + TECH_STATUS | 🔴 | | |
| Prometheus + Grafana | 🔴 | | |
| E-mails transacionais | 🔴 | | |
| Notificações in-app (back) | 🔴 | | |
| Expo Push (back) | 🔴 | | |
| Hardening e auditoria | 🔴 | | |
| Onboarding público web | | 🔴 | |
| CRUD Application (front) | | 🔴 | |
| CRUD Project (front) | | 🔴 | |
| CRUD Vulnerability (front + editor) | | 🔴 | |
| Dashboard por role | | 🔴 | |
| Upload de evidências (back + front) | | 🔴 | |
| Comentários em findings | | 🔴 | |
| Chat Socket.IO (gateway + front) | | 🔴 | |
| Tela de avaliação de maturidade | | 🔴 | |
| Radar chart Recharts | | 🔴 | |
| Relatório executivo PDF | | 🔴 | |
| Relatório técnico PDF | | 🔴 | 🟡 |
| Mobile Expo (telas, navegação, push UI) | 🟡 (setup) | 🔴 | |
| Testes E2E Playwright | | 🔴 | |
| CRUD Company (front) | 🟡 (mentoria) | | 🔴 |
| Seed de Plans | | | 🔴 |
| Seed de MaturityDomain e MaturityControl | | | 🔴 |
| Tickets de suporte (CRUD básico) | | | 🔴 |
| READMEs dos módulos | | | 🔴 |
| Documentação de arquitetura | 🟡 | | 🔴 |
| Testes manuais | | | 🔴 |
| Seed de dados para demo | | | 🔴 |
| Ajustes de UI (espaçamento, cor, responsividade) | | | 🔴 |

---

## Pontos de concentração e mitigação

### Rafael — alto volume de responsabilidades críticas

Rafael é responsável pelas partes com maior impacto em segurança e arquitetura. Para evitar sobrecarga:
- delegar CRUDs de menor risco a Guilherme (já no plano)
- reservar 2h/dia para code review sem interrupção
- o vault reduz dependência de conhecimento tácito
- Guilherme assume ownership de chat e mobile — Rafael revisa mas não é bloqueante

Ver: [[Riscos]] — R6

### Iann — sem tarefas no caminho crítico

As tarefas de Iann (documentação, seeds, tickets, testes manuais) são importantes mas não bloqueiam as fases principais. Se houver evasão ou sobrecarga, são redistribuíveis.

Ver: [[Riscos]] — R1

---

## Responsabilidade por capítulo da monografia

| Capítulo | Escrita principal | Revisão final |
|---|---|---|
| 1 — Introdução | Iann | Rafael |
| 2 — Fundamentação teórica | Iann + Rafael | Rafael |
| 3 — Requisitos | Rafael | Guilherme |
| 4 — Modelagem e design | Rafael | Guilherme |
| 5 — Implementação | Rafael + Guilherme | Rafael |
| 6 — Testes e validação | Guilherme + Rafael | Rafael |
| 7 — Resultados e discussão | Todos | Rafael |
| 8 — Conclusão | Todos | Rafael |

---

## Acordo de trabalho

- **daily async**: cada integrante posta status curto no grupo (o que fez, o que vai fazer, algum bloqueio)
- **code review**: toda PR revisada por Rafael antes do merge em `develop`
- **reunião de planning**: início de cada sprint (a cada 2 semanas)
- **revisão da monografia**: Guilherme e Iann revisam seções do Rafael; Rafael revisa tudo antes de entregar

---

## Links relacionados
[[Estrutura da Monografia]]
[[Roadmap Fases]]
[[Riscos]]
[[Metodologia]]
