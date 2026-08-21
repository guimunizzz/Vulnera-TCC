# Protocolo de fechamento de finding

## Estados

`UNVERIFIED → CONFIRMED|REFUTED → RED_PROVEN → PATCHED → GREEN_PROVEN → REVIEWED → VALIDATED → CLOSED`

Estados alternativos: `BLOCKED`, `DEFERRED`.

## 1. CONFIRM

Antes de editar, confirme o finding contra código atual e, quando aplicável, runtime.

Saída mínima:

- Finding ID;
- `CONFIRMED | REFUTED | DIVERGENT`;
- evidência por arquivo/símbolo/linha;
- `VALIDATION_REQUIRED` original;
- `CLOSURE_CRITERIA` original.

`REFUTED` não recebe patch. Deve ser documentado e revisado pelo `closure_validator`.

## 2. RED

O `test_engineer` cria uma prova que falha no estado vulnerável/incorreto.

A prova deve ser do tipo adequado ao finding: unit, integration, concurrency, pipeline, browser ou outra forma automatizável prevista no consolidado.

Registre comando + resultado esperado/observado.

## 3. PATCH

O remediator de domínio aplica a menor correção consistente com:

- causa raiz;
- regras de negócio;
- contratos existentes;
- convenções do projeto;
- findings acoplados atribuídos ao mesmo checkpoint.

Não ampliar o escopo sem autorização do orquestrador.

## 4. GREEN

O `test_engineer` executa a mesma prova do RED e os testes diretamente relacionados.

Só avance quando o teste específico estiver verde.

## 5. REVIEW

O `patch_reviewer` compara:

- finding original;
- RED test;
- patch;
- GREEN result;
- riscos de bypass/regressão;
- mudanças não relacionadas.

Saída: `APPROVED | CHANGES_REQUIRED | UNRESOLVED`.

## 6. CLOSURE

O `closure_validator` valida explicitamente o `CLOSURE_CRITERIA` e todos os tipos de `VALIDATION_REQUIRED` aplicáveis.

Saída:

- `CLOSED` somente se tudo foi provado;
- `PARTIALLY_VALIDATED/BLOCKED` se faltar runtime obrigatório;
- `REFUTED` se o finding não existir no estado real.

## Regra de agrupamento

Findings com mesma causa raiz podem compartilhar patch e testes, mas cada ID mantém linha própria no relatório de remediação e fechamento explícito.
