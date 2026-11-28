---
type: decisao
tags: [decision, assistente, ia, gemini, escopo]
status: vigente
codigo: ADR-064
data: 2026-10-23
---

<!-- Registra a reintrodução limitada da IA como orientação contextual, suas fronteiras e alternativa local; consumido pela implementação, pelos mantenedores e pela banca. -->

# ADR-064 — Assistente contextual com Gemini e ajuda local

## Contexto

> Atualização 2026-11-16: a [ADR-066](ADR-066%20-%20Conversa%20basica%20e%20cota%20de%20geracao%20da%20Vuvu.md) substitui somente a aplicação dos buckets próprios a toda mensagem: eles passam a reservar tentativas de geração, com ajuda local e prazo em seu esgotamento. Limites HTTP gerais preservam 429. Decisões originais abaixo mantidas como histórico.

O ADR-017 retirou a IA do MVP em 03/08/2026, incluindo sugestões de findings. ADR-006 e ADR-011 preservam decisões anteriores sobre Gemini. Em 23/10/2026 foi solicitada explicitamente uma nova entrega: um mascote com chat de orientação para a apresentação do TCC, exclusivo da web autenticada.

Esta decisão registra a autorização de escopo do pedido atual, sem editar regras protegidas de `AGENTS.md`, `CLAUDE.md` ou `GOTCHA.md`. O histórico do corte continua válido para as funcionalidades antigas. Na criação desta ADR, a Fase 0 está concluída e a implementação ainda não começou.

## Decisão

> Em 27/11/2026, a [ADR-068](ADR-068%20-%20Orcamento%20e%20fronteiras%20da%20Vuvu.md) atualizou a coordenação de orçamento e a política de modelos. Testes com transporte simulado usam identificadores públicos compatíveis, independentes da escolha privada do ambiente.

- **Invariante de privacidade (H6, PR #88):** `systemInstruction` recebe somente instruções estáticas, o papel autenticado, um rótulo de tela de catálogo fechado e ajuda pública versionada filtrada por papel. Dados de tenant, identidade (como IDs de empresa, usuário e recurso), registros e segredos jamais entram nesse campo. Pergunta e histórico são dados não confiáveis e só entram em `contents` após os limites e filtros aplicáveis. Regexes são heurísticas para texto livre e podem deixar passar dados. A garantia depende da origem restrita do contexto e da ausência de ferramentas ou acesso a registros pelo modelo. Incluir qualquer dado de tenant nesse fluxo requer uma nova decisão de arquitetura e revisão da fronteira.
- **Ampliação de domínio em 2026-11-16:** catálogo de 44 tópicos (29 anteriores mais 15 aprofundamentos), sem leitura bruta de docs ou dados reais. Jornadas conectam pré-condições, etapas, responsáveis e próximo passo; empates de recuperação preferem expressões específicas. Preservados três tópicos/6.000 caracteres, saída, chamadas e permissões. O alinhamento da API principal, ainda em 17 tópicos antes desta aplicação, é registrado em `docs/QA_VUVU_CONTEXTO_2026-11-16.md`; curadoria em `docs/ASSISTENTE_CONTEUDO_PRODUTO.md`. Sem nova arquitetura de recuperação ou persistência.
- **Esclarecimento PR #77 (2026-11-16):** ajuda curada exclusivamente de domínio/produto, conferida contra o comportamento vigente, sem ingestão de documentação arquitetural ou de desenvolvimento. Catálogo atual de 29 tópicos; até três e 6.000 caracteres por chamada. Identificador concreto do modelo apenas no ambiente privado; exemplos vazios, fixture sintética e alternativa local quando uma resposta reproduz valores privados configurados. O histórico Git não foi reescrito. Ver `docs/ASSISTENTE_CONTEUDO_PRODUTO.md` e `docs/REVISAO_PR77_2026-11-16.md`.
- Reintroduzir IA apenas como **Assistente Vulnera**, para explicar telas, processos e conceitos em PT-BR. Nenhuma geração de findings, cálculo de severidade, leitura de registros reais, preenchimento ou alteração de dados, execução de scans ou integração mobile.
- Usar base curta de ajuda versionada e recuperação simples por tela/termos/histórico limitado. Não adicionar embeddings, banco vetorial, conversas persistidas, migration, repository vazio ou infraestrutura nova.
- Integrar Gemini Developer API por `fetch` em gateway injetável, com endpoint oficial fixo e uma chamada por pergunta explícita. Chave somente no backend, via `EnvVar`/`EnvKeys`; chave/modelo ausentes não impedem inicialização.
- Manter `ASSISTANT_MODE=local|gemini`, padrão local. Modo Gemini depende de `GEMINI_API_KEY` e `GEMINI_MODEL`. A ajuda local é alternativa funcional e sempre identificada pela origem da resposta, sem se apresentar como IA ao vivo.
- Configurar o identificador do modelo somente no ambiente privado, conferindo disponibilidade, contrato, cotas e elegibilidade no projeto do responsável. Exemplos públicos deixam o valor vazio; testes usam identificador sintético. A escolha concreta da rodada de 23/10/2026 foi omitida da versão pública atual no atendimento ao PR #77, sem reescrever o histórico.
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
- [Modelo](https://ai.google.dev/gemini-api/docs/models), [preços](https://ai.google.dev/gemini-api/docs/pricing), [ciclo de vida](https://ai.google.dev/gemini-api/docs/deprecations), [faturamento](https://ai.google.dev/gemini-api/docs/billing), [limites](https://ai.google.dev/gemini-api/docs/rate-limits), [contrato REST](https://ai.google.dev/api/generate-content), [termos](https://ai.google.dev/gemini-api/terms).

## Implementação e evidências — 2026-10-23

Fases 1–6 entregues: endpoint autenticado, base de 14 tópicos, gateway opcional, limites compartilhados e interface contextual com sessão em memória. Foram aprovados 47 testes focais API, 45 focais web, check web com 400 testes, 13 verificações HTTP locais e 12 cenários no build servido em 8086, além dos três perfis com login real e fluxo CLIENT pela UI. Serviços novos atingiram 100% de cobertura de linhas; builds host/Docker aprovados. Guia em [ASSISTENTE_VULNERA.md](../../ASSISTENTE_VULNERA.md); resultados completos e limitações em [VALIDACAO.md](../../VALIDACAO_ASSISTENTE_2026-10-23.md).

A configuração runtime consultada sem expor valores não continha chave/modelo Gemini; validação ao vivo permanece pendente. O check global API continua sujeito a dois imports antigos não usados e a incompatibilidade anterior da assertion de header Excel com o Express instalado, documentadas separadamente. A nota de criação com implementação pendente acima é preservada como histórico da Fase 0.

## Identificação na integração — 2026-11-15

Esta decisão foi criada como ADR-048 na feature/agent-ai em 23/10/2026. A dev passou a usar ADR-048 para o grafo DAST. Na integração, a decisão do assistente recebeu ADR-054, com conteúdo e histórico preservados e links atualizados; a ADR-048 do grafo permanece intacta. Menções históricas ao ADR-048 do assistente correspondem agora a esta decisão.

Em 26/11/2026, a integração do PR #77 renumerou esta decisão para ADR-064. O número ADR-054 ficou associado ao registro da pintura da landing na dev. ADR-048 e ADR-054 são identificadores históricos do assistente na feature.

## Evolução Vuvu — 2026-11-15

> **Atualização autorizada de interação — 2026-11-16:** passeio, flutuação e botão de pausa citados nos registros anteriores foram substituídos por posição controlada por arraste/teclado. O usuário escolheu duplo clique para o novo atlas six seven, uma execução de 2,88 s e alternativa por Shift+Enter; não abre conversa nem solicita geração. Preferências/contextos restritivos continuam interrompendo animações e o repouso não mantém loop. Chat compacto preserva origem, contexto, atalhos e sessão. Backend/personalidade inalterados. Detalhes em `docs/QA_VUVU_INTERACOES_2026-11-16.md`; o registro abaixo permanece histórico.

O responsável forneceu o atlas animado da Vuvu e sua personalidade, autorizando explicitamente aplicá-la também às respostas Gemini. A personagem é renderizada a partir do PNG local original, sem WebGL, nova dependência ou serviço de animação. Quadros e 16 direções de olhar respondem a eventos da interface; coordenadas de cursor não entram na conversa nem saem do navegador. O player pausa por preferências, modal, aba oculta e controle manual, sem render React a cada quadro.

O tom acolhedor e curioso não amplia o escopo desta ADR: perfis, ajuda documentada, operações proibidas e limites permanecem. A apresentação da Vuvu também funciona localmente. O painel mantém o modelo não modal e a conversa em memória; a altura/rolagem se adapta ao texto ampliado. Evidências em [QA_VUVU_UI_2026-11-15.md](../../QA_VUVU_UI_2026-11-15.md).
