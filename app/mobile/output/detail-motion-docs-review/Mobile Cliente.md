---
type: plataforma
tags: [feature]
status: ativo
---

# Mobile Cliente

## Usuários
- CLIENT

## Papel
Acompanhamento read-only de projetos e findings da própria empresa, com notificações push de novas vulnerabilidades críticas.

## Limites
- sem funções administrativas
- sem criação ou edição principal de projetos
- chat em tempo real não é foco inicial

## Decisão associada
[[ADR-004 - Mobile cliente e read-mostly]]

## Escopo vigente do MVP

Cinco telas: Login, Home/Projetos, ProjectDetail, FindingDetail e Configurações/Minha conta. O cadastro acontece no web. O cliente consulta projetos, vulnerabilidades, evidências e comentários; não cria/edita dados nem envia comentários no mobile. Relatórios/PDF, chat e preferências por categoria não integram a Fase 7. Em 2026-10-06, a área autenticada recebeu visual próprio com roxo/liquid glass e integração validada contra a API real, mantendo o login. Ver `docs/ROADMAP_PROMPTS.md` e [[ADR-045 - Consulta mobile paginada e isolamento de sessao]].


## Comportamento visual vigente — 2026-10-09

Home e Configurações compartilham a assinatura compacta; a barra usa o indicador roxo deslizante da opção 1. Abrir projeto/vulnerabilidade e alternar Home/Configurações aplica deslize curto com fade de 320 ms, com direção invertida no retorno. Blocos entram em sequência, skeletons indicam a primeira espera da API e informações/comentários permitem expansão suave. Comentários são mostrados inicialmente; o vetor CVSS é expansível. A preferência por movimento reduzido aplica estados diretamente. O escopo continua de consulta, com contratos reais, paginação e erros separados de vazio. Aparência e desempenho nativos ainda precisam de validação em aparelho.
