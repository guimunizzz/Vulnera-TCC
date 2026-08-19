# Política de Routing e Consumo

Objetivo: preservar qualidade da auditoria sem usar Sol/xhigh indiscriminadamente.

## Tiers

### Tier 1 — coleta/classificação repetível

Modelo preferido: `gpt-5.6-luna`, reasoning `high`.

Use para inventário, indexação, classificação, busca de TODO/FIXME/mocks/placeholders, catálogo de testes e tarefas mecânicas com formato de saída claro.

### Tier 2 — análise técnica

Modelo preferido: `gpt-5.6-terra`, reasoning `high`.

Use para arquitetura, backend, frontend/UX, dados, infra, integrações e análise técnica que exige seguir relações entre arquivos.

### Tier 3 — julgamento transversal

Modelo preferido: `gpt-5.6-sol`, reasoning `xhigh`.

Use para regras de negócio, segurança, fluxos ponta a ponta e revisão adversarial.

### Tier 4 — escalonamento excepcional

Não existe `max` como valor de `model_reasoning_effort` nos TOMLs deste harness. Quando houver um P0/P1 extremamente ambíguo ou conflito crítico não resolvido por Sol/xhigh, o orquestrador deve:

1. isolar o requisito/finding;
2. reduzir o contexto aos arquivos/evidências relevantes;
3. registrar `ESCALATION_REQUIRED: YES`;
4. recomendar ao usuário uma adjudicação separada usando Max na interface, se disponível.

A auditoria não deve colocar todo o projeto em Max.

## Regras de economia

- Não reenviar a Checklist Mestre inteira a todo agente; use `REQUIREMENT_SEEDS.jsonl`/Registry e envie apenas lotes relevantes.
- Batches preferenciais: 40–80 requisitos auditáveis; até ~120 apenas para trabalho mecânico.
- Não reenviar logs longos; sumarizar e apontar caminhos.
- Agentes devem retornar findings compactos, não capítulos de relatório.
- `adversarial_reviewer` revisa 100% de P0/P1, divergências e baixa confiança; para P2/P3/✅, use amostragem dirigida.
- Evitar subagente quando uma consulta simples do próprio agente resolve a questão.
- Máximo recomendado de 6 threads concorrentes durante a primeira execução.
