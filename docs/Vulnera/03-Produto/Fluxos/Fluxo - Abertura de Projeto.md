---
type: fluxo
tags: [feature, flow]
status: ativo
---

# Fluxo - Abertura de Projeto

## Objetivo
Permitir que o cliente solicite uma análise de segurança para uma Application, gerando um Project em status `REQUESTED`.

## Ator principal
Cliente (OWNER ou MEMBER) — etapas de atribuição são do Admin

## Pré-condições
- `Subscription` ativa
- pelo menos uma `Application` cadastrada
- Application não tem outro Project ativo (regra 1-para-1 entre Application e Project ativo)

## Passos principais

1. Cliente acessa a Application desejada e clica em "Solicitar análise"
2. Preenche o formulário de escopo:
   - `analysis_type`: `SAST`, `DAST`, `MATURITY` ou `COMBO`
   - `analysis_level`: `BASIC`, `INTERMEDIATE` ou `ADVANCED`
   - `scope_in`: o que está incluso na análise
   - `scope_out`: o que deve ser ignorado
   - `notes`: restrições ou informações adicionais
   - `hasRemediationService`: se deseja contratar o serviço de remediação (flag)
3. Sistema cria o `Project` com status `REQUESTED` vinculado à Application
4. Admin visualiza o novo projeto na fila de triagem
5. Admin inicia triagem → status muda para `TRIAGE`
6. Admin valida o escopo e aprova → status muda para `PLANNED`
7. Admin atribui um ou mais Pentesters ao projeto (cria `ProjectMember`)
8. Pentester inicia a análise → status muda para `IN_PROGRESS`

## Regras de negócio relacionadas
- [[RN05 - Project 1 para 1 com Application]] — define a restrição de unicidade
- [[RN06 - Project herda Company da Application]] — companyId é derivado automaticamente
- [[RN07 - Projeto exige assinatura ativa]] — gate de criação
- [[RN08 - Projeto pode ter multiplos Pentesters]] — múltiplos podem ser atribuídos
- [[RN13 - Fluxo com remediation service]] — impacta quem move findings
- [[RN14 - Fluxo sem remediation service]] — caminho padrão

## Pós-condições
- `Project` criado com status `REQUESTED`
- após triagem e atribuição: `Project.status = IN_PROGRESS` e `ProjectMember` criado
- Pentesters atribuídos passam a ver o projeto em suas listagens

## Relacionado
[[Fluxo - Contratacao]]
[[Fluxo - Registro de Finding]]
[[Projetos]]
[[Project]]
[[Application]]
[[ProjectMember]]
[[Maquina - Project]]
