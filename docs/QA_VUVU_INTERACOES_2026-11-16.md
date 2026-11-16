<!-- Registra a evolucao de interacao e leitura da Vuvu, seus testes e limites; existe para revisao e e consumido pelos mantenedores. -->

# Vuvu — arraste, six seven e chat compacto

Data: 2026-11-16. Branch `refactor/assistant-ui`, sobre `2abbd9b`. Evolução posterior ao PR #77, que permanece na `feature/agent-ai` sem estas mudanças visuais.

## Escolhas autorizadas

O usuário forneceu `Vuvu-Six-Seven-Original.zip`, pediu retirar passeio e botão de pausa, permitir segurar/arrastar com animação e deixar o chat menos poluído. Entre as opções apresentadas, escolheu **duplo clique** como surpresa para o six seven. O gesto de arraste usa animação separada.

## Resultado

- A personagem fica na posição escolhida durante a sessão, inclusive ao navegar. Sem passeio, flutuação automática, inércia ou botão de pausa; reload/nova sessão volta ao canto.
- Mouse, toque e caneta usam Pointer Events com captura. Movimento acima de 6 px inicia o arraste e sua animação. Soltar não abre o chat. Cancelamento, perda de captura, blur, modal e resize encerram o gesto; limites mantêm a área dentro da viewport.
- Clique simples continua abrindo/fechando o chat, com 280 ms para distinguir o duplo clique. Teclado/leitor de tela abre imediatamente. Setas movem 24 px e Home volta ao canto.
- Duplo clique ou Shift+Enter dispara o six seven por **2,88 segundos**, uma única vez. Não consulta API, não abre o painel e não comemora automaticamente dados ou operações reais.
- Atlas novo copiado sem edição: PNG 2048×1024, oito poses, três ciclos, 120 ms/quadro. SHA-256 `265e90dea0a6f4b8885c0c7506fe7c7a21a159f2c9533b2a0568f6463b630565`. Atlas anterior preservado; nenhuma geração/edição da arte.
- Repouso não agenda loop. Movimento reduzido, alto contraste, modal e aba oculta restringem animações; posicionamento explícito permanece disponível. Timers/listeners encerrados na desmontagem.
- Chat com cabeçalho/avatar menores, contexto integrado, menos ornamentos, limpar conversa no cabeçalho, envio compacto e contador visível somente a partir de 800 caracteres. Sugestões iniciais preservadas, recolhidas após começar a conversa; origem Gemini/Ajuda local, todos os atalhos autorizados e texto de privacidade mantidos.
- Conversa, autenticação, isolamento de sessão, limites e backend permanecem iguais. Não há novo evento de mouse/toque enviado ao provedor.

## Verificações

| Verificação | Resultado |
| --- | --- |
| Focais do assistente/player | **43/43** |
| `npm run check -- -- --maxWorkers=2` no Web | **677/677**, 76 arquivos; lint sem erros |
| Contraste | **132/132**, dois temas e alto contraste |
| Build TypeScript/Vite | Aprovado |
| Navegador no build de produção | **11/11**, sem erros de página/CSP |
| Axe, todas as regras AA selecionadas | Sem violações nas rodadas finais |
| Mouse, toque por CDP e teclado | Arraste, limites, cancelamento, clique e surpresa conferidos |
| Responsividade | 1440×900, 390×844 e 320×568; claro/escuro; texto 200% com alto contraste e envio utilizável |

O navegador usou login/HTTP simulados com dados fictícios; foram verificados envio explícito, origem, atalhos e sugestões, sem banco ou chamada Gemini. Backend não alterado: não foi repetida a suíte da API por esta mudança visual. Seu resultado anterior continua histórico, não uma nova execução.

## Achados e limites

- O primeiro build foi disparado enquanto o painel ainda estava sendo editado e acusou dois valores temporariamente não utilizados; corrigidos ao concluir o cabeçalho. Build final aprovado.
- A primeira rodada de navegador usou o servidor de desenvolvimento antigo em 4188, que servia estilos utilitários incompletos após as trocas de checkout/configuração. Isso deformava a página e gerava alerta de tamanho no sino; diagnóstico com o build fresco mostrou tamanho correto e nenhum alerta. Não foi alterado o componente de notificações nem desabilitada regra do axe.
- No ensaio seguinte, o roteiro precisou reabrir o chat após Escape fechar o menu de acessibilidade, comportamento já considerado pelo roteiro anterior do projeto. Ajustado somente o roteiro local; repetição final 11/11.
- Avisos preexistentes de lint e bundle continuam; sem dependências, schema, backend, arquivos protegidos ou configuração privada alterados.
- Toque validado no Chrome por protocolo, sem aparelho físico/leitor de tela físico. Sem persistência de posição entre reloads, por escolha de escopo. Nenhuma alegação de teste ao vivo com Gemini nesta rodada.

## Entrega

Prévia de produção separada em `http://127.0.0.1:4190`. As capturas/relatórios brutos e scripts desta rodada ficam somente no `output/vuvu-clean/` ignorado. As prévias usam dados fictícios; suas respostas não demonstram chamada real ao Gemini.

Atualizados guia do assistente, documentação frontend, plano visual, origem dos assets, ADR-054 e documentos vivos. Commit/publicação restritos à branch visual, com identidade `iannxz`; sem merge na dev, alteração do PR #77 ou aplicação/restart do ambiente principal em `localhost:8086`.
