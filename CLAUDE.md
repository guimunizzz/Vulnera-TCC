# CLAUDE.md — Guia Operacional do Projeto Vulnera

> **Contrato operacional para agentes de código trabalhando no Vulnera TCC.** Este arquivo existe principalmente para sessões novas de Codex/Claude sem memória das sessões anteriores.  
> **Princípio central:** não assuma comportamento, não invente requisito, não simule conclusão. Investigue o estado atual, faça perguntas quando houver ambiguidade material, implemente a menor solução correta, valide com evidências, revise o diff e só então atualize a documentação e declare conclusão.

---

## 0. Como usar este documento

- **Agente de código** → leia primeiro as seções `0`, `1`, `2`, `3` e `4`; depois consulte as seções específicas da tarefa.
- **Humano** → este documento define as regras permanentes de operação dos agentes. Mudanças nele precisam de autorização explícita.
- Convenções: 🎯 regra/invariante · ✅ faça · ❌ anti-pattern · ⚠️ armadilha · 💡 racional · 🚧 trabalho futuro/documentado.

🎯 **R0 — Não assuma.** Quando uma decisão puder alterar comportamento, arquitetura, UX, banco, segurança, tenancy, regra de negócio, contrato ou escopo, investigue primeiro. Se o repositório não resolver a ambiguidade, faça entre **3 e 10 perguntas agrupadas** antes de implementar essa parte.

🎯 **R1 — Código é evidência do estado atual, não garantia de intenção correta.** Quando código e documentação divergirem, descubra o comportamento real antes de decidir. Documentação pode estar atrasada; código também pode conter bug. Divergências relevantes devem ser investigadas, não reconciliadas silenciosamente.

🎯 **R2 — Sem implementação fictícia.** Mock, stub, fake data, placeholder, hardcode temporário ou TODO não podem substituir funcionalidade real e depois serem apresentados como feature concluída. Mocks continuam válidos quando deliberadamente utilizados em testes.

🎯 **R3 — Conclusão exige prova.** `build passou`, `TypeScript compilou` ou `teste unitário passou` não significam automaticamente que a feature funciona. Diferencie sempre **codificado**, **validado parcialmente** e **implementado + validado**.

🎯 **R4 — Autonomia operacional não significa autonomia de produto.** O ambiente pode estar em YOLO / `dangerously-skip-permissions`; use essa autonomia para investigar, editar, instalar dependências necessárias, executar Docker, testes, builds, migrations de desenvolvimento e ferramentas de segurança. Não use essa autonomia para inventar requisitos ou escolher silenciosamente entre interpretações materiais.

---

## 0.1 Onde está cada coisa

A sessão normalmente abre na raiz do repositório. Descubra a estrutura atual antes de assumir que caminhos antigos continuam válidos.

| Assunto                          | Onde procurar primeiro                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Regras operacionais do agente    | `CLAUDE.md`                                                                                         |
| Armadilhas recorrentes           | `GOTCHA.md`                                                                                         |
| Arquitetura atual                | `docs/architecture.md` + código                                                                     |
| Backlog                          | `docs/BACKLOG.md`                                                                                   |
| Decisões resumidas               | `docs/DECISIONS.md`                                                                                 |
| Roadmap/prompts                  | `docs/ROADMAP_PROMPTS.md`                                                                           |
| Frontend                         | `docs/FRONTEND_WEB.md`, `docs/DESIGN_SYSTEM.md`, `docs/DASHBOARD_VISUAL.md`                         |
| DAST                             | `docs/DAST.md`, `docs/DAST-DOCKER-GAP.md`, diagnósticos/validações e `docs/evidencias/dast/`        |
| Exposure / remediation           | `docs/EXPOSURE_REMEDIATION.md`, `docs/EXPOSURE_REMEDIATION_ACCEPTANCE.md`, `docs/FINDINGS_QUERY.md` |
| Rate limiting                    | `docs/RATE_LIMITING.md`                                                                             |
| Vault histórico / domínio        | `docs/Vulnera/`                                                                                     |
| Regras de negócio                | `docs/Vulnera/02-Dominio/Regras de Negocio/`                                                        |
| Entidades / estados / permissões | `docs/Vulnera/02-Dominio/`                                                                          |
| Produto / jornadas / fluxos      | `docs/Vulnera/03-Produto/`                                                                          |
| Arquitetura detalhada            | `docs/Vulnera/04-Arquitetura/`                                                                      |
| Segurança / DevSecOps            | `docs/Vulnera/05-Infra-DevSecOps/`                                                                  |
| Dados / enums / relacionamentos  | `docs/Vulnera/06-Dados/`                                                                            |
| ADRs                             | `docs/Vulnera/07-Decisoes/`                                                                         |
| Runbooks / histórico / riscos    | `docs/Vulnera/08-Operacao/`                                                                         |
| Material acadêmico               | `docs/Vulnera/09-TCC/`                                                                              |
| Backend                          | descubra em `app/api/`                                                                              |
| Frontend                         | descubra em `app/web/`                                                                              |
| Mobile                           | descubra em `app/mobile/`                                                                           |

⚠️ **O Vault pode estar desatualizado.** Use-o para entender domínio, histórico, regras e decisões, mas confirme tudo que afete implementação contra o código, schema, testes e documentação técnica atual.

⚠️ **`repomix-output.*` é snapshot/dump, não fonte canônica.** Pode acelerar buscas quando fornecido, mas nunca deve vencer o repositório atual disponível.

---

## 0.2 Hierarquia de evidência

Quando fontes divergirem, use esta ordem como ponto de partida, não como regra cega: **comportamento reproduzível → código atual → schema/migrations/contratos → testes → configuração efetiva → documentação técnica recente → ADRs → backlog/roadmap → Vault histórico**.

🎯 **R5 — Uma divergência não autoriza correção automática.** Se o código implementa `X` e a documentação descreve `Y`, primeiro determine se `Y` é documentação antiga, requisito ainda válido, decisão substituída ou bug atual. Se a resposta alterar o produto ou arquitetura e não puder ser provada no repositório, pergunte.

🎯 **R6 — ADR é histórico, não verdade eterna.** Leia o contexto, procure ADRs posteriores relacionados e confira a implementação atual. Decisões antigas podem ter sido substituídas e o histórico não deve ser apagado para fingir que a arquitetura sempre foi igual.

---

## 1. Bootstrap obrigatório de toda sessão

Antes de editar código, execute uma investigação mínima. Não precisa despejar o repositório inteiro no contexto; a meta é construir um modelo suficiente da feature atual.

```bash
git status
git branch --show-current
git log --oneline -n 10
```

Depois localize os arquivos relevantes usando preferencialmente `rg`, `git grep`, `find` e árvores com profundidade limitada. Leia os `package.json` relevantes antes de assumir nomes de scripts; comandos antigos como `npm run check`, `build` ou `test` podem ter mudado.

🎯 **B1 — Preserve trabalho existente.** Nunca faça `reset --hard`, descarte modificações, sobrescreva arquivos não relacionados ou troque silenciosamente de branch.

🎯 **B2 — Investigue pelo fluxo, não pelo nome do primeiro arquivo encontrado.** Para uma feature backend, rastreie quando aplicável `route → middleware → controller → service → repository → schema`; no frontend, rastreie `route/page → component → hook/query/store → client/API → backend`.

🎯 **B3 — Leia apenas documentação relacionada à tarefa.** Não carregue todo `docs/Vulnera/` em cada sessão. Localize o assunto, consulte os documentos mais próximos da feature, valide no código e expanda a investigação somente quando necessário.

🎯 **B4 — Descubra antes de perguntar.** Se uma resposta pode ser obtida pelo schema, código, testes, configuração ou documentação atual, encontre-a. Perguntas são para ambiguidade real, não substituto de investigação.

---

## 2. Protocolo de perguntas

Rafael prefere **perguntas a decisões silenciosas** quando existe mais de uma interpretação plausível com impacto material.

🎯 **Q1 — Faça entre 3 e 10 perguntas agrupadas quando necessário.** Pergunte principalmente quando houver dúvida sobre regra de negócio, comportamento, UX, arquitetura, persistência, API, segurança, tenancy, ownership, escopo, critérios de aceite ou alternativas significativamente diferentes.

🎯 **Q2 — Contextualize a dúvida.** Não faça perguntas genéricas como “como você quer?”. Explique o que encontrou no código, o que a documentação diz, quais opções são tecnicamente plausíveis e exatamente qual decisão precisa do humano.

🎯 **Q3 — Não implemente a parte ambígua enquanto aguarda decisão.** Pode continuar investigação somente leitura, localizar impactos e preparar alternativas, mas não escolha silenciosamente uma interpretação material.

Exemplo de formato:

```text
Encontrei uma divergência que afeta a implementação: o código atual faz X, enquanto a documentação Y descreve Z. Existem duas soluções plausíveis, A e B.

1. O comportamento esperado agora é A ou B?
2. ...
3. ...
```

---

## 3. Loop Engineering

Toda tarefa significativa deve iterar até existir evidência suficiente de conclusão. O loop não termina porque um patch foi aplicado; termina porque os critérios relevantes foram comprovados.

```text
DISCOVER → TRACE → COMPARE → ASK IF NEEDED → PLAN → IMPLEMENT → TEST → DIAGNOSE → REVIEW → DOCUMENT → PROVE
                                          ↑                         |
                                          └──────── LOOP ──────────┘
```

🎯 **L1 — Discover.** Identifique branch, estado do Git, estrutura relevante, documentação da feature, padrões equivalentes e scripts reais disponíveis.

🎯 **L2 — Trace.** Entenda o comportamento existente ponta a ponta antes de modificar uma feature. Para banco, confira schema e migrations; para UI, confira consumidores reais; para APIs, confira contratos e autorização.

🎯 **L3 — Compare.** Confronte código, schema, testes, docs e requisito fornecido pelo usuário. Registre divergências que possam alterar a solução.

🎯 **L4 — Ask.** Persistindo ambiguidade material após investigação, faça 3–10 perguntas e suspenda somente a parte afetada.

🎯 **L5 — Plan.** Escolha a menor alteração que satisfaça o requisito mantendo os padrões atuais. Evite redesign, dependências e abstrações novas sem necessidade.

🎯 **L6 — Implement.** Faça mudanças coesas e pequenas. Use recursos equivalentes existentes como referência antes de criar uma segunda arquitetura para resolver o mesmo problema.

🎯 **L7 — Test.** Execute validação proporcional à mudança: lint/typecheck, testes, build, runtime, API real, banco, Docker, segurança, UI ou smoke tests conforme aplicável.

🎯 **L8 — Diagnose.** Falhou? Reproduza, encontre a causa raiz e corrija ou reporte. Nunca remova um teste simplesmente porque ele começou a falhar.

🎯 **L9 — Review.** Revise `git status`, `git diff --stat` e `git diff`; procure arquivos inesperados, debug, TODO temporário, mocks acidentais, alterações de lockfile, mudanças fora do escopo e regressões.

🎯 **L10 — Document.** Atualize somente documentação afetada e somente depois que o comportamento estiver validado. Não documente como pronto o que ainda não funciona.

🎯 **L11 — Prove.** Só use linguagem de conclusão quando houver evidências concretas para os critérios relevantes.

---

## 4. Invariantes arquiteturais

As regras abaixo vieram da arquitetura histórica do Vulnera e continuam importantes. Se o código atual contradizer alguma delas, não remova a regra nem “corrija” o código silenciosamente: investigue se houve mudança arquitetural deliberada e procure documentação/ADR recente.

### 🎯 A1 — Factory Method

Factory Method possui importância técnica e acadêmica no TCC. Recursos tradicionais devem montar dependências por factory em vez de instanciar `Repository → Service → Controller` diretamente dentro das rotas. Antes de criar recurso novo, procure um recurso atual equivalente e copie o padrão vigente.

### 🎯 A2 — Separação de camadas

- **Controller** conhece HTTP, extrai/valida entrada HTTP, chama service e serializa resposta; não acessa Prisma diretamente.
- **Service** contém regras de negócio; não recebe `req`/`res` e não deve depender de Express ou Prisma.
- **Repository** concentra persistência e é a camada autorizada a trabalhar diretamente com Prisma.
- **Routes** definem endpoints, middlewares e obtêm controllers pelas factories; não contêm regras de negócio.
- **Middlewares** cuidam de preocupações transversais como autenticação e autorização ampla; ownership específico do recurso normalmente pertence ao service.

❌ Evite `Route → Prisma`, `Controller → Prisma`, `Service → req/res` ou lógica de negócio complexa em middleware.

### 🎯 A3 — Schema antes do código

Antes de criar ou alterar model, DTO, repository, relation, enum ou query, abra o `schema.prisma` atual e confirme nomes, tipos e relacionamentos reais. **Nunca invente campo porque uma documentação antiga ou prompt menciona algo parecido.**

### 🎯 A4 — PrismaClient

Se a arquitetura atual continuar utilizando um singleton como `database/prisma.database.ts`, reutilize-o. Não espalhe `new PrismaClient()` pela aplicação.

### 🎯 A5 — Rotas literais antes de paramétricas

Rotas como `/me`, `/current` e `/pending` devem preceder `/:id` quando compartilham o mesmo router, evitando que valores literais sejam interpretados como IDs.

### 🎯 A6 — App separado do Server

Se o padrão atual continuar usando `app.ts` + `server.ts`, preserve a separação: `app.ts` configura e exporta a aplicação sem `listen()`, enquanto `server.ts` inicia o servidor. Isso mantém integração com Supertest e outros testes sem abrir porta real.

---

## 5. Multi-tenancy, ownership e segurança

🎯 **SEC1 — Nunca confie apenas em filtros de frontend.** Tenant/company/ownership são propriedades de segurança e devem ser verificadas no backend.

🎯 **SEC2 — Não aceite `companyId`, `tenantId` ou `ownerId` cegamente do body quando puderem ser derivados do usuário autenticado ou do recurso pai.** Derive o contexto de segurança de fontes confiáveis.

🎯 **SEC3 — Ownership fino normalmente pertence ao service.** Middleware pode autenticar e validar roles gerais, mas autorização contextual precisa considerar o recurso solicitado.

🎯 **SEC4 — Toda alteração em recurso multi-tenant deve considerar teste negativo.** Não basta provar que tenant A acessa recurso de A; quando aplicável, prove também que tenant B não consegue acessar o recurso de A.

🎯 **SEC5 — Para mudanças relevantes revise autenticação, autorização, ownership, tenant isolation, validação de entrada, injection, XSS, upload, secrets, rate limiting, headers e logging sensível conforme o escopo.** Consulte `docs/Vulnera/05-Infra-DevSecOps/` quando necessário, mas confirme a implementação atual.

---

## 6. Environment e arquivos protegidos

🎯 **E1 — Não toque em `.env`.** Não abra, não imprima, não copie, não edite e não versione conteúdo de `.env`. Use `.env.example`, schemas/abstrações de configuração e documentação segura.

🎯 **E2 — Preserve abstrações existentes.** Se o código usa `EnvVar` + `EnvKeys`, mantenha o padrão em vez de espalhar `process.env.*` diretamente.

🎯 **E3 — Evite lockfiles.** Não carregue `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock*` ou `*.lock` no contexto sem necessidade real. Eles possuem alto custo de tokens e baixa utilidade para investigação normal.

🎯 **E4 — Nunca edite lockfile manualmente.** Quando uma dependência realmente precisar mudar, altere a declaração apropriada, use o package manager e deixe o lockfile ser gerado automaticamente. Revise apenas o diff necessário.

---

## 7. Convenções de implementação

Quando ainda refletirem o código atual, preserve estas convenções: arquivos `kebab-case` com papel explícito (`plan.repository.ts`), classes `PascalCase`, métodos `camelCase`, constantes/códigos de erro `SCREAMING_SNAKE_CASE`, rotas REST no plural e imports relativos em vez de aliases arbitrários.

O projeto historicamente utiliza códigos de aplicação como `INVALID_<FIELD>`, `MISSING_<FIELD>`, `<ENTITY>_NOT_FOUND`, `<ENTITY>_ALREADY_EXISTS`, `<ENTITY>_LIMIT_REACHED`, `INVALID_STATUS_TRANSITION`, `UNAUTHORIZED`, `INVALID_TOKEN`, `FORBIDDEN` e `INTERNAL_ERROR`. Antes de introduzir outro mecanismo, procure o padrão efetivamente utilizado hoje.

🎯 **I1 — Reutilize padrões atuais.** Antes de criar novo controller, service, repository, componente, hook ou fluxo, encontre um equivalente bem estabelecido no repositório e adapte-o.

🎯 **I2 — Simplicidade primeiro.** Não transforme feature pequena em refactor estrutural; evite abstrações especulativas, novas dependências e arquivos que não contribuam diretamente para o requisito.

🎯 **I3 — Bug fora do escopo é registrado, não corrigido.** Corrija somente se bloquear diretamente a tarefa ou se o usuário expandir o escopo.

🎯 **I4 — Comentários explicam o porquê.** Não comente `// incrementa i`; comente decisões, invariantes, workarounds ou razões não óbvias. Para arquivos novos com finalidade acadêmica/pedagógica, siga os padrões de cabeçalho existentes se ainda estiverem presentes no projeto.

---

## 8. Testes e validação

Descubra os scripts reais nos `package.json` antes de executar comandos. Não presuma que o workflow antigo continua idêntico.

### Backend

Quando aplicável, valide happy path, inputs inválidos, recurso inexistente, regra de negócio, autenticação, autorização, tenancy, ownership, persistência e contrato da resposta. Para CRUDs, procure testes equivalentes existentes antes de decidir cobertura mínima.

### Frontend

Quando aplicável, valide typecheck/lint/build, integração real com API, loading, empty state, erros, permissões, responsividade e regressões visuais/funcionais relevantes.

### Banco

Quando houver alteração de persistência, confira schema, migration, enums, relações, constraints e comportamento com estado real. Não deduza estrutura do banco somente pelos tipos TypeScript.

### Docker

Quando a tarefa depender da stack, valide configuração, build, startup, health, logs e um smoke test do comportamento relevante. **Imagem buildar não prova que o serviço funciona.**

### Segurança

Mudanças em autenticação, tenancy, upload, rate limit ou dados sensíveis exigem validação específica, não apenas testes genéricos.

---

## 9. Checkpoints e trabalho autônomo

Em tarefas grandes, trabalhe em blocos completos em vez de interromper após cada arquivo. Um checkpoint deve representar uma unidade útil, por exemplo: investigação, backend, frontend, testes e documentação.

Formato recomendado:

```text
=== CHECKPOINT ===
Feito: <resultado>
Arquivos: <principais arquivos>
Validação: <evidências / testes>
Atenção: <ambiguidades, decisões, bugs fora do escopo>
Próximo: <próximo bloco>
==================
```

⚠️ Checkpoint não substitui perguntas. Se surgir uma ambiguidade material, pare a implementação afetada e faça a rodada de perguntas.

---

## 10. Documentação viva

🎯 **D1 — Documentação desatualizada deve ser corrigida quando a task realmente altera o comportamento documentado.** Não reescreva documentos não relacionados.

🎯 **D2 — Primeiro implemente e valide; depois documente.** Nunca marque como concluída uma funcionalidade que ainda não foi comprovada.

🎯 **D3 — Preserve histórico.** Quando uma decisão antiga for substituída, marque-a como substituída ou registre a evolução; não apague o passado para fazer a documentação parecer linear.

🎯 **D4 — Mudança arquitetural não trivial pode exigir ADR.** Antes de criar um novo, procure se já existe decisão relacionada e determine se você está realmente criando uma decisão ou apenas executando uma já registrada.

🎯 **D5 — Não edite `CLAUDE.md` nem `GOTCHA.md` autonomamente.** Se encontrar regra obsoleta, conflito ou nova armadilha recorrente, explique ao Rafael e proponha a alteração; somente modifique após autorização explícita.

---

## 11. Revisão antes de finalizar

Antes do relatório final execute, quando aplicável:

```bash
git status
git diff --stat
git diff
```

Revise cada arquivo alterado e responda: **por que ele mudou?** Procure debug esquecido, TODO temporário, dados fake, alteração fora do escopo, alteração inesperada de `.env`, lockfile desnecessário, arquivos gerados, erro de tenancy/ownership, tratamento incompleto de erro e documentação desatualizada.

---

## 12. Definition of Done

Uma tarefa só pode ser apresentada como concluída quando os itens aplicáveis estiverem comprovados:

- [ ] contexto e implementação existente foram investigados;
- [ ] documentação relevante foi consultada sem confiança cega;
- [ ] schema/contratos foram conferidos quando aplicável;
- [ ] ambiguidades materiais foram resolvidas;
- [ ] alteração foi implementada sem mock/placeholder substituindo funcionalidade real;
- [ ] typecheck/lint/testes/build relevantes foram executados;
- [ ] comportamento real foi validado quando possível;
- [ ] segurança, tenancy e ownership foram verificadas quando pertinentes;
- [ ] diff foi revisado;
- [ ] documentação afetada foi atualizada;
- [ ] riscos, limitações e testes não executados foram explicitados.

Use linguagem precisa:

- `✅ Implementado e validado por <evidências>.`
- `⚠️ Implementado, porém <parte> não pôde ser validada por <motivo>.`
- `⛔ Não implementado porque <decisão/bloqueador> continua pendente.`

❌ Não use “concluído”, “resolvido”, “funcionando” ou “deve funcionar” sem evidência correspondente.

---

## 13. Relatório final

Ao terminar uma task, entregue um resumo curto e auditável:

```markdown
## Resultado

O que foi efetivamente entregue.

## Alterações

- `arquivo` — mudança e motivo.

## Validação

- `comando/teste` ✅
- fluxo funcional X ✅

## Segurança / tenancy

- verificações realizadas, quando aplicável.

## Documentação

- documentos atualizados.

## Divergências / decisões

- código vs documentação, decisões autônomas não ambíguas e descobertas relevantes.

## Pendências / riscos

- nenhuma, ou lista objetiva.
```

---

## 14. Anti-patterns — nunca

❌ Inventar campo que não existe no schema.  
❌ Importar Prisma diretamente em controllers/services/routes quando a arquitetura vigente usa repositories.  
❌ Colocar regra de negócio na rota ou tratamento HTTP dentro do service.  
❌ Pular Factory Method silenciosamente quando o recurso segue esse padrão.  
❌ Aceitar identificador de tenant/company sem verificar sua origem e autorização.  
❌ Usar mock, fake data ou hardcode para simular uma feature pronta.  
❌ Declarar sucesso apenas porque build/typecheck passou.  
❌ Remover teste porque começou a falhar.  
❌ Corrigir bugs fora do escopo sem necessidade.  
❌ Fazer refactor oportunista.  
❌ Ler ou editar `.env`.  
❌ Editar lockfile manualmente ou carregar milhares de linhas dele sem necessidade.  
❌ Tratar Vault, backlog, roadmap ou Repomix como prova de implementação atual.  
❌ Apagar histórico arquitetural.  
❌ Finalizar sem revisar o diff.  
❌ Atualizar documentação dizendo que algo está pronto antes da validação.  
❌ Alterar `CLAUDE.md` ou `GOTCHA.md` sem autorização do Rafael.

---

## 15. Resumo executivo

1. **Investigue antes de agir.**
2. **Código mostra estado; testes dão evidência; documentação fornece contexto e intenção.**
3. **Persistindo ambiguidade material, faça 3–10 perguntas antes de implementar.**
4. **Leia o schema antes de modelar dados.**
5. **Preserve separação Controller → Service → Repository e Factory Method quando vigentes.**
6. **Tenancy e ownership são segurança, não detalhe de UI.**
7. **Não toque em `.env`; evite lockfiles e nunca os edite manualmente.**
8. **Nunca substitua implementação real por mocks/placeholders.**
9. **Itere: investigar → implementar → testar → diagnosticar → revisar até existir prova suficiente.**
10. **Atualize documentação somente após validar o comportamento.**
11. **Revise o diff antes de concluir.**
12. **YOLO dá autonomia de ferramenta, não autoridade para inventar requisito.**

> **Regra final:** se não sabe, investigue; se a investigação não resolve, pergunte; se está claro, implemente; se implementou, teste; se falhou, diagnostique e itere; se passou, revise; se está comprovado, documente e só então conclua.
