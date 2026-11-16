<!-- Registra a ampliação do conhecimento de produto da Vuvu e sua validação; consumido pelos mantenedores para conferir escopo, evidências e limites. -->

# Vuvu — contexto de produto e fluxos completos

Data: 2026-11-16. Branch: `refactor/assistant-ui`. Pedido: aprofundar conceitos,
regras e fluxos do Vulnera, conforme escolha explícita do usuário.

## Entrega

O catálogo de código passa de 29 para **44 tópicos**, preservando os identificadores
anteriores e acrescentando 15 aprofundamentos. Na inspeção inicial, a API do
ambiente principal ainda tinha **17**: as aplicações mais recentes tinham
recriado somente a Web. A aplicação desta rodada deve atualizar exclusivamente
a API e conferir os 44 tópicos na imagem em execução.

O conteúdo cobre jornada completa, onboarding/aprovação, capacidade do plano,
evidências, relatórios, exportação, estados e promoção DAST, formatos e comparação
SAST/SCA, inventário e triagem Threat Intel, override de severidade, uso da Vuvu
e acessibilidade. A rastreabilidade está em
[ASSISTENTE_CONTEUDO_PRODUTO.md](ASSISTENTE_CONTEUDO_PRODUTO.md).

A instrução do Gemini pede objetivo, pré-condições, etapas, responsável e próximo
passo. A seleção resolve empates pela expressão mais específica; perguntas
naturais sobre peso de evidência e download Excel também estão cobertas. A ajuda
genérica de evidências recebeu os formatos e o limite de tamanho vigentes.

Continuam os três perfis, 23 telas e 12 ações do contrato existente; seleção de
até três tópicos e 6.000 caracteres de ajuda; orçamento de histórico/saída e uma
chamada por pergunta explícita. Novos tópicos de análise bruta respeitam o perfil.
Os atalhos anteriores de Threat Intel continuam preservados. Personalidade,
animações, modo discreto, sessão e controles da Web permanecem como estavam.

Não há leitura automática de documentação, registros ou anexos, execução de
operações pelo assistente, novo RAG ou persistência. Nenhum detalhe de arquitetura
foi acrescentado à ajuda externa. Mais conteúdo pode alterar o consumo efetivo de
entrada dentro do teto existente; não se afirma custo zero ou franquia disponível.

## Documentação e compatibilidade

As notas de onboarding/contratação no vault distinguem comportamento disponível
de previsões antigas sobre campos, convites, e-mails e remediação. O histórico foi
preservado. ADR-054 e guias do assistente foram atualizados.

A comparação da API principal com o código confirmou schema idêntico e nenhuma
migration nova. Além das melhorias do assistente já presentes na branch, existe a
extração de `makeSavedQueryService` incorporada anteriormente da dev: a factory
monta a mesma cadeia de dependências, sem mudar regras ou permissões. Não foi
feita alteração adicional nesse recurso.

## Validação

- Primeira verificação focal: **93/93**. Corrigidos o atalho extra indesejado em
  Threat Intel e o uso de uma palavra em português que colidia com a verificação
  de terminologia técnica, sem enfraquecer os testes existentes.
- Primeira execução completa: `npm run check`, **940/940**, 58 suítes. Após ela,
  acrescentados dois casos de linguagem natural e seus termos de seleção.
- Execução completa final: **942/942**, 58 suítes, `npm run check` aprovado
  em 303,066 s, incluindo os 95 casos da suíte do assistente. Aplicação principal
  em fechamento.
- Build Docker de produção aprovado; imagem de QA derivada apenas para permitir
  escrita no diretório do runner, sem alterar o Dockerfile de produção.
- Sem alteração frontend nesta rodada; a validação anterior de Web 690/690,
  contraste 132/132 e navegador 16/16 permanece histórica, sem ser contada como
  reexecução desta tarefa.

## Aplicação principal

Pendente da conclusão do check final. Antes de recriar exclusivamente a API:
conferir ausência de scans ativos, migrations pendentes e mudanças inesperadas de
variáveis; guardar imagem anterior apenas localmente. Depois, conferir saúde,
44 tópicos e uma pergunta fictícia pela interface real, registrando a origem
efetiva da resposta. Comparar containers, mounts, contagens e hash privado do
ambiente, preservando Web, banco, Mailhog e containers de QA já existentes.

Scripts, logs, Compose de teste e resultados brutos ficam somente no `output/`
ignorado. Este relatório humano e os testes de código são versionados. Não há
novas capturas ou ambientes de teste publicados.
