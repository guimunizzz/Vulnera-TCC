---
status: aceito
data: 2026-11-16
---

<!-- Registra a fronteira entre resultados do produto e decoracao da Vuvu; consumido pelos mantenedores e pela banca. -->

# ADR-055 — Reações locais e modo discreto da Vuvu

## Contexto

O responsável autorizou quatro melhorias: transição do chat, suavização do olhar, reações a resultados confirmados e modo discreto. A ADR-054 limita o assistente à orientação e proíbe executar operações ou acessar registros para a geração. As reações precisam acompanhar o resultado da interface, sem adivinhar sucesso, ampliar acesso ou criar chamadas Gemini.

## Decisão

- Usar sinais tipados locais `report-ready` e `operation-error`, sem nomes, IDs, texto de erro, payload HTTP ou dados de relatório. Consumidor único: a instância autenticada da Vuvu.
- Capturar o assinante da sessão no início da ação e descartar resultados após sua substituição/desmontagem ou em aba oculta. O módulo não importa autenticação nem o cache, evitando ciclo entre store e QueryClient.
- Sinalizar relatório pronto após gerar o PDF e iniciar o download; no relatório de projeto, esperar também o registro final já existente. O navegador não confirma gravação no disco. Falha de geração/registro não gera sucesso.
- Observar falhas finais de mutations pelo `MutationCache` e os erros dos PDFs DAST/SAST nos seus handlers; cancelamentos e falhas de consultas/polling não disparam reação. Callbacks, erros, retries e fluxos existentes permanecem intactos. Falha da decoração nunca rejeita a operação.
- Reações são breves e somente visuais. Não roubam foco, abrem chat, executam operações ou substituem mensagens existentes. Modo discreto, modal, movimento reduzido/alto contraste, aba oculta, arraste, dança e chat ativo têm precedência; não há fila de reações para depois.
- Modo discreto é controlado pelo usuário: botão Recolher Vuvu no chat e ícone de 44 px na borda para restaurar. Mantém conversa, rascunho e posição na sessão; não persiste após reload e não se expande sozinho por evento.
- Entrada/saída do painel usam Motion já existente, `transform`/opacidade e tokens do projeto. Durante a saída, painel fica `aria-hidden`/`inert`; o rascunho pertence à sessão, não à montagem do painel.
- Olhar usa filtro temporal, margem entre direções e mistura curta entre duas poses originais. RAF encerra ao estabilizar; preferências, aba oculta e desmontagem cancelam trabalho. As 16 direções originais não viram uma animação 3D contínua.

## Consequências

Sem backend, schema, dependências, custo extra de provedor ou novos dados enviados. Cobertura de falhas é de ações via QueryClient e dos três fluxos de PDF integrados; não é um monitor genérico de toda falha do navegador. Componentes montados fora da sessão autenticada não recebem reações. Dados e preferências continuam sob seus mecanismos existentes.

A fluidez é verificada por transições e cadência no navegador; não se garante FPS fixo em todo equipamento. Reações não são evidência de ausência de vulnerabilidades ou confirmação de correção. A personagem continua parada até interação explícita.

## Relacionado

- [[ADR-054 - Assistente contextual com Gemini e ajuda local]]
- [[ADR-049 - Menu de acessibilidade com preferencias no navegador]]
- [[ADR-050 - Camadas de movimento e kit three.js imperativo no web]]
- `docs/QA_VUVU_FLUIDEZ_2026-11-16.md`
