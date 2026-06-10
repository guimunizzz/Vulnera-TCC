# REFACTOR_PLAN.md — Plano de refactor do código atual

> **Objetivo:** alinhar o repositório existente com o `CLAUDE.md` v2.
> **Estimativa:** 4-6 horas de trabalho (Rafael) — fazer em uma sessão.
> **Quando fazer:** ANTES de começar a Sprint 1. Branch dedicada: `refactor/align-claude-md`.

---

## Estado atual (auditado)

```
app/api/src/
├── config/
│   ├── enum/EnvKeys.ts          ✅ ok
│   └── EnvVar.ts                ✅ ok
├── controller/
│   └── user.controller.ts       ⚠️ existe mas Auth ainda não foi implementada — revisar
├── database/
│   └── prisma.database.ts       ✅ ok
├── model/
│   ├── company.model.ts         ⚠️ confirmar se tem type+dto+entity
│   └── plan.model.ts            ⚠️ confirmar se tem type+dto+entity
├── repository/
│   ├── company.repository.ts    ✅ existe (revisar conformidade)
│   └── plan.repository.ts       ✅ existe (revisar conformidade)
├── routes/
│   └── user.routes.ts           ⚠️ tem rota mas não tem routes.ts central
├── service/
│   ├── company.service.ts       ✅ existe (revisar conformidade)
│   └── plan.service.ts          ✅ existe (revisar conformidade)
└── server.ts                    ⚠️ revisar se monta routes.ts central
```

**Pastas que faltam:** `factory/`, `middleware/`, `utils/`, `tests/`.

---

## Tarefas de refactor (em ordem)

### R1 — Criar pastas que faltam

```bash
cd app/api/src
mkdir -p factory middleware utils
cd ..
mkdir -p tests/integration tests/fixtures
```

✅ Critério: pastas existem com pelo menos um `.gitkeep` ou já com arquivo dentro.

---

### R2 — Auditar e corrigir `model/*.model.ts`

Para `plan.model.ts` e `company.model.ts`, **abrir e verificar** se contêm:

- `export type Plan = PrismaPlan` (re-export do Prisma)
- `export type CreatePlanDTO`, `UpdatePlanDTO`, `PlanResponseDTO`
- `export class PlanEntity` com `toResponse()`

**Se faltar alguma seção, complementar** seguindo o padrão do §5.1 do `CLAUDE.md`.

⚠️ **Não criar arquivos separados.** Tudo num arquivo só.

---

### R3 — Criar factories pros recursos existentes

Pra cada recurso que já tem service + repository, criar a factory:

```typescript
// factory/plan.factory.ts
import { prisma } from "../database/prisma.database";
import { PlanRepository } from "../repository/plan.repository";
import { PlanService } from "../service/plan.service";
import { PlanController } from "../controller/plan.controller"; // criar se não existir

export function makePlanController(): PlanController {
  const repository = new PlanRepository(prisma);
  const service = new PlanService(repository);
  const controller = new PlanController(service);
  return controller;
}
```

**Criar:** `plan.factory.ts`, `company.factory.ts`.
**Importante:** se `plan.controller.ts` não existe, criar agora seguindo §5.4 do `CLAUDE.md`.

---

### R4 — Criar `routes/routes.ts` (centralizador)

```typescript
// routes/routes.ts
import { Router } from "express";
// import { userRoutes } from "./user.routes";  // descomentar quando estiver pronto
// import { planRoutes } from "./plan.routes";
// import { companyRoutes } from "./company.routes";

const router = Router();

// router.use("/users", userRoutes);
// router.use("/plans", planRoutes);
// router.use("/companies", companyRoutes);

export { router as apiRoutes };
```

Conforme criar `<recurso>.routes.ts` (R6), descomenta as linhas correspondentes.

---

### R5 — Refatorar `server.ts` pra usar `routes.ts`

**Antes (provável):**

```typescript
import { userRoutes } from "./routes/user.routes";
app.use("/api/users", userRoutes);
```

**Depois:**

```typescript
import { apiRoutes } from "./routes/routes";
app.use("/api", apiRoutes);

export { app }; // adicionar export pra teste com Supertest
```

---

### R6 — Reescrever `routes/user.routes.ts` pra usar factory

**Antes (provável):**

```typescript
const router = Router();
router.get("/", async (req, res) => {
  /* lógica inline */
});
```

**Depois:**

```typescript
import { Router } from "express";
import { makeUserController } from "../factory/user.factory";
// import { authMiddleware } from "../middleware/auth.middleware";  // quando criar

const router = Router();
const controller = makeUserController();

// router.use(authMiddleware);  // quando authMiddleware existir

router.get("/", (req, res) => controller.list(req, res));
router.get("/:id", (req, res) => controller.getById(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export { router as userRoutes };
```

---

### R7 — Criar `plan.routes.ts` e `company.routes.ts` (se ainda não existem)

Mesmo padrão de R6, adaptado pro recurso.

---

### R8 — Garantir conformidade dos Services existentes

Abrir `plan.service.ts` e `company.service.ts`, verificar:

- [ ] Não importa `@prisma/client` direto
- [ ] Não importa `Request`/`Response` do Express
- [ ] Construtor recebe Repository por injeção
- [ ] Métodos lançam `throw new Error("CODE_IN_SNAKE")` (sem mensagem humana)
- [ ] Métodos devolvem `Entity` ou `Entity[]` (não objeto raw)

Se algo divergir, corrigir.

---

### R9 — Garantir conformidade dos Repositories existentes

Abrir `plan.repository.ts` e `company.repository.ts`:

- [ ] Construtor recebe `prisma: PrismaClient`
- [ ] Não tem lógica de negócio
- [ ] Não lança erro HTTP
- [ ] Métodos retornam tipos brutos do Prisma (`Plan`, `Company`)
- [ ] `findById` retorna `Promise<Plan | null>` (pode ser null)

---

### R10 — Adicionar scripts em `package.json`

```jsonc
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "db:reset": "prisma migrate reset --force",
    "db:seed": "tsx prisma/seed.ts",
    "check": "npm run lint && npm run test",
  },
}
```

**Instalar deps:**

```bash
npm i -D jest @types/jest ts-jest supertest @types/supertest eslint
```

---

### R11 — Substituir `schema.prisma` pelo revisado

O `schema.prisma` revisado (em `/mnt/user-data/outputs/schema.prisma`) tem:

- Plan com `maxProjects` e `includesRemediation`
- Vulnerability + Evidence + VulnerabilityComment + AuditLog (Sprint 5)
- MaturityDomain, MaturityControl, etc. (Sprint 8)
- Notification, Report (Sprint 6-7)

**Comandos:**

```bash
cp /caminho/do/schema-revisado.prisma app/api/prisma/schema.prisma
npx prisma migrate dev --name align_schema_with_prd
```

⚠️ **Atenção:** se o banco já tem dados, vai pedir `reset`. Em ambiente local de TCC, ok.

---

### R12 — Adicionar arquivos de config

**`.env.example`** (na raiz de `app/api/`):

```
PORT=3000
DATABASE_URL="mysql://vulnera:vulnera@localhost:3306/vulnera"
JWT_SECRET="dev-secret-trocar"
JWT_REFRESH_SECRET="dev-refresh-secret-trocar"
NODE_ENV=development
```

**`.env.test`** (mesmo lugar, ignorado pelo git):

```
DATABASE_URL="mysql://vulnera:vulnera@localhost:3306/vulnera_test"
JWT_SECRET="test-secret"
JWT_REFRESH_SECRET="test-refresh-secret"
NODE_ENV=test
PORT=3001
```

---

### R13 — Criar `docker-compose.yml` na raiz do repo

```yaml
services:
  db:
    image: mysql:8
    container_name: vulnera-db
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: vulnera
      MYSQL_USER: vulnera
      MYSQL_PASSWORD: vulnera
    ports:
      - "3306:3306"
    volumes:
      - vulnera-db-data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 5s
      timeout: 5s
      retries: 10

  mailhog:
    image: mailhog/mailhog:v1.0.1
    container_name: vulnera-mail
    ports:
      - "1025:1025"
      - "8025:8025"

  sonarqube:
    image: sonarqube:10-community
    container_name: vulnera-sonar
    ports:
      - "9000:9000"
    environment:
      SONAR_ES_BOOTSTRAP_CHECKS_DISABLE: "true"
    volumes:
      - vulnera-sonar-data:/opt/sonarqube/data
      - vulnera-sonar-ext:/opt/sonarqube/extensions

volumes:
  vulnera-db-data:
  vulnera-sonar-data:
  vulnera-sonar-ext:
```

---

### R14 — Garantir CI atualizado

Abrir `.github/workflows/build.yml` e validar/atualizar pra rodar:

- `npm ci`
- `npm run lint`
- `npm run build`
- `npm run test`

(Detalhe dos jobs no `ROADMAP_PROMPTS.md`, sprint 1.)

---

## Checklist final do refactor

Antes de mergear `refactor/align-claude-md` em `develop`:

- [ ] `npm run lint` passa
- [ ] `npm run build` passa
- [ ] `npm run dev` sobe a API sem erros
- [ ] `curl http://localhost:3000/api/plans` responde (mesmo se vazio)
- [ ] Estrutura de pastas bate com §2 do `CLAUDE.md`
- [ ] Nenhum `import { prisma }` fora de `repository/`
- [ ] Pelo menos uma factory criada (`plan.factory.ts`)
- [ ] `routes/routes.ts` existe e é importado pelo `server.ts`

---

## Após o refactor

1. Commit: `refactor: align project structure with CLAUDE.md v2`
2. Abrir PR pra `develop`
3. Self-review honesto (você é o único reviewer)
4. Merge
5. Tag `v0.1-foundation`
6. Começar Sprint 1 conforme `ROADMAP_PROMPTS.md`

---

_Este arquivo pode ser deletado depois do refactor concluído._
