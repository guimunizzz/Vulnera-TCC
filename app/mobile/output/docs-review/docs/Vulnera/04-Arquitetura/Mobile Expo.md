---
type: documentacao-tecnica
tags: [architecture]
status: ativo
---

# Mobile Expo

## Papel
Cliente mobile enxuto para consulta e acompanhamento.

## Stack
- React Native
- Expo
- Expo Router
- Expo Notifications
- Axios
- TanStack Query

## Responsabilidades no MVP
- login exclusivo do CLIENT, sem cadastro
- lista de projetos da empresa, com busca/status e atualização
- detalhe de projeto com metadados, datas e lista paginada de vulnerabilidades
- detalhe read-only de vulnerabilidade, com CVSS, OWASP, descrição, impacto, recomendação e SLA/VRS quando fornecidos
- consulta de evidências autenticadas e comentários paginados
- conta com perfil atualizado, logout e status compartilhado do push
- registro de dispositivo e alertas de novas vulnerabilidades CRITICAL

## Limites

Relatórios/PDF e preferências de push por categoria eram citados como responsabilidades aqui, mas não integram o recorte da Fase 7. Permanecem fora do mobile atual, assim como criação/edição, upload, envio de comentários, chat, maturidade e funções de ADMIN/PENTESTER. A RN24 descreve uma evolução futura.

## Consulta e sessão — atualização de 2026-10-06

A identidade visual autenticada foi refeita com autorização explícita do usuário. Login e tokens anteriores foram preservados. As consultas usam os DTOs reais, paginação e facetas do servidor; falha não equivale a lista vazia. Cache por sessão é limpo em logout/troca de conta, o refresh preserva sessão em falha de rede e ignora respostas de conta anterior, e 429 respeita Retry-After. Android/iOS mantêm SecureStore; preview web guarda sessão apenas em memória. Ver [[ADR-045 - Consulta mobile paginada e isolamento de sessao]] e `app/mobile/output/mobile-refactor-report.md`.
