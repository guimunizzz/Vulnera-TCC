# Remediação e SLA — relatório visual

**Data:** 2026-09-23 · **Branch:** `feat/remediation-sla-visual` · **Base:** `76e4f81`

## Arquivos

- `app/web/src/pages/remediation-page.tsx` e `remediation-page.css`
- `app/web/src/pages/remediation-page-flow.test.tsx`
- `app/web/src/pages/settings/sla-settings-page.tsx`, `sla-settings-page.css` e `sla-settings-page.test.tsx`
- `PRD_VIVO.md` e `docs/BACKLOG.md` (registro exigido pela documentação viva)
- Este relatório

O arquivo não rastreado `repomix-output.md` já existia antes desta tarefa e não foi alterado.

## Entrega

**`/remediation`.** Hero e contadores derivados do quadro carregado; identidade semântica de OPEN, IN_PROGRESS e FIXED; filtros, skeleton, vazio e erro com nova tentativa; cards mais legíveis com ações sempre visíveis. `CLOSED` permanece fora. `layoutId` no card comunica a troca de coluna após confirmação/refetch, sem atualização otimista nem drag-and-drop. Entrada escalonada somente na primeira carga, crossfade curto ao trocar o recorte, contador animado e feedback de mutation. Candidatos a responsável continuam carregados somente ao abrir o menu.

**`/settings/sla`.** Hero de governança, quatro módulos de severidade com os inputs reais de dias, reação breve ao sair de um campo válido, estado de erro acessível e histórico em tabela com linha vigente e rolagem horizontal no celular. Salvar e Reaplicar são superfícies separadas: salvar não recalcula prazos existentes; reaplicar continua ADMIN-only. Perfil MEMBER recebe informação de consulta sem botão de escrita.

Motion reutiliza `useMotion`, `NumeroAnimado` e tokens existentes. O caminho de `prefers-reduced-motion` remove deslocamento/stagger/layout spring, contagem numérica e destaque em escala; CSS local cancela animações/transições decorativas. Não há loop contínuo nem Three.js nesta rodada.

## Permissões e navegador

- ADMIN: seletor de empresa exibido com TechNova, edição, salvar, reaplicar e histórico conferidos na sessão já autenticada. A troca para outra empresa foi coberta por teste automatizado, não por sessão real.
- CLIENT OWNER: política da própria empresa editável; sem seletor de empresa ou reaplicação.
- CLIENT MEMBER: política/histórico somente leitura; inputs desabilitados, sem botão de salvar.
- PENTESTER: tentativa de acesso direto a `/settings/sla` redirecionou ao dashboard.
- Remediação: carregamento das três etapas, filtro por projeto, `IN_PROGRESS → FIXED → IN_PROGRESS`, atribuir Bruno e remover responsável foram testados no navegador. O teste automatizado existente confirmou a busca lazy de candidatos. Teste de mutation diferida confirmou um único card no destino depois do refetch.
- SLA: entrada inválida `0` exibiu erro e bloqueou Salvar; valores 2/7/30/90 foram salvos sem reaplicação automática. A ação Reaplicar foi executada separadamente e informou 6 findings abertos recalculados; histórico exibiu a versão vigente.
- Matriz visual: ambas as páginas inspecionadas em 1440, 768 e 375 px, claro e escuro. `scrollWidth` da página ficou abaixo da largura do viewport em todos os tamanhos; no SLA móvel, somente a região da tabela rola horizontalmente (672 px de conteúdo em 331 px de região).
- Console: nenhum erro/Promise rejeitada/Motion warning nas duas rotas. Os avisos observados eram do gráfico do Dashboard ao alternar perfis, fora do escopo.

**Limite da validação:** a ferramenta de navegador não disponibilizou emulação da media query de movimento reduzido (`cdp` indisponível). O comportamento foi revisado no hook Motion e nas regras CSS, mas não foi observado em um navegador com essa preferência ativa. Após alternar os perfis, a tentativa de voltar à conta ADMIN com a credencial de demo retornou “e-mail ou senha incorretos”; a conta/seed não foi modificada.

## Verificações

| Comando | Resultado |
| --- | --- |
| `npm run lint` | 0 erros; 9 avisos preexistentes fora destas páginas |
| `npm run check:contrast` | 66/66 pares WCAG AA |
| `npm test -- --maxWorkers=1` | 236/236 testes, 20/20 arquivos (contêiner com `src` e `vitest.config.ts` montados) |
| `npm run build` | TypeScript + Vite aprovados no contêiner; aviso já existente de bundle > 500 kB |

O host não possui todas as dependências de desenvolvimento (`@playwright/test`, `dompurify`, `marked`); por isso o build/teste completo foi repetido no contêiner. Uma primeira execução de teste no contêiner sem montar `vitest.config.ts` usou a configuração padrão do Vite e falhou por ausência de `jsdom`; a execução correta, com o arquivo de configuração montado, passou 236/236.
Vitest ainda emite avisos de future flags do React Router e de atualizações assíncronas fora de `act` em alguns testes; nenhum erro de console apareceu nas páginas reais.

## Achados e escopo

Durante a inspeção foram corrigidos a precedência das cores das colunas, a persistência de um destaque no modo de movimento reduzido e o texto de leitura do perfil MEMBER. A checagem visual do design seguiu a hierarquia e os tokens semânticos do Design System; nenhuma infraestrutura compartilhada foi alterada. API, backend, banco/schema, RBAC, contratos, dependências e lockfiles permaneceram intactos. Os testes manuais alteraram dados do banco de demonstração: versão de política TechNova com valores padrão e recálculo auditado de 6 findings; a atribuição e o status do finding usado no teste foram restaurados, embora a transição possa ter atualizado sua data de SLA/auditoria.

## Git

Arquivos desta tarefa: as duas páginas, seus estilos e testes locais, documentação viva e este relatório. `repomix-output.md` permanece não rastreado e alheio à tarefa.

O commit local foi solicitado depois da entrega inicial e realizado nesta branch. Nenhum push foi realizado.

**Mensagem do commit:** `feat(web): refina remediação e políticas de SLA`
