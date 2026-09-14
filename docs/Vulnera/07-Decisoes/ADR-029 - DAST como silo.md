---
type: decisao
tags: [decision, backend, dast, modelo-de-dados]
status: vigente
codigo: ADR-029
data: 2026-09-05
---

# ADR-029 - DAST como silo (não importa para Vulnerability)

## Contexto

O Vulnera já tem um model `Vulnerability` maduro — máquina de 4 estados, CVSS calculado, override com justificativa, evidências, comentários, auditoria (ver ADR-021). Era natural perguntar: os alertas que o ZAP encontra deveriam virar `Vulnerability` diretamente, entrando no mesmo fluxo de triagem/remediação que o resto do produto já tem?

## Decisão

**Não.** `DastScan`/`DastFinding` são um silo próprio nesta entrega — dois models novos, sem FK para `Vulnerability`, sem relação com `Project`/`Application`/`Company`. Os achados do ZAP vivem inteiramente dentro do módulo DAST: persistidos, listados, filtrados e exportados em PDF só dentro de `/dast/*`.

### Por que não importar agora

1. **O ZAP não fornece vetor CVSS.** A saída nativa do ZAP é `riskcode` (0-3) + `confidence` (1-4) — não um vetor `CVSS:3.1/AV:.../AC:.../...` completo. `Vulnerability.cvssVector` é `String?` mas `severityCalculated` é **derivada automaticamente** dele via `utils/cvss.util.ts` (ver ADR de Fase 5). Importar um finding do ZAP pra dentro de `Vulnerability` exigiria **inventar** um vetor a partir de `riskcode` — um mapeamento de 4 valores pra um espaço de milhares de vetores possíveis, sem base real. Isso contaminaria o cálculo automático que hoje é 100% confiável (validado contra os 13 vetores oficiais do FIRST, ver Fase 5.12) com heurística arbitrária.
2. **`Vulnerability` não tem `projectId` opcional.** Toda `Vulnerability` pertence a um `Project`, que pertence a uma `Application`, que pertence a uma `Company` (cadeia de isolamento multi-tenant, ver filosofia do schema). Um `DastScan` não nasce dentro dessa cadeia — o pentester informa uma URL nua, sem escolher Application/Project antes. Forçar essa amarração exigiria um passo extra no fluxo ("qual Project/Application isso pertence?") que contraria o objetivo explícito da Fase: **um campo e um botão**.
3. **Owner do finding é diferente.** `Vulnerability.createdBy` é o pentester que digitou manualmente um achado depois de uma análise humana. Um `DastFinding` nasce de uma ferramenta automatizada, sem revisão — misturar as duas origens na mesma tabela sem uma flag de proveniência degradaria a confiança em `Vulnerability` como "achado triado por humano" (que é hoje um pressuposto implícito em todo o resto do produto: relatórios, dashboards, notificação de CRITICAL).

### O que seria necessário para integrar depois

Se uma sprint futura decidir unificar os dois:

1. **Resolver o vetor CVSS.** Ou aceitar um score aproximado por faixa de `riskcode` (mesma técnica de aproximação já usada em [[ADR-025 - Metricas analiticas derivadas do AuditLog]] para a série histórica) com o valor **claramente marcado como estimado, não calculado**, ou exigir triagem manual antes da promoção (um pentester revisa o `DastFinding` e cria a `Vulnerability` correspondente com vetor real).
2. **Escolher o `Project`/`Application` de destino no momento da promoção** — provavelmente um botão "Promover para finding" na tela de detalhe do finding DAST, que abre um seletor de Project (só os que o pentester já tem acesso).
3. **Preservar a proveniência.** Um campo tipo `Vulnerability.sourceType: "MANUAL" | "DAST_IMPORT"` e `Vulnerability.sourceDastFindingId` pra rastrear a origem sem duplicar dado.
4. **Decidir deduplicação cross-import.** Se o mesmo `DastFinding` (mesmo fingerprint) já foi promovido antes, a segunda promoção deveria ser bloqueada ou virar "já existe, ver Vulnerability X".

Nada disso foi construído agora — fica registrado aqui como o caminho, não como próxima task automática.

## Consequências

- Dois models novos, zero alteração em `Vulnerability`/`Project`/`Application`/`Company`. Migration é 100% aditiva (ver Fase 1 do módulo).
- Dashboards, relatórios e notificações existentes continuam vendo exatamente o que viam antes — o módulo DAST é invisível pra qualquer tela que não seja `/dast/*`.
- O pentester tem DOIS lugares pra achado até uma eventual integração: a lista manual de findings (`Vulnerability`) e a lista de scans DAST. Isso é um custo real de UX, aceito conscientemente nesta entrega.

## Alternativa descartada

**Importar automaticamente todo `DastFinding` como `Vulnerability` no momento da persistência**, com CVSS estimado por faixa de risco. Descartada porque um score "inventado" convincente demais é pior que a ausência dele: o resto do produto trata `cvssScore` como calculado com confiança (RN10), e uma pilha de findings DAST com CVSS heurístico misturada a findings manuais com CVSS real quebraria essa garantia silenciosamente — ninguém saberia, ao olhar pra `Vulnerability`, quais scores são reais e quais são chute.

## Relacionado
[[ADR-028 - Execucao do ZAP via Docker spawn]]
[[ADR-021 - Maquina de Vulnerability com 4 estados]]
[[ADR-025 - Metricas analiticas derivadas do AuditLog]]
