<!-- Planeja a refatoração visual do assistente sem alterar sua integração; existe para delimitar a execução e é consumido pelo responsável e pelos mantenedores web. -->

# Plano de ação — visual do Assistente Vulnera

## Objetivo e ponto de partida

Melhorar a apresentação e a leitura do assistente, mantendo os contratos, permissões e fluxos já entregues. O usuário definiu a Vuvu fornecida como personagem e autorizou aplicar também sua personalidade às respostas do Gemini.

- Branch: `refactor/assistant-ui`.
- Origem: `feature/agent-ai`, commit `63c469625a2686e45afb7cccd307549dabe6da6e`.
- Estado atual: visual, personalidade, validação, documentação e aplicação local concluídos (6/6 checkpoints). O registro original de planejamento está preservado no histórico.
- Direção visual definida: Vuvu grafite/violeta do ZIP fornecido, presença suave, olhares e reações reais ao hover e aos estados da conversa; painel adaptado aos tokens do site. Prévias desktop/celular apresentadas ao usuário, que pediu continuar.
- Integração futura: se o PR de `feature/agent-ai` ainda estiver aberto, revisar inicialmente o diff visual contra essa branch. Antes de abrir PR para `dev`, conferir como a feature foi integrada, inclusive se houve squash, para evitar repetir alterações no diff. Não fazer merge automático nesta etapa.

## Escopo proposto

Refinar o disparador Ajuda e o mascote; hierarquia do cabeçalho; identificação da tela; apresentação das mensagens e da origem Gemini/Ajuda local; sugestões, atalhos, compositor e estados vazio, aguardando, erro e indisponível. Usar os tokens, fontes e componentes já existentes, com boa leitura nos temas e em diferentes tamanhos de tela.

A proposta inicial deve mostrar o assistente aberto e fechado em desktop e celular. Qualquer alteração de comportamento, como remover o passeio do mascote, mudar o tipo de painel ou persistir conversas, precisa ser identificada e discutida antes de entrar na implementação.

## Contratos a preservar

- Chave e integração Gemini somente no backend, com ajuda local e indicação verdadeira da origem.
- Envio explícito: abrir, animar, digitar, navegar ou preencher uma sugestão não gera chamadas externas.
- Tela capturada no envio, histórico em memória, cancelamento e isolamento por sessão.
- Permissões e atalhos por perfil, sem novos acessos ou execução de operações pelo texto.
- Instância única nas telas autenticadas; ausência nas públicas, mobile, impressão e documentos exportados.
- Painel não modal, Escape, foco visível, retorno ao disparador e nomes acessíveis coerentes com os textos visíveis.
- Bloqueio sob Dialog/Drawer e preservação do rascunho ao retornar.
- Movimento reduzido, pausa manual, foco, hover, aba oculta e estado compacto.

Escopo inicial: backend e prompts estavam fora da refatoração visual. **Ampliação explicitamente autorizada pelo usuário:** aplicar `personalidade.md` ao Gemini e apresentar a Vuvu também na ajuda local. Foram acrescentados somente dois termos exatos de identidade ao tópico existente para reconhecer “Quem é você?”/“Quem é a Vuvu?”. Cotas, contratos, recuperação dos demais tópicos, `.env`, schema, dependências e funcionalidades de negócio permanecem preservados. Problemas fora desse escopo serão registrados separadamente.

## Checkpoints de execução

### CP-0 — Investigar e preparar a branch — concluído

Conferir origem e árvore limpa; criar branch própria; ler os componentes visuais, movimento, conversa e regras do projeto; registrar escopo e riscos. Não alterar o produto.

Entregas: este plano, registro no PRD/BACKLOG e commit documental.

### CP-1 — Definir a direção e apresentar uma prévia — concluído

1. Registrar a preferência do usuário e eventuais referências que ele fornecer.
2. Capturar o estado atual a partir de um build correspondente ao checkout, em uma prévia isolada, sem substituir os containers existentes.
3. Preparar uma proposta com botão fechado, painel aberto, conversa curta e mensagem longa, em desktop e celular.
4. Demonstrar cores, espaçamento, tipografia, fonte da resposta, sugestões e controles. Preservar a identidade do Vulnera.
5. Apresentar o comparativo e registrar as escolhas antes de implementar a direção final. Informar explicitamente se alguma escolha afeta interação ou acessibilidade.

Aceite: direção e comportamento pretendidos claros; nenhuma decisão de produto escondida em uma mudança de estilo.

### CP-2 — Implementar o visual escolhido — concluído

Aplicar a proposta em blocos pequenos: disparador/mascote, estrutura do painel, mensagens e compositor. Manter o comportamento dos hooks e da API. Ajustar os limites geométricos do movimento caso o tamanho visual mude, verificando alinhamento e permanência na viewport.

Cobrir apresentação de conversa vazia, rascunho, envio pendente, resposta Gemini, resposta local, erro, limite de requisições e texto longo. Reutilizar SVG e bibliotecas já instaladas; não adicionar dependências por padrão.

Aceite: interface corresponde à proposta, com controles legíveis, origem da resposta visível e fluxos existentes preservados.

### CP-3 — Conferir responsividade e acessibilidade — concluído

Validar 320×568, 390×844, 768×1024 e 1440×900; temas claro/escuro, sistema, alto contraste, texto a 200% e movimento reduzido. Conferir teclado, leitor de tela por inspeção semântica/axe, foco, retorno de modal, rolagem e área de digitação em telas baixas. Registrar separadamente a verificação em celular e leitor de tela reais, caso não estejam disponíveis.

Comparar a largura da página com o assistente fechado e aberto. O overflow preexistente a 320 px deve ser distinguido de qualquer regressão nova; corrigir a página inteira seria outro escopo.

Aceite: assistente sem corte ou novo overflow; controles com alvo mínimo de 44 px; contraste aprovado; nenhuma regra de acessibilidade desativada.

### CP-4 — Validar regressões — concluído

- Rodar testes focais existentes de assistente, contexto e roteamento; atualizar apenas expectativas afetadas e adicionar cobertura onde houver risco de comportamento novo.
- Executar `npm run check --workspace=app/web` e `npm run build --workspace=app/web`.
- Repetir e2e pertinentes de acessibilidade e smoke por ADMIN/CLIENT/PENTESTER, incluindo modais, navegação, rascunho, origem da resposta, logout e descarte de resposta pendente.
- Conferir ausência de POST antes do envio e de erros de página/CSP.
- Usar respostas controladas nos testes repetidos. Uma prova Gemini real pode complementar a entrega quando necessária, sem expor chave, enviar dados reais ou multiplicar chamadas para validar CSS.
- Se a execução exigir alterar backend ou contratos, interromper esse desvio e discutir o impacto antes de ampliar o escopo.

Referência histórica da branch de origem: Web 659/659, contraste 132/132, API 905/905 no Node 22 e e2e acessibilidade/Exposure Graph 7/7. Esses números são evidência anterior e não representam uma execução nesta branch.

### CP-5 — Documentar e entregar — concluído

Registrar capturas antes/depois e resultados efetivos; atualizar guia, PRD e BACKLOG. Ao encerrar a fase, atualizar ROADMAP/Changelog, preservando o histórico. Criar ADR somente se houver decisão arquitetural nova.

Revisar o diff para excluir segredos e mudanças incidentais; preparar título/descrição do PR e apontar a base correta conforme o estado da integração anterior. Aplicar o visual nos containers existentes somente em uma etapa de atualização explicitamente definida, preservando os dados.

## Commits previstos

Commits com identidade `iannxz`, em Conventional Commits, por bloco revisável:

- `docs(assistant): planeja refatoracao visual`.
- `refactor(assistant): atualiza apresentacao do mascote e painel`.
- `fix(assistant): ajusta responsividade e acessibilidade`, se houver correções distintas.
- `test(assistant): cobre interacoes afetadas pelo novo visual`, quando houver mudanças de testes relevantes.
- `docs(assistant): registra validacao do novo visual`.

Os nomes finais devem descrever o que realmente for implementado. Não criar commits vazios para seguir esta lista. Apresentar relatório ao fim de cada checkpoint com arquivos, resultados, decisões e próximo passo.

## Riscos observados na investigação

- Na origem, o tamanho do conjunto do mascote estava duplicado em CSS e constantes (116×88). Agora o limite 144×128 é compartilhado entre movimento e CSS por `ASSISTANT_FOOTPRINT` e custom properties.
- O painel tem posicionamento e altura próprios, independentes do passeio. Uma mudança visual não pode fazê-lo seguir o mascote ou fugir da viewport sem decisão explícita.
- O portal e a observação de modais protegem a interação. Reestruturar o DOM pode afetar foco, inert e z-index.
- Trocar a montagem dos componentes pode apagar conversa/rascunho ou criar instâncias duplicadas; preservar os limites de sessão.
- A API local tem Gemini ativo. Não reiniciar a stack ou provocar chamadas externas apenas para avaliar aparência.

## Histórico

- 2026-11-15: branch criada diretamente de `feature/agent-ai` em `63c4696`; planejamento concluído, implementação pendente e direção visual aguardando preferência do usuário. Sem PR, publicação de nova branch ou alteração de runtime nesta etapa.
- 2026-11-15: usuário forneceu `Vuvu-Animada.zip`/`personalidade.md`, pediu animações suaves e interativas e autorizou aplicar a voz ao Gemini. Após as prévias, pediu continuar. Atlas copiado sem alterar pixels, painel/estados implementados e personalidade testada por chamada real. Prévia visual isolada em `127.0.0.1:4188`; containers existentes preservados. Resultados finais no relatório de QA da Vuvu.
- 2026-11-15: validação final aprovada (API 906, Web 671, contraste 132 e navegador/CSP 10); ajustes finais de rolagem/foco/texto ampliado conferidos em build e 48 testes focais Web. API focal final 59/59. Usuário autorizou aplicar em `localhost:8086`; imagens antigas guardadas localmente e reconstrução iniciada, sem alteração de banco/volumes.
- 2026-11-15: API/Web Docker reconstruídos e aplicados após confirmar novamente zero scans ativos. Health, imagem do atlas e resposta Gemini com identidade Vuvu aprovados no navegador real. Banco/Mailhog e mounts preservados, contagens de negócio iguais. Prévias fictícias e relatório final versionados; revisão/merge de PR ficam separados da aplicação local autorizada.
