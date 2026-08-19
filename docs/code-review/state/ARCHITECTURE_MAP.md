# Vulnera — Mapa da Arquitetura Implementada

## Escopo e baseline

- Código funcional auditado: `dev@49cac59122bc9d4e05e491339e1f4eb80aad838d`.
- Workspace de artefatos: branch `code-review`.
- Exclusões funcionais: `.agents/**`, `.codex/**`, `vulnera_codex_code_review_bootstrap/**` e `docs/code-review/**`.
- Método: inspeção estática e somente leitura. Docker, migrations, testes, browser, aparelho e integrações externas não foram executados.
- ZIP adicional: `NOT_VALIDATED`; nenhum `.zip` está acessível no baseline/workspace atual.

## Visão estrutural

O repositório é um monorepo npm workspaces com três aplicações:

| Aplicação | Stack observada | Entrada |
|---|---|---|
| API | Node, TypeScript, Express 5, Prisma, MySQL | `app/api/src/server.ts` |
| Web | React 18, Vite, React Router, TanStack Query, Zustand, Axios, Tailwind, Recharts, pdf-lib | `app/web/src/main.tsx` |
| Mobile | Expo/React Native, Expo Router, TanStack Query, Zustand, SecureStore, expo-notifications | `app/mobile/package.json` (`expo-router/entry`) |

O backend segue predominantemente `routes → controllers → services → repositories → Prisma/MySQL`, com montagem das dependências em factories. `app/api/src/app.ts` configura CORS/JSON e monta as rotas sob `/api`; não há middleware global de erros montado.

## Superfícies HTTP

- Públicas: `GET /api/health` e `POST /api/auth/{register,login,refresh,logout}`.
- Autenticadas: users, plans, companies, subscriptions, applications, projects, vulnerabilities, reports, notifications e maturity.
- Subrotas relevantes:
  - `/projects/:projectId/members`;
  - `/vulnerabilities/:vulnId/evidences`;
  - `/vulnerabilities/:vulnId/comments`;
  - `/applications/:id/metrics/{summary,timeseries,insights}`;
  - `/companies/me/metrics/comparison`.

## Domínios e persistência

- Identidade: `User`, `RefreshToken`, `PasswordResetToken`.
- Comercial/tenant: `Company`, `Plan`, `Subscription`.
- Análises: `Application`, `Project`, `ProjectMember`.
- Findings: `Vulnerability`, `Evidence`, `VulnerabilityComment`.
- Auditoria/analytics: `AuditLog` e agregações no `MetricsRepository`.
- Entregas complementares: `Report`, `Notification`, `MaturityDomain`, `MaturityControl`, `MaturityAssessment`, `MaturityScore`.

O schema usa MySQL, IDs `cuid()` e duas migrations versionadas. `Project` e `Vulnerability` mantêm chaves de Company/Application desnormalizadas. Evidence e Comment usam cascade a partir de Vulnerability. `MaturityAssessment.companyId`, `Notification.userId` e `Report.projectId/generatedBy` são escalares sem relações Prisma declaradas.

## Autenticação e autorização

- `authMiddleware` valida Bearer access token e injeta `req.user`.
- `requireRole` aplica apenas role; ownership fino fica nos services.
- Registro cria CLIENT; refresh é persistido como hash e rotacionado por revogação/novo par.
- Services de Application, Project, Vulnerability, Evidence, Maturity e Metrics contêm verificações por Company e/ou ProjectMember; a auditoria especializada deve comprovar cada caminho completo.
- Web armazena access/refresh no `localStorage` e serializa refresh concorrente por fila Axios.
- Mobile usa SecureStore e bloqueia ADMIN/PENTESTER no login.

## Integrações e entrega

- PDFs executivo/técnico são gerados no browser com `pdf-lib`; a API persiste metadados de Report.
- Upload usa Multer em memória, uma entrada e limite de 10 MB; detecção/validação/gravação ficam no service.
- Expo Push é a única integração externa funcional localizada. Falha de push é desenhada como não bloqueante para criação de finding.
- Não foram localizadas implementações funcionais de Gemini, SMTP/Nodemailer, WebSocket, filas, cron ou pagamento. Mailhog aparece somente no Compose.

## Infraestrutura e testes

- Compose: MySQL 8, API, web, Mailhog e volumes de DB/uploads.
- Docker da API aplica `prisma migrate deploy`; web usa `vite preview`.
- CI observado é backend-centric: lint/build, Prisma, migrations/testes MySQL e Sonar; web/mobile não são gates.
- Inventário estático: 22 arquivos de teste API, 4 web e nenhum teste mobile localizado.

## Limitações e sinais para auditoria

- Não há lockfile versionado, mas CI referencia `app/api/package-lock.json` e usa `npm ci`: risco de reprodutibilidade a confirmar estaticamente.
- `.env.example` da API declara `SERVER_PORT`, enquanto o código lê `PORT`.
- Sem runtime autorizado: execução do Compose, migrations aplicadas, testes, downloads/PDFs, persistência, desempenho, envio Expo, UI responsiva e aparelho físico permanecem `NOT_VALIDATED` salvo evidência pré-existente.

## Evidências estruturais principais

- `package.json:5` — workspaces.
- `app/api/src/server.ts:5`, `app/api/src/app.ts:7`, `app/api/src/routes/routes.ts:17` — bootstrap e rotas.
- `app/api/prisma/schema.prisma:48` — datasource MySQL; modelos a partir das linhas 50+.
- `app/api/src/middlewares/auth.middleware.ts:27`, `require-role.middleware.ts:16` — AuthN/role.
- `app/api/src/services/auth.service.ts:29` — registro/tokens/refresh.
- `app/web/src/App.tsx:23`, `app/web/src/lib/api/client.ts:46`, `app/web/src/store/auth.store.ts:22` — rotas e sessão web.
- `app/mobile/app/login.tsx:38`, `app/mobile/src/store/auth.store.ts:15` — escopo CLIENT/SecureStore.
- `.github/workflows/build.yml:15`, `docker-compose.yml:12` — CI e Compose.

