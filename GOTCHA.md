# GOTCHA.md — Armadilhas do Vulnera

> **Pre-flight checklist para agentes.** Leia antes de alterar código. O objetivo deste arquivo é lembrar rapidamente das armadilhas que mais geram implementação incorreta, desperdício de contexto ou falso positivo de conclusão.

---

## 🔴 Fonte de verdade e investigação

⚠️ **G1 — O Vault pode estar atrasado.** `docs/Vulnera/` é excelente para domínio, regras, histórico e ADRs, mas confirme decisões que afetem código contra implementação, schema, testes e docs técnicas atuais.

⚠️ **G2 — ADR não é verdade eterna.** Procure decisões posteriores relacionadas e confira o código atual; uma decisão antiga pode ter sido substituída.

⚠️ **G3 — Backlog, roadmap e docs não provam implementação.** Um item documentado pode estar planejado, parcial, abandonado ou historicamente correto. Confirme no repositório.

⚠️ **G4 — Repomix é snapshot.** Use para busca/contexto quando útil, mas o repositório atual vence um dump antigo.

⚠️ **G5 — Código também pode estar errado.** Ele representa o estado implementado, não necessariamente a intenção correta. Se contradizer segurança, testes válidos ou requisito confirmado, investigue.

---

## 🔴 Perguntas e decisões

🎯 **G6 — Não assuma decisão material.** Ambiguidade em comportamento, UX, regra de negócio, arquitetura, banco, contrato, segurança, tenancy ou escopo → investigue; persistindo dúvida → faça **3–10 perguntas agrupadas**.

🎯 **G7 — Não pergunte o que o repositório responde.** Antes de perguntar, procure em código, `schema.prisma`, testes, docs e configuração.

🎯 **G8 — YOLO não autoriza inventar requisito.** Permissões amplas servem para executar o trabalho, não para escolher silenciosamente decisões de produto.

---

## 🔴 Banco e arquitetura

❌ **G9 — Nunca invente campo.** Leia `schema.prisma` antes de criar/alterar model, DTO, repository, enum, relação ou query.

❌ **G10 — Não misture camadas.** Controller trabalha com HTTP; Service contém regra de negócio; Repository cuida da persistência/Prisma; Routes registram endpoints/middlewares; Factory monta dependências.

❌ **G11 — Não pule Factory Method silenciosamente.** O padrão possui importância técnica e acadêmica no Vulnera.

❌ **G12 — Não espalhe Prisma.** Se repositories são a camada de persistência, não introduza Prisma em route/controller/service. Se existe singleton de `PrismaClient`, reutilize-o.

⚠️ **G13 — Rotas literais antes de `/:id`.** `/me`, `/current`, `/pending` etc. devem vir antes de parâmetros genéricos quando usam o mesmo router.

---

## 🔴 Segurança e multi-tenancy

❌ **G14 — Não aceite `companyId`/`tenantId`/`ownerId` cegamente do body.** Derive do usuário autenticado ou do recurso pai quando possível.

⚠️ **G15 — Role não substitui ownership.** Middleware pode validar autenticação e role; autorização contextual do recurso normalmente precisa de regra no service.

⚠️ **G16 — Teste tenancy nos dois sentidos.** Não prove apenas `tenant A → recurso A ✅`; quando aplicável, prove também `tenant B → recurso A ❌`.

---

## 🔴 `.env`, dependências e arquivos grandes

❌ **G17 — Não abra nem edite `.env`.** Não imprima, copie ou versione secrets; use `.env.example` e abstrações de configuração.

❌ **G18 — Não desperdice contexto com lockfiles.** Evite `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock*` e `*.lock` durante investigação normal.

❌ **G19 — Nunca edite lockfile manualmente.** Quando uma dependência realmente mudar, use o package manager e deixe o lockfile ser gerado automaticamente.

---

## 🔴 Implementação e escopo

❌ **G20 — Mock não é feature pronta.** Mock, stub, fake data, placeholder, hardcode e TODO podem existir em testes ou trabalho explicitamente temporário, mas não podem ser apresentados como integração concluída.

⚠️ **G21 — Bug fora do escopo: registre, não conserte.** Só corrija se bloquear diretamente a task ou se o escopo for expandido.

⚠️ **G22 — Não faça refactor oportunista.** Uma feature pequena não é autorização para redesenhar módulos não relacionados.

🎯 **G23 — Procure um exemplo equivalente antes de criar estrutura nova.** O padrão atual do próprio repositório é normalmente melhor referência que uma arquitetura inventada durante a sessão.

---

## 🔴 Testes e falso positivo

❌ **G24 — `build passou` ≠ `feature funciona`.** Typecheck, lint, build, testes e runtime validam coisas diferentes.

❌ **G25 — Não remova teste porque falhou.** Reproduza → diagnostique → classifique a causa → corrija ou reporte → execute novamente.

⚠️ **G26 — Docker build não prova runtime.** Quando pertinente, valide `compose config`, build, startup, health/logs e smoke test.

⚠️ **G27 — Teste o caminho real quando possível.** Request real → aplicação → persistência → resposta possui valor maior que apenas verificar tipos.

---

## 🔴 Documentação

⚠️ **G28 — Documente depois de validar.** Fluxo correto: implementação → testes → revisão → documentação.

⚠️ **G29 — Não apague histórico.** Decisões substituídas devem continuar registradas como histórico.

❌ **G30 — Não altere `CLAUDE.md` ou `GOTCHA.md` autonomamente.** Identifique a necessidade, explique e peça autorização ao Rafael.

---

## 🔴 Antes de declarar conclusão

Execute quando aplicável:

```bash
git status
git diff --stat
git diff
```

Cheque: **arquivo inesperado? mudança fora do escopo? debug? TODO? mock? `.env`? lockfile? schema correto? tenancy? ownership? teste relevante? documentação afetada?**

Use somente estados honestos:

- `✅ Implementado e validado por X, Y e Z.`
- `⚠️ Implementado, mas X não pôde ser validado por Y.`
- `⛔ Não implementado porque a decisão X continua ambígua.`

❌ Evite sem evidência: **“está funcionando”, “resolvido”, “concluído”, “deve funcionar”, “provavelmente está certo”.**

---

## Resumo de bolso

**Dúvida → pesquise. Ambiguidade persistiu → pergunte. Campo/model → leia schema. Código → respeite camadas. Tenant → teste isolamento. Implementou → teste de verdade. Falhou → diagnostique e itere. Passou → revise o diff. Validou → atualize docs. Evidência suficiente → conclua.**
