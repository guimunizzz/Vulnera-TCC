---
type: entidade
tags: [domain, source-of-truth]
status: ativo
---

# Project

## Definição
Representa uma análise de segurança específica vinculada a uma Application.

## Papel no sistema
É a unidade central de operação do Vulnera. Organiza escopo, andamento, findings, relatório e revalidação.

## Relacionamentos
- pertence a [[Application]]
- herda contexto de [[Company]]
- possui múltiplos [[Vulnerability]]
- possui múltiplos [[ProjectMember]]
- pode possuir [[MaturityAssessment]]
- gera [[Report]]

## Regras associadas
- [[RN05 - Project 1 para 1 com Application]]
- [[RN06 - Project herda Company da Application]]
- [[RN07 - Projeto exige assinatura ativa]]
- [[RN08 - Projeto pode ter multiplos Pentesters]]
- [[RN18 - Relatorios exigem Project em IN_REVIEW ou superior]]

## Estados
[[Maquina - Project]]

## Campos críticos
- analysis_type
- analysis_level
- has_remediation_service
- scope_in
- scope_out
- status

## Relacionado
[[Projetos]]
[[Fluxo - Abertura de Projeto]]
[[Fluxo - Revalidacao]]