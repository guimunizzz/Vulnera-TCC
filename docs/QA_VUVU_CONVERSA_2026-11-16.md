<!-- Registra correções de conversa, consumo e teclado da Vuvu; consumido pelos mantenedores para revisar comportamento, testes e aplicação local. -->

# Vuvu — conversa, espera e acessibilidade

Data: 2026-11-16. Branch: `refactor/assistant-ui`. Autorização: implementar as
melhorias discutidas e corrigir Enter, que antes apenas inseria linha no campo.
Código: `7388ba0`, autor e committer `iannxz`.

## Comportamento entregue

- “OI”, “OQ E O VULNERA” e “quem e vc” recebem respostas próprias de saudação,
  produto e identidade, com origem Ajuda local e sem geração externa. Três
  respostas básicas separadas dos 44 tópicos de domínio existentes.
- Abreviações por palavra inteira, acentos e caixa são normalizados na seleção;
  a pergunta original permanece na conversa. “Oi, como faço uma análise?” não é
  descartada como saudação. A barreira de conteúdo sensível continua anterior.
- Quando não reconhece, pede esclarecimento e não afirma que a documentação
  inexiste. Não oferece botões de operação que não tenham relação identificada.
- Buckets pessoal/global do assistente reservados somente antes da tentativa de
  geração. Mantidos valores, retenção e proteção de memória. Negação global
  devolve reserva pessoal; tentativa externa falha continua contando.
- Cota de geração esgotada retorna ajuda local HTTP 200 e
  `providerRetryAfterSeconds`, com aviso/contagem que permitem continuar usando
  a ajuda local. Nenhuma repetição ou chamada implícita. Limites gerais HTTP,
  autenticação, empresa, usuário e escrita permanecem; HTTP 429 ainda conserva
  contrato/Retry-After, rascunho e bloqueio temporário de envio na interface.
- Enter no campo envia; Shift+Enter quebra linha. Tab/Enter acionam o botão.
  Composição IME, tecla repetida, campo vazio e envio pendente não duplicam
  requisições. Foco permanece no campo no envio explícito; Escape retorna ao
  botão da Vuvu. Campo tem instrução visível e descrição acessível dos atalhos.
- Contagens usam prazo absoluto, não disparam chamadas e não são anunciadas a
  cada segundo. Mensagens estáveis informam início/fim. Timers pertencem à
  sessão e são limpos ao desmontar. Reload não reinicia a cota do servidor.
- Cabeçalho com texto ampliado usa duas linhas de layout: título/contexto com
  largura disponível e ações separadas. Evita quebrar as palavras do contexto
  em fragmentos no tamanho 200%, preservando foco, contraste e alvos de 44px.

ADR-056 registra a substituição parcial da política original da ADR-054.
Não há schema, dependências, credencial ou permissão nova; atlas e animações
preservados. Não aumentados valores de geração nem tokens. O aproveitamento da
cota pode aumentar porque ajuda local deixa de consumi-la; não é promessa de
gratuidade nem confirmação de faturamento/cota do Google.

## Validação

- API focal intermediária: 108/108. Check final Linux Node 22:
  **957/957**, 58 suítes, lint aprovado, 325,033 s; inclui 110 casos do assistente.
  Sequência relatada, linguagem informal, modos/perfis, privacidade, validação,
  cota compartilhada/concorrência, devolução de reserva, tentativa falha,
  reposição e preservação do contrato 429 geral cobertos.
- Web focal: **40/40**, dois arquivos, incluindo teclado real via user-event e
  testes isolados de relógio do hook. As primeiras execuções com relógio falso
  na árvore animada interferiram no fechamento de um teste anterior; o relógio
  de espera foi isolado do Motion, sem alterar essa asserção antiga.
- Web check Linux inicial e repetição final após o ajuste visual: **697/697**,
  78 arquivos; contraste **132/132** e lint aprovados. Rodada final em 85,57 s.
- Typecheck/build Web no host e builds Docker API/Web aprovados. Imagem de QA
  da API altera apenas permissão do runner, sem modificar Dockerfile de produção.
- Navegador: primeira rodada **11/11**, zero erros de página/CSP/axe. Conferência
  visual motivou o ajuste do cabeçalho a 200%. Na rodada imediatamente após
  reiniciar a prévia, dois cenários começaram antes do servidor, com
  `ERR_EMPTY_RESPONSE`; adicionado aguardo de HTTP 200 no script local. A
  repetição final com essa prontidão passou **11/11**, zero erros de página,
  CSP ou axe. Capturas finais conferidas, incluindo o cabeçalho a 200%.

Verificações automáticas de acessibilidade cobrem os critérios axe WCAG
2 A/AA, 2.1 A/AA e 2.2 AA, temas claro/escuro, desktop/390px/320px, texto
200%/alto contraste e composição de texto simulada. Não substituem validação
com leitor de tela físico, aparelho móvel real ou todos os IMEs disponíveis.
Avisos anteriores de bundles grandes permanecem fora do escopo.

## Aplicação e publicação

**Concluída em 2026-11-16.** Zero scans, nenhuma migration pendente e nenhuma
variável de aplicação divergente antes do restart. Imagens de produção validadas
aplicadas com `docker compose up -d --no-deps --no-build api web`. Imagens
anteriores somente locais: `vulnera-before-vuvu-conversation-api:2026-11-16` e
`vulnera-before-vuvu-conversation-web:2026-11-16`. Sem seed/reset ou deploy na dev.

Na interface real em `localhost:8086/applications`, abertura por teclado,
**Enter para todos os quatro envios**, campo focado após cada resposta e Escape
devolvendo foco à Vuvu. Sem mocks nessa verificação:

| Pergunta | HTTP/origem | Tempo observado | Resultado |
| --- | --- | --- | --- |
| OI | 200/local | 88 ms | Saudação, sem atalhos operacionais. |
| OQ E O VULNERA | 200/local | 17 ms | Conceito de plataforma/aplicações/projetos/findings. |
| como faço uma analise | 200/Gemini | 1.297 ms | Passos de solicitação e distinção entre projeto e scan. |
| quem e vc | 200/local | 18 ms | Identidade, escopo e limites da Vuvu, sem atalhos alheios. |

Quatro POST explícitos, uma resposta Gemini, nenhum reenvio ou erro de página/CSP.
Container confirmou 44 tópicos e três respostas básicas. API saudável e Web
HTTP 200. Esperas/esgotamento foram simulados nos testes, sem consumir chamadas
reais para forçar a cota Google.

Comparação antes/depois aprovada: somente API/Web recriados; MySQL/Mailhog e
três containers de QA pré-existentes com IDs/imagens/início inalterados. Todos
os mounts e portas preservados; hash privado do `.env` inalterado. Contagens:
5 usuários, 1 empresa, 5 aplicações, 5 projetos, 10 vulnerabilidades,
2 evidências e 0 scans. Nenhuma mudança de dados de negócio.

Somente código, testes e documentação humana são versionados. Prévias, scripts,
Compose, capturas e resultados brutos desta rodada ficam em `output/` ignorado.
Nenhuma atualização de PR #77, feature de origem ou dev nesta tarefa.
