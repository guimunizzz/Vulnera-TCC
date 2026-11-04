---
type: decisao
tags: [decision, assistente, ia, gemini, escopo]
status: vigente
codigo: ADR-048
data: 2026-10-23
---

<!-- Registra a reintrodução limitada da IA como orientação contextual, suas fronteiras e alternativa local; consumido pela implementação, pelos mantenedores e pela banca. -->

# ADR-048 — Assistente contextual com Gemini e ajuda local

## Contexto

O ADR-017 retirou a IA do MVP em 03/08/2026, incluindo sugestões de findings. ADR-006 e ADR-011 preservam decisões anteriores sobre Gemini. Em 23/10/2026 foi solicitada explicitamente uma nova entrega: um mascote com chat de orientação para a apresentação do TCC, exclusivo da web autenticada.

Esta decisão registra a autorização de escopo do pedido atual, sem editar regras protegidas de `AGENTS.md`, `CLAUDE.md` ou `GOTCHA.md`. O histórico do corte continua válido para as funcionalidades antigas. Na criação desta ADR, a Fase 0 está concluída e a implementação ainda não começou.

## Decisão

- Reintroduzir IA apenas como **Assistente Vulnera**, para explicar telas, processos e conceitos em PT-BR. Nenhuma geração de findings, cálculo de severidade, leitura de registros reais, preenchimento ou alteração de dados, execução de scans ou integração mobile.
- Usar base curta de ajuda versionada e recuperação simples por tela/termos/histórico limitado. Não adicionar embeddings, banco vetorial, conversas persistidas, migration, repository vazio ou infraestrutura nova.
- Integrar Gemini Developer API por `fetch` em gateway injetável, com endpoint oficial fixo e uma chamada por pergunta explícita. Chave somente no backend, via `EnvVar`/`EnvKeys`; chave/modelo ausentes não impedem inicialização.
- Manter `ASSISTANT_MODE=local|gemini`, padrão local. Modo Gemini depende de `GEMINI_API_KEY` e `GEMINI_MODEL`. A ajuda local é alternativa funcional e sempre identificada pela origem da resposta, sem se apresentar como IA ao vivo.
- Recomendar inicialmente `gemini-3.5-flash-lite`, estável, com texto no Free Tier e sem desligamento anunciado nas fontes oficiais consultadas em 23/10/2026. Modelo configurável; reconferir disponibilidade/contrato na integração. Não recuperar exemplos históricos de Gemini 1.5.
- Derivar perfil/identidade da autenticação. Enviar somente pergunta/histórico limitados, tela normalizada, role e ajuda selecionada. Não coletar dados de negócio, DOM ou identificadores de recursos para o provedor; usar documentação e dados fictícios nos ensaios.
- Determinar ações por catálogo fechado da aplicação, filtrado no servidor e na interface. O texto do modelo não concede permissões e não define URLs ou operações executáveis.
- Aplicar limites próprios por usuário e globais à instância, compartilhados entre requisições, preservando o contrato HTTP 429 atual. Limitar tamanho de entrada/histórico/saída e timeout; nenhuma repetição automática ou troca de provedor/modelo. Falhas externas caem para ajuda local; limite da aplicação continua 429.
- Montar uma única instância por árvore autenticada, acima do AppLayout e fora das transições de página, incluindo onboarding e visualizador DAST. Portal deve respeitar inert/modais, movimento reduzido e impressão. Conversa somente em memória da sessão/aba, cancelada e limpa ao encerrá-la ou substituí-la.

## Consequências

- O ADR-017 fica parcialmente superado **apenas quanto à proibição total de orientação com IA**. Sugestões de findings, `aiAssisted` e IA no mobile continuam excluídas. ADR-006/011 permanecem referências históricas, não contratos desta nova feature.
- A API ganha uma dependência externa opcional, com ajuda local para modo explícito, configuração ausente, indisponibilidade, timeout, cota e resposta inválida. Sem internet externa, a demonstração local pressupõe API local acessível.
- A aplicação não comprova billing tier pela chave e não garante custo zero. A operação depende de projeto elegível ao Free Tier, sem faturamento/trial pago, e de recursos/modelo elegíveis. Não ativar grounding ou serviços adicionais.
- Google pode usar entradas e respostas gratuitas para melhorar produtos, inclusive revisão humana. A entrega deve explicar essa condição e limitar o uso a orientação/dados fictícios, sem conteúdo confidencial da plataforma.
- Contadores e conversa não são persistidos: cotas reiniciam com o processo e a conversa termina com a sessão/aba. Não são adequados a múltiplas instâncias sem coordenação futura.
- O limiter precisa reter buckets pelo período necessário à reposição e impedir reinício de cota por evicção. O setup atual de testes exige confirmar banco separado antes da integração.
- Nenhuma validação real com Gemini foi feita nesta fase. Consulta à documentação não comprova acesso da conta nem funcionamento do gateway ainda não implementado.

## Relacionado

- [Plano e evidências da Fase 0](../../ASSISTENTE_VULNERA_PLANO.md)
- [[Adr 017 ia cortada do escopo do mvp]] · [[ADR-006 - Gemini com rate limit agressivo]] · [[ADR-011 - Provedor de IA em revisao]] · [[ADR-040 - Rate limiting multi-tenant em memoria]]
- [Modelo](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), [preços](https://ai.google.dev/gemini-api/docs/pricing), [ciclo de vida](https://ai.google.dev/gemini-api/docs/deprecations), [faturamento](https://ai.google.dev/gemini-api/docs/billing), [limites](https://ai.google.dev/gemini-api/docs/rate-limits), [contrato REST](https://ai.google.dev/api/generate-content), [termos](https://ai.google.dev/gemini-api/terms).

## Implementação e evidências — 2026-10-23

Fases 1–6 entregues: endpoint autenticado, base de 14 tópicos, gateway opcional, limites compartilhados e interface contextual com sessão em memória. Foram aprovados 47 testes focais API, 45 focais web, check web com 400 testes, 13 verificações HTTP locais e 12 cenários no build servido em 8086, além dos três perfis com login real e fluxo CLIENT pela UI. Serviços novos atingiram 100% de cobertura de linhas; builds host/Docker aprovados. Guia em [ASSISTENTE_VULNERA.md](../../ASSISTENTE_VULNERA.md); resultados completos e limitações em [VALIDACAO.md](../../../output/assistant/VALIDACAO.md).

A configuração runtime consultada sem expor valores não continha chave/modelo Gemini; validação ao vivo permanece pendente. O check global API continua sujeito a dois imports antigos não usados e a incompatibilidade anterior da assertion de header Excel com o Express instalado, documentadas separadamente. A nota de criação com implementação pendente acima é preservada como histórico da Fase 0.
