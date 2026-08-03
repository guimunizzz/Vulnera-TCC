---
type: decisao
tags: [decision, source-of-truth]
status: vigente
codigo: ADR-002
---

# ADR-002 - Project 1 para 1 com Application

## Contexto
No modelo inicial de domínio, debateu-se se uma `Application` poderia ter múltiplos projetos simultâneos ativos (ex: análise SAST e DAST em paralelo sobre o mesmo sistema) ou se deveria existir uma relação mais restrita.

Duas perspectivas competiram:
1. **Modelo flexível**: Application pode ter N Projects em estados distintos simultaneamente, refletindo a realidade de consultorias que executam análises em paralelo
2. **Modelo 1-para-1**: Application tem no máximo um Project ativo por vez, simplificando escopo, rastreabilidade e o modelo de dados

A equipe precisava de uma decisão que fosse sustentável no prazo de 7 meses com 3 pessoas, sem abrir mão da coerência do produto.

## Decisão
**Um `Project` é 1-para-1 com uma `Application`.**

Isso significa:
- uma Application tem no máximo um Project ativo em determinado momento
- um Project está vinculado a exatamente uma Application
- o Project herda a Company da Application — rastreabilidade de propriedade sempre via Application → Company

## Alternativas consideradas

### Alternativa A: Application tem N Projects simultâneos
- **Prós**: reflete realidade de algumas consultorias; permite SAST e DAST em paralelo
- **Contras**: exige controle de conflito de escopo entre projetos; dashboard do cliente fica mais complexo; modelo de ownership vira N:M via Application; pentesters precisariam navegar entre projetos do mesmo sistema

### Alternativa B: Project independente de Application (relação direta com Company)
- **Prós**: maior flexibilidade
- **Contras**: perde o conceito central de "análise de uma aplicação específica"; findings ficam sem contexto de sistema claro; relatório técnico perde âncora

### Alternativa C (adotada): 1-para-1 com archive implícito
- Project 1-para-1 com Application
- quando uma nova análise for necessária, a Application pode receber um novo Project após o anterior ser encerrado (`CLOSED`)
- histórico fica preservado — o Project antigo não é deletado

## Consequências positivas
- **Modelo de dados simples**: FK `application_id` no Project, sem tabela intermediária
- **Ownership direto**: Project → Application → Company — nunca ambíguo
- **Dashboard claro**: o cliente vê "projetos da aplicação X" sem sobreposição
- **Relatório técnico coerente**: sempre há uma aplicação inequívoca como alvo da análise
- **Guards e ownership mais fáceis**: verificar `project.application.companyId === user.companyId` resolve em uma query

## Trade-offs e limitações
- não suporta análises simultâneas de tipos diferentes na mesma Application (SAST + DAST em paralelo) — aceito no MVP
- cliente que quiser nova análise da mesma aplicação precisa esperar o projeto anterior fechar — fluxo operacional a documentar
- a relação é `1-para-1 no momento ativo`, não ao longo do tempo — o histórico pode ter múltiplos Projects fechados para a mesma Application

## Impacto no sistema

| Camada | Impacto |
|---|---|
| Banco de dados | FK `application_id UNIQUE` no `PROJECT` (unicidade do projeto ativo por application) |
| Domínio | [[RN05 - Project 1 para 1 com Application]], [[RN06 - Project herda Company da Application]] |
| Guards | Ownership verificado via `project.application.companyId` |
| Dashboard | Simplificado — uma aplicação tem no máximo um projeto visível em andamento |
| Relatório | Âncora clara: `Project → Application → Company` |

## Quando revisar
Revisar esta decisão se:
- um cliente ou usuário real demandar fortemente análises simultâneas na mesma aplicação
- o produto for além do MVP e precisar suportar múltiplos tipos de análise em paralelo
- o modelo de negócio evoluir para projetos independentes do sistema-alvo

## Links relacionados
[[RN05 - Project 1 para 1 com Application]]
[[RN06 - Project herda Company da Application]]
[[Project]]
[[Application]]
[[Middlewares e Ownership]]
[[Regras de Ownership]]
[[MOC - Dominio]]
