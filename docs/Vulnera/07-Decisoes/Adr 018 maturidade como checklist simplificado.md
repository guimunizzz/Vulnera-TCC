---
type: decisao
tags: [decision, escopo, dominio]
status: vigente
codigo: ADR-018
data: 2026-08-03
---

# ADR-018 - Maturidade como checklist simplificado

## Contexto

A avaliação de maturidade estava especificada como um modelo estilo SAMM simplificado: domínios → controles → score 1–5 por controle → agregação ponderada → nível por domínio → comparativo histórico entre avaliações. O conteúdo (quais domínios, quais controles) estava em aberto na flag F-03, registrada em [[ADR-013 - Dominios de maturidade em aberto]].

Com 12 semanas para 6 fases e a maturidade alocada na última, o custo do modelo completo não se justifica.

## Decisão

**A maturidade vira um checklist de perguntas objetivas para avaliar o ambiente do cliente.**

Estrutura:

- domínios de segurança (~7)
- 3 a 4 **perguntas objetivas** por domínio, respondíveis por quem conhece o ambiente
- resposta em escala 1–5
- **média simples** por domínio e média geral
- radar com a média por domínio

Exemplo de pergunta, no domínio Gestão de Acesso: _"Existe MFA obrigatório para acessos administrativos?"_

Fica de fora: scoring ponderado, níveis nomeados por domínio (BASIC/INTERMEDIATE/ADVANCED), comparativo histórico entre avaliações.

Isso encerra a flag **F-03** — a estrutura está definida e o conteúdo exato pode ser escrito na Fase 8 sem nova decisão.

## Justificativa

- o valor de demonstração é o mesmo: a banca vê um radar preenchido e entende a proposta
- perguntas objetivas são mais defensáveis do que controles com critério subjetivo de pontuação
- a média simples é explicável em uma frase durante a defesa
- reduz a Fase 8 e devolve folga para o fechamento do TCC, que não tem buffer

## Consequências

- os models `MaturityDomain`, `MaturityControl`, `MaturityAssessment` e `MaturityScore` continuam servindo — "controle" passa a significar "pergunta"
- [[Maturidade]] e [[RN19 - Maturidade e feita por Admin]] precisam refletir o modelo simplificado
- o radar no PDF executivo é desenhado à mão com `pdf-lib` (linhas e polígono por coordenada)
- modelo completo entra como trabalho futuro no README

## Substitui

[[ADR-013 - Dominios de maturidade em aberto]] — a flag F-03 fica encerrada.

## Relacionado

[[Contexto Mestre v4]] · [[Maturidade]] · [[MaturityDomain]] · [[MaturityControl]] · [[Roadmap Fases]]
