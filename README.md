<!--
O QUE FAZ: apresenta o Vulnera, suas telas, funcionalidades e formas de execução.
POR QUE EXISTE: oferece uma entrada atualizada para avaliação do TCC e colaboração.
QUEM CONSOME: visitantes do repositório, banca, equipe e contribuidores.
-->

# Vulnera

**Gestão de vulnerabilidades, análises de segurança e remediação em uma plataforma multi-tenant.**

[![CI da main](https://github.com/guimunizzz/Vulnera-TCC/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/guimunizzz/Vulnera-TCC/actions/workflows/build.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![DAST](https://img.shields.io/badge/DAST-OWASP%20ZAP-F97316)

Projeto de TCC do curso Técnico em Desenvolvimento de Sistemas do SENAI, desenvolvido por **Rafael, Guilherme e Iann**. Empresas cadastram aplicações e solicitam projetos de análise; pentesters registram achados e evidências; clientes acompanham prioridades, prazos, responsáveis e relatórios.

O Vulnera reúne CVSS 3.1, contexto de risco, SLA, Vulnera Risk Score, aceite formal de risco, playbooks OWASP e scans DAST. A execução real usa um baseline passivo do ZAP com autorização explícita; seus resultados continuam sujeitos à revisão humana antes da promoção para uma vulnerabilidade do projeto.

**Estado deste README:** experiência integrada na `main` após a release de 06/10/2026. A stack descrita abaixo é destinada a desenvolvimento e demonstração local.

## Sumário

- [O problema e a solução](#o-problema-e-a-solução)
- [Funcionalidades](#funcionalidades)
- [Perfis e casos de uso](#perfis-e-casos-de-uso)
- [Screenshots](#screenshots)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Setup do zero](#setup-do-zero)
- [DAST: demonstração e execução real](#dast-demonstração-e-execução-real)
- [Demo guiada](#demo-guiada)
- [Qualidade e segurança](#qualidade-e-segurança)
- [Documentação técnica](#documentação-técnica)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Limitações conhecidas](#limitações-conhecidas)
- [Trabalho futuro](#trabalho-futuro)
- [Equipe](#equipe)

## O problema e a solução

Resultados de pentest distribuídos entre planilhas, e-mails e PDFs dificultam a priorização, o acompanhamento das correções e a preservação do histórico. O Vulnera centraliza esse processo: cada finding de projeto está vinculado a uma aplicação e uma empresa, com permissões por papel e trilha de auditoria.

O fluxo vai do cadastro da empresa à análise e à remediação. A severidade técnica vem do CVSS; o contexto da aplicação ajuda a priorizar o risco; políticas de SLA definem prazos; responsáveis, comentários, evidências e relatórios tornam o trabalho acompanhável.

## Funcionalidades

| Área | O que a plataforma oferece |
| --- | --- |
| Apresentação pública | Landing com introdução 3D, seções do produto, equipe e preview interativo com dados fictícios locais. |
| Identidade e acesso | Cadastro, login, JWT com access de 15 minutos e refresh rotativo de 7 dias, papéis e isolamento por empresa. |
| Empresas e planos | Onboarding, catálogo de planos e aprovação administrativa da assinatura. |
| Aplicações | Inventário por empresa, contexto de risco e criação administrativa com seleção explícita do cliente. |
| Projetos | Wizard de análise, seleção de aplicação elegível, nome e escopo, limites do plano, remediação opcional e atribuição de pentesters. |
| Findings | CVSS 3.1, severidade, estados, responsável, comentários, evidências e histórico de auditoria. |
| Busca global | Filtros, paginação, facetas, query wizard, buscas salvas e watchlists. |
| Priorização | Vulnera Risk Score explicável, combinando CVSS e contexto da aplicação. |
| SLA e risco | Prazos por severidade e aceite formal de risco com revisão, segregação de função e validade. |
| Remediação | Quadro operável por menu/teclado, responsáveis e catálogo OWASP Top 10 com origem e licença. |
| DAST | Demonstração sem tráfego ou baseline real autorizado, progresso, diagnóstico, triagem, promoção e comparação de resultados reais. |
| Dashboards e relatórios | Métricas por perfil/aplicação e PDFs Executivo/Técnico gerados no navegador. |
| Maturidade | Checklist por domínio, respostas de 1 a 5 e visualização por radar. |
| Mobile | Aplicativo Expo de consulta para CLIENT, com registro de token de push para findings críticos. |
| Experiência web | Temas claro/escuro, atmosfera compartilhada, layouts responsivos, cache e recuperação limitada de consultas transitórias. |

O preview da landing não acessa a API nem grava dados. Os planos apresentados nessa seção pública são conteúdo fixo; pagamento real e geração de achados por IA não fazem parte do MVP.

## Perfis e casos de uso

| Perfil | Casos de uso |
| --- | --- |
| Visitante | Conhecer a solução, explorar o preview, consultar a apresentação dos planos e criar acesso. |
| ADMIN | Aprovar assinaturas, escolher a empresa ao cadastrar aplicações, criar projetos, atribuir pentesters, acompanhar indicadores globais e executar DAST. |
| CLIENT | Cadastrar aplicações e solicitar análises da própria empresa, acompanhar findings, remediação e relatórios. Ações de aceite de risco respeitam a alçada OWNER. |
| PENTESTER | Trabalhar nos projetos aos quais está vinculado, registrar findings/evidências e executar/triá-los no DAST; não cria aplicações ou projetos. |
| CLIENT no mobile | Consultar projetos e findings da empresa e receber notificações quando o ambiente/aparelho estiver configurado. |

Na criação de Project, a empresa é derivada da Application. A assinatura deve estar `ACTIVE`; `PENDING`, `IN_PROGRESS` e `IN_REVIEW` consomem capacidade simultânea. Um projeto `COMPLETED` libera essa capacidade, mas a regra de um Project por Application permanece, inclusive após a conclusão. Remediação depende de `includesRemediation` no plano.

## Screenshots

Capturas versionadas da interface integrada em setembro/outubro de 2026. As telas autenticadas usam dados de demonstração ou fixtures de validação; nomes como `E2E20-*` identificam registros de teste.

### Landing e dashboards

| Landing pública | Dashboard administrativo — tema escuro |
| --- | --- |
| ![Landing pública atual do Vulnera](output/landing-merge-desktop.png) | ![Dashboard administrativo com dados de demonstração e tema escuro](output/visual-qa/dashboard-loaded-dark.png) |

| Dashboard administrativo — tema claro | Portfólio de projetos |
| --- | --- |
| ![Dashboard administrativo com tema claro](output/visual-qa/dashboard-loaded-light.png) | ![Portfólio com estados, listagem e ação Novo projeto](output/issue-20/issue20-projects-1440.png) |

### Criação de aplicações e projetos

| ADMIN seleciona a empresa da aplicação | Wizard de projeto: nome, nível e escopo |
| --- | --- |
| ![Modal de criação administrativa de aplicação com seleção de empresa](output/issue-19-desktop.png) | ![Etapa de dados do projeto com nome, nível, escopo e Cancelar](output/issue-20/issue20-wizard-passo-3-1440.png) |

### Interface em telas estreitas

| Landing — 375 px | Criação de aplicação — 375 px |
| --- | --- |
| <img src="output/landing-merge-mobile.png" width="280" alt="Landing pública em viewport de 375 pixels" /> | <img src="output/issue-19-mobile.png" width="280" alt="Criação administrativa de aplicação em viewport de 375 pixels" /> |

Outras evidências: [painel móvel carregado](output/page-loading-mobile.png), [elegibilidade de aplicações no wizard móvel](output/issue-20/issue20-wizard-aplicacao-375.png) e [matriz de QA do fluxo de projetos](output/issue-20-qa-report.md).

<details>
<summary>Capturas históricas do produto — preservadas do README anterior</summary>

Estas imagens registram as interfaces das fases anteriores. O login e os dashboards abaixo não representam o visual atual.

| Login anterior | Planos públicos |
| --- | --- |
| ![Login da fase anterior](docs/evidencias/screenshots/01-login.png) | ![Página pública de planos capturada em uma fase anterior](docs/evidencias/screenshots/02-plans.png) |

| Dashboard ADMIN anterior | Dashboard CLIENT anterior |
| --- | --- |
| ![Dashboard ADMIN histórico](docs/evidencias/screenshots/03-dashboard-admin.png) | ![Dashboard CLIENT histórico](docs/evidencias/screenshots/07-dashboard-client.png) |

| Projetos | Detalhe de projeto |
| --- | --- |
| ![Listagem histórica de projetos](docs/evidencias/screenshots/05-projects.png) | ![Detalhe histórico de projeto](docs/evidencias/screenshots/06-project-detail.png) |

| Avaliação de maturidade | Quadro de remediação |
| --- | --- |
| ![Checklist de maturidade e pontuações por domínio](docs/evidencias/screenshots/04-maturidade.png) | ![Quadro de remediação da entrega de setembro](docs/evidencias/exposure-remediation/screenshots/04-quadro-remediacao.png) |

Capturas feitas contra a stack local, com a base fictícia TechNova Solutions. O histórico e os roteiros estão em [DEMO.md](docs/DEMO.md) e nas [evidências de remediação](docs/evidencias/exposure-remediation/README.md).

</details>

## Stack

| Camada | Tecnologia |
| --- | --- |
| Backend | Node.js 22 nas imagens Docker, Express 5 e TypeScript; camadas e montagem por Factory Method. |
| Banco | MySQL 8 e Prisma ORM. |
| Web | React 18, Vite, TanStack Query, Zustand, Tailwind e design system próprio. |
| Movimento e visual | Motion, Three.js, React Three Fiber/Drei e GSAP, com carregamento lazy da landing/cena. |
| PDF | pdf-lib; relatórios montados no navegador. |
| DAST | OWASP ZAP em container por execução real, com runner e watchdog na API. |
| Mobile | Expo, React Native, Expo Router e Expo Notifications. |
| Autenticação | JWT HS256, refresh persistido como hash SHA-256 e senhas com bcrypt cost 12. |
| Infra local | Docker Compose: MySQL, API, Web e MailHog. |
| Testes | Jest/Supertest, Vitest/Testing Library/axe-core e Playwright. |
| CI | GitHub Actions: testes/cobertura da API e análise SonarQube em push/PR para `main`. |

As versões e os scripts detalhados estão nos manifestos de [API](app/api/package.json), [Web](app/web/package.json) e [Mobile](app/mobile/package.json).

## Arquitetura

```mermaid
flowchart TB
    Browser["Navegador: React / PDFs client-side"] --> Web["Web: localhost:8086"]
    Browser -->|HTTP + JWT| API["API: localhost:3001/api"]
    Mobile["Expo: CLIENT"] -->|HTTP + JWT| API
    API --> Routes["Routes + middlewares"]
    Factory["Factory Method"] -.-> Controller["Controllers"]
    Routes --> Controller
    Controller --> Service["Services: negócio e ownership"]
    Service --> Repo["Repositories"]
    Repo --> DB[("Prisma / MySQL 8")]
    API --> Uploads[("Volume de evidências")]
    API --> Reports[("Volume de relatórios DAST")]
    Service --> Watchdog["Fila / watchdog DAST"]
    Watchdog --> ZAP["Container ZAP: baseline passivo"]
    ZAP --> Target["Alvo autorizado: GET limitado"]
    API -.-> Push["Expo Push Service"]
    Push -.-> Mobile
```

Controllers adaptam HTTP; services aplicam regras de negócio e ownership; repositories concentram o acesso a dados dos recursos. As factories montam as dependências. O módulo DAST mantém scans separados do tenant até a promoção de um achado para um projeto autorizado.

## Setup do zero

### Pré-requisitos

- Git, Docker e Docker Compose.
- Node.js 22 para desenvolvimento local de API/Web, alinhado às imagens Docker.
- Para o mobile, o ambiente Expo e um aparelho/emulador compatível.

### Stack completa no Docker

```bash
git clone --branch main https://github.com/guimunizzz/Vulnera-TCC.git
cd Vulnera-TCC
docker compose up -d --build
docker compose ps
```

Aguarde MySQL e API ficarem saudáveis. A API aplica as migrations versionadas no boot. Em uma base local nova, prepare a demonstração e o catálogo:

```bash
docker compose exec api npm run db:seed
docker compose exec api npm run db:seed:playbooks
```

O catálogo OWASP vem de um snapshot versionado e não precisa de acesso à Internet para o seed. Os volumes preservam banco, evidências e relatórios entre reinícios da stack.

| Serviço | Endereço no host |
| --- | --- |
| Web — entrada do produto | [localhost:8086](http://localhost:8086) |
| API | [localhost:3001/api](http://localhost:3001/api) |
| Health da API | [localhost:3001/api/health](http://localhost:3001/api/health) |
| MySQL | `localhost:3307` |
| MailHog — infraestrutura local | [localhost:8025](http://localhost:8025) |

As credenciais da base fictícia estão em [DEMO.md](docs/DEMO.md). MailHog está disponível na stack; e-mail transacional não foi implementado.

**Configuração:** o Compose define o ambiente da API e usa a rede `vulnera-net`. O endereço `VITE_API_URL` entra no bundle Web durante o build; trocar esse endereço exige reconstruir a imagem. Editar apenas `app/api/.env` não substitui valores definidos pelo Compose.

### Desenvolvimento com hot reload

Na raiz, instale os workspaces API/Web e inicie somente a infraestrutura:

```bash
npm install
docker compose up -d db mailhog
```

Copie `app/api/.env.example` para `app/api/.env`. Para usar o MySQL do Compose, configure:

```dotenv
PORT=3001
DATABASE_URL=mysql://vulnera:vulnera@localhost:3307/vulnera
CORS_ORIGIN=http://localhost:3000
```

O exemplo versionado ainda usa `SERVER_PORT`; substitua essa chave por `PORT`, que é a chave lida pelo servidor. Mantenha as demais variáveis do exemplo e ajuste os segredos para seu ambiente.

**Terminal da API:**

```bash
cd app/api
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run db:seed:playbooks
npm run dev
```

**Terminal da Web:** copie `app/web/.env.example` para `app/web/.env`, confirmando `VITE_API_URL=http://localhost:3001/api`.

```bash
cd app/web
npm run dev
```

A Web de desenvolvimento abre em `http://localhost:3000`. Não execute API/Web locais e os serviços equivalentes do Compose disputando as mesmas portas.

**Terminal opcional do Mobile:** copie `app/mobile/.env.example` para `app/mobile/.env`. Em aparelho físico, use `EXPO_PUBLIC_API_URL=http://<IP-da-maquina-na-LAN>:3001/api`; no emulador Android, use `10.0.2.2` no lugar do IP.

```bash
cd app/mobile
npm install
npx expo start
```

Mobile não participa dos workspaces npm da raiz. As configurações de acesso por rede local estão comentadas em seu [.env.example](app/mobile/.env.example).

## DAST: demonstração e execução real

ADMIN e PENTESTER escolhem o modo ao criar o scan:

| Modo | Comportamento |
| --- | --- |
| Simulado | Gera dados fictícios identificados, sem Docker nem tráfego ao alvo. Promoção e comparação ficam bloqueadas; triagem permanece disponível. |
| Real | Exige segundo aviso e autorização explícita; executa GETs limitados e análise passiva, preservando resultados e falhas reais. |

O baseline real visita até **30 páginas**, com **profundidade 2**, na mesma origem/subárvore, sem queries, formulários, JavaScript, login ou active scan. O padrão operacional é um ZAP por vez, com **2 GiB e 2 CPUs**. Falha não é convertida em demonstração: o scan fica `FAILED` com diagnóstico.

O alvo precisa ser autorizado e alcançável pelo container. GET ainda gera tráfego e pode causar efeitos em sistemas mal projetados; o resultado passivo não substitui um pentest completo. `localhost` dentro do ZAP representa o próprio container. O Compose mantém alvos privados bloqueados por padrão.

Consumidores da API devem enviar `mode: "REAL" | "SIMULATED"` no `POST /api/dast/scans`; o modo Real também exige `confirmedRealScan: true`. `DAST_FORCE_SIMULATE=true` bloqueia execuções reais.

Operação, limites e evidências: [DAST.md](docs/DAST.md) e [validação de 28–29/09/2026](docs/DAST-VALIDACAO-2026-09-28.md). A stack usa o socket Docker do host para criar o ZAP e deve permanecer em ambiente local de avaliação.

## Demo guiada

O roteiro de aproximadamente dez minutos está em [docs/DEMO.md](docs/DEMO.md), com contas fictícias para ADMIN, CLIENT OWNER/MEMBER e PENTESTER.

Uma sequência de avaliação: conhecer a landing → registrar/onboardar empresa → aprovar assinatura → criar Application e Project → atribuir pentester → registrar finding/evidência → consultar VRS/SLA/playbook → acompanhar remediação → exportar relatório. O DAST pode ser demonstrado sem tráfego ou executado em um alvo controlado e autorizado.

## Qualidade e segurança

| Componente | Comando / mecanismo |
| --- | --- |
| API | `npm run check --workspace=app/api`: ESLint + Jest. `npm run build --workspace=app/api`: TypeScript. |
| Cobertura da API | `npm run test:coverage --workspace=app/api`. |
| Web | `npm run check --workspace=app/web`: ESLint + contraste + Vitest. `npm run build --workspace=app/web`: typecheck + Vite. |
| E2E | `npm run test:e2e --workspace=app/web`: Playwright contra uma stack configurada. O E2E DAST requer `E2E_DAST_TARGET_URL` explícito. |
| CI da main | MySQL de teste, migrations, cobertura da API e análise SonarQube. Não executa os gates Web, build Docker ou E2E. |

Os testes API usam `.env.test` e um banco separado `vulnera_test`; esse arquivo não é versionado. `cleanDatabase()` apaga registros do banco apontado, portanto nunca direcione essa configuração para a base da demonstração.

Os controles incluem canários `TEN-*` de isolamento, validação de CVSS, evidências por conteúdo/magic number, auditoria, sanitização de Markdown, CSP no `vite preview` e rate limiting por Token Bucket em camadas. O workflow executa o scanner SonarQube, mas não aguarda/verifica seu Quality Gate separadamente.

### Evidências de entregas

| Data / entrega | Resultado registrado | Fonte |
| --- | --- | --- |
| 30/09 — criação de Application | Web 257/257; API 588/588; smoke 44/44. | [Validação da Issue #19](output/issue-19-validation.md) |
| 01/10 — criação de Project | Web 297/297; API focal 24/24; smoke real 1/1. A suíte API completa registrou 598/601 e o grupo DAST passou 17/17 na repetição isolada. | [QA da Issue #20](output/issue-20-qa-report.md) |
| 01/10 — carregamento | Web 286/286; smoke de navegação 17/17 e recuperação real de HTTP 429. | [Validação de carregamento](output/page-loading-validation.md) |
| 28–29/09 — DAST | API focal 81/81; scan real concluído com 11 findings na validação de navegador; demonstração sem tráfego e falha sem fallback. | [Validação DAST](docs/DAST-VALIDACAO-2026-09-28.md) |

São snapshots históricos por entrega, não uma execução única atual ou números somáveis. O check global da API tem falha de lint documentada por dois imports não usados em `vulnerability.service.ts`; não se declara gate global verde. O badge do início consulta o workflow da `main`.

Também estão preservadas as [evidências ZAP de agosto](docs/evidencias/zap/README.md) e as [notas históricas de SonarQube](docs/evidencias/sonarqube/README.md). Algumas observações desses documentos foram substituídas pelas entregas posteriores, como a implementação da CSP.

## Documentação técnica

| Documento | Conteúdo |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Convenções de código, camadas, factories e protocolo de documentação viva. |
| [PRD_VIVO.md](PRD_VIVO.md) | Estado de implementação e histórico. |
| [BACKLOG.md](docs/BACKLOG.md) | Pendências, fases e limitações. |
| [ROADMAP_PROMPTS.md](docs/ROADMAP_PROMPTS.md) | Prompts e histórico de checkpoints. |
| [FRONTEND_WEB.md](docs/FRONTEND_WEB.md) | Layout compartilhado, movimento, temas e recuperação de navegação. |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, componentes e acessibilidade. |
| [FINDINGS_QUERY.md](docs/FINDINGS_QUERY.md) | Linguagem de busca global. |
| [EXPOSURE_REMEDIATION.md](docs/EXPOSURE_REMEDIATION.md) | SLA, VRS, aceite de risco, playbooks, buscas salvas e quadro. |
| [DAST.md](docs/DAST.md) | Operação vigente e histórico do módulo ZAP. |
| [RATE_LIMITING.md](docs/RATE_LIMITING.md) | Limites HTTP, configuração e carga. |
| [DECISIONS.md](docs/DECISIONS.md) | Decisões de projeto. |
| [ADRs](docs/Vulnera/07-Decisoes/) | Contexto, decisões arquiteturais e consequências. |
| [CLAUDE.md](CLAUDE.md) / [GOTCHA.md](GOTCHA.md) | Guias operacionais e armadilhas recorrentes. |

## Estrutura do repositório

```text
app/
├── api/        # Express, Prisma, MySQL, testes e runner DAST
├── web/        # React, landing, design system e E2E
└── mobile/     # Expo: consulta para CLIENT
docs/
├── DEMO.md
├── BACKLOG.md
├── ROADMAP_PROMPTS.md
├── EXPOSURE_REMEDIATION.md
├── DAST.md
├── evidencias/ # screenshots e relatórios de entregas
└── Vulnera/    # domínio, jornadas, ADRs e material acadêmico
output/        # evidências recentes e relatórios de validação
AGENTS.md      # guia de escrita e manutenção do projeto
PRD_VIVO.md    # memória viva de implementação
```

## Limitações conhecidas

| Limitação | Estado atual |
| --- | --- |
| Lint global da API | Dois imports não usados seguem registrados; resultados de testes não equivalem a `check` verde. |
| Concorrência de Project | Verificação de duplicidade e cota não é serializada com a criação; requests concorrentes podem violar RN05/`maxProjects`. |
| DAST | Baseline limitado, sem exploração ativa; DNS rebinding/egress por IP resolvido, retenção automática e fixação da imagem por digest permanecem pendentes. |
| Rate limiting | Implementado em memória para uma instância; não compartilha estado entre réplicas. |
| Builds | Lockfiles não são versionados e as imagens usam `npm install`; não há árvore de dependências travada. Aviso histórico de bundle grande permanece. |
| Sessão e rede | Falha de rede durante refresh pode deslogar; cache fresco pode aguardar 30 s para refletir alterações feitas por outra pessoa. |
| Evidências | A API não oferece exclusão de Evidence. |
| CSP | Política de scripts aplicada no preview/build servido pelo Docker, não no servidor de hot reload. |
| Push mobile | A validação física em aparelho permanece pendente na documentação. |
| SAST | Dois alertas HIGH sobre relatório HTML DAST e download de evidências seguem `needs_review`; exploração, falso positivo ou correção não são afirmados aqui. |

As credenciais locais e o socket Docker do Compose não constituem configuração de produção. A lista completa, com histórico e acompanhamento, está em [docs/BACKLOG.md](docs/BACKLOG.md).

## Trabalho futuro

- Exposure Graph / Cadeias de Exposição — CP-8 adiado.
- Garantias de concorrência para criação de projetos e limites do plano.
- Builds com lockfile, verificações completas de CI e observabilidade.
- Hardening e expansão de cobertura do DAST.
- Pagamento real, e-mail transacional e recuperação de senha.
- Chat em tempo real, tickets de suporte e i18n.
- Pesos de VRS configuráveis por empresa.

IA/Gemini foi retirada do escopo em 03/08/2026. Não há geração automática de findings por IA no MVP.

## Equipe

Fotos e funções utilizadas também na landing pública do projeto.

| Rafael | Guilherme | Iann |
| --- | --- | --- |
| <img src="app/web/src/assets/landing/team/rafael.jpg" width="150" alt="Foto de Rafael" /> | <img src="app/web/src/assets/landing/team/guilherme.jpg" width="150" alt="Foto de Guilherme" /> | <img src="app/web/src/assets/landing/team/iann.jpg" width="150" alt="Foto de Iann" /> |
| Tech Lead & Scrum Master | Back-end | Front-end |
| [LinkedIn](https://www.linkedin.com/in/rafael-augusto-barros-51a919233/) | [LinkedIn](https://www.linkedin.com/in/guilherme-muniz-claro/) | [LinkedIn](https://www.linkedin.com/in/iannarthur/) |

<details>
<summary>Contribuidores — registro histórico de agosto de 2026</summary>

Imagem preservada do README anterior; representa o registro daquele período.

<img width="1623" height="825" alt="Registro histórico dos contribuidores do Vulnera em agosto de 2026" src="https://github.com/user-attachments/assets/a2c3002f-edd4-4eaf-8ce3-53eabf4c66fb" />

</details>

*Vulnera — TCC de Rafael, Guilherme e Iann. Consulte [AGENTS.md](AGENTS.md) para contribuir e [PRD_VIVO.md](PRD_VIVO.md) para acompanhar a implementação.*
