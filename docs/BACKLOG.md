# BACKLOG.md — Vulnera

> **v4 · 2026-08-03.** Substitui a versão por sprints com divisão por pessoa (Rafael/Guilherme/Iann). Agora é **fase e checkpoint**, execução solo-delegada.
> Estimativas em horas-equivalentes — servem para dimensionar risco e revisão, não para prever o tempo do agente.
> **Entrega: 25/10/2026.**

## Status

| Fase               | Escopo                                             | Estado         |
| ------------------ | -------------------------------------------------- | -------------- |
| 0 Refactor         | Alinhamento com CLAUDE.md                          | ✅             |
| 1 Fundação         | Infra, schema, CI, migrations, seed, testes        | ✅ backend     |
| 2 Auth + User      | JWT, refresh rotativo, CRUD, factories             | ✅ backend     |
| 3 Empresas         | Refactor plural + Subscription + bootstrap web     | ✅ concluída 2026-08-04 |
| 4 Projetos         | Application + Project + Member + telas             | ✅ concluída 2026-08-04 |
| **5 Findings**     | **Vulnerability + Evidence** ⭐                    | ✅ concluída 2026-08-05 |
| 6 Relatórios       | report-data + PDFs pdf-lib + dashboards            | ✅ concluída 2026-08-07 |
| **6.5 Design System** | **Tokens OKLCH, componentes próprios, temas, métricas, dashboards** | ✅ concluída 2026-08-09 |
| 7 Mobile           | Expo enxuto + Push                                 | ✅ concluída 2026-08-10 |
| 8 Maturidade + TCC | Checklist + demo + Sonar/ZAP + docs                | 🚧 CP1-3 concluídos 2026-08-11 (backend+frontend+seed) |

✅ **Frontend web bootstrapado na Fase 3** (2026-08-04) — `app/web` tem Vite+React+TS+Tailwind+Radix+TanStack Query+Zustand+Axios, com Login/Register/Dashboard/Plans/Onboarding/PendingSubscriptions funcionando ponta a ponta (smoke E2E manual validado no navegador). Próximas fases só adicionam telas, não infraestrutura.

Restante estimado: **~200h-equivalente** em 12 semanas.

---

## Cronograma

| Semanas | Período       | Fase                         |
| ------- | ------------- | ---------------------------- |
| 1–2     | 04/08 → 17/08 | 3 — Empresas + bootstrap web |
| 3–4     | 18/08 → 31/08 | 4 — Projetos                 |
| 5–7     | 01/09 → 21/09 | 5 — Findings ⭐              |
| 8–9     | 22/09 → 05/10 | 6 — Relatórios               |
| 10–11   | 06/10 → 15/10 | 7 — Mobile                   |
| 12      | 16/10 → 25/10 | 8 — Maturidade + fechamento  |

> **Sem buffer.** Válvula de escape: atraso acumulado > 1 semana até o fim da Fase 6 → a Fase 7 encolhe primeiro (mobile vira demo de telas com seed, sem push funcional).

---

## FASE 3 — Empresas + bootstrap web (~44h) — ✅ concluída em 2026-08-04

| #    | Task                                                            | h   | Estado |
| ---- | --------------------------------------------------------------- | --- | ------ |
| 3.0  | Auditoria: schema, completude de company/plan, `npm run check`  | 2   | ✅     |
| 3.1  | Refactor plural (`git mv` + imports + docs/architecture.md)     | 3   | ✅     |
| 3.2  | Completar schema com os models faltantes + migration            | 3   | ✅ não precisou — schema já tinha os 19 models |
| 3.3  | `require-role` middleware                                       | 1   | ✅     |
| 3.4  | AuditLog repository                                             | 2   | ✅     |
| 3.5  | Completar Plan (GET público, CUD admin, BASIC/PRO/Enterprise)   | 3   | ✅     |
| 3.6  | Completar Company + vínculo de owner                            | 4   | ✅     |
| 3.7  | Subscription + approve/reject + invariante 1-ACTIVE + auditoria | 7   | ✅     |
| 3.8  | Testes PLAN/COMP/SUB                                            | 5   | ✅     |
| 3.9  | Bootstrap web: Vite, Tailwind, Radix, TanStack, Zustand, Axios  | 5   | ✅     |
| 3.10 | UI base + client.ts com fila de refresh + auth store            | 5   | ✅     |
| 3.11 | Login, Register, ProtectedRoute, Dashboard stub                 | 4   | ✅     |
| 3.12 | Plans pública + Onboarding wizard + PendingSubscriptions        | 10  | ✅     |

## FASE 4 — Projetos (~33h) — ✅ concluída em 2026-08-04

| #   | Task                                                    | h   | Estado |
| --- | ------------------------------------------------------- | --- | ------ |
| 4.1 | Application CRUD + gate de limite do plano              | 7   | ✅     |
| 4.2 | Project CRUD + máquina de estados + `/transition`       | 7   | ✅     |
| 4.3 | ProjectMember subrota (gestão ADMIN, leitura ampliada)  | 5   | ✅ leitura ampliada pra CLIENT/PENTESTER-membro além de ADMIN — não estava no texto original, necessário pra ProjectDetail funcionar |
| 4.4 | Testes APP/PROJ + TEN-01..05                            | 7   | ✅ 20 testes novos, cobertura services 85-100% |
| 4.5 | Applications + wizard NewAnalysis                       | 8   | ✅     |
| 4.6 | ProjectDetail com abas + gestão de membros + breadcrumb | 6   | ✅     |

## FASE 5 — Findings ⭐ (~46h) — ✅ concluída em 2026-08-05

| #   | Task                                                              | h   | Estado |
| --- | ----------------------------------------------------------------- | --- | ------ |
| 5.1 | `cvss.util` — parser manual 3.1 + testes com vectors conhecidos   | 4   | ✅     |
| 5.2 | Vulnerability CRUD + transition + override justificado            | 9   | ✅ máquina simplificada de 4 estados (mesmo padrão do Project); DELETE ADMIN-only |
| 5.3 | Evidence multipart (MIME + magic number + UUID) + GET autenticado | 8   | ✅ Content-Type declarado é ignorado — magic number é a única fonte de verdade |
| 5.4 | VulnerabilityComment nested paginado                              | 4   | ✅ qualquer ator com acesso de leitura comenta, não só ADMIN/PENTESTER |
| 5.5 | AuditLog integrado (override + transition)                        | 3   | ✅ + CREATE (RN20) e SEVERITY_CHANGE em edição de vetor (RN21) |
| 5.6 | Testes BIZ-03..09 + TEN-06                                        | 8   | ✅ 24 testes novos (13 unit CVSS + 11 integração), 97/97 total |
| 5.7 | Lista de findings com filtros e badges                            | 4   | ✅ + contador de críticos abertos no header do projeto |
| 5.8 | FindingEditor (CVSS live, drag-drop, comentários, override)       | 10  | ✅ + FindingDetail read-only separado pro CLIENT |

## FASE 6 — Relatórios (~34h) — ✅ concluída em 2026-08-07

| #   | Task                                                 | h   | Estado |
| --- | ---------------------------------------------------- | --- | ------ |
| 6.1 | `GET /projects/:id/report-data` consolidado          | 5   | ✅ RN18 aplicada (Project precisa IN_REVIEW/COMPLETED, 422 PROJECT_NOT_READY_FOR_REPORT) |
| 6.2 | Report metadata + AuditLog                           | 2   | ✅ AuditLog REPORT_GENERATED; quem gera inclui CLIENT (PDF client-side: gerar = baixar) |
| 6.3 | Testes RPT-01..03                                    | 3   | ✅ 9 testes de report (+1 subscription/active), 107/107 total |
| 6.4 | `lib/pdf/base.ts` — helpers, gráfico de barras à mão | 6   | ✅ + `sanitizeForFont` (achado no smoke: WinAnsi não cobre emoji/setas) |
| 6.5 | PDF Executivo                                        | 6   | ✅ capa + sumário + KPIs + gráfico + top 5 riscos + maturidade placeholder + conclusão |
| 6.6 | PDF Técnico (com evidências embutidas)               | 7   | ✅ embedPng/embedJpg + comentários + glossário |
| 6.7 | Dashboards cliente / pentester / admin               | 5   | ✅ + `GET /subscriptions/active` (novo, admin-only) pro KPI "empresas ativas" |

> ⚠️ **pdf-lib é imperativo.** Sem componentes React: cria-se o documento e desenha-se por coordenada. Gráficos são retângulos e linhas desenhados à mão. Reservar tempo de aprendizado na 6.4.

## FASE 6.5 — Design System + Dashboards analíticos (~50h) — ✅ concluída em 2026-08-09

| #    | Task                                                          | h  | Estado |
| ---- | ------------------------------------------------------------- | -- | ------ |
| 6.5.1 | Tokens OKLCH (7 rampas × 11 passos) + escalas + 3 temas       | 8  | ✅ primitivo × semântico imposto por build: `bg-iris-500` não compila |
| 6.5.2 | `check-contrast.mjs` + calibragem WCAG dos dois temas         | 5  | ✅ 66 pares, 0 falhas; pegou 4 reprovações e 15 cores fora do gamut |
| 6.5.3 | `/styleguide` com os dois temas lado a lado                   | 3  | ✅ só em dev (`import.meta.env.DEV`) |
| 6.5.4 | ~30 componentes próprios + remoção do Radix                   | 14 | ✅ ADR-023; `react-select` era dependência morta |
| 6.5.5 | Contrato de acessibilidade documentado e testado              | 5  | ✅ A11Y-01..14 + axe-core; achou bug no `offsetParent` |
| 6.5.6 | Camada de movimento (`motion`) + `prefers-reduced-motion`     | 4  | ✅ hook central, 8 padrões |
| 6.5.7 | Backend de métricas: 4 endpoints, agregação no banco          | 8  | ✅ ADR-025; sem migration |
| 6.5.8 | Testes MET-01..18 + TEN-14..17 + desempenho com 500 findings  | 5  | ✅ 225 → 247; 9–17 ms por endpoint |
| 6.5.9 | Dashboard de 4 abas + 5 gráficos tematizados                  | 8  | ✅ estado vazio desenhado, skeleton com a forma final, tooltip absoluto+relativo |
| 6.5.10 | Filtros na URL + filtragem cruzada + chips                   | 5  | ✅ `useSearchParams` como fonte única; URL vence localStorage |
| 6.5.11 | Migração das telas para os tokens                            | 6  | 🚧 tokens e componentes em todas as 13; **falta polimento de skeleton/vazio/erro** nas telas que só receberam a migração mecânica |
| 6.5.12 | `seed-demo.ts` (90 findings em 90 dias)                      | 3  | ✅ semente fixa, idempotente, `--volume=500` |
| 6.5.13 | Validação visual no navegador real                           | 3  | ❌ **bloqueada** — extensão do Chrome não conectou |
| 6.5.14 | ADRs 022-025 + `docs/DESIGN_SYSTEM.md`                       | 4  | ✅ ADR-024 reverte o corte de "toggle de tema" |

## FASE 7 — Mobile enxuto (~24h) — ✅ concluída em 2026-08-10

| #   | Task                                                     | h   | Estado |
| --- | -------------------------------------------------------- | --- | ------ |
| 7.1 | Bootstrap Expo + Router + client com SecureStore         | 6   | ✅ Expo SDK 57 + expo-router + tema portado de `tokens.css` (OKLCH→hex convertido, ver histórico) |
| 7.2 | Login + Home + ProjectDetail                             | 7   | ✅ + bloqueio explícito de ADMIN/PENTESTER no login (mobile é exclusivo do CLIENT) |
| 7.3 | FindingDetail read-only + Configurações                  | 5   | ✅ evidências em carrossel com header autenticado; Configurações com status de push + logout |
| 7.4 | Push: migration + endpoint + registro + trigger CRITICAL | 6   | ✅ diff da migration mostrado e só aplicado após confirmação explícita do Rafael |

> Escopo deliberadamente cortado: sem criação/edição, sem upload, sem PDF, sem telas de admin ou pentester. Se estourar o prazo, corte mais do mobile — nunca do backend.
>
> **Deviations conscientes do `docs/DESIGN_SYSTEM.md` §8** ("o que portar pra Fase 7"): motion/`prefers-reduced-motion` e fontes customizadas (Archivo/JetBrains Mono via `expo-font`) NÃO foram portados — fora do escopo enxuto pedido no prompt da fase (o app usa a fonte padrão do sistema e não tem nenhuma transição animada). Cor, escala tipográfica/espaçamento/raio e vocabulário `-ink`/`-surface` foram portados à risca. Contrato de acessibilidade: pass básico feito (`accessibilityRole`/`accessibilityLabel`/`accessibilityState` nos componentes interativos principais — Button, Card), mas não tem o mesmo rigor da Fase 6.5 (sem teste automatizado de a11y no mobile, sem auditoria completa) — trabalho futuro se o mobile ganhar mais telas.

## FASE 8 — Maturidade + TCC (~32h)

| #   | Task                                                            | h   | Estado |
| --- | --------------------------------------------------------------- | --- | ------ |
| 8.1 | Seed de domínios e perguntas do checklist                       | 3   | ✅ 7 domínios × 4 perguntas, upsert |
| 8.2 | MaturityAssessment CRUD + scores em batch                       | 5   | ✅ RN19; 10 testes MAT-01..03; achou/corrigiu bug em `cleanDatabase()` (faltava `maturityAssessment`) |
| 8.3 | Tela de avaliação + radar                                       | 6   | ✅ `maturity-assessment-page.tsx` + `MaturityRadar` (Recharts); entrada nos 3 dashboards |
| 8.4 | Maturidade no PDF executivo (radar à mão com pdf-lib)           | 3   | ✅ `drawRadarChart` novo (coordenada de `drawSvgPath` validada em smoke isolado antes); `report.service.ts` parou de devolver `maturity: null` fixo |
| 8.5 | Seed demo TechNova (5 apps, 10 findings, maturidade preenchida) | 4   | ✅ 2C/3H/3M/2L exato, 2 evidências, 4 comentários, 1 avaliação (28 respostas); idempotente, contagens conferidas |
| 8.6 | SonarQube (pipeline) + ZAP baseline — evidências capturadas     | 3   | 📋     |
| 8.7 | `docs/DEMO.md` + README + diagrama + limitações conhecidas (base pronta: ver "Limitações conhecidas — Fase 5" no fim deste arquivo) | 5   | 📋     |
| 8.9 | (descoberta 2026-08-07) Rota DELETE de Evidence — hoje não existe (L-05) | 1 | 📋 |
| 8.10 | (descoberta 2026-08-07) Rate limiting em upload e login (L-07)  | 2   | 📋     |
| 8.11 | (descoberta 2026-08-07) PDF Executivo: título longo sobrepõe o texto de CVSS/OWASP no "Top 5 riscos" (`lib/pdf/executive.ts`) | 1 | 📋 |
| 8.8 | Smoke E2E cronometrado + tag `v1.0.0`                           | 3   | 📋     |

> Slides e ensaios ficam com o Rafael, fora da contagem.
> **Maturidade simplificada:** checklist de perguntas por domínio, escala 1–5, média simples. Sem scoring ponderado, sem níveis por domínio, sem comparativo histórico.

---

## Removido do escopo

| Removido                                                       | Quando     | Motivo                                      |
| -------------------------------------------------------------- | ---------- | ------------------------------------------- |
| IA / Gemini (sugestão de finding, rate limit, botão no editor) | 2026-08-03 | Corte de prazo; não é o que a banca avalia  |
| Chat em tempo real (Socket.IO)                                 | 2026-07-26 | `VulnerabilityComment` cobre a comunicação  |
| Tickets de suporte                                             | 2026-07-26 | Escopo administrativo sem valor de demo     |
| E-mail transacional (Nodemailer/Mailhog)                       | 2026-07-26 | `AuditLog` cobre a rastreabilidade          |
| Prometheus + Grafana                                           | 2026-07-26 | Observabilidade não é critério de avaliação |
| Testes E2E (Playwright)                                        | 2026-07-26 | Integração + smoke manual cobrem            |
| Viewer de PDF no mobile                                        | 2026-08-03 | Corte do escopo mobile                      |
| Maturidade completa estilo SAMM                                | 2026-08-03 | Vira checklist simples                      |
| Varredura antivírus/malware no upload de Evidence               | 2026-08-05 | Validação é de tipo (magic number) e tamanho, não de conteúdo malicioso — limitação conhecida, documentar no README/DEMO |

Tudo isso entra como **trabalho futuro** no README — e a redução consciente de escopo sob restrição de prazo é material de defesa na banca.

---

## Limitações conhecidas — Fase 5 (Vulnerability + Evidence)

> L-01..L-08 levantadas na sessão de endurecimento de **2026-08-07**; L-09..L-11 na Fase 6.5, em **2026-08-09**.
> Contexto original: Todas foram
> **encontradas, avaliadas e conscientemente não corrigidas** — cada uma tem o
> motivo registrado. Material direto para a seção de limitações do README/DEMO
> (task 8.7) e para a defesa na banca: saber onde o sistema não protege vale
> mais que fingir que protege em tudo.

| # | Limitação | Por que não foi corrigida | Mitigação existente |
| --- | --- | --- | --- |
| L-01 | **Sem varredura antivírus/malware no upload.** A validação é de tipo e tamanho, não de conteúdo. | Exigiria integrar engine de AV — fora do escopo do MVP (já registrado em "Removido do escopo" em 2026-08-05). | Tipo restrito a 4 formatos por magic number; nome reescrito com UUID; nada é executado no servidor. |
| L-02 | **Polyglot é aceito.** Arquivo com header PNG/JPEG/PDF válido seguido de payload arbitrário passa na validação. | Bloquear exigiria parse completo de cada formato. A assinatura prova como o arquivo se apresenta, não que o resto seja inofensivo. | Nome UUID (nunca executável pelo nome), extensão derivada do tipo **detectado**, download sempre `attachment` + `nosniff`, nenhum caminho de código que interprete o conteúdo. Comportamento coberto por teste (SEC-EV-07). |
| L-03 | **PDF com bytes antes do `%PDF` é recusado.** A spec do PDF tolera até 1024 bytes de lixo antes do header; exigimos offset 0. | Falso-negativo **preferido de propósito**: aceitar assinatura em offset arbitrário é justamente o que facilita polyglot (L-02). | PDFs de ferramentas normais começam em offset 0. Coberto por teste que documenta a escolha. |
| L-04 | **Acesso negado responde 403, não 404.** Um atacante com um ID válido de outra company aprende que o recurso existe. | O `CLAUDE.md` §9 define `FORBIDDEN`→403 como padrão do projeto, e as Fases 3/4 já usam 403 em TEN-01..06. Mudar só a Fase 5 criaria inconsistência; mudar tudo quebraria contrato já mergeado. | IDs são `cuid()`, não enumeráveis por força bruta — o ganho do 404 é marginal. Isolamento em si é total e provado por TEN-07..13. |
| L-05 | **Não há rota de DELETE para Evidence.** Uma evidência anexada por engano não pode ser removida pela API. | Criar a rota é **feature nova**, fora do escopo de uma sessão de endurecimento. | Anexar evidência errada exige refazer o finding ou remoção manual no banco. **Candidata a task da Fase 8.** |
| L-06 | **`text/plain` aceita qualquer texto UTF-8**, inclusive HTML, SVG, JS ou script shell renomeados para `.txt`. | Texto não tem assinatura binária própria; distinguir "texto de log" de "texto que é código" exigiria heurística frágil e cheia de falso-positivo. | Servido sempre como `attachment` + `nosniff` + `Content-Type: text/plain` — o navegador não renderiza. Bytes de controle são recusados desde 2026-08-07. |
| L-07 | **Sem rate limiting em nenhuma rota**, inclusive upload e login. | Fora do escopo do MVP; exigiria middleware novo e decisão sobre store (memória × Redis, e Redis está fora do escopo). | Limites de tamanho e de partes no multipart reduzem o custo por requisição. **Candidata a task da Fase 8.** |
| L-09 | **A paridade de acessibilidade foi provada em jsdom, não em leitor de tela real.** NVDA e VoiceOver não foram testados. | Exigiria máquina com leitor de tela instalado e um protocolo de teste manual — fora do que uma sessão automatizada alcança. | 14 testes cobrindo role/ARIA/teclado/foco item a item do contrato, mais `axe-core` sem violações. O que NÃO se prova é a experiência de escuta: ordem de anúncio, verbosidade, se o texto faz sentido em voz alta. **Candidata a task da Fase 8.** |
| L-10 | **A validação visual no navegador real não foi feita na Fase 6.5.** Aparência, responsividade em 375/768/1440 e console limpo não foram conferidos. | A extensão do Chrome não conectou na sessão (mesmo bloqueio da Fase 6). | Build e tipos limpos; 24 testes de frontend em jsdom; contraste medido matematicamente. **Pendente para o Rafael** — os 10 itens estão no bloqueio de 2026-08-09 do `PRD_VIVO.md`. |
| L-11 | **O risk score da SÉRIE TEMPORAL é aproximado**, diferente do valor exato do `summary`. | Reconstruir o CVSS de cada finding aberto em cada período passado exigiria tabela de snapshot, que o ADR-025 evitou de propósito. | Serve para ver TENDÊNCIA, que é a função da linha. Está comentado no código, dito no ADR-025 e visível na interface. O `summary` — o número que a pessoa lê — é exato. |
| L-08 | **Uploads ficam em disco local**, não em storage externo com versionamento. | Decisão de infraestrutura do MVP (`UPLOADS_DIR` + volume Docker). | Volume nomeado sobrevive a `docker compose down`; caminho sempre contido sob `UPLOADS_ROOT`. |

---

## Regras

- ✅ marcado pelo agente ao concluir (CLAUDE.md §0.1 R2)
- Consolidar ou dividir task = editar a linha, nunca duplicar
- Task descoberta no meio de uma fase → adicionar com `(descoberta)` na descrição
- JIRA sincronizado manualmente ao fim de cada fase, com as KANs listadas no relatório do agente
