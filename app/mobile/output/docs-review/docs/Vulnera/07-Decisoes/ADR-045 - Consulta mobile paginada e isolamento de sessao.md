---
type: decisao
tags: [decision, mobile, api, pagination, tenancy]
status: vigente
codigo: ADR-045
data: 2026-10-06
---

# ADR-045 - Consulta mobile paginada e isolamento de sessao

## Contexto

A refatoração autenticada do mobile foi solicitada com liberdade visual, preservando login, tonalidade roxa e liquid glass. O contrato de `GET /vulnerabilities` é paginado e sua projeção de listagem difere do detalhe. O mobile anterior limitava o projeto aos primeiros 100 findings e podia apresentar falhas de consultas auxiliares como estados vazios. O cache de consultas não era limpo ao trocar de conta, e falha de rede no refresh encerrava a sessão.

## Decisão

- Manter o escopo read-only e exclusivo do CLIENT da Fase 7 e ADR-004; tenancy e autorização permanecem no servidor.
- Preservar paginação e facetas da API. Usar tipos distintos para listagem/detalhe, `useInfiniteQuery` e carregamento explícito em páginas de 30; comentários também são paginados.
- Carregar evidências/comentários ao abrir as abas e distinguir ausência de dados de erro de leitura. Resumos usam totais/facetas do servidor.
- Limpar/cancelar consultas em logout e nova autenticação. Ignorar resultado de refresh que pertença a uma sessão anterior, inclusive quando esse refresh for recusado.
- Preservar sessão em falha transitória de refresh; encerrar apenas após 401/403 correspondente à mesma sessão. Manter a fila única de refresh e timeout de 20 s.
- Leituras usam cache fresco de 30 s, atualização ao retornar ao app e uma retentativa transitória que respeita `Retry-After`.
- Android/iOS mantêm tokens no SecureStore. Preview web usa sessão volátil em memória, sem persistência em storage de navegador. Downloads de evidência permanecem autenticados, nunca com token na URL.
- Isolar os novos estilos autenticados em `theme/workspace.ts`, preservando os tokens e componentes do login.

## Consequências

Projetos com mais de uma página não ficam truncados e seus resumos não dependem da quantidade já carregada. O usuário distingue indisponibilidade da API de uma lista realmente vazia. A nova autenticação não reutiliza consultas da conta anterior. Os contratos e limites do backend permanecem intactos; nenhum model ou migration novo é necessário. Aparência nativa e entrega de push ainda exigem validação no aparelho. O preview web existe para QA e não constitui uma nova superfície distribuída do produto.

## Relacionado

- [[ADR-004 - Mobile cliente e read-mostly]]
- [[ADR-027 - Mobile fora do workspace npm da raiz]]
- [[ADR-044 - Recuperacao de leituras e cache na navegacao]]
- `docs/ROADMAP_PROMPTS.md`, Fase 7
- `app/mobile/output/mobile-refactor-report.md`
