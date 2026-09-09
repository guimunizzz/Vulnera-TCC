# AGENTS.md — Guia do projeto Vulnera API

> **Fonte única da verdade sobre como código deve ser escrito neste projeto.**
> Toda PR segue este padrão. Toda divergência justificada vira atualização deste arquivo.
>
> **v4 · 2026-08-03** — pastas no plural, IA cortada do escopo, protocolo de documentação viva e modo solo-delegado.

---

## 0. Como usar este documento

- **Agente de código (Codex)** → siga à risca. **Leia o §0.1 e o §0.2 antes de qualquer tarefa.**
- **Humano** → o §5 (walkthrough do `plan`) é o passo-a-passo. O resto é referência.

Convenções de bloco: 🎯 princípio inviolável · ✅ faça · ❌ anti-pattern · 💡 racional · ⚠️ armadilha · 🚧 `[FUTURO]` adiado pós-MVP.

### Onde fica cada coisa

A sessão do Codex **abre na raiz do repositório**. Todos os caminhos abaixo são relativos a ela.

| O quê                                                   | Caminho                                     |
| ------------------------------------------------------- | ------------------------------------------- |
| Este guia                                               | `AGENTS.md`                                 |
| Estado de implementação                                 | `PRD_VIVO.md`                               |
| Prompts de execução por fase                            | `docs/ROADMAP_PROMPTS.md`                   |
| Backlog por fase                                        | `docs/BACKLOG.md`                           |
| **Vault de documentação (fonte de verdade do domínio)** | `docs/Vulnera/`                             |
| Nota mestra do vault                                    | `docs/Vulnera/00-Hub/Contexto Mestre v4.md` |
| Decisões arquiteturais                                  | `docs/Vulnera/07-Decisoes/ADR-*.md`         |
| Backend                                                 | `app/api/`                                  |
| Frontend web                                            | `app/web/`                                  |
| Mobile                                                  | `app/mobile/`                               |

⚠️ Ignorar `docs/Vulnera/repomix-output.xml` — é um dump gerado, não documentação.

---

## 0.1 🎯 Protocolo de documentação viva

Os documentos vivos **são a memória do projeto entre sessões**. Mantê-los sincronizados com o código é sua responsabilidade. **Documentação desatualizada é bug.**

| Documento                                                   | Papel                                          | Quando atualizar                                 |
| ----------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `PRD_VIVO.md`                                               | Estado atual (feito / em progresso / pendente) | Toda tarefa concluída                            |
| `docs/BACKLOG.md`                                           | Futuro planejado                               | Ao concluir ou reordenar tasks                   |
| `docs/ROADMAP_PROMPTS.md`                                   | Prompts + histórico por fase                   | Fim de cada fase                                 |
| `docs/Vulnera/07-Decisoes/`                                 | ADRs                                           | Ao decidir algo não-trivial                      |
| `docs/Vulnera/08-Operacao/Mudancas/Changelog do Projeto.md` | Histórico de sessões                           | Fim de cada fase                                 |
| `AGENTS.md`                                                 | Regras eternas                                 | Só com aviso ao humano — **nunca edite sozinho** |

### Regras

🎯 **R1** — Ao concluir qualquer task, atualize o `PRD_VIVO.md` antes de encerrar: ✅ na task, marco no histórico, % de progresso.
🎯 **R2** — Marque também no `docs/BACKLOG.md`.
🎯 **R3** — Ao fechar uma fase, ponha badge `✅ Concluída em YYYY-MM-DD` no prompt correspondente do `ROADMAP_PROMPTS.md` e acrescente uma seção `## Histórico` com branch, PR, data e desvios.
🎯 **R4** — Decisão arquitetural nova vira ADR em `docs/Vulnera/07-Decisoes/`, seguindo o formato dos existentes (contexto, decisão, consequências, relacionado).
🎯 **R5** — **O código é a verdade.** Doc que afirma o que o código não faz está errado — corrija o doc. Vale nos dois sentidos.
🎯 **R6** — Histórico só cresce. Marcos e decisões antigas ganham marcação de "substituída", nunca somem.
🎯 **R7** — Ao **iniciar** sessão, leia `PRD_VIVO.md` primeiro. Você não tem memória entre sessões; ele tem.

### Fluxo de uma task

```
1. Ler PRD_VIVO.md            → onde paramos
2. Ler AGENTS.md §5           → como se escreve código aqui
3. Ler schema.prisma          → o que existe DE FATO no banco
4. Executar seguindo o padrão
5. npm run check              → lint + test
6. Atualizar PRD_VIVO.md + BACKLOG.md
7. Fim de fase → ROADMAP_PROMPTS.md + Changelog
8. Commit + PR
```

---

## 0.2 🎯 Modo solo-delegado

Rafael supervisiona, você implementa. Prazo curto — o comportamento esperado:

🎯 **S1 — Autonomia com checkpoints.** Execute blocos inteiros sem parar a cada arquivo, mas **pare no fim de cada checkpoint numerado** do prompt da fase e reporte antes de seguir.

🎯 **S2 — Leia o schema antes de escrever model.** O erro mais caro é inventar campo. Abra `app/api/prisma/schema.prisma` e confirme os nomes reais. Se o campo não existe, use o que existe ou pare e pergunte.

🎯 **S3 — Terminar > perguntar, exceto no irreversível.** Nome de variável, ordem de método, estrutura de teste → decida e anote no relatório. Deletar dados, mudar schema, renomear branch, alterar o `AGENTS.md` → pare e pergunte.

🎯 **S4 — Nunca edite lockfile na mão.** `npm install` falhou? Pare e reporte.

🎯 **S5 — Relatório ao fim de cada checkpoint:**

```
=== RELATÓRIO ===
Feito: <o que foi implementado>
Arquivos: <lista>
Testes: <X/Y passando>
Docs atualizados: PRD / BACKLOG / (ROADMAP se fim de fase)
⚠️ Atenção do Rafael: <decisões autônomas, ambiguidades, bugs achados e não corrigidos>
Próximo: <próximo checkpoint>
=================
```

🎯 **S6 — Bug fora do escopo: anote, não conserte.** A menos que bloqueie a task atual.

🎯 **S7 — Cabeçalho comentado em PT-BR em todo arquivo novo:** o que faz, por que existe, quem consome. A banca lê o código.

---

## 1. O projeto em uma frase

Vulnera API é o back-end **Node.js + Express + Prisma + MySQL** em **TypeScript**, organizado em **camadas**, com cada recurso montado via **Factory Method** (padrão obrigatório pela avaliação acadêmica).

---

## 2. Estrutura de pastas (não negociável)

```
app/api/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── config/
│   │   ├── enum/EnvKeys.ts
│   │   └── EnvVar.ts
│   ├── database/
│   │   └── prisma.database.ts
│   ├── repositories/         # acesso a dados — única camada que toca Prisma
│   ├── models/               # 1 arquivo por recurso (type + DTO + entity)
│   ├── services/             # regras de negócio
│   ├── controllers/          # entrada HTTP
│   ├── factories/            # montagem da stack (Factory Method)
│   ├── middlewares/          # auth, require-role
│   ├── routes/
│   │   └── routes.ts         # centralizador (ÚNICO ponto de registro)
│   ├── utils/                # jwt, hash, cvss
│   ├── app.ts                # cria o app Express, exporta sem listen (teste)
│   └── server.ts             # importa app e chama listen
├── tests/
│   ├── fixtures/
│   ├── integration/
│   └── setup.ts
├── uploads/                  # evidências: {companyId}/{vulnId}/
├── .env.example
├── jest.config.ts
├── package.json
└── tsconfig.json
```

🎯 **Pastas de recurso no PLURAL.** `controllers/`, `models/`, `repositories/`, `services/`, `factories/`, `middlewares/`.
`config/` e `database/` ficam no **singular** por convenção fixa, independente da contagem de arquivos — evita renomeação em cascata.

> Isto **inverte** a convenção da v2 (que exigia singular). Ver `docs/Vulnera/07-Decisoes/ADR-009 - Pastas no plural e cadeia de camadas.md`.

### Cadeia de camadas

```
config → database → repositories → models → services → controllers → routes → server
                                                            ↕
                                                      middlewares
```

---

## 3. Princípios

### 🎯 P1 — Cada camada conhece só a de baixo

- **Controller** não chama Repository
- **Service** não toca em `req` / `res`
- **Repository** é o único que importa `@prisma/client`

💡 Sem isso: Service depende de Express → testar exige subir servidor. Service importa Prisma → não dá pra trocar banco.

### 🎯 P2 — Factory Method é obrigatório

Toda rota recebe Controller via factory. Nunca instanciamos stack inline.
💡 **Acadêmico:** é o padrão avaliado pelo professor. PR sem factory = rejeitada.
💡 **Técnico:** centraliza a árvore de dependências; mock de teste = uma linha.

### 🎯 P3 — Simplicidade primeiro

🚧 `[FUTURO]`: validação manual com `if` (depois zod) · `try/catch` por controller (depois middleware global) · sem envelope JSON · `console.error` (depois Pino).

### 🎯 P4 — Documente o porquê, não o quê

❌ `// incrementa i` ✅ `// reset do índice porque o lote anterior subiu mesmo com erro`

### 🎯 P5 — Nomenclatura: kebab + role

| Item           | Padrão          | Exemplo                |
| -------------- | --------------- | ---------------------- |
| Arquivo        | `kebab.role.ts` | `plan.repository.ts`   |
| Classe         | PascalCase      | `PlanRepository`       |
| Método         | camelCase       | `findById`             |
| Rota REST      | plural + kebab  | `/api/project-members` |
| Constante env  | SCREAMING_SNAKE | `JWT_SECRET`           |
| Código de erro | SCREAMING_SNAKE | `PLAN_NOT_FOUND`       |

---

## 4. Anatomia de uma request

```
POST /api/plans
   ▼ [Express]      app.ts monta routes.ts em /api
   ▼ [Routes]       routes/plan.routes.ts — define endpoints, chama factory
   ▼ [Middleware]   auth + requireRole
   ▼ [Controller]   extrai req, valida, chama service, serializa
   ▼ [Service]      regra de negócio, chama repository
   ▼ [Repository]   prisma.plan.*
   ▼ [Prisma] → [MySQL]
```

Sem atalhos.

---

## 5. Walkthrough — recurso `plan`

Exemplo canônico. **Ao criar recurso novo, copie e adapte — sempre conferindo os campos reais no `schema.prisma` antes (§0.2 S2).**

### 5.1 Model — `models/plan.model.ts`

1 arquivo com type + DTOs + entity. Quebra em 3 só acima de ~200 linhas.

```typescript
import type { Plan as PrismaPlan } from "@prisma/client";

export type Plan = PrismaPlan;

export type CreatePlanDTO = {
  name: string;
  maxApplications: number;
  maxProjects: number;
  includesRemediation: boolean;
  price: number;
};
export type UpdatePlanDTO = Partial<CreatePlanDTO>;
export type PlanResponseDTO = {
  id: string;
  name: string;
  maxApplications: number;
  maxProjects: number;
  includesRemediation: boolean;
  price: number;
  isActive: boolean;
  createdAt: string;
};

export class PlanEntity {
  constructor(private readonly data: Plan) {}

  toResponse(): PlanResponseDTO {
    return {
      id: this.data.id,
      name: this.data.name,
      maxApplications: this.data.maxApplications,
      maxProjects: this.data.maxProjects,
      includesRemediation: this.data.includesRemediation,
      price: Number(this.data.price),
      isActive: this.data.isActive,
      createdAt: this.data.createdAt.toISOString(),
    };
  }

  allowsMoreApplications(currentCount: number): boolean {
    return currentCount < this.data.maxApplications;
  }
}
```

### 5.2 Repository — `repositories/plan.repository.ts`

🎯 Única camada autorizada a importar `@prisma/client`. `PrismaClient` injetado por construtor. Sem lógica de negócio. Métodos devolvem tipos brutos do Prisma.

```typescript
import type { PrismaClient } from "@prisma/client";
import type { Plan, CreatePlanDTO, UpdatePlanDTO } from "../models/plan.model";

export class PlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { id } });
  }
  async findAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({ orderBy: { createdAt: "desc" } });
  }
  async create(data: CreatePlanDTO): Promise<Plan> {
    return this.prisma.plan.create({ data });
  }
  async update(id: string, data: UpdatePlanDTO): Promise<Plan> {
    return this.prisma.plan.update({ where: { id }, data });
  }
  async delete(id: string): Promise<void> {
    await this.prisma.plan.delete({ where: { id } });
  }
}
```

### 5.3 Service — `services/plan.service.ts`

🎯 Regras de negócio. Não conhece HTTP nem Prisma. Lança **string-código**, nunca mensagem humana.

```typescript
import { PlanRepository } from "../repositories/plan.repository";
import { PlanEntity, CreatePlanDTO, UpdatePlanDTO } from "../models/plan.model";

export class PlanService {
  constructor(private readonly repository: PlanRepository) {}

  async getById(id: string): Promise<PlanEntity> {
    const plan = await this.repository.findById(id);
    if (!plan) throw new Error("PLAN_NOT_FOUND");
    return new PlanEntity(plan);
  }

  async list(): Promise<PlanEntity[]> {
    return (await this.repository.findAll()).map((p) => new PlanEntity(p));
  }

  async create(dto: CreatePlanDTO): Promise<PlanEntity> {
    if (dto.maxApplications < 1) throw new Error("INVALID_MAX_APPLICATIONS");
    if (dto.maxProjects < 1) throw new Error("INVALID_MAX_PROJECTS");
    return new PlanEntity(await this.repository.create(dto));
  }

  async update(id: string, dto: UpdatePlanDTO): Promise<PlanEntity> {
    await this.getById(id);
    return new PlanEntity(await this.repository.update(id, dto));
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await this.repository.delete(id);
  }
}
```

⚠️ O service **recebe `{ userId, role }` como argumento** quando precisa checar ownership. Nunca recebe `req`.

### 5.4 Controller — `controllers/plan.controller.ts`

🎯 Adapta HTTP ↔ Service. `try/catch` por método, validação manual com `if`, tradução de string-código para status.

```typescript
import type { Request, Response } from "express";
import type { PlanService } from "../services/plan.service";
import type { CreatePlanDTO } from "../models/plan.model";

export class PlanController {
  constructor(private readonly service: PlanService) {}

  async list(req: Request, res: Response): Promise<Response> {
    try {
      const plans = await this.service.list();
      return res.status(200).json(plans.map((p) => p.toResponse()));
    } catch (error) {
      console.error("PlanController.list", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }

  async create(req: Request, res: Response): Promise<Response> {
    try {
      const body = req.body as Partial<CreatePlanDTO>;

      // 🚧 [FUTURO] migrar pra zod
      if (!body.name || typeof body.name !== "string") {
        return res.status(400).json({ error: "INVALID_NAME" });
      }
      if (
        typeof body.maxApplications !== "number" ||
        body.maxApplications < 1
      ) {
        return res.status(400).json({ error: "INVALID_MAX_APPLICATIONS" });
      }
      if (typeof body.maxProjects !== "number" || body.maxProjects < 1) {
        return res.status(400).json({ error: "INVALID_MAX_PROJECTS" });
      }
      if (typeof body.price !== "number" || body.price < 0) {
        return res.status(400).json({ error: "INVALID_PRICE" });
      }
      if (typeof body.includesRemediation !== "boolean") {
        return res.status(400).json({ error: "INVALID_INCLUDES_REMEDIATION" });
      }

      const plan = await this.service.create(body as CreatePlanDTO);
      return res.status(201).json(plan.toResponse());
    } catch (error: any) {
      if (error.message?.startsWith("INVALID_")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("PlanController.create", error);
      return res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  }
}
```

### 5.5 Factory — `factories/plan.factory.ts`

🎯 Coração do padrão acadêmico. Cabeçalho pedagógico obrigatório.

```typescript
// app/api/src/factories/plan.factory.ts
//
// FACTORY METHOD para o recurso Plan (padrão GoF).
// Sem factory, a rota teria que instanciar Repository → Service → Controller
// na mão, embolando responsabilidades e dificultando mock em teste.
// Esta factory esconde a montagem, centraliza a injeção do PrismaClient e
// permite uma factory-irmã de teste que injeta mock.
//
// Convenção: arquivo `<recurso>.factory.ts`, função `make<Recurso>Controller`.
// Consumidor: APENAS o arquivo de routes do recurso.

import { prisma } from "../database/prisma.database";
import { PlanRepository } from "../repositories/plan.repository";
import { PlanService } from "../services/plan.service";
import { PlanController } from "../controllers/plan.controller";

export function makePlanController(): PlanController {
  const repository = new PlanRepository(prisma);
  const service = new PlanService(repository);
  return new PlanController(service);
}
```

### 5.6 Routes — `routes/plan.routes.ts`

```typescript
import { Router } from "express";
import { makePlanController } from "../factories/plan.factory";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/require-role.middleware";

const router = Router();
const controller = makePlanController();

// catálogo público
router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));

// gestão restrita a admin
router.post("/", authMiddleware, requireRole("ADMIN"), (req, res) =>
  controller.create(req, res),
);
router.put("/:id", authMiddleware, requireRole("ADMIN"), (req, res) =>
  controller.update(req, res),
);
router.delete("/:id", authMiddleware, requireRole("ADMIN"), (req, res) =>
  controller.delete(req, res),
);

export { router as planRoutes };
```

💡 O arrow wrapper `(req, res) => controller.metodo(req, res)` preserva o `this` da classe.
⚠️ **Rotas literais antes de paramétricas.** `/me`, `/current` e `/pending` sempre antes de `/:id`.

### 5.7 Centralizador — `routes/routes.ts`

🎯 ÚNICO ponto de registro. Toda rota nova é plugada aqui.

### 5.8 App + Server

`app.ts` cria o Express, monta `apiRoutes` em `/api` e **exporta `app` sem `listen()`** (pra Supertest). `server.ts` importa `app` e chama `listen()`.

---

## 6. Env — `EnvVar` + `EnvKeys`

Padrão acadêmico fixo, não simplificar. `EnvKeys` é um enum com as chaves; `EnvVar` tem `get`, `getOptional` e `getNumber`, lançando erro se a variável faltar.

✅ `EnvVar.get(EnvKeys.PORT)` ❌ `process.env.PORT`

---

## 7. Database — `database/prisma.database.ts`

Singleton exportado. ⚠️ **Nunca** `new PrismaClient()` em outro lugar — múltiplas instâncias vazam conexão.

---

## 8. Autenticação

- JWT HS256 · access **15 min** · refresh **7 dias**, rotativo
- Refresh persistido só como **hash SHA-256** — token cru nunca toca o banco
- Senha em bcrypt **cost 12** (cost 4 em teste)
- `authMiddleware` popula `req.user = { userId, role }`
- `requireRole(...roles)` responde `403 FORBIDDEN`
- **Não aplicar** auth em `auth.routes.ts` nem no `GET /api/plans`

Ownership fino (qual empresa é dona do registro) fica no **service**, não no middleware.

---

## 9. Códigos de erro

| Padrão                                                   | Status |
| -------------------------------------------------------- | ------ |
| `MISSING_<CAMPO>` / `INVALID_<CAMPO>`                    | 400    |
| `<ENTIDADE>_NOT_FOUND`                                   | 404    |
| `<ENTIDADE>_ALREADY_EXISTS`                              | 409    |
| `<ENTIDADE>_LIMIT_REACHED` / `INVALID_STATUS_TRANSITION` | 422    |
| `UNAUTHORIZED` / `INVALID_TOKEN`                         | 401    |
| `FORBIDDEN`                                              | 403    |
| `INTERNAL_ERROR`                                         | 500    |

---

## 10. Checklist de novo CRUD

1. [ ] `schema.prisma` se o model é novo → `npx prisma migrate dev --name add_<recurso>`
2. [ ] `models/<recurso>.model.ts`
3. [ ] `repositories/<recurso>.repository.ts`
4. [ ] `services/<recurso>.service.ts`
5. [ ] `controllers/<recurso>.controller.ts`
6. [ ] `factories/<recurso>.factory.ts`
7. [ ] `routes/<recurso>.routes.ts`
8. [ ] Plugar em `routes/routes.ts`
9. [ ] `tests/integration/<recurso>.test.ts` — happy path + erros de validação + 1 regra de negócio
10. [ ] `npm run check` verde
11. [ ] **Atualizar `PRD_VIVO.md` e `docs/BACKLOG.md`** (§0.1)

---

## 11. Scripts

`npm run check` (lint + test) antes de toda PR. Demais: `dev`, `build`, `test`, `lint`, `prisma:migrate`, `prisma:studio`, `db:seed`, `db:reset`.

---

## 12. Testes

Só integração — Jest + Supertest contra `app` (sem `listen`), banco separado via `.env.test` (`vulnera_test`).

`tests/setup.ts` exporta `testPrisma` e `cleanDatabase()`. **Ordem de limpeza (respeita FKs):**

```
auditLog → evidence → vulnerabilityComment → vulnerability →
projectMember → project → application → subscription →
company → refreshToken → user
```

`Plan` e `Maturity*` ficam (vêm do seed).

Toda PR de CRUD cobre: happy path · erros de validação do controller · ao menos uma regra de negócio do service. Canários `TEN-xx` de tenancy em toda fase que toque recurso de cliente. Cobertura ≥80% nos services.

---

## 13. Convenções gerais

**Imports relativos** sempre, sem alias `@/`.
**Commits** em Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).
**Branches**: `main` (protegida) ← `develop` (integração) ← `feat/fase-N-<nome>`. **1 branch e 1 PR por fase.**

---

## 14. Anti-patterns — nunca

❌ Importar Prisma fora de `repositories/`
❌ Erro HTTP no service — use `throw new Error("CODE")`
❌ Pular a factory
❌ Misturar camadas (`prisma.*` dentro de uma rota)
❌ Devolver tipo bruto do Prisma — vaza `passwordHash`
❌ Validação de input no service (é do controller; **regra de negócio** sim vai no service)
❌ Pasta de recurso no singular
❌ Aceitar `companyId` vindo do body — derive do recurso pai ou do `req.user`
❌ Terminar sem atualizar os docs vivos (§0.1)
❌ Editar lockfile na mão (§0.2 S4)
❌ Inventar campo que não existe no schema (§0.2 S2)

---

## 15. Fora do escopo do MVP

Chat em tempo real · tickets de suporte · e-mail transacional · reset de senha · pagamento real · Redis/filas · i18n · toggle de tema · deploy em produção · **IA / Gemini** (cortada em 2026-08-03) · zod `[FUTURO]` · middleware global de erro `[FUTURO]`.

Item novo descoberto no meio de uma fase vira "trabalho futuro" na documentação, não código.

---

## 16. Resumo executivo

1. Camadas: `models → repositories → services → controllers → routes`, com `middlewares` transversal
2. **Factory Method obrigatório** (avaliação acadêmica)
3. `routes/routes.ts` é o único ponto de registro
4. 1 arquivo por model (type + DTO + entity)
5. kebab + role; **pastas de recurso no plural**
6. `EnvVar` + `EnvKeys`; `database/` isolada
7. Validação manual + `try/catch` (refatorar pós-MVP)
8. JWT desde o início; `requireRole` pra autorização; ownership no service
9. Nunca Prisma fora de repository; nunca tipo bruto na resposta
10. **Ler o schema antes de escrever model**
11. **Atualizar PRD/BACKLOG ao concluir**
12. Autonomia com checkpoints + relatório

---

_Documento vivo. Ao mudar uma regra eterna, avise o humano antes de editar aqui._
