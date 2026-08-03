---
type: contexto
tags: [core]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Proposta de Valor

## Para o cliente (empresa contratante)

| Valor | Descrição |
|-------|-----------|
| Clareza contratual | Escopo definido formalmente com aceite, sem ambiguidade |
| Visibilidade em tempo real | Acompanhamento do status de projetos e findings via web e mobile |
| Relatórios profissionais | Relatório técnico e executivo em PDF gerado client-side |
| Mobile com push | Notificações push para eventos críticos (finding grave, mudança de status) |

## Para a equipe técnica (consultoria)

| Valor | Descrição |
|-------|-----------|
| Centralização de findings | Todos os achados em um só lugar, com thread de comentários e histórico |
| Padronização CVSS/OWASP | Severidade calculada automaticamente por padrão de mercado |
| Assistência por IA | Gemini sugere descrição, OWASP e recomendação a partir do título |
| Auditoria completa | Trilha de log para criação de findings e mudanças de severidade |

## Para o TCC

| Valor | Descrição |
|-------|-----------|
| Arquitetura real | Back-end em camadas (controller → service → repository) com Express |
| TypeScript end-to-end | Tipagem forte em todas as camadas: API, web e mobile |
| Três aplicações integradas | Web admin, web cliente e mobile com comunicação via API REST + WebSocket |
| DevSecOps como meta | O produto analisa segurança e aplica boas práticas em si mesmo |
| Tema atual com IA | Integração real com Gemini como assistência, não automação |

## Diferenciais em relação a soluções simples
- não é um CRUD simples — tem máquina de estados, integrações externas, real-time e mobile
- domínio de segurança da informação aplicado com padrões reais (CVSS v3.1, OWASP Top 10)
- laboratório didático: aplicações de colegas do curso como alvos reais de análise

## Relacionado
[[Visao Geral]]
[[Problema e Oportunidade]]
[[Diferenciais e Posicionamento]]
[[ADR-001 - Plataforma foca gestao e nao execucao real]]
