# DECISIONS.md — Decisões a ratificar com o time

> Use este documento como pauta de uma call de 30 minutos com Guilherme e Iann.
> Cada decisão tem **contexto**, **opção escolhida** e **alternativa rejeitada** — pra eles entenderem o "porquê" antes de só cumprir.

---

## D1 — Padrão arquitetural: 5 camadas + Factory Method

**Decisão:** Controller → Service → Repository → Prisma, com Factory Method por recurso.

**Por quê:**

- Factory Method é padrão **avaliado pelo professor** (não negociável)
- 5 camadas facilita teste (mockar 1 camada por vez)
- Separação clara permite trocar Prisma sem mexer no Service

**Alternativa descartada:** Express puro com função handler por rota.

- Seria 30% menos código, mas perde a nota do padrão acadêmico.

---

## D2 — Estrutura de pastas fixa

**Decisão:**

```
src/
├── config/ (com EnvVar e enum/EnvKeys)
├── controller/
├── database/ (prisma client + scripts SQL futuros)
├── factory/
├── middleware/ (singular)
├── model/ (1 arquivo por recurso)
├── repository/
├── routes/ (com routes.ts central)
├── service/ (SINGULAR, não plural)
└── utils/
```

**Por quê:**

- `service/` singular pra alinhar com `controller/`, `repository/`, `middleware/`
- `database/` separada de `config/` porque vai crescer (scripts SQL, snapshots, docs de modelagem)
- `factory/` nova — não existia no código, agora obrigatória

**Itens divergentes do código atual que vão ser corrigidos:** ver `REFACTOR_PLAN.md`.

---

## D3 — Nomenclatura: kebab + role

**Decisão:** Arquivos no padrão `<recurso>.<role>.ts`.

- ✅ `plan.controller.ts`, `plan.service.ts`, `plan.repository.ts`
- ❌ `PlanController.ts`, `PlanService.ts`

**Por quê:**

- O código atual já usa esse padrão (`user.controller.ts`)
- Mais legível em IDE com fuzzy search ("plan.r" encontra repository)
- Padroniza com convenção popular do Node/Express

**Para as CLASSES dentro dos arquivos:** PascalCase normal (`class PlanController`).

---

## D4 — 1 arquivo por model

**Decisão:** `plan.model.ts` contém **type + DTOs + entity** juntos.

**Por quê:**

- Pra TCC com prazo de 4 meses, 3 arquivos por model vira ritual sem ganho
- Quando um model passar de ~200 linhas, quebra em 3

**Alternativa descartada:** `plan.type.ts` + `plan.dto.ts` + `plan.entity.ts`.

- Padrão mais clássico mas inflama o repo prematuramente.

---

## D5 — Validação manual com `if` (por enquanto)

**Decisão:** validação inline no Controller com `if (!body.name)`.

**Por quê:**

- Time aprendendo. `zod` adiciona conceito novo (schema declarativo) que distrai do padrão de camadas
- Cada validação manual é literal e óbvia

**Alternativa adiada:** migrar pra `zod` depois do MVP.

- Marcado com `🚧 [FUTURO]` no CLAUDE.md.

---

## D6 — try/catch em cada método do controller

**Decisão:** repetir `try/catch` em cada método.

**Por quê:**

- Explícito = didático
- Cada erro é tratado onde a regra dele faz sentido (no controller)

**Alternativa adiada:** middleware global de erro + classe `AppError`.

- Refatorar quando todos os CRUDs estiverem prontos.

---

## D7 — Códigos de erro em SCREAMING_SNAKE_CASE

**Decisão:** Service lança `throw new Error("PLAN_NOT_FOUND")`, Controller traduz pra HTTP + JSON `{ error: "PLAN_NOT_FOUND" }`.

**Padrões fixos:**

- `MISSING_<FIELD>`, `INVALID_<FIELD>`
- `<ENTITY>_NOT_FOUND`, `<ENTITY>_ALREADY_EXISTS`
- `UNAUTHORIZED`, `INVALID_TOKEN`, `FORBIDDEN`
- `INTERNAL_ERROR`

**Por quê:**

- Sem texto humano no Service permite trocar idioma sem mexer em regra
- Frontend pode renderizar mensagem amigável a partir do código

---

## D8 — JWT desde o início

**Decisão:** Auth completa (register, login, refresh, logout, reset) implementada na Sprint 2.

**Por quê:**

- Toda rota de CRUD precisa de `authMiddleware`. Adiar Auth quebra o fluxo de teste.
- O Guilherme conhece JWT bem → naturalmente owner desta sprint.

**Detalhes:**

- Access token: 15 minutos
- Refresh token: 7 dias, armazenado hasheado (SHA-256) no banco
- Bcrypt cost 12 pra senha

---

## D9 — MySQL via Docker Compose

**Decisão:** MySQL 8 em container local. Sem produção, sem Nginx, sem Postgres.

**`docker-compose.yml`** (a criar) deve ter apenas:

- `db` (MySQL 8)
- `mailhog` (SMTP fake pra testar e-mails)
- `sonarqube` (opcional, pra avaliação)

**Por quê:**

- Mínimo viável. Prometheus/Grafana já foram descartados.
- Trocar pra Postgres no futuro = mudar 1 linha no `schema.prisma`.

---

## D10 — Testes de integração obrigatórios

**Decisão:** Toda PR de CRUD inclui `tests/integration/<recurso>.test.ts` com:

- Happy path (POST cria, GET busca, PUT atualiza, DELETE remove)
- 1-2 cenários de erro do controller (validação)
- 1 cenário de regra de negócio do service

**Comando:** `npm run test` deve passar antes de mergear.

**Por quê:**

- "Quero rodar `npm test` e ele garantir que não quebrei nada" — requisito explícito do Rafael.
- Testes unitários por camada são over-engineering nesta fase.

---

## D11 — Vulnerabilidades como instância individual (Tenable/Wiz-like)

**Decisão:** Cada `Vulnerability` é registro único, ligado a UM Project / Application / Company.

**Não há "biblioteca compartilhada de CVEs".** Se TechNova e Acme têm a mesma SQL Injection, são 2 registros independentes.

**Isolamento garantido por:**

- FK `projectId`, `applicationId`, `companyId` em cada Vulnerability
- Toda query de listagem filtra por `companyId` primeiro
- Canários TEN-XX validam que cliente A nunca vê dado de B

---

## D12 — Sprints de 2 semanas

**Decisão:** 8 sprints de 2 semanas = 16 semanas (4 meses).

**Capacidade:**

- Rafael: 4h/dia × 10 dias úteis = 40h/sprint
- Guilherme: ~2h/dia (entre trabalho) = ~20h/sprint
- Iann: ~2h/dia (entre trabalho) = ~20h/sprint
- **Total: ~80h por sprint**

**Sprints (resumo, detalhe no `BACKLOG.md`):**

1. Fundação (infra, schema, server base)
2. Auth + User
3. Company + Plan + Subscription
4. Application + Project + ProjectMember
5. Vulnerability + Evidence (núcleo)
6. Relatórios + Dashboards
7. Mobile + IA Gemini
8. Maturidade + Polimento + Apresentação

---

## D13 — Divisão por integrante

**Rafael (Tech Lead):**

- Toda decisão arquitetural
- Infra (Docker, CI, Sonar)
- Code review obrigatório em PRs
- Schema Prisma e migrations
- Recursos críticos (Project, Vulnerability)

**Guilherme (Backend secundário):**

- Auth completa (sprint 2)
- User CRUD
- Subscription com aprovação (envolve regra fiscal)
- JWT refresh + rotation

**Iann (Frontend):**

- **Pode começar AGORA**, em paralelo com a API
- Setup do React+Vite em `app/web`
- Componentização base com Tailwind + Radix
- Landing page (já temos prompt pronto)
- Páginas mockadas (login, register, dashboard) com dados fake
- Quando API estiver pronta, troca mock por endpoint real

---

## D14 — PRD vivo como gestão à vista

**Decisão:** `PRD_VIVO.md` na raiz do repo.

- Claude Code **lê** no início de cada sessão pra saber o que falta
- Claude Code **atualiza** marcando ✅ quando termina uma task
- Você consulta pra gestão (sem precisar abrir o JIRA toda hora)

**Estrutura:** tabela por sprint, com checklist de tasks dentro de cada feature.

---

## D15 — JIRA: project KAN, type Task, sprints como labels

**Decisão:**

- Project key: `KAN`
- Issue type: `Task` (sem Epic/Story complexo)
- Sprint: campo nativo do JIRA
- Estimativa: em **horas** (não story points)
- Sprints duram 2 semanas; podem encurtar conforme prazo

**O backlog completo está em `BACKLOG.md`** — copia/cola pra criar issues no JIRA.

---

## D16 — Endurecimento da Fase 5: decisões tomadas (2026-08-07)

Decisões da sessão de hardening (branch `fix/fase-5-hardening`) que mudam
comportamento ou fixam um trade-off. Detalhamento em
`docs/ROADMAP_PROMPTS.md` §Fase 5 → Sessão de endurecimento.

**D16.1 — Acesso negado continua respondendo 403, não 404.**
Considerou-se trocar para 404 em cross-tenant ("não revele existência"). Mantido
403 porque: o `CLAUDE.md` §9 define `FORBIDDEN`→403 como padrão do projeto; as
Fases 3/4 já usam 403 nos canários TEN-01..06; e os IDs são `cuid()`, não
enumeráveis — o ganho do 404 é marginal frente à inconsistência de contrato.
Registrado como limitação consciente **L-04** em `docs/BACKLOG.md`.
*Alternativa descartada:* 404 só em Evidence (criaria incoerência com
Vulnerability e Comment).

**D16.2 — Assinatura de arquivo só no offset 0.**
Um PDF com lixo antes do `%PDF` (que a spec do PDF tolera) é **recusado**. O
falso-negativo é preferido de propósito: aceitar assinatura em offset arbitrário
é justamente o que facilita polyglot. Limitação **L-03**.

**D16.3 — Polyglot é aceito, com mitigações.**
Bloquear exigiria parse completo de cada formato. Mitigado por nome UUID,
extensão do tipo **detectado**, `attachment` + `nosniff`, e nenhum caminho de
código que interprete o conteúdo no servidor. Limitação **L-02**, coberta por
teste que documenta o comportamento.

**D16.4 — Novo evento de auditoria `SEVERITY_OVERRIDE_RESET`.**
Trocar o vetor CVSS descarta o override manual (D da Fase 5, mantida), mas o
descarte passou a ter evento próprio, com a justificativa que deixou de valer.
Sem ele, a trilha do PDF Técnico mostrava um override sumindo sem explicação.
*Impacto:* `diffJson` do `SEVERITY_CHANGE` também mudou (ganhou vetor e score
de origem/destino) — o teste da Fase 5 que fixava o formato foi atualizado.

**D16.5 — Limites de tamanho de texto são regra de produto, não só de banco.**
`FIELD_LIMITS` no model. Título limitado a 180 por causa do `VARCHAR(191)` (era
500); descrição/impacto/recomendação a 5000 **mesmo cabendo 64KB no `TEXT`**,
porque 50 mil caracteres geram um PDF Técnico inutilizável. Justificativa de
override ganhou teto de 1000 (`JUSTIFICATION_TOO_LONG`).

**D16.6 — Aviso de caractere não-renderizável é não-bloqueante.**
O `FindingEditorPage` avisa quais caracteres virarão `?` no PDF, mas **salva
assim mesmo**. O dado no banco é UTF-8 e está correto; impedir o registro de um
finding legítimo por causa de um emoji seria pior que o `?` no relatório.

**D16.7 — Máquina de Vulnerability tem 4 estados, definitivamente.**
Ver [[ADR-021 - Maquina de Vulnerability com 4 estados]].

**D16.8 — Silenciar o dotenv no código, não em variável de ambiente.**
`quiet: true` em `tests/setup.ts` e `EnvVar.ts`. `.env*` está no `.gitignore`, então
`DOTENV_CONFIG_QUIET` no `.env` não sobreviveria a um clone.

---

## Pauta sugerida pra call com o time (30 min)

1. **5 min** — Rafael apresenta decisões D1, D2, D3 (estrutura e nomenclatura)
2. **5 min** — Iann valida divisão dele e topa começar landing + componentes
3. **5 min** — Guilherme valida Auth (sprint 2) como responsabilidade dele
4. **10 min** — Discutir D11 (vulnerabilidades como instância) — conceito crítico do produto
5. **5 min** — Combinar ritual de check-in semanal e uso do PRD_VIVO

---

_Toda decisão vira regra escrita no CLAUDE.md. Toda exceção vira nova decisão neste arquivo._

---

## Fase 6.5 — Design System + Dashboards analíticos (2026-08-09)

Quatro decisões arquiteturais, todas com ADR próprio em
`docs/Vulnera/07-Decisoes/`.

### ADR-022 — Stack completa no Docker Compose

**Contexto:** o compose da raiz foi ampliado na sessão de 2026-08-07 (commit
`c131aef`, "unificando docker — não finalizado") sem ADR, e o número 021 que ele
referenciava foi ocupado por outra decisão no mesmo dia.

**Decisão:** o `docker-compose.yml` da raiz é o único e descreve a stack inteira,
com dois modos suportados — `up -d db mailhog` + `npm run dev` (dia a dia) e
`up --build` (demonstração). **Não existe compose em `app/api`**; prompt que
mandar `cd app/api && docker compose` está desatualizado.

**Alternativa descartada:** manter só banco e Mailhog. A defesa se beneficia de
"o projeto sobe num comando", e o modo de desenvolvimento não foi removido.

### ADR-023 — Biblioteca de componentes própria em vez de Radix

**Contexto:** a auditoria mediu 11 componentes somando 257 linhas (23 cada) e
apenas 3 importações de Radix — das quais só o Dialog entregava acessibilidade
real. `@radix-ui/react-select` estava instalado e nunca foi importado.

**Decisão:** remover o Radix por completo e possuir ~30 componentes, cada um com
contrato de acessibilidade escrito em PT-BR e provado por teste.

**Custo assumido explicitamente:** focus trap, `inert`, navegação por setas,
typeahead e retorno de foco passam a ser responsabilidade do projeto — e quebram
silenciosamente. Mitigado por contrato escrito, maquinaria centralizada em
`_internal/` (não reexportada) e 14 testes que verificam item por item.

**Alternativa descartada:** manter o Radix e adicionar mais 8-10 pacotes.

### ADR-024 — Sistema de temas com tokens OKLCH

**Esta decisão REVERTE um corte de escopo.** "Alternância de tema" estava em
`Fora do Escopo` e no ADR-014.

**Por que reverter:** o corte foi feito quando "tema" significava uma
funcionalidade a mais. Um sistema de tokens semânticos bem-feito **já é** um
sistema de temas, e a camada de indireção precisa existir de qualquer forma para
o mobile da Fase 7 consumir.

**Decisão:** OKLCH (o L é perceptual — é onde HSL mais mente numa rampa que
atravessa vermelho, amarelo e azul), primitivo separado de semântico e imposto
por build, violeta como cor de ação (o único matiz a mais de 30 graus de todas as
cores que já têm significado), três temas sem flash, e contraste medido por uma
ferramenta que falha o build.

**Alternativa descartada:** extrair tokens e manter um tema só. Foi ao calibrar o
tema claro que quatro reprovações de contraste apareceram — num tema só,
continuariam invisíveis.

### ADR-025 — Métricas analíticas derivadas do AuditLog

**Contexto:** zero agregação no backend (duas chamadas a `.count()` no projeto
inteiro) e nenhuma série temporal. O schema não tem tabela de snapshot.

**Decisão:** reconstruir o histórico de `Vulnerability.createdAt` mais
`AuditLog.diffJson` (que registra `{from, to}`), **sem migration**. Agregação
100% no banco. Risk score `soma de (cvss ao quadrado / 10)` — soma porque risco
acumula, quadrática porque um 9,8 não vale três 3,2. MTTR por **mediana**, porque
a média é destruída por um outlier (que aparece no aging, a métrica feita para
encontrá-lo). Agregação por período em UTC.

**Alternativa descartada:** tabela `VulnerabilitySnapshot` com job diário.
Exigiria migration e scheduler (que não existe), começaria o histórico do zero, e
o custo medido da reconstrução foi de 9 a 17 ms.

## Módulo DAST (OWASP ZAP) — 2026-09-05

Três decisões arquiteturais, todas com ADR próprio em
`docs/Vulnera/07-Decisoes/`. Módulo novo, fora da numeração de fases do
BACKLOG v4 — entrada posterior.

### ADR-028 — Execução do ZAP via Docker spawn

**Contexto:** o scan precisa rodar o OWASP ZAP contra uma URL arbitrária, sem
fila (Redis fora de escopo) e sem exigir instalação manual além do Docker que
o projeto já usa.

**Decisão:** um container novo por scan (`docker run --rm --name
vulnera-zap-<scanId>`), nunca um daemon persistente — isolamento de estado
entre scans de tenants diferentes e cancelamento trivial (`docker rm -f`
determinístico pelo nome).

**Risco assumido, não eliminado:** a API precisa de acesso ao socket Docker
do host — comprometer o processo da API compromete o host. Mitigado por
ausência de flags privilegiadas, volume restrito ao diretório do scan, e
validação de alvo antes de qualquer `docker run`; não resolvido por completo
(rodar a API sem acesso direto ao socket exigiria um sidecar dedicado, fora
do escopo desta entrega).

**Alternativa descartada:** daemon ZAP persistente com API de sessões —
vazaria estado entre scans de tenants diferentes.

### ADR-029 — DAST como silo (não importa para Vulnerability)

**Contexto:** o Vulnera já tem `Vulnerability` maduro (CVSS calculado,
override, auditoria). Fazia sentido os achados do ZAP virarem `Vulnerability`
direto?

**Decisão:** não, nesta entrega. Dois models novos (`DastScan`/
`DastFinding`), sem FK pra `Vulnerability`/`Project`/`Application`/`Company`.

**Por quê:** o ZAP não fornece vetor CVSS (só `riskcode` 0-3) — inventar um
vetor a partir disso contaminaria o cálculo automático que hoje é 100%
confiável (validado contra os vetores oficiais do FIRST). `Vulnerability`
também exige `Project` desde a criação, o que quebraria o fluxo de "um campo
e um botão" do DAST.

**Caminho de integração futura registrado no ADR:** CVSS estimado e marcado
como tal, ou triagem manual antes da promoção; escolha de Project/Application
no momento da promoção; campo de proveniência (`sourceType`).

**Alternativa descartada:** importar automaticamente com CVSS estimado por
faixa de risco — um score "inventado" convincente demais é pior que a
ausência dele, porque o resto do produto trata `cvssScore` como calculado
com confiança.

### ADR-030 — Execução assíncrona sem fila

**Contexto:** um scan leva minutos; a resposta de `POST /dast/scans` não pode
esperar. Sem Redis/BullMQ (fora de escopo), como garantir execução em
background confiável?

**Decisão:** fire-and-forget dentro do próprio processo Node (`create()` não
dá `await` em `runInBackground`), estado inteiro no banco, e um watchdog no
boot que marca `FAILED` qualquer scan `QUEUED`/`RUNNING` encontrado — por
definição, órfão de um processo anterior que morreu no meio.

**O que isso NÃO dá, ao contrário de uma fila de verdade:** sobrevivência de
scans em andamento a um restart da API, e distribuição entre múltiplos
processos/máquinas. Aceito conscientemente pelo volume real do produto (um
punhado de scans concorrentes, não milhares/hora).

**Alternativa descartada:** Redis + BullMQ — desproporcional ao volume e
fora do escopo explícito da entrega; o contrato de `DastScanService` já é
compatível com trocar por uma fila depois, se o produto crescer.
