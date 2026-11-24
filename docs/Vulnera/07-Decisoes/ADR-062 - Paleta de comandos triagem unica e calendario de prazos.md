---
type: decisao
tags: [decision, frontend, backend, produtividade, multi-tenant]
status: vigente
codigo: ADR-062
data: 2026-11-23
---

# ADR-062 - Paleta de comandos, triagem única e calendário de prazos

> Branch irmã de `feat/grafo-postura` (ADR-061) e de
> `feat/conformidade-correcao` (ADR-063). Respostas em `docs/DECISIONS.md` D22.

## Contexto

Três funcionalidades de produtividade inspiradas em outras ferramentas:

- a paleta Ctrl+K (Linear, Raycast);
- a caixa de triagem por teclado (Superhuman);
- o calendário de prazos em heatmap (GitHub).

Hoje cada fonte de achado novo tem a própria tela: achados DAST no scan,
SAST/SCA na importação e casamentos do Threat Intel na aba "Afeta". O SLA
(CP-2) dá prazo às vulnerabilidades, mas só aparece como data na tabela.

## Decisão

1. **Paleta de comandos** (D22.7), aberta com Ctrl/⌘+K ou pelo botão do
   cabeçalho. Tem três grupos:
   - **navegação**: os mesmos itens da sidebar, filtrados pelo papel. A
     lista saiu da `sidebar.tsx` para `components/layout/navegacao.ts`, a
     fonte única;
   - **ações**: nova análise, triagem, apresentar o dashboard e trocar o
     tema;
   - **busca de entidades**: aplicações, projetos e vulnerabilidades, pelos
     endpoints que já existem, com o parâmetro `search`.

   Sem endpoint novo. O filtro e a pontuação são puros (`lib/paleta.ts`) e
   testados.

2. **Caixa de triagem única** (D22.8), em `GET /triage/inbox`, com o bucket
   `expensive` do rate limit. O service agrega as três fontes reaproveitando a
   autorização de cada uma:
   - **DAST**: os scans que `DastScanService.list` devolve ao usuário,
     somente ADMIN e PENTESTER;
   - **SAST/SCA**: a última importação de cada (projeto, ferramenta), por
     `CodeScanService.listImports`;
   - **Threat Intel**: só nas empresas em que `escopo.permissoes.triar` é
     verdadeiro.

   O endpoint só **lê**. A decisão (confirmar, falso positivo, aceitar)
   continua nos PATCH de cada módulo, então a auditoria e as regras de cada
   um não se duplicam. A tela `/triagem` funciona por teclado:
   - J/K ou as setas movem;
   - A confirma, F marca falso positivo e R aceita o risco;
   - U desfaz;
   - Enter ou O abre o item na tela de origem;
   - N anota;
   - ? mostra a ajuda.

   A atualização é otimista, com reversão se o PATCH falhar. Os atalhos não
   disparam com o foco num campo.

3. **Calendário de prazos** (D22.10), compacto no Dashboard e como aba
   "Calendário" da Remediação (`?vista=calendario`). Mostra o peso das
   vulnerabilidades abertas por dia de vencimento (CRITICAL 4 … LOW 1), com a
   pilha das vencidas e grade navegável por setas (roving tabindex). O clique
   no dia lista as vulnerabilidades **ali mesmo**, porque `/findings` não tem
   filtro por data de vencimento e criar um só para isto ampliaria a API sem
   necessidade.

## Alternativas descartadas

- **Busca global no backend** (um `/search`): duplicaria a autorização das
  três listas que já filtram por papel e empresa.
- **Decisão em lote pelo endpoint da caixa**: criaria um segundo caminho de
  escrita para cada módulo.
- **Filtro `slaDueAt` em `/findings`**: só para o clique no dia; fica para
  quando houver outro consumidor.

## Consequências

- Um endpoint novo, só de leitura, testado com tenancy (a dona da empresa A
  não vê o casamento da B) e papel (CLIENT não recebe DAST nem código; MEMBER,
  que não tria, recebe a caixa vazia).
- A sidebar e a paleta leem a mesma lista, então um item novo aparece nas
  duas.
- Limite: a caixa não pagina. Ela olha até 30 scans, 60 importações e 10
  empresas, e devolve no máximo 200 itens, os mais graves primeiro.

## Relacionado

[[ADR-052 - Importacao SAST e SCA por SARIF e CycloneDX]] ·
[[ADR-053 - Threat Intel com inventario de tecnologias e sincronizacao agendada]] ·
[[ADR-061 - Analises do Exposure Graph e comentarios no grafo]] · `docs/DECISIONS.md` D22
