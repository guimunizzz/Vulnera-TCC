<!-- Registra provas, comandos e limitações da entrega do assistente; consumido pelos mantenedores e pela banca, sem expor credenciais reais. -->

# Assistente Vulnera — validação de 23/10/2026

Branch `feature/agent-ai`, base `44f9c58`. Alterações locais anteriores de PRD/BACKLOG preservadas. Sem alteração de schema, migration nova, dependências declaradas, lockfile ou arquivos `.env` reais.

## Resultados confirmados

| Verificação | Resultado |
| --- | --- |
| API, teste focal `tests/integration/assistant.test.ts` | 47/47 aprovados; JWT real, gateway/rede simulados, sem consulta/limpeza de banco nesse arquivo |
| Cobertura dos serviços novos | 100% linhas, 94,28% statements, 85,5% branches, 93,33% funções |
| Web, quatro arquivos focais | 45/45 aprovados: assistente, contexto, árvore App e auth store |
| `npm run check --workspace=app/web` | Aprovado: 400/400 testes em 37 arquivos, contraste 66/66, lint 0 erros/9 avisos anteriores |
| Builds API e web no host | Aprovados; web repetido após correções de Escape/viewport |
| Lint dos fontes API/web alterados | Aprovado |
| `npm run check --workspace=app/api` | Não verde: dois imports não usados anteriores em `vulnerability.service.ts:46`; teste não executa após esse lint |
| HTTP real local compilado | 13/13 verificações aprovadas em `127.0.0.1:3002`, sem Google, identidades JWT sintéticas e modo local |
| Navegador Vite | 12/12 cenários, zero erros de página; Chrome em desktop e 320px, ADMIN/CLIENT/PENTESTER, dark/light/system |
| Builds Docker/API local | Aprovados; serviços atualizados em `http://localhost:8086`, API saudável em 3001, modo local |
| Navegador do build servido | 12/12, zero pageerrors/violações CSP; header CSP exigido e bundle `index-BM7VkbDc.js` confirmado |
| API local com logins reais | ADMIN/CLIENT/PENTESTER: 3/3 aprovados, seis perguntas 200/Ajuda local, sem dados de negócio alterados |
| UI real, sem fixtures | CLIENT: login, pergunta, atalho Solicitar análise, nova pergunta contextual e logout aprovados; duas respostas 200/local, nenhum formulário de negócio enviado |
| API Node 22, conjunto completo e correção de ambiente | Resultado combinado 772/773 testes e 47/48 suítes, conforme detalhamento abaixo; falha anterior de assertion Excel |
| Gemini ao vivo | Pendente: configuração runtime consultada sem revelar valores indicou ausência de chave e modelo; nenhuma chamada ao Google |

Relatórios: [navegador](browser-report.md), [dados do navegador](browser-results.json), [HTTP local](live-local-results.json), [cobertura](api-coverage/coverage-summary.json). Capturas desktop e narrow na mesma pasta foram inspecionadas visualmente, não apenas geradas.

## Provas relevantes

- Endpoint exige autenticação; body fechado rejeita perfil, tenant, ação, URL ou papel `system` forjados, tela desconhecida e limites excedidos.
- Backend deriva o perfil do JWT; catálogo define IDs/rótulos e a interface refiltra por perfil. Testes tentam nomes de propriedades, URLs e ações falsas.
- Gateway simulado valida host/header/payload, limite de saída, ausência de identidade/ferramentas, uma chamada, timeout, cota, resposta vazia/bloqueada/truncada/inválida e falta de chave/modelo. Dados sensíveis reconhecíveis permanecem locais.
- Contadores de usuário/instância compartilham o store; testes usam relógio controlado para validar reposição, TTL, pressão de memória e 429 existente.
- Nenhum POST na montagem, abertura, sugestão, digitação, rota, refoco ou movimento. Envio captura a tela e bloqueia duplicação; navegação preserva conversa e rotula respostas referentes à tela anterior.
- Logout, troca de conta e novo login da mesma pessoa cancelam/descartam resposta tardia. Rotação de token e atualização de perfil não apagam a conversa; histórico não entra em persist/localStorage.
- Instância única também em onboarding/relatório DAST; ausente nas públicas. Modais tornam o assistente inerte/oculto, movimento pausa nas condições previstas, painel permanece estável, Escape devolve foco, impressão oculta e HTML ZAP original permanece intacto.

## Achados corrigidos nesta entrega

1. Escape durante espera podia falhar quando o foco saía do textarea. Corrigido com listener condicionado ao painel aberto/sem modal e textarea readonly; teste de regressão incluído.
2. Painel de 320px usava `100vw`, desconsiderando scrollbar. Corrigido para largura relativa ao contêiner e limites reais; painel cabe e histórico rola.
3. Histórico influenciava perguntas novas fora da ajuda. Recuperação agora usa histórico apenas para continuação reconhecida.
4. Relatório DAST podia recuperar ajuda de PDF de projeto. Base de 14 tópicos distingue relatório do scan (Baixar PDF/Ver relatório do ZAP) de relatórios do projeto; regressão incluída.

## Falhas anteriores e limites do ambiente

**Lint API:** `UserEntity` e `UserResponseDTO` são imports não usados em `app/api/src/services/vulnerability.service.ts:46`, também presentes no HEAD original. Esse arquivo não foi alterado. Não se reporta check API verde.

**Excel:** o teste `FX-I-01` em `tests/integration/findings-export.test.ts:176` exige `filename="...xlsx"`; Express 5.3.0 obtido pelas faixas existentes responde `filename=...xlsx`. A incompatibilidade foi reproduzida em um app Express mínimo com apenas `res.attachment(...)`, sem qualquer código do assistente. Controller/teste de exportação não foram alterados. É pendência fora deste escopo.

**Primeira rodada API Windows:** 769/772 testes, 45/48 suítes aprovados em 320,369s. Além do Excel, dois testes de evidência falharam porque o processo foi configurado por esta validação com `UPLOADS_DIR=uploads-assistant-test`, enquanto os testes esperam `uploads-test`. A configuração foi corrigida; não houve patch no produto ou nesses testes.

**Segunda rodada Windows:** configuração de uploads corrigida, mas o processo terminou com código nativo `3221226505` (`0xC0000409`) antes do relatório JSON/conclusão da suíte. A causa nativa não foi comprovada e não é tratada como defeito do assistente. Rodada final será registrada usando Node 22 da imagem da API e banco separado.

**Navegador 320px:** o cabeçalho Conta anterior produz `scrollWidth=335` em viewport de 320px tanto com chat fechado quanto aberto, nos dois temas. O painel do assistente cabe e não amplia esse overflow. Não foi modificado o cabeçalho fora do escopo.

**Instalação:** sem lockfile raiz, `npm ci` não se aplica. `npm install --package-lock=false` concluiu; Prisma Client foi gerado explicitamente. Não se editou lockfile nem se atualizou pacote declarado. Bcrypt e esbuild foram exercitados após avisos de lifecycle do npm 12.

## Reprodução e isolamento

O MySQL de teste foi criado exclusivamente para esta rodada em `vulnera-assistant-test-db`, porta host 3308, database `vulnera_test`, com credencial sintética. As 14 migrations **já existentes** foram aplicadas somente nele; nenhuma migration da feature foi criada. Toda execução de integração definiu `DATABASE_URL` explicitamente, além de JWTs sintéticos, `NODE_ENV=test`, `BCRYPT_COST=4`, `DAST_FORCE_SIMULATE=true` e, na configuração corrigida, `UPLOADS_DIR=uploads-test`. Nunca rodar a limpeza dos testes no banco da apresentação.

Scripts reais continuam:

```text
npm run check --workspace=app/api
npm run build --workspace=app/api
npm run check --workspace=app/web
npm run build --workspace=app/web
```

Smoke de UI reproduzível (fixtures de navegador, não Gemini):

```powershell
$env:ASSISTANT_QA_URL = 'http://127.0.0.1:5175'
node output/assistant/browser-smoke.cjs
# API local de QA compilada em modo local, com segredo JWT sintético do script:
node output/assistant/live-local-smoke.cjs
```

Build/aplicação Docker e rodada final API/produção serão acrescentados neste relatório depois da conclusão. O guia de uso e roteiro da banca está em [ASSISTENTE_VULNERA.md](../../docs/ASSISTENTE_VULNERA.md).

## Fechamento — Node 22 e aplicação local

Os itens pendentes do registro intermediário acima foram executados. Build API/web em Docker aprovado; aplicação recriada em modo local e disponível em `http://localhost:8086`, health API 200. Antes da recriação, consulta somente de contagem confirmou zero scans QUEUED/RUNNING. Volumes/dados anteriores foram preservados; não houve seed/reset do banco da demonstração, migration nova ou `.env` real editado.

O conjunto completo de testes API foi executado na imagem Node 22 com banco de testes separado. Resultado bruto: 715/716 testes, 46/48 suítes aprovadas, 263,952s. Duas suítes ficaram vermelhas: a assertion anterior do Excel e a suíte CVSS, que importa o helper do workspace web ausente na imagem API isolada. Montado esse helper somente leitura no ambiente de teste, a repetição **apenas de CVSS** aprovou **57/57** em 3,041s. **Resultado combinado**, não apresentado como uma única execução verde: 772/773 testes, 47/48 suítes; permanece a assertion Excel. Ambos os testes de evidência passaram com `UPLOADS_DIR=uploads-test`. Artefatos: [rodada completa](api-linux-results.json) e [CVSS corrigido no ambiente](api-cvss-results.json).

QA foi repetido no build servido, porque a CSP de produção difere do Vite. Matriz **12/12**, zero erros/violações CSP, asset `/assets/index-BM7VkbDc.js`. Usou fixtures somente no navegador, preservadas em [production/browser-results.json](production/browser-results.json). Capturas desktop/320px claro/escuro/sistema foram inspecionadas visualmente.

Separadamente, a API real da stack recebeu login de ADMIN/CLIENT/PENTESTER com as contas fictícias já existentes de `docs/DEMO.md`: seis perguntas HTTP 200, todas `source: local`, ações por perfil e logout; [resultado](production-local-results.json). O helper precisou tratar logout 204 sem JSON, ajuste exclusivo do roteiro de QA, sem patch no produto. Um fluxo **UI real sem fixtures** validou CLIENT login → pergunta → atalho Solicitar análise → pergunta na nova tela → logout, com duas respostas locais e zero submissões de formulário de negócio: [resultado](production/real-ui-results.json) e [captura](production/real-client-local.png).

**Limite externo:** runtime consultado por `loadAssistantConfig` indicou chave/modelo ausentes sem expor valores. Nenhuma requisição ao Google, nenhuma ativação de billing/trial e nenhuma validação Gemini ao vivo. O guia explica a configuração privada e o ensaio Free Tier.

**Entrega:** Fases 0–6 encerradas, docs/ADR sincronizados, mudanças locais revisáveis, sem commit/push/PR. Check API não verde e overflow anterior do cabeçalho em 320px permanecem explícitos; não se atribui ao assistente aprovação global inexistente.

Ao encerrar, o MySQL temporário foi parado e os servidores auxiliares Vite/3002 foram encerrados. Os uploads descartáveis da primeira rodada foram preservados em `output/assistant/test-uploads`, fora da árvore de produto. Após reconfirmar zero scans ativos, a API local foi reiniciada para deixar a demonstração com budgets novos; limites padrão permanecem ativos. Web/API/MySQL/MailHog da stack local continuam disponíveis, sem exclusão de dados anteriores.
