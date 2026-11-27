# Adesão B2B, equipes e segurança de tenants

Branch `feat/unified-onboarding-tenant-security`, base `db91b70e37ab121dc1d87c071e95620d38bb8bd9`. **Aprovada com ressalvas para revisão local em 2026-11-25.** A adesão, as equipes e os controles de acesso estão integrados em commits locais. O desenho aditivo e as duas migrations foram aplicados sobre MySQL descartável, inclusive com registros legados.

O gate independente validou os canários de autorização, efeitos persistidos, rejeição de replay e concorrência nos domínios alterados. A revisão dirigida ficou sem achados altos ou críticos confirmados em aberto no recorte. O CI aguardará publicação autorizada e as quatro jornadas com Turnstile real e MailHog permanecem para validação manual.

## Refinamentos finais de 2026-11-27

A validação manual relatada confirmou o formulário em etapas, o Turnstile real, a ativação de conta, os convites empresariais, a associação de colaboradores e a separação visual de aplicações entre empresas. A rodada completa no Chrome fica para a próxima autorização.

- **Central administrativa.** A rota ADMIN-only `/admin/access-requests` concentra Adesões empresariais e Solicitações comerciais. A primeira mantém responsável, empresa, plano, verificação, decisão e histórico. A segunda reaproveita a fila comercial e suas decisões. `/admin/subscriptions` redireciona sob o mesmo guard para `/admin/access-requests?section=commercial`. O menu tem um único item e o atalho comercial do dashboard aponta para a seção correspondente. A adesão mantém uma única aprovação, com domínio comercial e recuperação legada preservados.
- **Acesso direto.** O dashboard iniciava a aplicação e as métricas em paralelo. A UI ignorava o erro da aplicação e dependia de `summary` para encerrar o carregamento, exibindo falha de métricas mesmo após negativa de acesso. O TanStack Query já recusava retry de 401, 403 e 404. O Axios só tentava renovar a sessão em 401. Retentativas de rede, 5xx selecionados e 429 poderiam estender a espera se uma dessas falhas ocorresse. O tempo da navegação manual anterior não foi capturado.
- **Consultas e respostas.** O dashboard lê a aplicação antes de pedir resumo, séries, insights ou comparação. Uma negativa definitiva apresenta a mesma mensagem para 403 e 404 e oferece retorno ao módulo. A interface diferencia sessão, limitação, rede/timeout e falha operacional. A revisão aplicou a regra a projetos e histórico de relatórios, findings (incluindo edição), Exposure Graph, importações, detalhes e relatórios DAST, playbooks e maturidade. Evidências seguem subordinadas à autorização do finding, e a proteção do iframe de relatório foi preservada.
- **Sessão e papéis.** Novo login, logout ou mudança de escopo invalidam cache e conteúdo protegido. Respostas e refresh iniciados em outra sessão são descartados. O menu de conta identifica Cliente · Responsável ou Cliente · Membro conforme o papel empresarial. Minha equipe mantém as permissões existentes, com listagem e gestão de membros pelo OWNER.
- **Limite da neutralidade.** A mensagem 403/404 é idêntica na interface. A API mantém seus envelopes e status distintos para recursos fora do escopo e inexistentes. Essa diferença continua observável por um cliente HTTP autorizado, embora o corpo da negativa não inclua dados do tenant.

Luna 1 (High) fez a Central e os estados de relatório DAST e maturidade. Luna 2 (XHigh) tratou dashboard, projeto, finding e Exposure Graph, além da regressão de leitura da API. Sol integrou navegação e estado de sessão, manteve os arquivos compartilhados e executou a validação. Houve até dois agentes em paralelo, com ownership exclusivo por arquivo.

### Evidência focal

O Jest passou 26/26 em três suítes da wave. A versão final da regressão de leituras passou 18/18, com 62 GETs, sem somar o reteste ao total. Os testes usaram o schema descartável `vulnera_test_wave_refine_20261127` no MySQL habitual, com 25 migrations. Os usuários foram autenticados pelo fluxo normal da API com fixtures sintéticas. As contas Alpha e Beta da jornada manual ficaram fora dessas execuções.

| Requisição em Supertest | Resultado | Tempo na execução final |
|---|---|---|
| Aplicação, resumo, séries e insights no tenant do OWNER ou MEMBER | HTTP 200. Identificadores e totais do próprio tenant | 10,3–38,6 ms |
| Aplicação ou métricas fora do escopo | HTTP 403, corpo `{"error":"FORBIDDEN"}` | 8,9–21,6 ms |
| Identificador inexistente | HTTP 404, corpo `{"error":"APPLICATION_NOT_FOUND"}` | 6,7–12,2 ms |
| Aplicação e métricas sem sessão | HTTP 401, envelope de autorização sem dados do recurso | 3,2–4,6 ms |
| Comparação e Exposure Graph do próprio tenant | HTTP 200. A fixture confere ausência de IDs, nomes e achados alheios e verifica os totais esperados | 8,9–18,7 ms |

Os canários também preservaram acessos legítimos de ADMIN e PENTESTER atribuído e verificaram o bloqueio de mutações fora do escopo. Os tempos são exclusivos do runner local e não representam a navegação anterior do usuário.

O Vitest passou 128 cenários focais distintos, incluindo seções administrativas, guard de rota, cache, refresh, páginas protegidas e ausência de consultas dependentes após 403/404. O lint focal passou sem erros. O aviso de Fast Refresh em `dast-status-banner.tsx` já existia com o hook exportado. A checagem TypeScript passou ao declarar os tipos Web explicitamente. O comando padrão no host encontra declarações incompletas no diretório ancestral e retorna TS2688. A verificação de contraste passou 132/132 nos temas testados. A bateria integral e o Chrome aguardam a próxima etapa.

Código local em `da4394a` (Central), `954b610` (sessão) e `7240030` (estados protegidos e canários de leitura). Nenhuma alteração de código de produção na API, schema ou migrations nesta etapa.

O build Docker do Web passou com Rollup 4.68.5. Somente `vulnera-web` foi recriado, com imagem local `vulnera-tcc-web:wave-7240030`. A API permaneceu na imagem de `b0e0833`, e API, MySQL, Redis e MailHog mantiveram os mesmos IDs de container. O schema manual `vulnera_wave_20261127` conservou 3 empresas, 8 usuários, 6 aplicações e 3 assinaturas. Rede, volumes, perfil real do Turnstile e portas do ambiente habitual foram preservados.

## Autorização

| Operação | ADMIN ativo | CLIENT OWNER ativo | CLIENT MEMBER ativo | PENTESTER ativo |
|---|---|---|---|---|
| Decisão de adesão e assinatura | Sim | — | — | — |
| Editar dados empresariais | Empresa identificada na rota | Própria empresa | — | — |
| Administrar o catálogo e alterar referência comercial | Sim, sujeito às assinaturas ativas | — | — | — |
| Solicitar assinatura legada | — | Própria empresa | — | — |
| Criar empresa pelo onboarding legado | — | CLIENT sem empresa e com permissão persistida | — | — |
| Gerir membros e convites | Recuperação explícita do OWNER e desativação administrativa de usuário | Própria empresa | — | — |
| Usar recursos operacionais | Escopo definido no módulo | Própria empresa | Própria empresa e permissões do módulo | Atribuição ao projeto e exceções globais documentadas |

Duas entradas concedem identidade externa, a aprovação administrativa direta e a delegação explícita de um OWNER à sua empresa. A API trata o usuário desativado como sessão inválida. A ativação pública usa convite de propósito específico e devolve 204.

## Contratos

- A jornada pública começa em `/request-access`. A solicitação passa responsável, empresa, plano escolhido e Turnstile para `POST /api/access-requests`. O HTTP 202 preserva a neutralidade. A verificação e a ativação seguem os links com fragmento.
- O ADMIN vê o snapshot e a elegibilidade em `/api/admin/access-requests/:id`. A rejeição de uma aprovação incompatível exige motivo. Aprovação legada mantém o fluxo de recuperação.
- `/team` consome os recursos `/api/companies/me/members`, `/api/companies/me/invitations` e `/api/companies/me/invitations/history`. O backend deriva empresa e papel. O reenvio rotaciona o hash, e a revogação/desativação devolve 204.
- O link de equipe usa `/join-company#token=…`. `POST /api/company-invitations/validate` devolve `{valid}`. `POST /api/company-invitations/activate` recebe token e senha e devolve 204. Ambas as ativações são seguidas pelo login existente.
- `DELETE /api/users/:id` desativa a identidade e conserva referências. `POST /api/users/:id/reactivate-owner` é reservado ao ADMIN para recuperação. Alterar o e-mail requer reverificação. Alterar o nome continua possível.

## Jornada manual

Desde 2026-11-27, a validação usa a própria stack `vulnera-tcc`, Web em `http://localhost:8086`, API em `http://localhost:3001` e MailHog em `http://localhost:8025`. A estratégia anterior de execução paralela foi substituída. O perfil real carrega as chaves do arquivo local ignorado `.env.turnstile-real.local`. A API manual aponta a `vulnera_wave_20261127` no MySQL existente, com conta limitada ao schema. Preserve os dados fictícios já cadastrados e dispense novo seed. As suítes que limpam registros usam um schema descartável separado.

### Roteiro para a rodada autorizada no Chrome

| Exercício | Resultado a conferir |
|---|---|
| Adesão | Completar os quatro passos com um plano ativo e Turnstile real. Confirmar o e-mail pelo MailHog e conferir o pedido na Central. |
| Administração | Como ADMIN, consultar histórico e decidir a adesão. Na ativação do convite, conferir criação de empresa, OWNER e assinatura inicial ativa após uma única aprovação. |
| Comercial legado | Abrir a URL antiga e conferir o redirecionamento à seção comercial. Exercitar aprovação e rejeição somente com solicitações legadas reservadas para a rodada. |
| Convite empresarial | Como OWNER, emitir e reenviar convites de teste. Conferir que o link anterior deixa de funcionar e que o novo abre a ativação. Revogar outro convite pendente e conferir a negativa do link revogado. |
| Ativação de colaborador | Confirmar o vínculo com a empresa do emissor e a identificação como Cliente · Membro após login. |
| Permissões de equipe | Conferir que OWNER pode gerir a equipe e que MEMBER não consegue convidar, reenviar, revogar, desativar ou alterar privilégios. |
| Desativação e sessão | Usar um membro fictício reservado para esse caso. Desativar como OWNER e confirmar que a sessão anterior perde acesso e volta ao login. |
| Isolamento e URL direta | Com as contas Alpha e Beta já existentes, comparar aplicações próprias. Verificar a resposta neutra de recurso indisponível para endereços fora do escopo e inexistentes. Alternar sessões no mesmo navegador e conferir ausência de dados da sessão anterior. |
| ADMIN e PENTESTER | Conferir acesso administrativo e os recursos autorizados ao PENTESTER atribuído. Conferir que PENTESTER, OWNER e MEMBER não abrem a Central. |
| Recuperação legada | Usar uma identidade fictícia elegível para retomada. Confirmar que apenas esse fluxo pede a decisão comercial separada. |
| Estados de interface | Conferir teclado, retorno ao módulo, temas e largura reduzida. Uma falha de comunicação deve permanecer distinguível de uma negativa de acesso. |

## Evidências dos checkpoints

| Verificação | Evidência observada |
|---|---|
| MySQL isolado | 25 migrations em schema novo. Em schema atualizado, 3 identidades com 1 permissão legada concedida, 2 empresas com representação de CNPJ preservada e 1 pedido sem snapshot. |
| Backend | TypeScript e Docker build aprovados. Identidade, empresas, planos, assinaturas e notificações passaram em 52/52 no snapshot intermediário. O reteste com o parser e o gate Threat Intel passou 138/138 em 5 suítes, incluindo a matriz de acesso, adesão unificada, convites, corridas e isolamento. |
| Jest integral | Snapshot inicial com 78/85 suítes, 1.244 de 1.249 testes executados e duas suítes que falharam antes de executar. As sete suítes problemáticas tiveram reteste verde com os ajustes de contratos, fixtures e runner. Há evidência verde distinta para as 85 suítes. |
| Ambiente dos testes da API | As duas suítes de upload passaram 35/35 com `UPLOADS_DIR=uploads-test`. O teste compartilhado de CVSS passou 57/57 com a biblioteca Web disponível no snapshot. O lint global reportou os mesmos dois parâmetros sem uso de `memory-job-queue.ts`, arquivo igual à base. |
| DAST agendado | 21/21 em execução simulada, incluindo a antiga exceção de visibilidade para agendamentos por URL sem tenant. |
| Web | TypeScript com tipos do projeto explicitados, Docker build concluído e contraste dos tokens 132/132. Lint Web sem erros, com 9 avisos em arquivos de base. |
| Vitest focal | 76/76 em 12 arquivos de rotas, adesão, painel ADMIN, login, recuperação legada, equipe, sidebar, clientes HTTP e Threat Intel. A regressão de envio no login passou em 10/10 no reteste separado, somando 86 cenários distintos. O erro de nome acessível no Security Graph foi reproduzido na base `db91b70`, com 7/8 naquela suíte. |
| Vitest integral | Rodada final com pool de threads, 93/94 arquivos e 782/783 testes. A única falha é a mesma de nome acessível no Security Graph reproduzida na base. A rodada anterior com forks iniciou 87 arquivos e teve timeouts de inicialização nos sete restantes. |
| Playwright | Rodada inicial com 10/12, seguida de 3/3 no reteste que cobriu CTA, acessibilidade do formulário em etapas e aceitação de convite empresarial. 13 cenários distintos aprovados no Chrome automatizado, com respostas locais simuladas. |
| Expo | O typecheck restrito a `app/`, `src/` e à configuração Expo passou após o `npm ci`. O script padrão inclui artefatos TypeScript versionados em `app/mobile/output` e falha em referências aos módulos desses snapshots. |
| Compose | Perfis DEV e real aceitos por `docker compose config --quiet`. O perfil real recebeu valores sintéticos apenas na verificação de configuração. |
| CI | YAML conferido com gatilho de PR para `dev`, permissões de leitura e MySQL de teste. A execução no GitHub é pendente de publicação autorizada. |

O caso CA-10 de login legado passou novamente no Chrome após a proteção da rota. A prova no navegador usa substitutos locais de API e Turnstile. As quatro jornadas com widget real e MailHog ficam para a execução manual no schema reservado.

## Findings e controles

| Finding | Controle implementado |
|---|---|
| SEC-01 | Identidade, papel ativo e versão consultados independentemente do rate limiter. |
| SEC-02 | Rotação transacional com bloqueio de identidade, consumo do hash e expiração JWT e persistida após ambos os locks. |
| SEC-03 | Alteração cadastral por OWNER do tenant ou ADMIN. Alteração da referência comercial exige ADMIN e aderência à assinatura ativa. |
| SEC-04 | Solicitação comercial por OWNER e decisão por ADMIN, com revalidação persistida. |
| SEC-05 | Operações comerciais serializadas em Company. Decisão e auditoria compartilham a transação. |
| SEC-06 | Proteção do último OWNER, identidade histórica conservada e recuperação administrativa explícita. |
| SEC-07 | Criação legada por CLIENT com permissão persistida consumida na vinculação. |
| SEC-08 | Alteração direta de e-mail bloqueada até existir reverificação. Nome pode ser atualizado. |
| SEC-09 | CNPJ canônico em novas escritas, consultas nas duas representações e regra única no banco para as escritas canônicas. |
| SEC-10 | Validade e condições do plano conferidas no envio, deferimento, reenvio e ativação. Decisão vinculada ao snapshot. |
| SEC-11 | CI com gatilho para PRs à `dev`, banco descartável e serviços externos substituídos por doubles nos testes. |

### Achados adicionais

- Histórico global de sincronização do Threat Intel ficava acessível a CLIENT e PENTESTER. A rota e o serviço agora exigem ADMIN. A visão operacional conserva o horário e a disponibilidade das fontes, com mensagens detalhadas e contagens globais reservadas ao ADMIN.
- A revisão de integração detectou que o router público de convites podia alcançar o controller antes da leitura JSON. O parser limitado voltou após a verificação por IP e antes da verificação por token. Os canários HTTP de ativação e concorrência passaram depois da correção.
- A desativação de membro deixou de consultar um destinatário fora do tenant para calcular quotas. A limitação de desativação usa emissor e empresa. As operações de envio continuam limitadas por destinatário.

### Ownership

| Frente | Modelo e esforço | Responsabilidade |
|---|---|---|
| Identidade | Luna GPT-6 XHigh | JWT, refresh, ciclo de vida de usuários e testes |
| Adesão | Luna GPT-6 XHigh | Entrada, snapshot, ADMIN, convite e ativação B2B |
| Equipes | Luna GPT-6 XHigh | Convites, rate limits, ativação, desativação e escopo global de sincronização |
| Web | Luna GPT-6 High | Assistente de solicitação, análise ADMIN, ativação, equipe e retomada legada |
| Revisão | Luna GPT-6 XHigh | Fixture com dois tenants, canários independentes e auditoria estática |
| Integração | Sol GPT-6.2 | Schema, SQL, contratos compartilhados, regras comerciais, rotas centrais, CI e validações |

Cinco subagentes, com máximo de três simultâneos. Arquivos atribuídos por frente e correções encaminhadas ao proprietário.

Os testes reutilizaram o servidor MySQL local, com contas limitadas a schemas descartáveis. Um erro de interpolação no bootstrap deixou um schema vazio chamado `$db`. As permissões do runner foram corrigidas, e as migrations e testes usaram os schemas explícitos da wave. O banco de desenvolvimento e o checkout original foram preservados.

Os manifestos e lockfiles de dependências ficaram sem alteração. As builds usaram tags de validação locais e o MySQL, Redis e MailHog existentes foram preservados. Os artefatos de execução ficaram fora dos commits.

## Cobertura de isolamento

| Superfície | Origem do escopo e restrição | Validação direta |
|---|---|---|
| User, Company, Subscription | Identidade persistida, empresa do ator, OWNER em gestão e ADMIN em decisão global | Sessões, papéis, efeito comercial persistido e auditoria |
| Adesão e convite de equipe | Snapshot e convite individuais, aprovação administrativa ou delegação local do OWNER | Ativação e rollback da adesão, isolamento dos convites e canários de concorrência |
| Application, Project, ProjectMember | Empresa persistida do recurso pai, atribuição ao projeto para PENTESTER e concessões por ADMIN | Fixture com dois tenants, leitura/listagem e efeitos de mutação. Concessão exige ADMIN |
| Vulnerability, comentários e evidências | Company e projeto do finding pai, com autorização antes da leitura ou gravação | Canários preexistentes de tenancy, comentários e evidências |
| Reports e Findings Export | Projeto ou empresa autorizada, escopo aplicado aos dados antes da exportação | Canários de leitura e conteúdo dos relatórios, com regressão de exportação separada |
| DAST scan, finding, triagem e agendamento | Recurso pai e papel do solicitante. Agendamento global por URL exige referências de tenant nulas | Agendamentos em modo simulado. Worker consulta criador ativo e consistência entre escopos antes de assumir |
| SAST/SCA, Threat Intel e sugestões de tecnologia | Projetos, inventário do tenant e atribuições persistidas. Operações globais administrativas explícitas | Regressões das suítes de importação e Threat Intel, complementadas pela revisão independente |
| Métricas, Exposure Graph e maturidade | Empresa de origem, autenticação e regra de papel de cada consulta | Regressões dos módulos e revisão do recorte. Interface real com dois tenants reservada à jornada manual |
| Risco, playbooks, buscas salvas e SLA | Concessões de domínio, vínculo ao tenant ou ao usuário e catálogos globais explícitos | Regressões de escopo e revisão dirigida. SLA consulta destinatários ativos antes de gravar aviso |
| Notificações, AuditLog e AdminQueues | Notificação ligada ao usuário. Auditoria ligada ao ator e à empresa do evento. Filas administrativas exigem ADMIN | Teste de notificações, histórico de equipe e auditoria comercial. Execução externa de workers é fora do ambiente desta prova |

## Propostas de rastreabilidade

- **Unified B2B Onboarding** — Registra plano e empresa na solicitação, vincula aprovação e provisão atômica e preserva recuperação legada. Validar condições do plano, rollback e login sem segundo onboarding. Referências ao PR #83, ADR-057 e ADR-058.
- **Company Team Management & Invitations** — Oferece convite e histórico pelo OWNER, adesão como MEMBER e revogação de acesso. Validar isolamento por empresa, estados do convite e preservação da auditoria. Referência ao ADR-058.
- **Multi-Tenant Isolation & RBAC Hardening** — Une estado de sessão, decisões comerciais, permissões e canários de autorização. Validar rotações/decisões concorrentes, papéis e recursos por tenant. Referência aos findings SEC-01–11 e ao gate de PRs para `dev`.
