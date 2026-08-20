---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN06
criticidade: media
---

# RN06 - Project herda Company da Application

## Enunciado
Um `Project` herda a `Company` da sua `Application`.

## Motivação
Mantém rastreabilidade de ownership sem redundância. Como Application já pertence a uma Company (RN04), o Project não precisa de campo `company_id` próprio. Evita inconsistência em que um Project poderia apontar para uma Company diferente da Application.

## Escopo
Aplica-se a todos os Projects. O `companyId` do Project é derivado da sua Application.

## Condições
- ao criar um Project, o sistema resolve `companyId = project.application.companyId`
- filtros de visibilidade por Company em listagens de Projects usam este vínculo derivado
- se armazenado por denormalização, deve ser consistente com a Application no momento da criação

## Impacta
[[Project]]
[[Application]]
[[Company]]

## Casos de teste
- listagem de projects por empresa retorna apenas projects cuja application pertence àquela empresa
- filtro de ownership de CLIENT usa company da application, não um campo direto no project

## Relacionado
[[RN04 - Application pertence a uma unica Company]]
[[RN05 - Project 1 para 1 com Application]]
[[RN16 - Cliente so ve dados da propria Company]]
