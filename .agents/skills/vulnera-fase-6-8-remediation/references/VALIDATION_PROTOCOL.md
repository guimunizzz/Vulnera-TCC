# Protocolo de validação

## Baseline

CP0 registra:

- Docker/Compose disponível;
- `npm run check` da API;
- build do web;
- número de testes pass/fail;
- cobertura por service quando disponível;
- estado do working tree.

Falhas preexistentes devem ser distinguidas de regressões introduzidas pela fase.

## Regressão incremental

Após cada checkpoint de implementação:

1. teste específico do finding;
2. suíte do módulo afetado;
3. `npm run check`/lint/build relevante;
4. pipeline completo quando CP1 o tornar confiável.

## Concorrência — CP4

Os testes precisam disparar requisições/operações simultâneas e validar o resultado agregado. Execute repetidamente, não apenas uma vez.

Mínimo esperado:

- refresh concorrente: no máximo um sucesso;
- aprovação concorrente: no máximo uma Subscription ACTIVE;
- criações concorrentes no limite: nunca superar `maxApplications`;
- outros invariantes transacionais recebem teste equivalente quando o consolidado exigir.

## Pipeline — CP1/CP8

Reproduza a sequência do workflow a partir de estado limpo sempre que Actions remoto não estiver disponível.

Para provar gates negativos, pode haver alteração temporária controlada, seguida de reversão e `git diff` limpo daquela mudança temporária.

## Browser — CP9

Validar e registrar os 9 itens:

1. PATCH Project com `status` protegido não persiste alteração;
2. cross-filter move todos os números coerentemente;
3. busca analytics filtra ou foi removida;
4. barra de aging aplica semântica correta;
5. API indisponível gera estado de erro, não vazio;
6. e-mail com casing diferente autentica;
7. rate limit gera 429 no limite configurado;
8. PDFs, dashboards e `report-data` continuam funcionando;
9. console limpo.

Falha no CP9 não é "nota": reabre o finding/checkpoint responsável e exige correção + nova validação.
