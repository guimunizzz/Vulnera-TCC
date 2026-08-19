# Vulnera — Codex Code Review Bootstrap

Pacote pronto para preparar uma revisão multiagente do Vulnera sem permitir correções no produto.

## Princípio central

A revisão é **read-only sobre o código**.

Depois do SETUP, o único local autorizado para escrita é:

`docs/code-review/**`

Os especialistas (`backend`, `frontend`, `business rules`, `security`, etc.) permanecem `read-only`. O agente principal apenas consolida mapas, findings e relatórios dentro da pasta de review.

## Checklist incluída

O pacote já contém a Checklist Mestre real fornecida para esta revisão. Ela é instalada como:

`docs/code-review/MASTER_CHECKLIST.md`

Ela não deve ser marcada ou editada durante a auditoria.

Como a checklist é grande, o SETUP executa um parser determinístico que cria `REQUIREMENT_SEEDS.jsonl` e `CHECKLIST_MANIFEST.md` antes de qualquer subagente. O modelo então enriquece/classifica os requisitos em batches, em vez de reler e redistribuir a checklist inteira repetidamente.

## Etapa 1 — SETUP

Extraia `vulnera_codex_code_review_bootstrap/` na raiz do Vulnera e peça ao Codex:

`Leia e execute vulnera_codex_code_review_bootstrap/SETUP_PROMPT.md. Faça somente o SETUP e não inicie a revisão.`

O SETUP prepara:

- `.codex/agents/*.toml`
- `.agents/skills/vulnera-implementation-audit/**`
- `[agents]` em `.codex/config.toml`
- `docs/code-review/**`
- seeds/manifesto da checklist
- relatório de prontidão

Ele não deve inspecionar profundamente o código.

## Etapa 2 — iniciar revisão

Abra uma nova sessão do Codex e envie:

`Leia e execute vulnera_codex_code_review_bootstrap/START_REVIEW_PROMPT.md.`

A revisão só começa se `READY_FOR_REVIEW: YES`.

## Saídas finais

- `docs/code-review/VULNERA_IMPLEMENTATION_AUDIT.md`
- `docs/code-review/RECOMMENDATIONS.md`

Nenhuma sugestão é aplicada ao código.

## Economia de tokens

O harness:

- pré-indexa checkboxes deterministicamente;
- classifica auditabilidade;
- não envia a checklist inteira a cada agente;
- trabalha em batches;
- reutiliza findings canônicos em edge cases/aceite/MVP pronto;
- evita auditoria profunda para itens processuais, documentação, fora do MVP e critérios derivados;
- usa revisão adversarial seletiva.

## Segurança operacional

Durante a auditoria:

- sem patches;
- sem refactor;
- sem auto-fix;
- sem migrations/seeds;
- sem install de dependências;
- sem comandos que escrevam fora de `docs/code-review/**`;
- runtime mutável vira `NOT_VALIDATED`.
