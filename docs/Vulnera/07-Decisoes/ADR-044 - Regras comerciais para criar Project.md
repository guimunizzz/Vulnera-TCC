---
type: decisao
tags: [decision, project, subscription, plan]
status: vigente
codigo: ADR-044
data: 2026-10-01
---

# ADR-044 - Regras comerciais para criar Project

## Contexto

A Issue #20 reutiliza a criação de `Project` existente. Na baseline anterior ao
CP-3, o serviço não aplicava todas as regras comerciais já descritas no domínio.
A descoberta confirmou que a empresa deve vir da `Application` escolhida e que
o backend rejeita qualquer segunda criação para a mesma aplicação, inclusive
quando o projeto anterior está `COMPLETED`. Também era necessário definir como a
capacidade simultânea de projetos e o serviço de remediação se relacionam com a
assinatura.

O schema relaciona `Project.applicationId` a `Application`, mantém
`Project.companyId` como vínculo derivado e define os campos reais
`Plan.maxProjects` e `Plan.includesRemediation`. Não há unicidade de
`Project.applicationId` no banco.

## Decisão

- O gate de assinatura consulta a subscription `ACTIVE` da empresa da
  `Application` selecionada. O `companyId` do usuário autenticado, inclusive de
  ADMIN, não define a empresa-alvo.
- O plano aplicável é o `Plan` ligado a essa subscription ativa.
- `maxProjects` limita projetos simultâneos da empresa. Contam `PENDING`,
  `IN_PROGRESS` e `IN_REVIEW`; `COMPLETED` não ocupa capacidade.
- `hasRemediation` é um opt-in. O Project só pode solicitar esse serviço quando
  `Plan.includesRemediation` for `true`; plano sem remediação não habilita a
  opção.
- Uma `Application` inativa não é elegível para um novo Project.
- O nome do projeto, após `trim`, deve conter de 1 a 191 code points; nome vazio
  ou maior que esse limite é inválido.
- Mantém-se RN05: uma `Application` pode ter um único `Project` durante todo o
  tempo, inclusive após conclusão. A verificação concorrente check-then-create
  permanece uma limitação separada; esta decisão e o CP-1 não afirmam garantia
  contra duas criações simultâneas.
- Não alterar schema nem criar migration nesta entrega. Qualquer constraint ou
  proteção transacional para RN05 concorrente exige tarefa própria e verificação
  de dados existentes.

## Consequências

- ADMIN pode criar para qualquer empresa alcançada por uma `Application`
  elegível, independentemente de seu `User.companyId` pessoal.
- CLIENT continua sujeito ao tenant autorizado pela API; a interface não concede
  acesso a outra empresa.
- O service de Project aplica os gates comerciais no create e impede que um
  update mude `hasRemediation` de `false` para `true` sem elegibilidade. A
  whitelist de update também protege `companyId`, `applicationId` e `status`;
  metadados comuns não passam pelo gate comercial, e desligar remediação para
  `false` continua permitido.
- CP-3 foi validado em teste focal API (24/24), cobertura de
  `project.service` de 100% em linhas/funções, 84,31% em branches e 93,2% em
  statements, além dos builds API host/Docker aprovados. O CP-4 concluiu com
  smoke Playwright real 1/1, duas criações 201 e confirmação por leitura Prisma
  de exatamente dois Projects do marcador, ambos com `companyId` igual ao da
  Application/Company esperada. A Issue #20 foi validada em 100% (CP-0 a CP-4).
- A suíte API completa ficou em 598/601 por três erros ambientais `spawn EPERM`
  durante a inicialização DAST no sandbox; a repetição isolada/escalada passou
  17/17. O `npm run check` global da API permanece bloqueado por dois imports
  preexistentes não usados em `vulnerability.service.ts:45`; não é declarado
  como verde nem foi corrigido nesta issue.
- `maxProjects` e RN05 continuam sujeitos a corrida concorrente: verificação e
  contagem ocorrem antes da criação sem serialização. Esta decisão não promete
  garantia de capacidade nem de unicidade sob requests simultâneas; hardening
  requer tarefa própria.

## Relacionado

- [[RN05 - Project 1 para 1 com Application]]
- [[RN07 - Projeto exige assinatura ativa]]
- [[Plan]]
- [[Remediation Service]]
- [[Discovery-Planejamento-Issue-20-Vulnera]]
- ADR-043 - Alvo administrativo explícito na criação de Application
