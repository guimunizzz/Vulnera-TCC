<!-- Descrição do PR da correção do contexto de risco, preparada para revisão no GitHub. -->
## Problema e resultado

Ao abrir o contexto de risco dentro do Dialog, o popup do Select customizado era renderizado por portal com `z-index: 40`, atrás do modal em `60`. Isso impedia o usuário CLIENT de interagir com Criticidade, Ambiente e Sensibilidade do dado.

Os três campos agora usam selects nativos com o estilo compartilhado `CLASSES_CONTROLE`, seguindo a solução já utilizada no seletor de empresa. O usuário CLIENT OWNER pode preencher os seis campos permitidos, salvar e reabrir o contexto com os valores atualizados, respeitando as regras existentes de risco e ownership.

## Alterações

- Substituição dos três seletores no formulário de contexto de risco, preservando labels, identificação acessível, valores controlados e opções existentes.
- Dono de negócio e Dono técnico estavam editáveis no cenário reproduzido; seus inputs foram preservados e incluídos na regressão completa.
- Exposta à internet continua usando o mesmo switch.
- Payload, handlers de salvamento e invalidação do cache permanecem iguais.
- Regressão Web cobre edição dos seis campos, salvamento, reabertura, bloqueio de redução de risco e resposta FORBIDDEN mantendo o formulário.
- Teste de integração da API ampliado para confirmar persistência dos seis campos por PUT seguido de GET e recusa de alteração de outra Company.
- PRD_VIVO e BACKLOG atualizados; o problema geral de integração Select/Dialog continua registrado em L-19.

## Permissões preservadas

CLIENT OWNER continua autorizado a aumentar os fatores de risco; reduções exigem ADMIN conforme a regra D2. As restrições existentes de CLIENT MEMBER e PENTESTER permanecem. O isolamento entre Companies continua sendo verificado na API.

Não há alterações de código de produção da API, schema, migrations, entidades, dependências ou lockfiles.

## Validação

| Verificação | Resultado |
| --- | --- |
| Regressão antes/depois | APP-CTX-01 falha no formulário anterior e passa com a correção |
| Testes focais Web | 24/24 |
| Check Web | 340/340 testes em 30 suítes; lint sem erros, com 9 avisos preexistentes |
| Contraste do design system | 66/66 verificações AA |
| Build Web | TypeScript e Vite aprovados; aviso preexistente de chunks grandes |
| Integração API focal | 12/12 contra banco isolado `vulnera_test` |
| Tenancy | TEN-29 recusa os seis campos de outra Company e confirma que o registro não mudou |
| Navegador Chrome | Build de produção: clique/teclado, salvar/reabrir, redução bloqueada e mobile 375 px sem overflow ou erros JavaScript |
| Diff | `git diff --check` aprovado |

A validação de navegador utiliza fixtures HTTP. A persistência real e o isolamento de tenants foram verificados separadamente nos testes de integração da API.

**Limitação preexistente:** o `npm run check` global da API continua bloqueado pelos imports não usados `UserEntity` e `UserResponseDTO` em `vulnerability.service.ts:45`. Esse problema está documentado e ficou fora do escopo; o check global da API não é declarado aprovado.

## Critérios de aceitação

- [x] CLIENT OWNER altera Criticidade, Ambiente e Sensibilidade do dado dentro das permissões existentes.
- [x] Dono de negócio, Dono técnico e Exposta à internet continuam editáveis.
- [x] Salvar contexto envia os seis campos e os valores permanecem após reabrir.
- [x] CLIENT não consegue editar contexto de outra Company.
- [x] Ownership, tenancy e regra D2 preservados.
- [x] Testes de regressão adicionados/ampliados.
- [x] Documentação viva atualizada.
