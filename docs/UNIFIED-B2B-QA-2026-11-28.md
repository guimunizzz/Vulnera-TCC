<!-- Registra a integração e as evidências finais da Wave B2B para revisão da Issue #84 e para a próxima sessão. -->
# QA da Wave B2B em 2026-11-28

**Security Gate independente — GO WITH CONDITIONS.** A adesão completa passou com Turnstile real no Brave. Os bloqueios de sessão e a revogação do convite foram confirmados pela API real e pelo estado persistido. A confirmação nativa dessas duas ações no Brave ficou pendente. A rodada permite publicação em rascunho para revisão.

## Integração

- Branch `feat/unified-onboarding-tenant-security`, base original `db91b70`, checkpoint publicado `67114e9` e `origin/dev` em `54c6f36`. A integração incorporou 61 commits da `dev` por merge `0d669f40c539e3a8353e35b1a5714a82b226f2f2`. O SHA de código validado é `c4a3ff734abc27820ade57ba27a08cf2d6eb53ac`.
- Foram resolvidos nove conflitos. API: schema Prisma e centralizador de rotas. Web: `App.tsx`, `dashboard-header.tsx`, `sidebar.tsx`, `threat-intel-page.tsx` e `auth.store.ts`. Documentação: backlog e changelog. Em `App.tsx`, a validação comparou 14 declarações duplicadas aos registros preservados e conferiu a presença dos guards de equipe e administração.
- Exposure Graph, comentários no grafo, triagem, SLA, Conformidade, paleta de comandos, landing e Assistente permaneceram integrados. A paleta e a sidebar compartilham a visibilidade de Minha equipe e o fluxo da Central. A rejeição automática inicial à operação de resolução de `App.tsx` foi superada com uma aprovação específica e uma checagem explícita de preservação de rotas.
- O commit `84f49b2` minimiza o diretório legado de MEMBER e revalida destinatários de notificações de grafo. `825b987` adapta a fixture do assistente ao middleware de identidade persistida e serializa a criação de usuários da fixture que apresentava deadlock intermitente. `c4a3ff7` atualiza a expectativa do nome acessível no formulário e o espaçamento do Skeleton.
- O checkout principal foi o único worktree. Luna Backend resolveu os conflitos da API, validou o schema isolado e rodou Jest. Luna Frontend integrou navegação, guardas de sessão e estados protegidos e rodou a regressão Web. Luna Security avaliou a composição de `0d669f4` e revisou os controles alterados após a correção. Sol coordenou o merge, os commits, Docker, dados de QA, Brave e a publicação.

## Resultados técnicos

| Verificação | Evidência observada |
|---|---|
| Prisma | Client 6.19.3 gerado e schema validado. Schema novo e schema manual aplicaram 26/26 migrations. Upgrade da `dev` aplicou 24 migrations antes das fixtures e as duas B2B depois. `migrate status` atualizado e `migrate diff` sem diferenças. |
| Upgrade | Três identidades preservadas, uma permissão legada concedida ao CLIENT elegível, dois CNPJs originais preservados, um pedido antigo sem snapshot e um comentário de grafo preservado. |
| API | Rodada final de Jest focal com 28/28 suítes e 445/445 testes. Incluiu acesso, sessão, concorrência relevante, tenants, equipe, GraphComment, triagem, Exposure Graph e Assistente. Build TypeScript e lint focal passaram. |
| Check global da API | Exit 1 no lint, antes de Jest. Os quatro erros são iguais aos da `dev` em `graph-comment.model.ts` e `memory-job-queue.ts`. Jest foi executado separadamente. |
| Web | Vitest integral inicial 989/991 em 112/114 arquivos. Após correções, 18/18 nos dois arquivos afetados. Evidência distinta de 991/991 em 114/114 arquivos, sem nova rodada integral. ESLint 0 erros e 9 avisos herdados. TypeScript, build Vite e contraste 132/132 passaram. |
| Acessibilidade | Detalhe do Security Graph passou 10/10. A falha histórica de nome acessível não reapareceu. O commit `3be8452` altera nomes da marca e do Assistente, sem vínculo demonstrado com a falha histórica do grafo. No Brave foram observados rótulos de formulário, histórico da Central e estados de recurso indisponível. |
| Mobile | O typecheck do Expo passou em 52 arquivos de código e configuração. O comando padrão inclui snapshots de `app/mobile/output` e falha nas referências desses artefatos. |
| Docker | Builds API e Web passaram. Ambas as imagens em execução têm o SHA `c4a3ff7`. Web, `/api/health` e MailHog responderam 200. MySQL e Redis saudáveis. Os IDs de MySQL, Redis, MailHog e TeamSpeak foram preservados. |
| CI | Workflow Tenant Security configurado para PRs à `dev`, com MySQL exclusivo. O recorte é focal e não executa diretamente todas as suítes novas de grafo, triagem e Web. O resultado remoto depende da execução após a publicação. |

O runner histórico `vulnera-qa-api-runner.cjs` não estava nos arquivos recuperados. As evidências acima foram produzidas com os scripts atuais. `npm ci` na raiz detectou divergência do lockfile local ignorado. O `npm install` de validação rodou com gravação do lockfile desativada. O lockfile versionado do Mobile permaneceu sem alteração.

O erro inicial da migration de collation ocorreu no `CREATE TEMPORARY TABLE`, antes do primeiro `ALTER` permanente. Foram ajustadas somente as contas dos schemas descartáveis. A tentativa incompleta foi marcada como revertida nesses schemas antes de retomar. A aplicação antiga possuía 25 migrations, iguais às da imagem do checkpoint, além dos três marcadores básicos do seed. O seed completo já presente foi verificado por marcadores, sem reexecutar. O banco `vulnera` foi preservado. O `.env` local da API contém uma aspa excedente no nome do banco do `DATABASE_URL` e ficou fora do QA, que usou o overlay local e o schema isolado.

## QA real no Brave e na API

| Exercício | Resultado |
|---|---|
| Adesão com Turnstile real | Formulário rejeitou campos obrigatórios vazios, carregou plano e foi enviado com o widget real. MailHog entregou a verificação e o convite. Depois de confirmar o e-mail, a Central exibiu uma solicitação e o ADMIN aprovou uma vez. |
| Ativação B2B | Novo OWNER ativou a conta, entrou direto no dashboard e visualizou sua empresa em Minha equipe. Leitura do banco confirmou pedido `ACTIVATED`, e-mail verificado, convite consumido, um evento de aprovação, um evento de ativação, um OWNER, uma empresa e uma assinatura `ACTIVE` no plano escolhido. |
| Convite e rotação | OWNER Alpha emitiu e reenviou convite. MailHog recebeu duas mensagens locais. O Brave recusou o link anterior, ativou o MEMBER com o reenvio e recusou reutilização. O novo MEMBER entrou e viu somente sua equipe Alpha. |
| Bloqueio de convite e sessões | Na API real, revogação do segundo convite retornou 204 e o token passou de válido a inválido. Desativação do MEMBER sintético retornou 204, a consulta que antes retornava 200 passou a 401 e o refresh retornou 401. O banco confirmou desativação e ausência de refresh ativo. A confirmação nativa dessas duas ações pelo Brave não foi concluída. |
| Alpha e Beta | OWNER e MEMBER de ambas as empresas viram suas próprias equipes. OWNER Alpha viu aplicação própria e a mesma mensagem neutra para aplicação Beta e identificador inexistente. No MEMBER Beta foram conferidos projetos e finding próprios, relatório de projeto em revisão, agendamento desativado, notificação, Exposure Graph e Conformidade. Não havia dados Alpha nas telas Beta verificadas. |
| Papéis | ADMIN acessou Central, Findings e redirecionamento da seção comercial. PENTESTER viu Findings e seu projeto atribuído, com negativa para projeto sem atribuição e ficou sem a entrada para a Central. CLIENT teve Findings do projeto e permaneceu sem o atalho global. |
| VUL-QA-01 | Brave exibiu `0 solicitações`, `1 solicitação` e os plurais `10 aplicações` e `10 projetos`. A bateria Web cobre zero, singular e plural nos componentes afetados. |
| VUL-QA-02 | Equipe somente leitura para MEMBER em Alpha/Beta, sem ações de gestão. A API verificou projeção mínima, conta ativa, bloqueio a outro tenant e perfil próprio completo. |
| VUL-QA-03 | Menu global de Findings ausente para OWNER/MEMBER e preservado para ADMIN/PENTESTER. Findings permitido no projeto de Beta. |

O overlay efetivo usa `http://localhost:8086` em `PUBLIC_WEB_URL` e `CORS_ORIGIN`, SMTP no MailHog e Siteverify com `localhost` e `access-request`. A chave pública foi verificada no bundle Web e a secret, somente no runtime API. Nenhum SMTP externo, provedor Gemini ou scan real foi acionado. O DAST ficou em modo simulado e os dois agendamentos fictícios permaneceram desativados. A Central comercial foi aberta e seu redirecionamento foi testado. A decisão comercial legada tem cobertura de API. Ficam para completar no Brave a decisão comercial legada, a confirmação nativa de revogação e desativação e a matriz ampliada de acessibilidade.

## Security Gate

| Controle | Parecer sobre o código integrado e evidência da validação |
|---|---|
| SEC-01 | Identidade ativa, papel vigente e versão de sessão conferidos no banco. Desativação invalidou access e refresh na API real. |
| SEC-02 | Rotação transacional e validação das expirações JWT e persistida. Testes de autenticação e rotação passaram na rodada focal. |
| SEC-03 | Gestão da empresa deriva OWNER e tenant persistidos ou exige ADMIN. MEMBER usou equipe somente leitura. |
| SEC-04 | Solicitação comercial restrita a OWNER, com decisão administrativa e estado conferido no banco. Regressões de assinatura aprovadas. |
| SEC-05 | As decisões comerciais serializam na empresa e gravam auditoria na mesma transação. As suítes focais comerciais passaram. |
| SEC-06 | Último OWNER ativo protegido. Recuperação administrativa preserva histórico e não recupera sessões antigas. |
| SEC-07 | Retomada legada depende de permissão persistida, concedida no upgrade apenas ao elegível. |
| SEC-08 | Alteração direta de e-mail bloqueada até reverificação. O canário conferiu o e-mail persistido. |
| SEC-09 | Escritas da aplicação usam CNPJ canônico. O upgrade preservou as formas legadas. |
| SEC-10 | Elegibilidade e snapshot do plano revalidados no domínio. A ativação real utilizou o plano associado à solicitação. |
| SEC-11 | Workflow focal revisado no código. O resultado remoto fica sujeito ao CI do PR. |

Os achados de excesso de dados do MEMBER e notificação ao ex-integrante foram corrigidos em `84f49b2` e revistos de forma independente. A listagem e a consulta de colegas no diretório legado entregam só ID e nome ao MEMBER. A notificação de Exposure Graph confere o vínculo ao tenant ao gravar. A notificação de DAST usa a autorização de leitura do scan. Os dois canários executaram no Jest focal final.

**Riscos residuais.** A janela entre a revalidação do acesso e o início do job DAST segue como risco condicional para revogação concorrente. A interface iguala o estado de negado e inexistente, enquanto os endpoints preservam a diferença HTTP 403/404. O Assistente está em modo local no QA. Habilitar o provedor externo exige governança separada sobre o texto livre que o usuário envia. A revisão independente não confirmou achado crítico ou alto pendente nesse recorte.

**Revisão antes de merge.** Conferir CI da `dev`, concluir os cenários manuais pendentes e revisar os riscos residuais. [Issue #84](https://github.com/guimunizzz/Vulnera-TCC/issues/84).
