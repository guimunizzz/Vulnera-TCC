---
type: funcionalidade
tags: [feature]
status: ativo
---

# Findings

## Objetivo
Permitir registrar, classificar, discutir e acompanhar vulnerabilidades.

## Componentes
- título
- descrição
- categoria OWASP
- CVSS
- severidade
- impacto
- recomendação
- status
- evidências
- comentários

## Onde os findings são listados

Desde a Fase 9, **uma implementação só** de listagem atende a página global e a
aba do projeto — ver [[Findings Globais]] e [[ADR-028 - Tabela de findings como componente canonico]].

## Regras associadas
- [[RN09 - Vulnerability pertence a um Project]]
- [[RN10 - Severidade via CVSS com override justificado]]
- [[RN11 - Toda Vulnerability deve ter categoria OWASP]]
- [[RN12 - Transicoes seguem maquina de estados]]
- [[RN20 - Criacao de Vulnerability gera auditoria]]
- [[RN21 - Mudanca de severidade gera auditoria]]

## Relacionado
[[Vulnerability]]
[[Evidence]]
[[VulnerabilityComment]]
[[IA Gemini]]