---
type: funcionalidade
tags: [feature]
status: ativo
---

# Maturidade

## Produto vigente ? conferido em 2026-11-16

A avalia??o ? um checklist da empresa, com respostas inteiras de 1 a 5 e m?dia simples das respostas preenchidas, arredondada a duas casas. Nota 4 ou 5 indica conformidade no controle. N?vel: B?sico abaixo de 2,5; Intermedi?rio de 2,5 at? menos de 4; Avan?ado a partir de 4. ADMIN cria/preenche; CLIENT da empresa e PENTESTER autorizado consultam. N?o h? m?dia ponderada, penaliza??o autom?tica por findings ou compara??o hist?rica implementadas.

## Planejamento original ? hist?rico, n?o especifica??o vigente

As f?rmulas, n?veis e comparativos descritos abaixo foram substitu?dos pelo checklist resumido acima.

## Objetivo
Avaliar o nível de maturidade de segurança de uma empresa ou projeto em domínios de controle padronizados, produzindo um score consolidado e nível final.

## Usuários envolvidos
- **Admin**: cria e preenche o assessment (único com permissão de escrita)
- **Cliente**: visualiza o resultado e a tendência histórica (read-only)
- **Pentester**: pode visualizar (read-only)

## Estrutura hierárquica
```
MaturityAssessment
└── MaturityDomain (ex: Gestão de Acesso)
    └── MaturityControl (ex: MFA)
        └── MaturityScore (score 1-5 + is_compliant)
```

## Domínios iniciais (seed)
1. Gestão de Acesso
2. Backup & Continuidade
3. Segurança de Rede
4. Gestão de Vulnerabilidades
5. Monitoramento e Resposta
6. Conscientização e Cultura
7. Gestão de Código e Dependências

## Cálculo do score
- score de cada controle: 1 a 5 (preenchido pelo Admin)
- score do domínio: média ponderada dos controles
- score geral: média dos domínios
- **ajuste por findings ativos**: quantidade e severidade de findings OPEN penalizam o score final
- nível final:
  - `BASIC` — score < 40
  - `INTERMEDIATE` — score 40-70
  - `ADVANCED` — score > 70

## Visualização
- radar/spider chart comparativo entre avaliações (usando Recharts)
- tendência histórica entre assessments do mesmo projeto/empresa

## Regras associadas
- [[RN19 - Maturidade e feita por Admin]]

## Fluxos relacionados
- sem fluxo dedicado — avaliação é operação do Admin no contexto de um projeto

## Dependências técnicas
- `POST /maturity/assessments` (admin cria)
- `PUT /maturity/scores/:id` (admin preenche scores)
- seed de domínios e controles via Prisma no bootstrap

## Relacionado
[[MaturityAssessment]]
[[MaturityDomain]]
[[MaturityControl]]
[[MaturityScore]]
[[Dashboard]]