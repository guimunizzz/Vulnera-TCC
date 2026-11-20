---
status: aceito
data: 2026-11-20
---

<!-- Registra a fronteira pública da Vuvu e o modo de ampliar a orientação de uso; serve a desenvolvimento e QA. -->

# ADR-059 — Origem pública e guias de uso da Vuvu

## Contexto

A interface, os avisos acessíveis, a origem da resposta HTTP e um texto de
ajuda exibiam o nome do provedor. O usuário pediu que a identificação técnica
ficasse interna e que a Vuvu explicasse mais passos da plataforma.

## Decisão

- Publicar apenas as origens `generated` e `local`, com textos e avisos
  genéricos no painel e na ajuda. Coordenar a aplicação da Web e da API para
  compatibilidade desse contrato. Diagnósticos do provedor continuam no backend.
- Responder de forma controlada a pedidos explícitos de bastidores antes da
  reserva de cota. Uma saída que contenha detalhes internos reconhecíveis,
  segredos ou caminhos privados volta à ajuda local. Manter termos e versões
  de formatos disponíveis ao usuário quando necessários ao fluxo.
- Ampliar o catálogo com fichas curadas dos guias de produto e conferir os
  passos nas telas e permissões vigentes. A recuperação usa até três tópicos,
  com o orçamento existente. Código bruto, documentos internos, versões da
  implementação e dados reais ficam fora do contexto do assistente.

## Consequências

A resposta pública comunica a diferença entre ajuda gerada e alternativa local.
As novas fichas aparecem em ambos os modos e o produto mantém o diagnóstico
interno. A filtragem de texto identifica padrões conhecidos. A curadoria, a
separação de dados e o controle de permissões são as fronteiras de acesso.

## Relacionado

- ADR-057 — Prioridade do Gemini na conversa da Vuvu.
- ADR-058 — Histórico e atalhos da Vuvu.
- `docs/ASSISTENTE_CONTEUDO_PRODUTO.md`.
