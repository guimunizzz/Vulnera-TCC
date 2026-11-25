# Adesão B2B, equipes e segurança de tenants

Branch `feat/unified-onboarding-tenant-security`, base `db91b70e37ab121dc1d87c071e95620d38bb8bd9`. **Aprovada com ressalvas para revisão local em 2026-11-25.** A adesão, as equipes e os controles de acesso estão integrados em commits locais. O desenho aditivo e as duas migrations foram aplicados sobre MySQL descartável, inclusive com registros legados.

O gate independente validou os canários de autorização, efeitos persistidos, rejeição de replay e concorrência nos domínios alterados. A revisão dirigida ficou sem achados altos ou críticos confirmados em aberto no recorte. O CI aguardará publicação autorizada e as quatro jornadas com Turnstile real e MailHog permanecem para validação manual.

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

Use dados fictícios em schema isolado e o perfil Turnstile real local, com as chaves configuradas no arquivo ignorado. Use a caixa local do MailHog para verificação e convites. As operações de teste devem apontar ao schema da wave. Mantenha a stack de desenvolvimento e suas credenciais locais separadas da validação.

Para rodar em paralelo à stack local, use o MySQL e o MailHog existentes na rede `vulnera-net`. Prepare um schema manual, por exemplo `vulnera_wave_manual`, e uma conta com acesso apenas a esse schema. Em um arquivo de ambiente fora do repositório, configure `DATABASE_URL` para essa conta e as chaves JWT de teste. Use `NODE_ENV=development`, `PORT=3001`, `CORS_ORIGIN=http://localhost:8186`, `PUBLIC_WEB_URL=http://localhost:8186`, `SMTP_HOST=mailhog`, `SMTP_PORT=1025`, `SMTP_FROM=noreply@localhost.test`, `SMTP_SECURE=false`, `SMTP_REQUIRE_TLS=false`, `QUEUE_DRIVER=memory`, `DAST_FORCE_SIMULATE=true` e `THREAT_INTEL_SYNC_ENABLED=false`. Use `TURNSTILE_SECRET_KEY` real somente nesse arquivo da API, `TURNSTILE_EXPECTED_HOSTNAME=localhost` e `TURNSTILE_EXPECTED_ACTION=access-request`.

Na raiz do worktree, a imagem local da API aplica as migrations ao schema indicado na inicialização. O seed é opcional para criar a conta ADMIN e os planos fictícios no schema manual.

```powershell
$waveApiEnvPath = Join-Path $env:LOCALAPPDATA 'Vulnera/wave-api.env'
docker run --rm --name vulnera-wave-api-manual --network vulnera-net --env-file $waveApiEnvPath -p 127.0.0.1:3101:3001 vulnera-wave-api:validation
```

Após a API ficar pronta, rode o seed em outro terminal para criar os dados fictícios.

```powershell
docker exec vulnera-wave-api-manual npm run db:seed
```

Em outro terminal, na pasta `app/web`, forneça a Site Key pública pela variável local exportada `LOCAL_TURNSTILE_SITE_KEY`.

```powershell
$env:VITE_API_URL = 'http://localhost:3101/api'
$env:VITE_TURNSTILE_SITE_KEY = $env:LOCAL_TURNSTILE_SITE_KEY
$env:VITE_TURNSTILE_ACTION = 'access-request'
npm run dev -- --host 127.0.0.1 --port 8186 --strictPort
```

Abra `http://localhost:8186/request-access` e use o MailHog local em `http://localhost:8025`.

1. Solicite acesso escolhendo um plano ativo. Confirme o e-mail, aprove no painel ADMIN, siga o convite e entre com a senha nova. Confirme acesso como OWNER e assinatura ACTIVE.
2. Como OWNER, convide um colaborador em Minha equipe. Abra o link de convite recebido no MailHog, ative e entre como CLIENT/MEMBER da mesma empresa. Confira o evento de aceitação no histórico do OWNER.
3. Verifique as restrições administrativas na sessão MEMBER. Como OWNER, revogue um convite pendente e desative um colaborador. Refaça a navegação autenticada na sessão desativada e confirme o encaminhamento para login.
4. Repita com duas empresas e dados fictícios distintos. Confira a separação de recursos na interface OWNER/MEMBER e a visibilidade esperada para ADMIN e PENTESTER atribuído.

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
