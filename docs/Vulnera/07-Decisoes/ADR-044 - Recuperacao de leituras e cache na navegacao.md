---
type: decisao
tags: [decision, frontend, cache, rate-limit]
status: vigente
codigo: ADR-044
data: 2026-10-01
---

<!-- Explica a recuperação e o cache das leituras; existe para compatibilizar
     navegação e rate limiting; consumido pela equipe e agentes do projeto. -->

# ADR-044 — Recuperação de leituras e cache na navegação

## Contexto

As APIs do frontend já retornam Promises corretamente. A primeira carga falha
quando o rate limiter responde 429 e a única retentativa global acontece após
um segundo, antes do prazo informado. O dashboard da aplicação fazia quatro
consultas caras simultâneas contra um burst compartilhado de três: reprodução
com os middlewares HTTP reais produziu 200/200/200/429, espera de seis segundos
e sucesso após esse prazo. Navegação rápida também consome os buckets de usuário
e global, enquanto o cache era considerado obsoleto imediatamente.

O cabeçalho Retry-After não é exposto pelo CORS atual. O JSON já contém
`retryAfterSeconds`, disponível ao navegador sem mudar a API.

## Decisão

- Centralizar a recuperação das queries no `query-client.ts`: no máximo duas
  retentativas para 429, erros de rede Axios e HTTP 500/502/503/504.
- Para 429, ler primeiro o prazo do JSON; como fallback aceitar Retry-After em
  segundos ou data HTTP. Esperar o prazo mais 250 ms. Sem prazo válido, usar
  um segundo. Prazos maiores que 30 segundos encerram a recuperação automática.
- Não repetir cancelamentos, falhas definitivas como 401/403/404 ou mutations.
  As gravações continuam exigindo uma ação explícita do usuário.
- Usar `networkMode: always` nas leituras para permitir recuperação e erro
  visível mesmo quando o navegador informa estar offline.
- Considerar uma leitura fresca por 30 segundos. Invalidar os prefixos de
  recursos afetados após gravações, e limpar o cache ao sair ou trocar de
  usuário. A rotação dos tokens da mesma sessão preserva o cache.
- Buscar métricas somente das abas abertas: summary sempre; timeseries na
  Postura/Evolução; insights e comparison nas respectivas abas. A janela de
  período não muda quando só a aba muda.
- Preservar o elemento retornado por `useOutlet` na transição para manter o
  contexto da página que está saindo, em vez de um Outlet vivo nessa saída.
- Exibir no cabeçalho um indicador após 200 ms, com espaço reservado, estado
  acessível e movimento reduzido. Os skeletons existentes permanecem na
  primeira carga. O botão de recuperação do finding refaz seu GET.

## Consequências

A pausa recuperável permanece como carregamento até a resposta ou o limite de
tentativas, sem exigir o clique manual prematuro. Leituras recentes reduzem o
tráfego ao voltar a uma página. Dados modificados pela própria sessão invalidam
os caches correspondentes imediatamente; alterações de terceiros podem ficar
visíveis só na próxima revalidação após os 30 segundos, salvo polling existente.

Os limites da API permanecem ativos e inalterados. A aplicação não promete
recuperação infinita: falha persistente mostra a recuperação manual existente.
O comportamento de logout por falha de rede no refresh permanece separado no
backlog L-17; essa alteração não muda o interceptor de autenticação.

## Relacionado

- [[ADR-040 - Rate limiting multi-tenant em memoria]]
- [[ADR-041 - Atmosfera unica no layout autenticado]]
- `docs/FRONTEND_WEB.md`
- `output/page-loading-validation.md`
