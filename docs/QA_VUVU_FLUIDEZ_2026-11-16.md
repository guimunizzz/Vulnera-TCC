<!-- Registra as quatro melhorias autorizadas, sua verificacao e limites; consumido pelo responsavel e pelos mantenedores. -->

# Vuvu — fluidez, reações confirmadas e modo discreto

Data: 2026-11-16. Branch `refactor/assistant-ui`, base `9504cd9`. O usuário delimitou explicitamente quatro melhorias; as outras sugestões anteriores não foram implementadas nesta rodada.

## Comportamento entregue

1. **Chat:** entrada por opacidade/transformação em 320 ms e saída em 140 ms, com tokens existentes e preferência reduzida. Durante a saída, o painel permanece para animar, mas já fica inerte e fora da árvore acessível. Retorno de foco e Escape preservados. Mantidos 280 ms para distinguir clique e duplo clique; não se apresenta isso como aumento de FPS.
2. **Olhar:** coordenadas amortecidas, margem entre direções e mistura curta entre duas poses originais. Aproximar do centro mantém a direção anterior, em vez de voltar subitamente ao neutro; retirado o salto de hover que interrompia o olhar. RAF encerra ao estabilizar. Os atlas não foram alterados; as 16 direções não são uma animação 3D contínua.
3. **Resultados reais:** sinais locais tipados acompanham PDFs de projeto, DAST e SAST/SCA e falhas finais de ações via mutations. Projeto aguarda também o registro final do relatório. Download iniciado não comprova arquivo salvo no disco. Falha parcial não dispara sucesso. Tratamentos originais, callbacks, mensagens e retries são preservados; cancelamentos e falhas de consultas/polling não reagem.
4. **Modo discreto:** Recolher Vuvu no cabeçalho deixa um ícone de 44 px na borda. Somente o clique do usuário restaura a personagem; o chat pode ser reaberto normalmente. Conversa, rascunho e posição permanecem durante a sessão. Sem persistência após reload ou expansão por evento.

Sem backend, schema, permissões, dependências ou chave alterados. Reações não enviam dados ao Gemini nem geram chamadas extras. O sinal transporta apenas um dos dois tipos; não contém nomes, IDs, mensagens de erro, registros ou payloads. Captura da sessão no início da ação descarta resposta após logout/troca de sessão, inclusive novo login da mesma pessoa. Reações decorativas não rejeitam a operação de origem, não roubam foco e não abrem chat. Modo discreto/contextos restritivos têm precedência, sem fila para depois.

Uma reação de erro também impede repetir a expressão de uma resposta antiga ao terminar. Com conversa aberta, envio pendente, arraste ou dança, as expressões atuais têm precedência. Decisão em [ADR-055](Vulnera/07-Decisoes/ADR-055%20-%20Reacoes%20locais%20e%20modo%20discreto%20da%20Vuvu.md).

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run check -- -- --maxWorkers=2` Web final | **690/690**, 77 arquivos; lint sem erros |
| Contraste | **132/132** |
| Build TypeScript/Vite | Aprovado |
| Regressão no navegador | **11/11**, preservando mouse/toque/teclado, six seven, temas, 320 px, 200% e axe |
| Novos cenários de navegador | **5/5**, sem erros de página/CSP |
| Atlas e configuração privada | Preservados; nenhum novo asset gerado |

Os cenários novos conferem: modo discreto com conversa/rascunho/posição; erro enquanto recolhida sem reexpansão; olhar perto do centro e repouso sem loop; falha HTTP confirmada com reação local; geração de PDF real com dados fictícios e registro controlado antes da reação; saída do painel com inércia de interação/foco. No cenário PDF, o gerador real cria o documento, o navegador inicia o download e a resposta simulada do registro é liberada somente depois da verificação de ausência de sucesso antecipado.

Testes de código exercitam erros antes/depois do PDF, callbacks preservados, cancelamento, troca de sessão com ação pendente, preferência reduzida, timers e retomada do modo discreto. A primeira rodada dos novos testes de relatório assumiu `role=alert`; a tela existente usa o aviso padrão. A asserção foi ajustada para a mensagem original, sem mudar esse componente. Na suíte final, todos passaram.

## Medição de fluidez

No ensaio local com Chrome, o intervalo mediano do RAF ficou em aproximadamente **6,9 ms** e p95 **7,1 ms**, antes e depois; sem tarefas longas acima de 50 ms nas janelas medidas. Valores distintos de opacidade amostrados: entrada **12 → 24**, saída **1 → 18**. A melhoria está na continuidade das transições; esses números não são medição de FPS da GPU, não representam frames novos da arte e não garantem o mesmo resultado em outro equipamento.

As medições e cenários usam respostas/contas fictícias em prévia de produção isolada. Sem geração Gemini, scans ou escrita no banco real nesta validação. Toque foi validado por protocolo do Chrome, sem aparelho/leitor de tela físico. Avisos anteriores de lint/bundle permanecem registrados; nenhuma dependência nova para animação.

## Entrega e aplicação

Implementação e relatório humano versionados somente na branch visual, como `iannxz`. Preview de trabalho em 4192; scripts, logs, capturas, perfil e resultados brutos ficam em `output/vuvu-smooth/` ignorado, sem envio ao GitHub. Os três screenshots históricos já existentes na branch não foram alterados nem acrescidos.

A aplicação em `localhost:8086`, após as validações, atualiza exclusivamente a Web. O registro da comparação de containers/volumes/dados e do smoke real é acrescentado ao fim desta nota quando concluído; o PR #77 e a branch dev permanecem intactos.
