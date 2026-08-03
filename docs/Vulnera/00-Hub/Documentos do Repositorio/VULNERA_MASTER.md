# VULNERA — Documento Mestre de Consulta

> **Versão:** 4.0 · **Data:** 24/07/2026 · **Status:** vigente
> **Substitui:** todas as decisões anteriores conflitantes em `CLAUDE.md` v3, `ARCHITECTURE.md`, `SDD.md`, `DECISIONS.md` e no vault de notas.
>
> **Para o Claude Code:** este é o documento de maior autoridade do projeto. Em caso de conflito entre este arquivo e qualquer nota do vault, **este arquivo vence** — a nota é que está desatualizada e deve ser refatorada. A §15 lista exatamente o que mudou e precisa ser corrigido no vault.

---

## §1 · Propósito deste documento

Três funções, nesta ordem:

1. **Consulta** — responder "o que o Vulnera é hoje, onde está e aonde vai" sem precisar abrir cinco arquivos.
2. **Fonte de refatoração** — servir de base pro Claude Code reavaliar o vault de notas do Vulnera e alinhar tudo às decisões vigentes.
3. **Registro de decisão** — deixar explícito o que está travado, o que é ajustável e o que ainda precisa ser decidido (flags 🚩).

Este documento **não** contém prompts de execução nem detalhe de tarefa. Isso continua em `docs/ROADMAP_PROMPTS.md` e `docs/BACKLOG.md`.

---

## §2 · O que o Vulnera é

**Vulnera Security** — plataforma SaaS de gestão de análises de segurança, no modelo Tenable/Wiz simplificado.

Empresas clientes contratam um plano, cadastram aplicações, abrem projetos de análise (pentest/DAST/SAST). Pentesters registram vulnerabilidades com evidências e severidade CVSS. O sistema gera relatórios executivos e técnicos em PDF, além de uma avaliação de maturidade de segurança.

- **Contexto:** TCC do curso Técnico em Desenvolvimento de Sistemas (SENAI)
- **Cliente fictício da demo:** TechNova Solutions
- **Tagline:** "Achamos vulnerabilidades antes dos hackers."
- **Superfícies:** web (React), mobile (Expo), landing page estática, uma API REST

### Atores

| Ator | Role | Responsabilidade |
|---|---|---|
| Administrador Vulnera | `ADMIN` | Aprova assinaturas, gerencia planos, atribui pentesters, enxerga todas as empresas |
| Empresa cliente | `CLIENT` | Cadastra a company, contrata plano, cadastra aplicações, abre projetos, acompanha findings, baixa relatórios |
| Pentester | `PENTESTER` | Acessa apenas projetos onde é membro; registra vulnerabilities, evidences e comentários |

### Regra de ouro do sistema

**Isolamento multi-tenant absoluto.** Nenhuma empresa enxerga dado de outra, em nenhuma rota, em nenhuma circunstância. Toda query de listagem filtra por `companyId` antes de qualquer outro critério. Isso é validado por canários de teste (`TEN-01..06`) que rodam no CI.

---

## §3 · Estado atual do desenvolvimento

**Progresso: 3 de 9 fases concluídas (~33%).**

| Fase | Escopo | Status |
|---|---|---|
| 0 | Refactor de alinhamento arquitetural | ✅ Concluída |
| 1 | Fundação — infra, schema, CI, seed, UI base | ✅ Concluída |
| 2 | Auth + User — JWT, refresh rotativo, CRUD, frontend de autenticação | ✅ Concluída |
| **3** | **Plan + Company + Subscription** | **📋 Próxima** |
| 4 | Application + Project + ProjectMember | 📋 Pendente |
| 5 | Vulnerability + Evidence — núcleo do produto | 📋 Pendente |
| 6 | Relatórios (PDF) + Dashboards | 📋 Pendente |
| 7 | Mobile + Push + IA | 📋 Pendente |
| 8 | Maturidade + encerramento do TCC | 📋 Pendente |

### O que já existe e funciona

- Monorepo com `app/api`, `app/web` e placeholder de `app/mobile`
- Schema Prisma com 19 modelos, migrations aplicadas, seed executando
- Docker Compose operacional (MySQL + Mailhog)
- Pipeline GitHub Actions: lint → build → test
- Autenticação completa: registro, login, refresh rotativo, logout
- CRUD de usuários com autorização por role
- Frontend com Zustand persistido, interceptor Axios com fila de refresh, telas de login/registro/dashboard, componentes base
- Testes de integração verdes: `AUTH-01..09`, `USR-01..03`
- Branch `develop` estável e íntegra

### O que não existe ainda

Todo o núcleo de produto. Nenhuma empresa pode contratar plano, cadastrar aplicação, abrir projeto ou registrar vulnerabilidade. O sistema hoje autentica usuários e não faz mais nada — a Fase 3 é o primeiro passo em direção ao produto de fato.

---

## §4 · Objetivo final

O TCC está pronto quando existir uma **demo end-to-end de ~10 minutos** que percorra, sem improviso:

1. Landing page → catálogo de planos → registro → onboarding (empresa + escolha de plano)
2. Admin aprova a assinatura
3. Cliente cadastra aplicação e abre projeto de análise
4. Admin atribui pentester ao projeto
5. Pentester registra vulnerabilidade crítica com CVSS calculado e evidência anexada
6. Push chega no mobile no momento do registro crítico
7. IA sugere descrição/impacto/recomendação de um finding
8. Cliente baixa relatório executivo e técnico em PDF
9. Avaliação de maturidade preenchida, exibida em radar
10. Dashboards corretos nos três perfis

Somado a isso: código comentado em PT-BR (a banca lê o código), cobertura de testes ≥80% nos services, evidências de qualidade (SonarQube + OWASP ZAP baseline) e documentação de arquitetura consistente.

---

## §5 · Stack tecnológica (definitiva)

### Backend
| Item | Escolha |
|---|---|
| Linguagem | **TypeScript** (strict) |
| Framework | **Express** |
| ORM | **Prisma** |
| Banco | **MySQL 8** |
| Testes | Jest + Supertest (integração contra app real + banco de teste) |

### Frontend web
React + Vite + Tailwind + Radix + TanStack Query (server state) + Zustand (client state) + Axios + Recharts + **pdf-lib**.

### Mobile
Expo + React Native + Expo Router + expo-secure-store.

### IA
Gemini 1.5 Flash via `@google/generative-ai`. 🚩 **Ver flag F-02 na §11** — o provedor pode mudar.

---

## §6 · Arquitetura em camadas

### Cadeia de dependência (ordem canônica)

```
config
  ↓
database
  ↓
repositories
  ↓
models
  ↓
services
  ↓
controllers
  ↓
routes  ←→  middlewares (transversal, opcional por rota)
  ↓
server
```

### Regras invioláveis da arquitetura

1. **Cada camada conhece apenas a camada imediatamente abaixo.** Controller não chama repository. Service não toca em `req`/`res`.
2. **Somente `repositories/` importa `@prisma/client`.** Nenhuma outra camada acessa o Prisma diretamente. Trocar de ORM significa reescrever uma pasta, não o sistema.
3. **Service não conhece HTTP.** Lança erro como string-código (`throw new Error("PLAN_NOT_FOUND")`); o controller traduz para status HTTP e JSON.
4. **Nunca devolver o tipo bruto do Prisma.** Sempre serializar via entity/DTO — devolver o objeto cru vaza campos como `passwordHash`.
5. **`routes/routes.ts` é o único ponto de registro de rotas.** Toda rota nova é plugada ali.
6. **Rotas literais antes de paramétricas.** `/me`, `/current` e `/pending` sempre declaradas antes de `/:id`, senão o Express captura a literal como parâmetro.

### 🚩 Factory Method — decisão pendente

A cadeia de camadas acima **não inclui a camada de factory**, que existia como decisão D1/A1 e estava marcada como *não-negociável por ser padrão avaliado pelo professor*. Ver flag **F-01** na §11 antes de qualquer refatoração que remova ou mantenha factories.

---

## §7 · Convenções de código

### Nomenclatura de pastas — **plural quando há mais de um arquivo**

Esta regra **inverte a convenção anterior** (que exigia `service/` e `factory/` sempre no singular).

```
src/
├── config/          # EnvVar + enum/EnvKeys
├── database/        # cliente Prisma + scripts SQL
├── repositories/    # acesso a dados — única camada que toca Prisma
├── models/          # 1 arquivo por recurso (type + DTO + entity)
├── services/        # regras de negócio
├── controllers/     # entrada HTTP
├── routes/          # 1 arquivo por recurso + routes.ts central
├── middlewares/     # auth, require-role, error handler futuro
├── utils/           # jwt, hash, cvss, helpers
└── server.ts
```

Critério: se a pasta contém mais de um arquivo, o nome vai no plural. Pastas com arquivo único permanecem no singular.

### Nomenclatura de arquivos — kebab + role

| Item | Padrão | Exemplo |
|---|---|---|
| Arquivo | `kebab.role.ts` | `plan.repository.ts` |
| Classe | PascalCase | `PlanRepository` |
| Método | camelCase | `findById` |
| Rota REST | plural + kebab | `/api/project-members` |
| Constante de ambiente | SCREAMING_SNAKE | `JWT_SECRET` |
| Código de erro | SCREAMING_SNAKE | `PLAN_NOT_FOUND` |

### Códigos de erro

| Padrão | HTTP |
|---|---|
| `MISSING_<CAMPO>` / `INVALID_<CAMPO>` | 400 |
| `<ENTIDADE>_NOT_FOUND` | 404 |
| `<ENTIDADE>_ALREADY_EXISTS` | 409 |
| `<ENTIDADE>_LIMIT_REACHED` / `INVALID_STATUS_TRANSITION` | 422 |
| `UNAUTHORIZED` / `INVALID_TOKEN` | 401 |
| `FORBIDDEN` | 403 |
| `INTERNAL_ERROR` | 500 |

### Outras convenções

- Todo arquivo novo abre com cabeçalho comentado em PT-BR: o que faz, por que existe, quem consome
- Comentários explicam o **porquê**, nunca o **quê**
- Validação manual com `if` no controller (zod marcado como `[FUTURO]`)
- `try/catch` por método de controller (middleware global de erro marcado como `[FUTURO]`)

---

## §8 · Infraestrutura

### Docker Compose (ambiente local)

Contém apenas **MySQL 8 + Mailhog**.

O SonarQube **saiu do Docker Compose** e passou a ser executado como **pipeline separado no GitHub Actions**. Isso alivia o ambiente local e mantém a análise estática como gate de qualidade automatizado.

### Pipelines GitHub Actions

| Pipeline | Escopo |
|---|---|
| Principal | lint → build → test (com serviço MySQL) |
| SonarQube | pipeline independente, análise estática |

Merge na `main` bloqueado com CI vermelho.

### Autenticação (mantida como está)

- JWT HS256
- Access token: 15 minutos
- Refresh token: 7 dias, **rotativo** (o antigo é revogado a cada refresh)
- Refresh persistido apenas como hash SHA-256 — o token cru nunca toca o banco
- Senhas em bcrypt cost 12 (cost 4 em ambiente de teste)
- `authMiddleware` popula `req.user = { userId, role }`
- `requireRole(...)` cobre autorização por role; regras finas ficam no service

### Geração de PDF

**pdf-lib**, renderização **client-side**. A escolha por client-side é deliberada: mantém o servidor livre de carga de renderização e elimina dependência de serviço externo de render.

### Push notifications

**Expo Push API** direto, via HTTPS. Sem Firebase, sem configuração de projeto externo. Falha de push é silenciosa (registrada em log) e nunca quebra a operação que a disparou.

### E-mail transacional

**Fora do MVP.** O Mailhog permanece no compose para uso futuro, mas nenhum fluxo depende de e-mail. A trilha de auditoria (`AuditLog`) cobre as necessidades de rastreabilidade.

---

## §9 · Modelo de domínio

19 modelos Prisma, organizados em dois núcleos e um bloco de suporte.

### Núcleo de tenancy — quem paga

```
Plan ◄──── Company ◄──── User (ADMIN | CLIENT | PENTESTER)
             │
             └──► Subscription (PENDING → ACTIVE | REJECTED)
```

**Invariante:** exatamente **1 subscription ACTIVE por company**, validada tanto no momento da solicitação quanto no momento da aprovação (o estado pode mudar entre os dois).

### Núcleo de produto — o que é entregue

```
Company ──► Application ──► Project (1-1) ──► Vulnerability ──► Evidence
                                │                    │
                                └──► ProjectMember    └──► VulnerabilityComment
```

- `Project` é 1-para-1 com `Application` e herda `companyId` da aplicação — nunca do body da requisição
- `Vulnerability` carrega `companyId` desnormalizado, para isolamento barato sem join de três tabelas

### Suporte

| Modelo | Função |
|---|---|
| `AuditLog` | Append-only. Registra aprovações, override de severidade, mudanças de status, geração de relatório |
| `RefreshToken` | Hash SHA-256, rotação a cada refresh |
| `PasswordResetToken` | Reservado, não utilizado no MVP |
| `Notification` | Push e in-app (Fase 7) |
| `Report` | Metadados de PDFs gerados — quem gerou, quando, qual projeto |
| `MaturityDomain` / `Control` / `Assessment` / `Score` | Avaliação de maturidade (Fase 8) |

### Máquinas de estado

| Entidade | Transições permitidas |
|---|---|
| Subscription | `PENDING → ACTIVE` · `PENDING → REJECTED` |
| Project | `PENDING → IN_PROGRESS → IN_REVIEW → COMPLETED` (+ retorno `IN_REVIEW → IN_PROGRESS`) |
| Vulnerability | `OPEN → IN_PROGRESS → FIXED → CLOSED` |

Qualquer transição fora dessas retorna `INVALID_STATUS_TRANSITION`.

---

## §10 · Regras de negócio

### Planos

Três planos: **BASIC**, **PRO** e **Enterprise**, diferenciados por limite de aplicações e por incluir ou não remediação.

- Catálogo público (GET aberto), criação/edição/remoção restrita a `ADMIN`
- `maxApplications ≥ 1`, `maxProjects ≥ 1`, `price ≥ 0`, nome único

### Empresa

- CNPJ único; validação de formato apenas (14 dígitos ou máscara), sem dígito verificador
- Quem cria a company vira owner
- `CLIENT` acessa e edita somente a própria; `ADMIN` acessa todas

### Assinatura

- Nasce `PENDING`; apenas `ADMIN` aprova ou rejeita
- Invariante de 1 ACTIVE por company revalidada na aprovação
- Toda transição gera `AuditLog`

### Aplicação

- Criar exige subscription `ACTIVE` **e** contagem abaixo do `maxApplications` do plano
- Estouro de limite retorna `422 PLAN_LIMIT_REACHED`
- URL validada por regex

### Projeto

- Um projeto por aplicação (`APPLICATION_ALREADY_HAS_PROJECT`)
- `companyId` sempre herdado da aplicação
- `PENTESTER` enxerga apenas projetos onde é membro

### Membros de projeto

- Somente usuários com role `PENTESTER` podem ser adicionados
- Par `(projectId, userId)` único
- Gestão restrita a `ADMIN`

### Vulnerabilidade

- Severidade **calculada automaticamente** a partir do vector CVSS 3.1: `0.1–3.9 LOW` · `4.0–6.9 MEDIUM` · `7.0–8.9 HIGH` · `9.0–10 CRITICAL`
- Sobrescrever a severidade exige justificativa de **no mínimo 20 caracteres** e gera `AuditLog` com valores anterior e novo
- Campo `owaspCategory` (OWASP Top 10 2021) e flag `aiAssisted`
- **Instância individual** — a mesma falha em duas empresas são dois registros independentes, nunca uma CVE compartilhada

### Evidência

- Whitelist de MIME: `image/png`, `image/jpeg`, `application/pdf`, `text/plain`
- Validação por **magic number** nos bytes iniciais, não apenas pelo header declarado
- Limite de 10MB; nome do arquivo reescrito para UUID
- Servida por rota autenticada que valida o acesso do ator à company

### Relatórios

- Endpoint consolidado devolve projeto + agregados por severidade + lista de findings + top 5 riscos + maturidade (quando houver)
- Cada geração de PDF é registrada com autor, tipo e projeto
- Executivo: 3–5 páginas. Técnico: 20+ páginas

### IA

- Endpoint recebe título e stack, devolve descrição, impacto, recomendação, categoria OWASP e vector CVSS sugeridos
- Rate limit de **10 requisições por hora por usuário**; excedente retorna `429 RATE_LIMITED`
- Finding preenchido por IA fica marcado com `aiAssisted = true`

### Maturidade

🚩 **Ver flag F-03 na §11.** Estrutura provisória: domínios de segurança avaliados por controles, com score de 1 a 5 por controle, agregados por domínio e exibidos em radar.

**Exemplo ilustrativo de domínio** (não é a lista final): *Gestão de Vulnerabilidades* — controles como "existe processo formal de triagem", "há SLA definido por severidade", "remediação é verificada após correção", cada um pontuado de 1 (inexistente) a 5 (otimizado).

O conjunto definitivo de domínios e controles ainda será decidido.

---

## §11 · Decisões pendentes 🚩

Estas são as decisões **conscientemente adiadas**. O Claude Code não deve resolvê-las sozinho nem tratá-las como fechadas.

### F-01 · Factory Method permanece na arquitetura?

**Contexto:** o Factory Method era decisão D1/A1, marcada como não-negociável por ser padrão explicitamente avaliado pelo professor. A cadeia de camadas definida em §6 não o inclui.

**Impacto:** se o padrão for exigido na avaliação e tiver sido removido, o custo de reintroduzir cresce a cada fase implementada — cada recurso novo é mais uma stack para reescrever.

**Opções:** manter `factories/` como camada entre service e routes · remover e instanciar a stack diretamente no arquivo de rotas · manter apenas em recursos já implementados.

**Necessário para decidir:** confirmar com o professor/orientador se o padrão é critério de avaliação.

### F-02 · Provedor de IA

**Contexto:** Gemini 1.5 Flash está definido como padrão, mas a escolha permanece aberta.

**Impacto:** baixo se decidido antes da Fase 7. O código isola o provedor em um único util, então a troca fica contida.

**Necessário para decidir:** avaliar custo/free tier no momento da Fase 7 e qualidade de saída estruturada em JSON.

### F-03 · Domínios e controles de maturidade

**Contexto:** o modelo (domínios → controles → score 1–5 → radar) está definido; o **conteúdo** não. A referência de partida é SAMM simplificado.

**Impacto:** afeta seed, tela de avaliação e a seção de maturidade do relatório executivo. Bloqueia a Fase 8, não as anteriores.

**Necessário para decidir:** definir quantos domínios, quais, e quantos controles cada um terá.

---

## §12 · Processo e execução

### Equipe

Três colaboradores: **Rafael**, **Guilherme** e **Iann**. A delegação de responsabilidades no JIRA é mantida entre os três.

> **Nota de realidade operacional:** o kit de execução (`ROADMAP_PROMPTS.md`) foi escrito para operação solo-delegada, com Rafael supervisionando e o Claude Code executando. Os prompts continuam válidos e não dependem de divisão por pessoa — a atribuição no JIRA e a execução real podem coexistir. Se as entregas voltarem a ser distribuídas de fato entre os três, os prompts de fase precisam ser fatiados por responsável.

### JIRA

- Board `KAN` em `rafaelscrum.atlassian.net`
- `cloudId`: `f050033a-30db-40e6-ba4c-ffb67c9c6e2f`
- Epics `KAN-8` a `KAN-17`; tasks `KAN-56` a `KAN-109`, com labels `sprint-N`
- Movimentação para *Done* feita manualmente ao fim de cada fase (o agente lista as KANs no relatório de encerramento)

### Branches e PRs

- `main` (protegida) ← `develop` (integração) ← `feat/fase-N-<nome>`
- **1 branch e 1 PR por fase.** A convenção anterior de uma branch por sprint por pessoa foi substituída.
- PR só entra com CI verde

### Testes

Toda PR de CRUD inclui teste de integração cobrindo:

1. Happy path (POST cria, GET busca, PATCH atualiza, DELETE remove)
2. Erros de validação do controller
3. No mínimo uma regra de negócio do service

Somado a isso: canários de tenancy (`TEN-xx`) em toda fase que toque recurso de cliente, e cobertura ≥80% nos services da fase.

Ordem de limpeza no `cleanDatabase()` (respeitando FKs):
`auditLog → evidence → vulnerabilityComment → vulnerability → projectMember → project → application → subscription → company → refreshToken → user`

### Documentos vivos

Mantidos deliberadamente para consumo por agentes. O Claude Code atualiza cada um a cada tarefa concluída:

| Arquivo | Papel |
|---|---|
| `VULNERA_MASTER.md` | **Este arquivo.** Fonte de maior autoridade sobre decisões |
| `CLAUDE.md` | Regras eternas de código; alterado apenas com aviso ao humano |
| `PRD_VIVO.md` | Estado atual — o que está feito, em progresso e pendente |
| `docs/BACKLOG.md` | Futuro planejado, task a task |
| `docs/ROADMAP_PROMPTS.md` | Prompts de execução por fase + histórico |
| `docs/DECISIONS.md` | Registro de decisões arquiteturais novas |

**Princípio:** documentação desatualizada é bug. O código é a verdade; o documento se ajusta a ele — nunca o contrário.

---

## §13 · Roadmap

| Fase | Entrega | Depende de |
|---|---|---|
| 3 | Plan, Company e Subscription full stack + `requireRole` + AuditLog | — |
| 4 | Application (com gate de plano), Project (máquina de estados), ProjectMember | 3 |
| 5 | CVSS util, Vulnerability, Evidence, Comment — o núcleo do produto | 4 |
| 6 | Endpoint consolidado de relatório, PDFs executivo e técnico, dashboards por perfil | 5 |
| 7 | App mobile, push em finding crítico, sugestão de finding por IA | 5 |
| 8 | Maturidade, seed de demo, evidências Sonar/ZAP, documentação final, tag `v1.0.0` | 6 |

Fase 7 pode correr em paralelo com a 6 — depende apenas de 4 e 5.

---

## §14 · Fora de escopo do MVP

Não implementar, mesmo que pareça barato:

- Chat em tempo real (Socket.IO)
- E-mail transacional e reset de senha
- Pagamento real
- Redis, filas, workers
- i18n e alternância de tema claro/escuro
- Deploy em produção
- Validação com zod (marcada `[FUTURO]`)
- Middleware global de erro (marcado `[FUTURO]`)

Item novo descoberto durante uma fase entra como "trabalho futuro" na documentação, não no código.

---

## §15 · Changelog desta revisão — o que refatorar no vault

Esta seção existe para orientar a refatoração do vault de notas. Cada linha indica uma decisão que **mudou** e que provavelmente aparece desatualizada nas notas existentes.

| # | O que mudou | De | Para |
|---|---|---|---|
| C1 | **Nomenclatura de pastas** | `service/`, `factory/`, `middleware/` sempre singular | **Plural quando a pasta tem mais de um arquivo**: `services/`, `repositories/`, `models/`, `controllers/`, `middlewares/` |
| C2 | **Cadeia de camadas** | Controller → Service → Repository → Prisma, com factory obrigatória | `config → database → repositories → models → services → controllers → routes (↔ middlewares) → server` · factory pendente de decisão (F-01) |
| C3 | **Biblioteca de PDF** | `@react-pdf/renderer` | **`pdf-lib`**, mantendo renderização client-side |
| C4 | **SonarQube** | Serviço dentro do `docker-compose.yml` | **Pipeline separado no GitHub Actions**; compose fica só com MySQL + Mailhog |
| C5 | **Nomes dos planos** | `BASIC` / `PRO` / `PRO_PLUS` | **`BASIC` / `PRO` / `Enterprise`** |
| C6 | **Domínios de maturidade** | 7 domínios fixos × ~3 controles, listados nominalmente | **Estrutura mantida, conteúdo em aberto** (flag F-03) — usar exemplo ilustrativo, não lista definitiva |
| C7 | **Provedor de IA** | Gemini 1.5 Flash como decisão fechada | **Gemini como padrão, com flag de revisão** (F-02) |
| C8 | **Equipe** | Execução solo-delegada substituindo a divisão por pessoa | **Três colaboradores mantidos** (Rafael, Guilherme, Iann) para delegação no JIRA |
| C9 | **Factory Method** | Decisão D1/A1, não-negociável | **Pendente de confirmação** (flag F-01) — não remover nem manter sem decisão |

### Instruções de refatoração

1. **Varrer o vault procurando referências às formas antigas** listadas na coluna "De". Cada ocorrência é candidata a correção.
2. **Não apagar histórico.** Decisões substituídas viram registro com marcação de "substituída em 24/07/2026", preservando o racional original — o histórico é material de defesa na banca.
3. **Não resolver as flags 🚩 sozinho.** Notas que dependem de F-01, F-02 ou F-03 recebem marcação de pendência, não uma resposta inventada.
4. **Conflito entre notas resolve-se por este documento.** Se duas notas discordam e nenhuma bate com o que está aqui, ambas estão erradas.
5. **Ao terminar, produzir um relatório** com: notas alteradas, notas criadas, contradições encontradas que este documento não resolve, e pendências que exigem decisão humana.

---

*Documento vivo. Toda decisão nova entra aqui antes de virar código.*
