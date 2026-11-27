<!-- Registra a preservação, as decisões e as provas da integração da feature/agent-ai com a dev; existe para revisão do PR e é consumido pelos mantenedores. -->

# Integração de feature/agent-ai com dev — 15/11/2026

> **Complemento posterior no mesmo dia:** o Docker foi disponibilizado e a rodada Linux confirmou API 905/905 e Web 659/659. A varredura ampliada encontrou dois problemas de nome acessível, corrigidos mediante autorização; os e2e finais passaram 7/7. O relato de indisponibilidade Docker abaixo pertence à primeira rodada e fica preservado como histórico. Detalhes e limites em [QA_DOCKER_AGENT_AI_2026-11-15.md](QA_DOCKER_AGENT_AI_2026-11-15.md).

## Escopo e referências

- Feature original: `69af46c9f0ab0dded6813d177884827e3c1b3aa3`.
- Dev incorporada: `ac968598a0f6b49fd9b963cbf80b960bffab93c7`.
- Base comum: `44f9c58f969125927d6bd379335f2cfa0b84d5e6`.
- Trabalho na própria `feature/agent-ai`, por merge, sem rebase ou force push. A dev e a main não foram alteradas nesta tarefa.
- Backups **somente locais**: `backup/agent-ai-before-dev-2026-11-15` e `backup/dev-before-agent-ai-2026-11-15`; nenhuma dessas referências deve ser publicada.
- Autor e committer: `iannxz <iannarthur90@gmail.com>`. A conexão GitHub também foi conferida como `iannxz`.

O usuário exigiu preservar as mudanças dos dois lados e ser consultado antes de decisões com impacto funcional. Foram autorizados explicitamente o contexto das telas novas e a remoção exclusiva de dois imports não usados. Nenhuma funcionalidade foi escolhida para descarte.

## Resolução dos sete conflitos

| Arquivo | Composição aplicada |
| --- | --- |
| `app/web/src/App.tsx` | Todas as rotas, guards, lazy loading, limites de carregamento/erro e menu de acessibilidade da dev; um AuthenticatedLayout mantém o assistente nas rotas protegidas, inclusive onboarding e relatório DAST. |
| `app/web/src/App.test.tsx` | Espera assíncrona das páginas lazy, verificações do assistente original e regressões dos guards dos módulos novos. |
| `app/api/src/routes/routes.ts` | Rotas do assistente, SAST/SCA e Threat Intel mantidas no centralizador. |
| `app/api/src/config/enum/EnvKeys.ts` | Variáveis do assistente e de NVD/Threat Intel preservadas. |
| `app/api/.env.example` | Configurações dos dois lados, incluindo a correção de PORT feita na dev. |
| `PRD_VIVO.md` | Históricos dos dois lados combinados; marcos desta integração acrescentados. |
| `docs/BACKLOG.md` | Entregas e pendências de ambos preservadas; tarefas INT-AI registradas. |

Também foram revisados os arquivos combinados automaticamente, especialmente AppLayout, sessão, limiter, Compose e documentação. As permissões, a persistência dos tokens e os contratos existentes permanecem.

## Adaptações autorizadas

O assistente agora reconhece `sast-sca`, `code-import-detail`, `threat-intel` e `exposure-graph`, em vez de tratar essas telas como Dashboard. São 17 tópicos e 12 atalhos fechados, com os nove atalhos anteriores preservados. IDs e query strings não entram no contexto. A ajuda explica os limites da plataforma sem executar ações.

- SAST/SCA: atalho somente para ADMIN/PENTESTER; CLIENT recebe orientação sobre a restrição.
- Threat Intel: atalho para os três perfis; escrita, promoção e sincronização continuam sujeitas à API. Somente ADMIN sincroniza; CLIENT OWNER/MEMBER mantêm suas diferenças.
- Exposure Graph: atalho somente para ADMIN/CLIENT; é necessário vínculo com empresa. PENTESTER recebe orientação sobre a restrição.
- `vulnerability.service.ts`: removidos apenas `UserEntity` e `UserResponseDTO`, não usados. **O JavaScript compilado desse arquivo continuou idêntico (SHA-256 antes/depois)**; nenhum método ou resposta mudou.
- A ADR do assistente passou de ADR-048 para **ADR-054**, com links corrigidos. A ADR-048 do grafo DAST da dev ficou intacta. As menções numéricas antigas registram o histórico. Desde a integração de 26/11, a decisão do assistente é ADR-064.

## Provas de preservação

Na composição inicial, os **1.171 arquivos exclusivos da dev** e os **109 exclusivos da feature** estavam idênticos às respectivas origens. Na revisão final:

- Entre os exclusivos da dev, somente o import autorizado de `vulnerability.service.ts` mudou; os outros 1.170 permanecem idênticos.
- Entre os exclusivos da feature, diferenças ficam limitadas ao contexto/testes e à documentação/identificação da ADR autorizados; evidências e demais arquivos foram preservados.
- Os **30 caminhos de rota da dev** continuam presentes, com testes de navegação e permissão.
- Schema, migrations, manifests de dependências e código mobile continuam iguais aos da dev incorporada.
- `AGENTS.md`, `CLAUDE.md` e `GOTCHA.md` continuam iguais aos da dev.
- Nenhuma branch pendente foi incorporada adicionalmente. O que já existia na dev vem por seu próprio histórico.

O verificador local está em `output/agent-ai-dev-merge/verify-preservation.cjs`, com resultado em `preservation-results.json`. Isso demonstra preservação de arquivos e contratos, complementada pelos testes; não é uma garantia absoluta para qualquer ambiente ou dado possível.

## Validação

| Verificação | Dev original | Feature integrada |
| --- | --- | --- |
| Testes API | 847/847, 57 suítes | 905/905, 58 suítes, Node 22.23.5 |
| Lint API | Dois imports não usados | Aprovado após a correção autorizada |
| `npm run check` API após a correção | Bloqueado no lint | Aprovado: lint sem erros e 905/905 testes em 58 suítes, Node 22 |
| Check Web | 614/614 | 659/659, 75 arquivos |
| Contraste Web | Aprovado | 132/132, AA nos temas e AAA em alto contraste |
| Builds API/Web | Aprovados | Aprovados |
| Navegador, matriz original do assistente | Referência histórica preservada | 12/12; zero erros de página/CSP |
| Navegador com login/API reais, sem interceptação | Não repetido antes do merge | 11 verificações; zero erros de página/CSP |

O Chrome exercitou ADMIN, CLIENT e PENTESTER no build de produção com CSP. A matriz original cobre envio explícito, pausas, foco, modais, mobile 320 px claro/escuro, impressão, onboarding, relatório DAST, páginas públicas, descarte de resposta após logout e texto seguro. O roteiro real confirmou ajuda nas telas novas, a mesma instância/conversa ao navegar, redirects das rotas proibidas, logout e painel a 375 px. Capturas foram abertas e inspecionadas.

As suítes da API incluem os testes existentes de tenancy/RBAC, SAST/SCA e Threat Intel. Os serviços `assistant-help`, `assistant` e `gemini` atingiram 100% das linhas executáveis (31/31, 23/23 e 21/21), conforme `app/api/coverage/coverage-final.json`; o relatório completo está em `app/api/coverage/`. Não se atribui cobertura nova ao mobile.

## Ambiente isolado e limitações

Docker Desktop não conseguiu disponibilizar o backend nesta sessão. Não houve rebuild/recriação da stack existente. Foi iniciada uma instância **nova** do MySQL 8.0.44 em `127.0.0.1:33319`, com diretório temporário próprio, bancos `vulnera_test` e `vulnera_smoke`. As 18 migrations existentes foram aplicadas exclusivamente nesses bancos. O seed original foi executado apenas no banco descartável de navegador; uploads foram direcionados para a pasta de QA.

API de smoke em `127.0.0.1:33320`, Web em `127.0.0.1:4175`, modo local, agendador Threat Intel desligado e DAST real bloqueado no ambiente de QA. Nenhum banco existente, volume Docker, arquivo `.env` real, configuração global de Git ou dependência declarada foi modificado. Não houve chamada Gemini ao vivo nem scan externo.

A instalação host usou `npm install --package-lock=false`, pois a raiz não versiona lockfile. O Node 24.15.0 completou o baseline, mas uma execução completa integrada encerrou sem relatório. O resultado validado da integração usa Node 22.23.5, da mesma linha da imagem API; binário obtido do site oficial com SHA-256 conferido. A causa do encerramento no Node 24 não foi comprovada e não é reportada como sucesso.

Em 320 px, o roteiro original encontrou largura de página de 340 px tanto com o chat fechado quanto aberto; o painel cabe e não aumenta a largura. O overflow fora do assistente foi mantido e registrado, sem alteração de layout fora deste escopo. Builds também mantêm o aviso de chunks grandes.

`git diff --check` do patch destinado à dev passou. O diff do merge contra a feature antiga inclui whitespace já existente em arquivos da dev e relatórios ZAP; esses arquivos foram preservados, sem limpeza incidental.

Artefatos locais: `output/agent-ai-dev-merge/`, incluindo logs baseline/finais, JSON de testes/preservação, dois roteiros de navegador e capturas. Artefatos brutos, diretórios de banco, caminhos locais e senhas sintéticas não são publicados como parte desta integração; somente este relatório e a documentação funcional.

## Commits e entrega

- `2e2ead6` — merge da dev na feature, com composição dos sete conflitos.
- `da21fc7` — contexto das telas novas e regressões.
- `05735a7` — remoção exclusiva dos dois imports não usados.
- Commit documental de fechamento: este relatório, links/ADR e docs vivos; identificável pelo histórico da feature.

A publicação é restrita a `feature/agent-ai`, com push normal. A integração na dev continua pelo PR e o deploy do ambiente é uma operação posterior; não foram executados nesta tarefa. Caso seja necessário desfazer, usar os commits/referências preservados, sem reset da dev ou force push.
