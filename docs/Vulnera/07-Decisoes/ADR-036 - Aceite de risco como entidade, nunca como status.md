---
type: decisao
tags: [decision, risk-acceptance, governanca, sla, tenancy]
status: vigente
codigo: ADR-036
data: 2026-09-16
---

# ADR-036 - Aceite de risco como entidade, nunca como status

## Contexto

Toda operação de segurança acaba tendo findings que **não serão corrigidos
agora** por decisão de negócio: a correção exige reescrever um módulo, o custo
não se justifica, existe controle compensatório. Sem representar isso, restam
dois caminhos ruins: fechar o finding (mentindo que foi corrigido) ou deixá-lo
estourando o SLA para sempre (transformando o indicador em ruído).

O ADR-021 já havia previsto um estado `RISK_ACCEPTED` e o descartado por falta
de regra de alçada. O CP-4 traz a regra — e reabre a pergunta: status ou
entidade?

## Decisão

**`RiskAcceptance` é uma entidade própria. A `Vulnerability` permanece ABERTA
durante o aceite.**

```
Vulnerability.status:  OPEN / IN_PROGRESS / FIXED / CLOSED   (inalterado)
RiskAcceptance.status: REQUESTED / APPROVED / REJECTED / REVOKED / EXPIRED
```

Regras:

- **Segregação de função sem exceção:** `requestedById != reviewedById`,
  inclusive para ADMIN.
- **PENTESTER nunca aprova risco.** Pode solicitar; quem assina é o dono do
  risco. `companyRole` é lido do **banco**, nunca do JWT.
- **Aceite tem validade.** `expiresAt` obrigatório, teto de 365 dias. Um aceite
  sem prazo é um finding esquecido com papel timbrado.
- **Enquanto vigente, o SLA fica PAUSADO** — não zerado. Ao terminar, o intervalo
  da pausa é somado a `slaPausedMs` e `slaDueAt`/`slaDueSoonAt` são deslocados
  juntos.
- **Expiração é PREGUIÇOSA.** Não há job: a leitura normaliza o que venceu, com
  um `updateMany` condicional (`WHERE status='APPROVED' AND expiresAt < now`).

## Justificativa

1. **Um aceite tem autor, aprovador, justificativa, prazo e revogação.** Nada
   disso cabe num enum de status; caberia numa coluna extra, depois em outra, e
   ao fim se teria uma entidade mal modelada dentro da tabela errada.
2. **O finding continua aberto porque ele continua existindo.** Aceitar risco
   não corrige nada. Manter `OPEN` é o que faz a métrica de exposição continuar
   dizendo a verdade.
3. **A máquina de estados fica intacta.** Sem `RISK_ACCEPTED`, as transições do
   ADR-033 continuam valendo e nenhuma métrica precisa de regra especial.
4. **Dois eixos independentes.** "Em que ponto do conserto está" e "houve
   decisão formal de não consertar agora" são perguntas diferentes, e cruzá-las
   num campo só perderia uma das duas.

## Consequências

- **A busca ganha `?riskAcceptance=`** com `ACTIVE | EXPIRED | REQUESTED | NONE`,
  expresso nos **dois** construtores gêmeos (`some`/`none` no Prisma, `EXISTS` /
  `NOT EXISTS` no SQL cru).
- **`EXPIRED` exclui quem tem aceite ativo**: um finding com um aceite vencido e
  outro vigente não é "vencido".
- **A expiração preguiçosa é atômica.** O `updateMany` condicional garante que,
  sob concorrência, exatamente uma requisição recebe `count: 1` — e só ela
  escreve o evento de auditoria. Provado por `RISK-ACC-10`, com duas leituras
  simultâneas.
- **Não existe rota de edição de aceite decidido.** Aprovado/rejeitado é
  imutável; o que existe é revogar, que é outro evento, com autor e motivo.
- **O relatório executivo em PDF ganhou seção de riscos aceitos** — sem ela, o
  documento mostraria findings abertos sem explicar por que alguns não estão
  sendo corrigidos.
- **`revokedById` ganhou FK em migration ADITIVA** (`20260916015804`), sem editar
  a migration já aplicada.

## Alternativas descartadas

**Status `RISK_ACCEPTED` na `Vulnerability`.** Descartada: perde autor,
aprovador, prazo e revogação; some com o finding das métricas de exposição; e
reabre a máquina de estados fechada no ADR-033.

**Aceite sem prazo de validade.** Descartada: vira arquivo morto. Prazo
obrigatório força a revisão periódica, que é o ponto do instrumento.

**Job noturno de expiração.** Descartada: a stack não tem agendador (ADR-030), e
entre duas execuções a tela mentiria sobre a vigência.

**Zerar o SLA ao fim do aceite.** Descartada: o tempo antes do aceite é tempo
real de exposição. Pausar preserva a verdade; zerar apagaria.

## Relacionado
[[ADR-033 - Transicoes de retorno na maquina de Vulnerability]]
[[ADR-034 - SLA de remediacao persiste o prazo e deriva o estado]]
[[Matriz de Permissoes]]
