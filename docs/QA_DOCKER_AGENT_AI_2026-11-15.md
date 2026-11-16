<!-- Registra o QA complementar em Docker, os defeitos encontrados e a correção autorizada; existe para revisão e é consumido pelos mantenedores da feature/agent-ai. -->

# QA Docker da integração do assistente — 15/11/2026

## Escopo e isolamento

Continuação do [relatório da integração](INTEGRACAO_AGENT_AI_DEV_2026-11-15.md), após o usuário informar que o Docker estava disponível. Base da rodada: `be93212`, na própria `feature/agent-ai`. O objetivo foi verificar os Dockerfiles reais, executar as suítes em Linux e procurar conflitos de interface/acessibilidade.

Docker Engine 29.7.2, imagens Node 22.23.5 Alpine e MySQL 8. As imagens foram construídas pelos Dockerfiles existentes, com cache onde aplicável. Tags e stack de QA próprias; banco/volumes/rede novos, sem reutilizar os volumes da demonstração.

- QA: `vulnera-agent-ai-qa-*`, rede `vulnera-agent-ai-qa-net`, Web `127.0.0.1:18086`, API `127.0.0.1:13301`.
- Bancos descartáveis `vulnera_test` (suíte) e `vulnera_smoke` (navegador), com as 18 migrations existentes. Seed somente no banco de smoke.
- API de smoke em modo local; DAST real e agendador Threat Intel desligados. Limiter desligado somente nessa cópia para isolar os testes de navegação; o limiter continua coberto pela suíte da API e nenhuma configuração do produto foi alterada.
- A stack existente `vulnera-api`, `vulnera-web`, `vulnera-db`, `vulnera-mail`, suas imagens/IDs de criação e volumes permaneceram preservados. Não houve rebuild/recriação ou aplicação das correções nessa stack.
- Nenhuma chave Gemini lida/exposta, chamada Google, scan externo, merge na dev ou alteração de schema/dependências.

## Defeitos encontrados e autorização

| ID | Evidência | Correção autorizada |
| --- | --- | --- |
| QA-DKR-01 | Axe `label-content-name-mismatch`: o botão mostra “Ajuda”, mas seu nome acessível era “Abrir Assistente Vulnera”, sem “Ajuda”. Ocorria nas páginas autenticadas, inclusive com alto contraste e texto a 200%. | `aria-label` agora “Ajuda — abrir Assistente Vulnera”. Texto visível, ícone, handlers e estilos mantidos. |
| QA-DKR-02 | A marca no login/cadastro mostra “Vulnera Security”, mas o nome acessível omitia “Security”. O DOM também concatenava o texto como `VULNERASECURITY`, apesar das duas linhas visuais. | Nome “Vulnera Security — página inicial” e separador explícito entre as palavras. Prova no navegador: caixas/posições da marca e dos elementos filhos idênticas antes/depois do separador; o problema do axe desapareceu. |

O usuário foi consultado, pediu esclarecimento sobre a diferença entre texto visível e nome acessível e depois autorizou **as duas descrições**, mantendo visual e ações. Nenhuma correção foi aplicada antes dessa autorização. A necessidade do separador foi investigada e comprovada sem alteração visual, dentro dessa mesma correção.

Os dois rótulos antigos já existiam nas respectivas origens: QA-DKR-01 na feature original e QA-DKR-02 na dev. A rodada ampliada os encontrou; não foram atribuídos à composição do merge.

Consultas dos testes foram atualizadas para os nomes aprovados. O teste de navegação também confere que o conteúdo textual da marca contém as duas palavras separadas. Nenhuma regra axe foi desabilitada.

Foi encontrada também uma instabilidade no teste de roteamento: ele consultava o assistente de forma síncrona após a página lazy aparecer, mas o `Portal` só anexa o conteúdo no efeito seguinte. A prova da falha mostrava a página e nós `data-portal` ainda vazios. As três asserções passaram a aguardar `findAllByTestId`, mantendo a exigência de exatamente uma instância. É ajuste de sincronização do teste; o portal e a lógica de autenticação da aplicação não foram alterados.

## Resultados da rodada

| Verificação | Resultado |
| --- | --- |
| Build Docker API | Aprovado, Dockerfile original |
| Build Docker Web | Aprovado, Dockerfile original, incluindo a imagem final com a correção |
| `npm run check` API dentro do Linux | **905/905**, 58 suítes, lint aprovado, 348,833 s |
| Web Linux: lint + contraste + suíte completa | **659/659**, 75 arquivos, contraste **132/132** |
| Web após a correção final | Check host **659/659** em 75 arquivos; focal Linux **36/36**, lint e contraste aprovados |
| Smoke real no Docker, ADMIN/CLIENT/PENTESTER | **11 verificações**, zero erros de página/CSP |
| E2E acessibilidade + Exposure Graph, antes | **5/7**; duas falhas do axe referentes aos dois rótulos descritos acima |
| Repetição após os nomes, antes do separador | **6/7**; assistente corrigido, marca ainda concatenada; causa comprovada no DOM |
| Repetição final dos e2e | **7/7**, 44,1 s; ambas as varreduras axe passaram sem desabilitar regras |
| Importação e assistente, fluxo real | **6 verificações**, zero erros de página |

O percurso de importação realizou, exclusivamente na cópia de QA:

1. Abrir o assistente e digitar um rascunho; abrir/cancelar o modal de importação pelo teclado. O assistente ficou oculto durante o modal e manteve o rascunho ao retornar.
2. Importar SARIF sintético pela UI, selecionar um projeto real do seed e abrir o detalhe. Nenhuma chamada implícita do chat.
3. Enviar pergunta explícita no detalhe e receber `code-import-detail`, sem IDs/query strings, com resposta local sobre SARIF.
4. Confirmar a triagem, salvar nota e recarregar. Status e nota permaneceram, sem a regressão de status já corrigida na dev.
5. Abrir Security Graph da importação com os dados importados.
6. Baixar o PDF e carregar o arquivo com `pdf-lib`, confirmando pelo menos uma página. Não equivale a revisão visual completa de layout do PDF.

Os e2e existentes também exercitam texto a 200%, persistência das preferências, alto contraste, movimento reduzido, foco, varredura WCAG A/AA nas páginas públicas/autenticadas e as três jornadas do Exposure Graph, incluindo seu mapa 3D.

## Limites e observações

- O encerramento sem relatório no Node 24 da rodada anterior não foi investigado nesta tarefa. A plataforma alvo Docker/Node 22 passou na suíte completa.
- O overflow de página a 320 px já registrado na integração continua uma pendência fora desta correção. Os dois ajustes desta rodada não mudam o layout.
- Os builds Web continuam com o aviso anterior de chunks grandes. `chown -R /app` levou aproximadamente 106–143 s nas duas reconstruções observadas; otimização fica separada, sem incorporar automaticamente a branch `chore/docker-build-leve`.
- Artefatos brutos, traces, scripts e dados sintéticos ficam **somente locais**, em `output/agent-ai-dev-merge/docker/`. As falhas intermediárias foram preservadas separadamente dos resultados finais.
- A publicação da correção é somente na `feature/agent-ai`, com autor/committer `iannxz`; backups locais e dev permanecem preservados. Atualizar a stack de demonstração e fazer merge são operações posteriores.
