---
status: aceito
data: 2026-11-20
---

<!-- Registra a seleção de histórico, a emissão de atalhos e os diagnósticos internos da Vuvu para manutenção e QA. -->

# ADR-058 — Histórico e atalhos da Vuvu

## Contexto

Um trecho reconhecido pelo filtro de privacidade permanecia no histórico e
impedia chamadas para perguntas seguintes. Palavras soltas de pedidos recusados
podiam acionar orientações e atalhos sem relação com a intenção da pessoa. O
rótulo de ajuda local não indicava o motivo da queda ao investigar a sessão.

## Decisão

- Validar a pergunta atual antes de reservar cota. Retirar do histórico para
  recuperação e para o Gemini as perguntas com conteúdo sensível reconhecível
  ou sinais explícitos de injeção e suas respostas associadas.
- Pedir na mesma chamada ao Gemini o texto e a classificação da resposta em um
  formato JSON validado. Emitir atalhos apenas para pedidos claros de navegação
  ou de uso do produto. No Gemini, a classificação também precisa confirmar
  navegação. A API escolhe o catálogo de destinos e filtra pelo perfil.
- Quando um pedido explícito sobre regras internas for reconhecido no backend,
  omitir ajuda de produto desse turno. Se a geração não retornar uma recusa
  válida, usar uma recusa local sem ações. O humor mira o truque ou o pedido
  claramente fora de escopo. Incidentes e suporte legítimo recebem tom neutro.
- Registrar `assistant.local_response` com motivo enumerado, versão da API e
  revisão do assistente. Manter esses dados internos e sem texto da conversa,
  credenciais, identificadores de usuário ou corpo da resposta do provedor.

## Consequências

Um turno descartado deixa de bloquear perguntas limpas posteriores. O contrato
Web mantém as mesmas propriedades. A resposta do provedor precisa respeitar o
esquema; incompatibilidade do modelo, timeout, bloqueio ou erro mantém a ajuda
local. Os sinais explícitos ajudam com casos conhecidos, e a classificação do
modelo pode variar entre chamadas. Permissões, limites e o número máximo de
chamadas externas continuam definidos pela aplicação.

Em 20/11, a revisão AI-CHAT-08 estendeu os sinais conhecidos a marcadores de
papel, alegações explícitas de autoridade, instruções embutidas e pedidos de
reconstrução de instruções privadas. O backend usa o mesmo tipo para filtrar
histórico e escolher uma recusa local no tom selecionado. Um pedido claramente
alheio também pode ser reconhecido antes da recuperação de ajuda.

## Relacionado

- ADR-056 — Conversa básica e cota de geração da Vuvu.
- ADR-057 — Prioridade do Gemini na conversa da Vuvu.
- `docs/ASSISTENTE_VULNERA.md`.
