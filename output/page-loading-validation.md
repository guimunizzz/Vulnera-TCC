<!-- Registra causa, correção e validação do carregamento; existe para tornar
     a entrega revisável; consumido por Rafael e próximas sessões do projeto. -->

# Carregamento ao navegar — 2026-10-01

Branch `codex/fix-page-loading`, base `origin/dev` em `36fcaec`. A `dev` local
estava limpa e seis commits atrás; a correção parte do remoto atualizado.
Entrega concluída em 100%, com commit local e sem push/PR.

## Causa e evidência

As APIs já usam Promises/async/await. O dashboard de aplicação chamava quatro
endpoints de métricas simultaneamente, todos no bucket expensive do mesmo
usuário: default 10/min, burst 3. Reprodução Express/Supertest com middlewares
reais e relógio injetado, sem banco: 200/200/200/429, Retry-After e JSON com
seis segundos; após seis segundos, 200. O cliente global fazia uma tentativa
extra depois de um segundo, antes de o limiter permitir a próxima leitura.

Navegação frequente também esgota global/usuário. Os limites permanecem
inalterados. O JSON do 429 é usado porque o CORS não expõe Retry-After.

## Correção

- Até duas retentativas das leituras Axios transitórias, respeitando o prazo
  do 429 mais 250 ms; prazos acima de 30 s encerram a recuperação automática.
- Cancelamentos, falhas definitivas e mutations não são repetidos.
- Cache fresco 30 s; gravações invalidam listas/detalhes/quadro/métricas que
  alteram. Logout ou troca de usuário limpa o cache; refresh da mesma sessão
  preserva os dados. `networkMode: always` permite erro/recuperação offline.
- Summary sempre; série em Postura/Evolução; Insights e Comparativo por aba.
  A janela de período permanece estável quando só a aba muda.
- `useOutlet` preserva o contexto da página em saída no crossfade. A prova
  no Chrome registra uma única janela de métricas durante a navegação.
- Spinner no cabeçalho após 200 ms, espaço reservado, anúncio acessível e
  movimento reduzido. Usa tamanhos existentes nos tokens; skeletons mantidos.
- “Tentar novamente” no finding refaz o GET e mantém a pessoa no detalhe.

## Validação

- Baseline do cliente: sete cenários de regressão falharam antes da correção.
- Web `npm run check -- -- --maxWorkers=1 --silent` no contêiner com dependências
  da imagem existente: **286/286 em 27 suítes**, lint **0 erros/9 avisos
  preexistentes**, contraste **66/66**. São 29 testes novos de recuperação,
  cache, sessão, abas, finding, navegação e indicador.
- Build `tsc --noEmit && vite build` aprovado no contêiner. Aviso preexistente
  de bundle maior que 500 kB permanece.
- Chrome headless com a web em modo dev, StrictMode, API e banco existentes:
  **17/17 checks**. Login ADMIN demo, Dashboard, Aplicações, Projetos, Findings,
  Remediação, Playbooks, DAST, SLA, Aprovações e painel de aplicação.
- 429 controlado de dois segundos em Projects: spinner sem erro prematuro,
  nova tentativa depois do prazo e dados sem clique. Retorno recente usa cache.
- 429 **real** em timeseries no painel: resposta 200 **6,276 s** depois. Summary
  e timeseries retornam 200; Insights/Comparativo não são consultados fechados.
- Screenshot final do painel **com dados**, 375 px, movimento reduzido,
  sem overflow horizontal; nenhuma exceção JavaScript. `page-loading-spinner.png`,
  `page-loading-mobile.png` e `page-loading-smoke-result.json` contêm as evidências.
- Smoke somente leitura de domínio: não criou aplicações, projetos, findings,
  scans ou migrations. Login usa a conta demo já existente.

## Limites e ambiente

O build no host falhou porque `@playwright/test`, `dompurify` e `marked` estavam
ausentes antes da task. Validação foi realizada com as dependências completas
da imagem web existente, sem instalar ou alterar manifestos/lockfiles. O smoke
usa o Playwright bundled e Chrome instalado; seu script registra o caminho
deste ambiente. O lint global da API tem ressalva histórica de imports não
usados; não foi reexecutado, pois a API não mudou.

O smoke cobre o perfil ADMIN e os caminhos listados. Permissões de CLIENT e
PENTESTER permanecem cobertas pela suíte web existente, sem uma nova navegação
manual completa desses perfis. Não foi executado scan DAST nem escrita de
domínio no banco. Falhas persistentes continuam oferecendo recuperação manual.
O interceptor de refresh que desloga em falha de rede continua fora desta task
(L-17). Alterações de outros usuários podem aguardar revalidação de 30 s.

Decisão: ADR-044. Docs vivos: PRD, BACKLOG, ROADMAP, Changelog e FRONTEND_WEB.
