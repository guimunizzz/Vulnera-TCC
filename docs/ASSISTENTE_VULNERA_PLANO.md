<!-- Registra a investigação, os limites e os critérios de aceite do Assistente Vulnera; existe para orientar a implementação por fases e ser revisado pelos mantenedores e pela banca. -->

# Assistente Vulnera — plano e investigação

**Data:** 2026-10-23 · **Branch:** `feature/agent-ai` · **Base:** `44f9c58`.
**Estado deste registro histórico:** Fase 0 concluída; Fases 1–6 ainda pendentes naquele checkpoint. O restante deste documento preserva a investigação e a solução planejada.

**Continuação em 23/10/2026:** o usuário autorizou executar todas as fases sem pausa. Fases 1–6 entregues, completando 7/7 fases; implementação e orientação local verificadas e aplicadas em `http://localhost:8086`. Gemini ao vivo permanece pendente de chave/modelo. O estado atual e o guia estão em [ASSISTENTE_VULNERA.md](ASSISTENTE_VULNERA.md) e [VALIDACAO.md](../output/assistant/VALIDACAO.md); os resultados abaixo referem-se ao checkpoint inicial.

## Escopo confirmado

Assistente de orientação em PT-BR nas rotas protegidas da web, com mascote SVG/CSS pequeno, movimento suave, painel estável e atalhos acionados pelo usuário. Contexto externo restrito à pergunta, histórico curto, identificador conhecido de tela, perfil autenticado e ajuda versionada. Sem leitura de registros de negócio pelo assistente, escrita de dados, geração de findings, cálculo de severidade, scans ou integração mobile.

A solicitação de 23/10/2026 reintroduz IA somente nesse escopo. O corte de 03/08/2026 permanece como histórico; a geração de findings continua excluída. A decisão está no [ADR-048](<Vulnera/07-Decisoes/ADR-048 - Assistente contextual com Gemini e ajuda local.md>). `AGENTS.md`, `CLAUDE.md` e `GOTCHA.md` foram lidos e permanecem preservados; a autorização específica do pedido atual delimita esta exceção de escopo.

## Evidências do checkout

- API Express/TypeScript/Prisma/MySQL confirmada. `app/api/src/app.ts` exporta `createApp()` e `app` sem `listen`; o centralizador é `src/routes/routes.ts`. Controllers continuam montados por factories.
- Web React/Vite/TypeScript, Tailwind, Zustand, TanStack Query e Motion confirmados em `app/web/package.json`. Rotas em `src/App.tsx`, layout em `components/layout/app-layout.tsx`, sessão em `store/auth.store.ts`, Axios em `lib/api/client.ts`.
- Autenticação da API fornece `{ userId, role }`, com ADMIN/CLIENT/PENTESTER. Não fornece `companyRole`; explicações sobre OWNER/MEMBER serão condicionais, sem aceitar esse atributo do navegador como autorização nem buscar registros para compor o prompt.
- Há rate limiter compartilhado por aplicação em `app.locals.rateLimitService`, configurado em `config/rate-limit.config.ts`, com store em memória. O middleware de endpoint atual aceita apenas escopos por usuário; o assistente exigirá também orçamento global próprio.
- `EnvKeys` e `EnvVar.getOptional` existem. Não há integração Gemini nem variáveis do assistente no código atual. `Vulnerability.aiAssisted` é legado e não será alterado.
- Node 22 na imagem da API suporta `fetch`. `services/owasp-sync.service.ts` já demonstra host fixo, `AbortController`, timeout e limpeza do timer.
- Git começou com mudanças locais somente em `PRD_VIVO.md` e `docs/BACKLOG.md`, relativas ao mobile de 21/10. Serão preservadas integralmente. Nenhuma troca/renomeação de branch, commit, push ou PR faz parte deste checkpoint.

## Mapa de telas e perfis

Os perfis abaixo são os guards de navegação. Acesso a cada registro continua sujeito às verificações de empresa, vínculo e ownership no backend.

| Rotas atuais | Perfis admitidos | Contexto normalizado planejado |
| --- | --- | --- |
| `/dashboard` | ADMIN, CLIENT, PENTESTER | `dashboard` |
| `/projects`, `/projects/:id` | ADMIN, CLIENT, PENTESTER | `projects`, `project-detail` |
| `/applications`, `/applications/:id/dashboard` | ADMIN, CLIENT | `applications`, `application-dashboard` |
| `/new-analysis` | ADMIN, CLIENT | `new-analysis` |
| `/findings` | ADMIN, PENTESTER | `findings` |
| `/findings/:id` | ADMIN, CLIENT, PENTESTER | `finding-detail` |
| `/projects/:projectId/findings/new`, `/findings/:id/edit` | ADMIN, PENTESTER | `finding-editor` |
| `/dast`, `/dast/scans/:id`, `/dast/scans/:id/report` | ADMIN, PENTESTER | `dast`, `dast-detail`, `dast-report` |
| `/remediation` | ADMIN, PENTESTER | `remediation` |
| `/playbooks`, `/playbooks/:id` | ADMIN, CLIENT, PENTESTER | `playbooks`, `playbook-detail` |
| `/settings/sla` | ADMIN, CLIENT | `sla-settings` |
| `/companies/:companyId/maturity` | ADMIN, CLIENT, PENTESTER | `maturity` |
| `/admin/subscriptions` | ADMIN | `subscriptions` |
| `/onboarding` | ADMIN, CLIENT, PENTESTER pelo guard atual | `onboarding` |
| `/`, `/login`, `/register`, `/plans`, `/styleguide` em desenvolvimento | Públicas, mesmo quando houver sessão | Assistente ausente |

`/onboarding` e o relatório DAST estão fora do `AppLayout`. A integração será um `AuthenticatedLayout` com `Outlet` sob o `ProtectedRoute` raiz, envolvendo tanto o `AppLayout` quanto essas duas telas. Uma única instância ficará fora de `TransicaoDeRota`, preservando a conversa entre telas. O relatório aberto em outra aba terá sua própria sessão de conversa em memória daquela aba; não haverá sincronização ou persistência adicional.

O mascote e o painel ficarão no documento pai do relatório. O iframe ZAP usa `sandbox` e `srcDoc`; não se injeta código no HTML do ZAP. PDFs por `pdf-lib` recebem dados, sem capturar o DOM. Também haverá exclusão explícita do assistente em impressão.

## Catálogo fechado de atalhos

As nove referências do pedido correspondem às rotas e guards atuais de `App.tsx`.

| ID proposto | Rótulo controlado | Destino | Perfis |
| --- | --- | --- | --- |
| `dashboard` | Abrir dashboard | `/dashboard` | ADMIN, CLIENT, PENTESTER |
| `projects` | Abrir projetos | `/projects` | ADMIN, CLIENT, PENTESTER |
| `applications` | Abrir aplicações | `/applications` | ADMIN, CLIENT |
| `new-analysis` | Solicitar análise | `/new-analysis` | ADMIN, CLIENT |
| `findings` | Abrir findings | `/findings` | ADMIN, PENTESTER |
| `dast` | Abrir DAST | `/dast` | ADMIN, PENTESTER |
| `remediation` | Abrir remediação | `/remediation` | ADMIN, PENTESTER |
| `playbooks` | Abrir playbooks | `/playbooks` | ADMIN, CLIENT, PENTESTER |
| `sla-settings` | Abrir configuração de SLA | `/settings/sla` | ADMIN, CLIENT |

O backend selecionará IDs a partir dos tópicos recuperados e filtrará por perfil. A interface fará a mesma filtragem antes de usar React Router. O modelo retornará somente texto; URLs, comandos ou ações sugeridos nesse texto não serão executados. Não haverá atalhos genéricos fictícios para maturidade ou relatórios, nem IDs de recursos no contexto externo.

## Fonte de ajuda a implementar na Fase 1

Uma base estática no backend conterá `id`, título, palavras-chave, telas, orientação, perfis e IDs de ações. Recuperação por tela e termos normalizados para português, usando o histórico curto para continuação. Limite inicial de três tópicos e 6.000 caracteres de trechos; sem embeddings ou envio do repositório.

Conteúdo a conferir novamente durante a redação:

- Dashboard e projetos: ADMIN tem visão global, CLIENT a empresa e PENTESTER os vínculos. Análise cria Project para Application ativa e respeita assinatura/plano; não executa scan automaticamente.
- Projetos: `PENDING → IN_PROGRESS → IN_REVIEW → COMPLETED`; revisão pode voltar para andamento. CLIENT solicita/edita metadados; mudanças de status são ADMIN/PENTESTER autorizado.
- Findings: CLIENT lê pela empresa/projeto; a listagem global é ADMIN/PENTESTER. Escrita e evidências são ADMIN/PENTESTER autorizado; comentários são permitidos a quem pode ler o finding, com exclusão por autor ou ADMIN.
- DAST: ADMIN/PENTESTER, com recorte de autoria dos scans. Triagem humana e promoção são etapas distintas; promoção exige projeto autorizado e CVSS revisado, e resultado simulado não promove.
- CVSS, VRS e SLA: explicar os valores e regras existentes, sem calcular ou revisar resultados. Aceite de risco é entidade própria, não status de finding; solicitação e decisão têm permissões diferentes.
- SLA: ADMIN/CLIENT leem; CLIENT OWNER configura e MEMBER lê. Reaplicação é ADMIN. Playbooks System são imutáveis; custom têm escrita autorizada para ADMIN/PENTESTER.
- Maturidade depende de empresa; ADMIN edita, demais apenas leem quando autorizados. Relatórios ficam no projeto e exigem `IN_REVIEW`/`COMPLETED`; exportação Excel de findings já existe no checkout e deve ser distinguida dos PDFs.

Referências rastreadas: `project.service.ts`, `application.service.ts`, `vulnerability.service.ts`, `evidence.service.ts`, `vulnerability-comment.service.ts`, `dast-scan.service.ts`, `dast-triage.service.ts`, `sla-policy.service.ts`, `risk-acceptance.service.ts`, `maturity.service.ts`, `report.service.ts` e páginas correspondentes.

## Contrato e limites propostos

`POST /api/assistant/chat`, autenticado. Pedido: `{ question, screen, history }`, sendo `screen` um identificador do catálogo e histórico com papéis `user|assistant`. Resposta: `{ message, source: "gemini"|"local", actions: [{ id, label }] }`. A Fase 1 formalizará os DTOs. Perfil, identidade, instruções de sistema, URLs e ações não serão aceitos como autoridade no body.

| Controle | Proposta inicial |
| --- | --- |
| Pergunta | 1.000 caracteres, texto não vazio |
| Histórico enviado | Até seis mensagens, até 1.000 caracteres cada e 4.000 no total |
| Contexto de tela | Identificador conhecido, sem pathname bruto, parâmetros ou query strings |
| Contexto de perfil externo | Somente role derivada da autenticação; nunca userId, nome, e-mail ou companyId |
| Saída | Até aproximadamente 500 tokens, com limite adicional de texto aceito |
| Timeout externo | 15 segundos, uma tentativa, sem troca automática de modelo |
| Uso por usuário | Proposta de bucket com reposição de 10/h e rajada de 5 |
| Uso global do assistente | Proposta de bucket com reposição de 30/h e rajada de 10 |
| Modo padrão | `ASSISTANT_MODE=local`; `gemini` exige chave e modelo explícitos |

São limites da aplicação, independentes das cotas Google. Buckets repõem continuamente; não representam teto exato de janela civil. Antes de implementar limites horários, garantir que o TTL de 10 minutos do store atual não renove um bucket incompleto antecipadamente. Também impedir que descarte por capacidade permita reiniciar a cota do assistente. Testar os dois casos com relógio controlado.

O limiter terá instância compartilhada por aplicação, nunca por pergunta, e preservará o contrato atual: HTTP 429, `code: RATE_LIMITED`, mensagem existente, `retryAfterSeconds`, `Retry-After` e `RateLimit-*`. Limite da aplicação não será transformado silenciosamente em HTTP 200 com fallback. Falhas externas/configuração ausente, por outro lado, terão ajuda local identificada.

Não se consultarão dados de negócio para compor prompts nem se copiarão DOM, formulários, nomes, e-mails, URLs de alvos, evidências ou findings. Perguntas livres terão orientação para não incluir conteúdo confidencial; a validação deverá evitar encaminhar padrões sensíveis reconhecíveis. Isso não será apresentado como detector infalível de informação confidencial.

## Modelo e documentação oficial consultada

Em 23/10/2026, a escolha recomendada é `GEMINI_MODEL=gemini-3.5-flash-lite`: o [catálogo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite) o identifica como estável; a [tabela de preços](https://ai.google.dev/gemini-api/docs/pricing) oferece entrada/saída de texto no Free Tier, e o [ciclo de vida](https://ai.google.dev/gemini-api/docs/deprecations) não anuncia desligamento. Modelos 2.5 têm acesso limitado a usuários anteriores; o exemplo histórico de 1.5 não orienta esta implementação.

O gateway usará `fetch` para `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, chave no header `x-goog-api-key`, instrução confiável em `systemInstruction`, dados de conversa em `contents` e `generationConfig.maxOutputTokens`. Para 3.5 Flash-Lite, conferir `thinkingLevel: MINIMAL` e omitir parâmetros de amostragem incompatíveis, conforme [REST](https://ai.google.dev/api/generate-content) e [mudanças da geração](https://ai.google.dev/gemini-api/docs/whats-new-gemini-3.6). Sem tools, grounding, arquivos, cache ou serviços adicionais; não seguir redirects para outro host. O modelo permanecerá configurável e o contrato será reconferido na Fase 2.

O projeto de demonstração deve permanecer no Free Tier, sem vincular faturamento, habilitar trial ou fazer pré-pagamento. A chave não comprova o tier; a gratuidade depende da conta, modelo e recursos, conforme [faturamento](https://ai.google.dev/gemini-api/docs/billing). As cotas efetivas são verificadas no AI Studio, conforme [limites](https://ai.google.dev/gemini-api/docs/rate-limits).

Entradas e respostas do Free Tier podem ser usadas para melhoria dos produtos Google, inclusive revisão humana. Utilizar apenas ajuda e dados fictícios; não transmitir conteúdo confidencial. Conferir [termos](https://ai.google.dev/gemini-api/terms), [chaves](https://ai.google.dev/gemini-api/docs/api-key) e [primeiros passos](https://ai.google.dev/gemini-api/docs/get-started). Nenhuma chamada real foi feita e a elegibilidade de uma conta específica não foi comprovada.

## Plano de arquivos e dependências

Os nomes abaixo são propostos; a implementação deve manter arquivos pequenos e o padrão de cabeçalho em PT-BR.

| Fase | Novos arquivos principais | Arquivos existentes a integrar |
| --- | --- | --- |
| 1 — ajuda/contratos | API: `models/assistant.model.ts`, `config/assistant-help.config.ts`, `services/assistant-help.service.ts`; web: `types/assistant.types.ts`, `lib/assistant-context.ts` | Nenhum schema ou repository |
| 2 — API/Gemini | API: `config/assistant.config.ts`, `services/gemini.service.ts`, `services/assistant.service.ts`, `controllers/assistant.controller.ts`, `factories/assistant.factory.ts`, `routes/assistant.routes.ts` | `routes/routes.ts`, `config/enum/EnvKeys.ts`, configuração/service/middleware de rate limit e store se necessário para retenção, `app.ts` apenas se necessário para injeção, `app/api/.env.example`, `docker-compose.yml` |
| 3 — UI | Web: `components/layout/authenticated-layout.tsx`, `components/assistant/assistant.tsx`, `assistant-mascot.tsx`, `assistant-panel.tsx`, `assistant.css`, hook de movimento | `App.tsx`; reutilizar Portal, primitives e `motion/use-motion.ts` |
| 4 — contexto/sessão | Web: `lib/api/assistant.api.ts`, hook de conversa/contexto | Componentes do assistente; `auth.store.ts` somente se necessário para identificar explicitamente uma nova sessão sem persistir a conversa |
| 5 — prova | API: testes de integração do endpoint/gateway; web: testes do assistente/contexto e smoke de navegador específico | `App.test.tsx`, testes de sessão/overlays/rate limit quando afetados; não disparar os E2E de scans reais |
| 6 — entrega | `docs/ASSISTENTE_VULNERA.md` com configuração e roteiro de três minutos | PRD, BACKLOG, ROADMAP, Changelog, ADR-048 e notas relacionadas de domínio afetadas |

Dependências adicionais previstas: **nenhuma**. A ajuda local é funcionalidade explícita, determinística e identificada, não simulação apresentada como Gemini. Gateway injetável permite testar respostas sem API externa. Não criar migration, tabela de conversas, repository vazio, pacote compartilhado novo ou infraestrutura adicional.

`GEMINI_API_KEY` e `GEMINI_MODEL` serão opcionais no boot e lidos somente no backend por `EnvVar`/`EnvKeys`. Modo, timeout e limites terão placeholders documentados. O Compose exige encaminhamento explícito em `services.api.environment`; nada será exposto em `VITE_*`. Arquivos `.env` reais não foram abertos, copiados ou editados.

## Movimento, overlays e sessão

- Mascote com `MotionValue`/animação imperativa, sem render React a cada quadro; trajetos lentos pelas bordas, descanso e contenção na viewport/resize. Em largura estreita e movimento reduzido, posição estável.
- Pausar por hover, foco, chat aberto, aba oculta, preferência manual e modal ativo. Limpar timers, animações e listeners no encerramento. Painel mantém posição própria e rolagem interna.
- Portal montado desde o layout autenticado, após o `Outlet`, preservando o primeiro link de pulo de `AppLayout`. O portal não libera interação acima de Dialog/Drawer: observar modal/inert, suspender controles e pausar movimento.
- `useInertForaDe` afeta irmãos já existentes; um portal criado depois de um modal pode escapar. Não recriar o portal ao abrir o chat nem refatorar a infraestrutura inteira para esta feature.
- Tokens existentes: sticky 10, dropdown 40, overlay 50, modal 60, toast 70. Assistente deve ficar abaixo de modais. Tailwind substitui escalas padrão: usar CSS com tokens e classes geradas pelo projeto.
- Temas `dark`, `light`, `system` (sistema resolve para uma das duas paletas); alvos de 44px, foco visível, Escape, retorno ao disparador e histórico com anúncio acessível. Não deslocar foco na mudança de rota.
- POST somente por envio explícito. Montagem, abertura, sugestões, digitação, movimento, rota e refoco não chamam Gemini. Mutation com retry desabilitado; refresh HTTP existente só poderá reenviar uma requisição que falhou na autenticação antes da geração.
- Capturar screen no envio. Preservar mensagens por navegação; limpar/cancelar no logout, novo login ou troca de usuário e descartar respostas tardias. Rotação de token e atualização de perfil da mesma sessão não são uma nova conversa. Não persistir histórico no Zustand persist/localStorage.

## Critérios de aceite por fase

| Fase | Evidência exigida para concluir |
| --- | --- |
| 0 | Checkout, esquema, scripts, telas, acesso, overlays e divergências investigados; plano/ADR/docs registrados; nenhuma alteração de produto |
| 1 | Tópicos dos três perfis conferidos contra código; recuperação em português/continuação limitada; DTOs e nove ações rastreáveis às rotas |
| 2 | 401/400/429 corretos; identidade do servidor; limites compartilhados/global; gateway simulado com sucesso; fallback em modo local, falta de chave/modelo, timeout, cota e resposta inválida; uma tentativa e nenhum log sensível |
| 3 | Instância única em todas as telas protegidas e ausente nas públicas/mobile; viewport/movimento/pausas/teclado/inert/print; painel estável em 320px e desktop |
| 4 | Zero POST antes de enviar; contexto capturado; conversa preservada nas rotas; logout/troca/nova sessão cancelam e isolam; atalhos por clique e papel; texto seguro e trava de duplicação |
| 5 | Checks/builds dos dois workspaces com falhas ambientais/preexistentes separadas; navegador ADMIN/CLIENT/PENTESTER, claro/escuro/sistema, modais, foco, scroll, impressão e largura estreita; testes sem Gemini real; prova ao vivo explicitamente confirmada ou pendente |
| 6 | Guia de configuração segura/Free Tier/Docker/local, limitações e roteiro de três minutos; docs vivos e histórico atualizados; diff local revisável |

## Validação inicial e pendências de ambiente

Confirmados os scripts reais:

```text
npm run check --workspace=app/api    # lint && jest --runInBand
npm run build --workspace=app/api    # tsc
npm run check --workspace=app/web    # lint && contraste && vitest
npm run build --workspace=app/web    # tsc --noEmit && vite build
```

O host usa Node `v24.15.0` e npm `12.0.2`; não há `node_modules` na raiz nem nos dois workspaces. Tentativas antes de qualquer edição de produto:

| Comando | Resultado inicial |
| --- | --- |
| `npm run lint --workspace=app/api` | Bloqueado: `eslint` não reconhecido; lint não executou |
| `npm run build --workspace=app/api` | Bloqueado: `tsc` não reconhecido; build não executou |
| `npm run check --workspace=app/web` | Bloqueado na primeira etapa: `eslint` ausente; contraste/testes não executaram |
| `npm run build --workspace=app/web` | Bloqueado: `tsc` ausente; build não executou |

Nenhuma dependência foi instalada neste checkpoint de investigação; nenhuma falha de código foi inferida desses resultados. O `check` API completo não foi disparado: sua etapa de lint depende do mesmo executável ausente, e a integração exige antes confirmar isolamento do banco. Próxima preparação: instalar dependências pelo gerenciador, sem editar lockfile, e preparar banco de teste separado. Se a instalação falhar, interromper e reportar conforme AGENTS §0.2 S4.

Docker disponível (`29.7.2`); serviços API/MySQL saudáveis, web/MailHog em execução. `GET http://localhost:8086` e `GET http://localhost:3001/api/health` responderam **200**. Isso comprova apenas disponibilidade da stack anterior, não valida a futura feature nem igualdade da imagem com o checkout. Nenhum container foi reconstruído/reiniciado, nenhum dado foi alterado e nenhum scan foi executado.

## Divergências e riscos registrados

1. IA aparece como excluída em AGENTS/roadmap/ADR-017 e como pendente/vigente em ADR-006/011. A nova decisão tem escopo restrito e mantém os registros antigos como histórico; não reativar sugestão de findings, mobile ou `aiAssisted`.
2. `AppLayout` não cobre todas as rotas privadas; resolver somente com o contêiner autenticado compartilhado. O comentário de DAST fala em 403, mas `ProtectedRoute` redireciona papel sem acesso para dashboard; manter o comportamento existente.
3. `Portal` tem comentário sobre exceção de portais que não corresponde ao código de inert. Não confiar nesse comentário; testar bloqueio do assistente sob modal, inclusive se modal já estiver aberto na montagem.
4. O interceptor HTTP tem risco anterior de resposta de refresh após troca de sessão. O assistente precisa de cancelamento/identificador próprio para descartar respostas; uma refatoração global de autenticação fica fora deste pedido.
5. AGENTS descreve somente testes de integração e preservação de Plan/Maturity no cleanup. O checkout possui `tests/unit`, e `tests/setup.ts` apaga também esses catálogos. Não corrigir regras protegidas ou limpeza incidentalmente.
6. O setup carrega `.env.test` sem verificar banco dedicado antes de `deleteMany`. Não executar testes de integração no banco da apresentação; prover configuração de teste explicitamente isolada sem abrir/imprimir arquivos `.env`.
7. `.env.example` da API menciona `SERVER_PORT`, enquanto `EnvKeys`/Compose usam `PORT`; divergência anterior, sem bloqueio para a configuração opcional do assistente.
8. O store atual limpa buckets por TTL e pode expulsar chaves por capacidade. Limites lentos do assistente exigem retenção adequada e comportamento fechado no teto de chaves; tratar como parte dos novos limites, não como refatoração geral.
9. Há numeração duplicada antiga de ADR-044/045/046; ADR-047 já existe para Excel. Usar ADR-048, sem renumerar o histórico.

## Revisão do checkpoint

`git diff --check` aprovado. Links locais e UTF-8 dos documentos novos conferidos. Revisões independentes de API e frontend não encontraram divergências adicionais entre o plano e o checkout. A remoção somente dos novos blocos de PRD/BACKLOG reproduziu os hashes do conteúdo encontrado no início (`cde25b8` e `788f6dd`), confirmando a preservação integral das alterações anteriores. O diff desta fase contém apenas documentação; nenhuma suíte de testes foi executada.

**Checkpoint:** investigação concluída (100% da Fase 0; 1/7 fases, 14% do plano). Implementação de produto: pendente. Próximo: Fase 1 — base de ajuda e contratos.
