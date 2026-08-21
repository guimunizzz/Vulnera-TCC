# Vulnera — Fase 6.8: Remediação dos Findings P1

## Contexto

Sessão na raiz do repositório. Você é o agente de implementação do Vulnera,
plataforma SaaS de gestão de análises de segurança (TCC/SENAI).

LEITURA OBRIGATÓRIA antes de tocar em qualquer arquivo:
- `CLAUDE.md` (§0.1 docs vivos, §0.2 modo solo, §5 padrão, §9 erros, §12 testes, §14 anti-patterns)
- `PRD_VIVO.md`
- `CONSOLIDATED_FINDINGS.md` — **o documento que origina esta fase; leia inteiro**
- `docs/Vulnera/00-Hub/Contexto Mestre v4.md`
- `docs/DESIGN_SYSTEM.md` (para o CP7)
- `app/api/prisma/schema.prisma`

## Situação

Uma auditoria estática do baseline `dev@49cac591` produziu 32 findings
acionáveis: **9 P1, 22 P2, 1 P3**. Nenhum P0.

Dois fatos sobre essa auditoria que governam esta fase:

1. **Nada foi executado.** Todo finding está `STATIC_EVIDENCE: CONFIRMED` mas
   `VALIDATION_STATUS: NOT_RUN`. São leituras de código, não observações de
   runtime. Parte pode ser falso-positivo.
2. **Todo critério de fechamento exige execução** — `INTEGRATION_TEST`,
   `CONCURRENCY_TEST`, `DATABASE_RUNTIME`, `CI_PIPELINE`, `BROWSER`. Sem
   pipeline funcionando, nenhum finding pode ser declarado fechado.

## Missão

Fechar os 9 findings P1 e os P2 que compartilham causa raiz com eles. **Não** os
32. O que ficar de fora vira "limitação conhecida" documentada.

Cada finding fechado precisa de **teste que falha antes da correção e passa
depois**. Correção sem teste não fecha finding — apenas move o problema para
fora do radar.

## Escopo desta fase

### Fechar (P1)
`INFRA-002` · `SECURITY-001` · `SECURITY-002` · `AUTH-001` · `BUSINESS-001` ·
`BUSINESS-002` · `BUSINESS-003` · `BUSINESS-004` · `METRICS-001`

### Fechar junto (P2 com a mesma causa raiz — sai mais barato agora)
`BUSINESS-005`, `BUSINESS-007`, `BUSINESS-008`, `MATURITY-002` (atomicidade) ·
`SECURITY-003`, `AUTH-002`, `SECURITY-004` (autorização e auth) ·
`FRONTEND-001`, `FRONTEND-002`, `FRONTEND-003` (painel, visível na demo) ·
`TESTS-001` (gate de cobertura)

### Explicitamente fora
`BACKEND-002` (P3) · `EVIDENCE-001`, `EVIDENCE-002`, `BUSINESS-009`,
`DATA-001`, `MATURITY-001`, `FRONTEND-004/005/006`, `TESTS-002`, `INFRA-001` ·
`SPEC-001`, `SPEC-002` (exigem decisão humana, não código) ·
`VALIDATION-002` (sem objeto)

Registre cada um destes no README como limitação conhecida, com o motivo.

## Modo de operação (AUTO-MODE)

Execute os checkpoints em sequência sem parar. Reporte ao fim de cada um e siga.

PARE E PERGUNTE apenas se:
1. O CP0 revelar que o estado real do código diverge materialmente do que a
   auditoria descreve — nesse caso reporte a divergência antes de corrigir
2. For necessário alterar `schema.prisma` além do previsto no CP4
3. Uma correção quebrar contrato público já mergeado
4. Docker indisponível e você não conseguir subir o ambiente

Branch `fix/fase-6.8-findings-p1`. NÃO commite, NÃO abra PR.
Você tem Docker e navegador. Valide de verdade.

---

## CHECKPOINT 0 — Estabelecer a verdade

A auditoria é estática. Antes de corrigir 20 findings, confirme que eles existem.

### Ambiente
```bash
docker ps || echo "iniciar Docker Desktop"
cd app/api && docker compose up -d && docker compose ps
npm run check
cd ../web && npm run build
```

### Verificação amostral
Abra o código e confirme **com citação de arquivo e linha** cinco findings —
um de cada tema. Para cada um, diga `CONFIRMADO` ou `REFUTADO` com evidência:

- `SECURITY-001` — `application.controller.ts:77`, `project.controller.ts:88`:
  o controller realmente faz cast de `req.body` inteiro e o repository repassa
  o objeto integral?
- `AUTH-001` — `auth.service.ts:54,63,68`: leitura, teste de `revokedAt` e
  revogação são mesmo chamadas separadas, sem transação?
- `BUSINESS-003` — `project.service.ts`: `create` realmente não consulta
  Subscription nem Plan?
- `INFRA-002` — existe `package-lock.json` no repositório? O `.gitignore` o
  ignora? O workflow usa `npm ci`?
- `METRICS-001` — `metrics.repository.ts:147-190`: o SQL cru de aging/MTTR
  ignora mesmo os filtros de severidade/status/OWASP?

### Estado real
Reporte: número de testes passando, cobertura por service, e se o
`npm run check` está verde. **Se estiver vermelho, conserte antes do CP1** —
você precisa de um baseline confiável para saber o que suas correções quebram.

---

## CHECKPOINT 1 — INFRA-002: destravar o pipeline

Este vem primeiro porque **todo critério de fechamento depende dele**.

1. Gere `package-lock.json` em `app/api` (e em `app/web`, se o workflow também
   usar `npm ci` lá). Rode `npm install` e **commite o lockfile** — não edite
   à mão (CLAUDE.md §0.2 S4).
2. Remova o lockfile do `.gitignore` (linhas 5 e 68, conforme a evidência).
   Lockfile em repositório é o comportamento correto para aplicação; a regra
   que o ignorava estava errada.
3. Rode o workflow completo a partir de checkout limpo. Se não puder acionar o
   GitHub Actions, reproduza os passos localmente na mesma ordem: `npm ci` →
   lint → build → migrate → test → coverage.
4. Confirme que os gates funcionam de verdade: quebre um teste de propósito,
   veja o pipeline falhar, conserte.

**Critério de fechamento:** instalação determinística e pipeline completo
executando com sucesso a partir de checkout limpo.

---

## CHECKPOINT 2 — SECURITY-001: mass assignment

O finding mais grave da auditoria. Em Project, `status`, `companyId` e
`applicationId` podem ser alterados por update direto, contornando
`/transition`, `requireRole` e o AuditLog inteiro.

### Correção

Em **todo** controller com `update`/`PATCH`, construa o DTO por **allowlist
explícita** — nunca cast do body inteiro:

```ts
// ❌ o que existe hoje
const body = req.body as UpdateProjectDTO;
await this.service.update(id, body, actor);

// ✅ allowlist: só o que é editável atravessa
const dto: UpdateProjectDTO = {};
if (typeof req.body.name === "string") dto.name = req.body.name;
if (typeof req.body.scope === "string") dto.scope = req.body.scope;
// status, companyId, applicationId NÃO entram — têm caminho próprio
```

Campos protegidos por entidade (confirme contra o schema real):

| Entidade | Nunca vem do body |
|---|---|
| Project | `status`, `companyId`, `applicationId`, timestamps |
| Application | `companyId`, timestamps |
| Vulnerability | `status`, `severity`, `companyId`, `projectId`, `applicationId`, `source` |
| Company | `id`, `planId` quando houver caminho próprio |
| User | `role`, `companyId`, `passwordHash` |
| Subscription | `status`, `activatedAt`, `companyId` |

**Defesa em profundidade:** o repository também não deve repassar objeto
arbitrário. Faça o `update` do Prisma receber campos nomeados, não spread cego.

### Testes
Para cada entidade, um teste que envia campo protegido no body e verifica que
ele **não** foi persistido. Em Project especificamente: `PATCH` com
`{ status: "COMPLETED" }` não muda o status e não gera AuditLog.

---

## CHECKPOINT 3 — Segredos e autorização

### SECURITY-002 — JWT com fallback previsível
`jwt.util.ts:27,49` tem default fixo, e o Compose publica a API com
`NODE_ENV=production`. Token ADMIN forjável se o Compose padrão for alcançável.

- Remova todo fallback de `JWT_SECRET` e `JWT_REFRESH_SECRET`. **Falhe fechado**:
  ausência de segredo derruba a aplicação no boot com erro claro. Use o
  `EnvVar.get()` que já lança quando falta variável.
- Compose: sem valores fixos de segredo. Documente no `.env.example` que precisa
  ser gerado (`openssl rand -hex 32`) e mencione no README.
- Revise o `NODE_ENV=production` e a publicação de porta no Compose de
  desenvolvimento. Se for compose de dev, não deve ser `production`.

### SECURITY-003 — role/companyRole não aplicados na Company
`requireRole` confia no papel assinado no token. Para operações sensíveis de
ADMIN, reconsulte o ator no banco antes de autorizar. Comece pelas rotas de
criação/edição de Plan citadas na evidência.

### AUTH-002 — e-mail sem normalização
Normalize para minúsculo **na escrita e na leitura**. Traduza o conflito de
e-mail duplicado para `USER_ALREADY_EXISTS` (409), não deixe vazar erro do Prisma.

> ⚠️ Este item vira crítico se vocês migrarem para PostgreSQL depois: o MySQL
> compara string sem diferenciar caixa por padrão, o Postgres diferencia. Sem
> normalização, o login quebra na migração.

### SECURITY-004 — rate limiting ausente
Aplique `express-rate-limit` nas rotas de autenticação (login, register,
refresh). Limite conservador, resposta `429 RATE_LIMITED`. Sem Redis — o store
em memória basta e Redis segue fora de escopo.

---

## CHECKPOINT 4 — Atomicidade: um problema, sete findings

`AUTH-001`, `BUSINESS-002`, `BUSINESS-004`, `BUSINESS-005`, `BUSINESS-007`,
`BUSINESS-008`, `MATURITY-002` têm a mesma raiz: **não existe `$transaction`
em lugar nenhum**. Toda regra do tipo "leia, verifique, escreva" tem janela de
corrida.

### Padrão a aplicar

Envolva em `prisma.$transaction` toda operação que:
- lê um estado, decide com base nele, e escreve (todos os gates)
- muta entidade **e** grava AuditLog (a trilha não pode divergir do estado)
- escreve em lote (scores de maturidade)

Para as invariantes de unicidade sob concorrência, transação isolada não basta —
duas transações podem ler o mesmo estado antes de qualquer escrita. Use
bloqueio de linha:

```ts
await prisma.$transaction(async (tx) => {
  // trava as linhas relevantes antes de decidir
  await tx.$queryRaw`SELECT id FROM subscriptions
                     WHERE company_id = ${companyId} AND status = 'ACTIVE'
                     FOR UPDATE`;
  // agora a verificação é confiável
  ...
});
```

> **Nota sobre o banco:** o MySQL não suporta índice único parcial, então a
> garantia de "uma Subscription ACTIVE por Company" no nível de banco depende de
> `SELECT ... FOR UPDATE`. No PostgreSQL isso seria um
> `CREATE UNIQUE INDEX ... WHERE status = 'ACTIVE'` — mais robusto e mais barato.
> Se a migração para Postgres for adiante (prompt da Fase 7 DAST), **este finding
> merece ser reforçado com o índice parcial na ocasião**. Registre isso.

### Por finding

- **AUTH-001** — o refresh precisa ser consumido de forma estritamente única.
  Revogue condicionalmente (`updateMany` com `where: { revokedAt: null }` e
  verifique `count === 1`) dentro da transação; se o count for zero, outro
  processo já consumiu → `401 INVALID_TOKEN`.
- **BUSINESS-002** — verificação de ACTIVE e aprovação na mesma transação com lock.
- **BUSINESS-004** — mutação e AuditLog na mesma transação. Falha do log reverte
  a mutação. **Atenção ao DELETE de Vulnerability**, que hoje é irreversível
  antes do log.
- **BUSINESS-005** — onboarding (Company + Subscription) atômico.
- **BUSINESS-007** — contagem de Applications e criação na mesma transação com lock.
- **BUSINESS-008** — unicidade e transição de Project na mesma transação.
- **MATURITY-002** — batch de scores atômico.

### Testes de concorrência

Este é o ponto onde a maioria das correções de atomicidade falha em ser provada.
Para cada invariante, dispare **N requisições simultâneas** com `Promise.all` e
verifique o resultado agregado:

- dois refresh com o mesmo token → no máximo um sucede
- duas aprovações concorrentes → no máximo uma Subscription ACTIVE no banco
- N criações de Application no limite do plano → nunca ultrapassa `maxApplications`

Rode cada um algumas vezes. Corrida que passa uma vez não está provada.

---

## CHECKPOINT 5 — Regras de negócio ausentes

### BUSINESS-001 — Plan inativo pode ser contratado
`isActive` não participa do gate em `company.service.ts:42,46` nem em
`subscription.service.ts:35,39`. Adicione a verificação **na solicitação e na
aprovação** — o plano pode ser desativado entre as duas.
Erro: `PLAN_NOT_AVAILABLE` (422).

### BUSINESS-003 — Project ignora Subscription e maxProjects
`ProjectService.create` consulta Application, ownership e conflito, mas não
consulta Subscription, Plan nem contagem de Projects. A Fase 4 implementou o gate
em Application e esqueceu em Project.

- Exija Subscription `ACTIVE` → `422 NO_ACTIVE_SUBSCRIPTION`
- Aplique `maxProjects` → `422 PROJECT_LIMIT_REACHED`
- Dentro da transação do CP4, com lock (é o mesmo padrão do BUSINESS-007)

> A auditoria ressalva que `maxProjects` "só integra o critério após ratificação
> da especificação". Implemente, mas **deixe o comportamento configurável e
> documente** — se a especificação divergir, é uma linha para ajustar.

---

## CHECKPOINT 6 — METRICS-001: o painel que mente

No painel da Fase 6.5, o cross-filter muda os KPIs e a distribuição OWASP, mas
o SQL cru de risk score, aging, MTTR, taxa de reabertura e séries temporais usa
apenas Application, período e estados fixos. `comparison` descarta as listas de
filtro por inteiro.

Resultado: clicar num setor do donut muda alguns números e não muda outros. É
visível ao vivo e é o tipo de coisa que a banca nota.

### Correção
Todo cálculo do painel precisa receber e aplicar **o mesmo conjunto de filtros**.
Na prática: construir um predicado de filtro único no service e injetá-lo em
todas as consultas, inclusive nas de SQL cru
(`metrics.repository.ts:82-89,147-190,234-274,310-353`).

Cuidado com SQL cru e parâmetros: use interpolação parametrizada do Prisma
(`Prisma.sql` / `$queryRaw` com placeholders), nunca concatenação de string —
seria injeção em uma plataforma de segurança.

### Testes
Para uma mesma combinação de filtros, o total de findings do KPI, a soma da
distribuição por severidade e a população usada em aging/MTTR precisam bater.
Depois, valide no navegador: aplicar cross-filter e conferir que **todos** os
números se movem de forma coerente.

---

## CHECKPOINT 7 — Frontend visível na demo

Três P2 que aparecem ao vivo:

- **FRONTEND-001** — a busca do analytics é decorativa (não filtra nada). Ou
  implemente, ou remova. Campo que não faz nada é pior que campo ausente.
- **FRONTEND-002** — clicar numa barra de aging aplica filtro com semântica
  errada. Corrija o mapeamento entre bucket de idade e o predicado aplicado.
- **FRONTEND-003** — erro de API é mascarado como carregando ou vazio. O usuário
  vê "nenhum dado" quando na verdade a chamada falhou. Estado de erro precisa ser
  distinto, com ação de recuperação.

Use o design system da Fase 6.5. Nada de Radix (ADR-023).

---

## CHECKPOINT 8 — TESTS-001: cobertura vira gate

A cobertura de 80% é documentada como requisito mas não é imposta.

- Configure o threshold no `jest.config.ts` (`coverageThreshold`), pelo menos
  para os services
- O pipeline falha se a cobertura cair abaixo
- Confirme que o gate funciona: baixe o threshold, veja passar; suba, veja falhar

Regressão completa: todos os testes anteriores continuam verdes.

---

## CHECKPOINT 9 — Validação em navegador

```bash
cd app/api && docker compose up -d && npm run dev   # :3001
cd app/web && npm run dev                            # :3000
```
Seed: `admin@vulnera.local`/`admin12345` ·
`owner@technova.demo`/`demo12345` · `pentester@vulnera.local`/`pentest12345`

Confira e capture:
1. `PATCH` em Project com `status` no body via console **não** muda o status
2. Cross-filter no painel: todos os números se movem coerentemente
3. Busca do analytics filtra de verdade (ou sumiu)
4. Clique em barra de aging aplica o filtro correto
5. API fora do ar → a tela mostra erro, não "vazio"
6. Login com e-mail em caixa diferente da cadastrada funciona
7. Rate limit dispara após N tentativas de login
8. Regressão: PDFs, dashboards e `report-data` continuam funcionando
9. Console limpo

---

## CHECKPOINT 10 — Documentação

### Rastreabilidade — o entregável mais importante desta fase

Crie `docs/FINDINGS_REMEDIATION.md` com uma linha por finding do
`CONSOLIDATED_FINDINGS.md`:

| ID | Severidade | Status | Correção | Teste que prova | Commit |
|---|---|---|---|---|---|
| SECURITY-001 | P1 | FECHADO | allowlist em 6 controllers | `mass-assignment.test.ts` | … |
| BACKEND-002 | P3 | ADIADO | — | — | limitação L-11 |

Todo finding do documento original precisa aparecer, inclusive os adiados. É essa
tabela que demonstra que a auditoria foi levada a sério, e é material direto de
defesa.

### ADRs em `docs/Vulnera/07-Decisoes/`
- **ADR-030 — Allowlist obrigatória em updates.** Vira regra permanente do
  `CLAUDE.md` §14 (anti-patterns).
- **ADR-031 — Transações em operações compostas.** O padrão do CP4 vira regra
  para todo CRUD futuro.
- **ADR-032 — Lockfile versionado.** Corrige a decisão que o ignorava.

### CLAUDE.md
Acrescente aos anti-patterns (§14): cast de `req.body` inteiro em update;
mutação sensível sem transação envolvendo o AuditLog.
Acrescente ao checklist de novo CRUD (§10): allowlist no controller; transação
quando houver gate ou AuditLog.

### Limitações conhecidas
Todo finding fora do escopo desta fase entra no README com ID, severidade e
motivo do adiamento.

### Docs vivos (§0.1)
`PRD_VIVO.md` · `docs/BACKLOG.md` · `docs/ROADMAP_PROMPTS.md` (Fase 6.8 com
badge e histórico) · `docs/DECISIONS.md` · Changelog do vault

---

## Restrições

- NÃO corrija findings fora do escopo declarado — anote (§0.2 S6)
- NÃO quebre as Fases 3–6.6. Regressão completa obrigatória.
- NÃO commite, NÃO abra PR
- Alteração de schema: diff primeiro, espere confirmação
- Nenhum finding fecha sem teste que falhe antes e passe depois
- Cabeçalho comentado em PT-BR em arquivo novo
- Zero `@radix-ui` no frontend

## Válvula de escape

Se o tempo apertar, a ordem de corte é: **CP7 (frontend) → CP8 (gate de
cobertura) → os P2 de autorização do CP3**. O que **não** se corta: CP1
(pipeline), CP2 (mass assignment), CP4 (atomicidade) e CP6 (métricas). São os
que aparecem na defesa.

## Relatório final

```
=== RELATÓRIO ===
CP0 — verificação amostral: <5 findings, CONFIRMADO ou REFUTADO com evidência>
Findings FECHADOS: <lista com ID e teste que prova>
Findings ADIADOS: <lista com ID e motivo>
Findings REFUTADOS pela verificação: <lista com evidência>
Testes: <antes → depois; novos por categoria>
Testes de concorrência: <quais invariantes, quantas execuções>
Cobertura: <por service, antes → depois; gate ativo?>
Pipeline: <roda a partir de checkout limpo? evidência>
Validação em navegador: <os 9 itens do CP9>
Regressão Fases 3–6.6: <ok / o que quebrou e como consertou>
Docs e ADRs: <lista>
⚠️ Atenção do Rafael: <decisões autônomas, ambiguidades, o que foi cortado>
Próximo: <Fase 8 — fechamento do TCC>
=================
```

Comece pelo Checkpoint 0.
