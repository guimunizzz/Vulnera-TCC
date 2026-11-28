---
status: aceito
data: 2026-11-27
---

<!-- Registra as decisões da revisão do PR #88 para orientar manutenção, operação e testes do assistente. -->

# ADR-068 — Orçamento e fronteiras da Vuvu

## Contexto

A revisão do PR #88 identificou acoplamento entre a cota de geração e a proteção HTTP, multiplicação da cota em múltiplos processos e diferenças de limites na leitura da resposta. Também pediu que o material de ajuda respeitasse os papéis das rotas.

## Decisão

- Aplicar o orçamento de geração em contadores próprios, inclusive com `RATE_LIMIT_ENABLED=false` e `NODE_ENV=test`. O padrão por deployment é de 5 tentativas iniciais por pessoa, com reposição de 10 por hora, e 20 compartilhadas, com reposição de 30 por hora. A rajada pessoal precisa ser menor que a compartilhada.
- Dividir as taxas e arredondar as rajadas para baixo por processo conforme `ASSISTANT_API_REPLICAS`. A configuração deve usar o total máximo de processos simultâneos, incluindo sobreposição de versões, e reservar ao menos um token pessoal e dois compartilhados por processo. Cada processo mantém sua própria parcela da cota.
- Limitar a leitura do corpo do provedor a 32.000 bytes e cancelar a leitura ao exceder esse limite. Respostas geradas aceitam até 4.000 caracteres e passam pelo filtro de texto simples. A Web usa o mesmo limite de caracteres.
- Usar `MINIMAL` por padrão. Permitir `LOW` nos modelos textuais validados para os dois níveis. Gemini 2.5 Flash e Flash-Lite usam `thinkingBudget: 0` no modo padrão. Um modelo ou combinação sem política definida aciona a ajuda local.
- Restringir guias operacionais aos papéis autorizados. A conversa Web é descartada quando muda a empresa da sessão, inclusive se a conta e o papel continuarem iguais.

## Consequências

- Um reinício restaura a parcela inicial da cota do processo. Réplicas seguem os limites agregados enquanto a contagem configurada cobre todos os processos ativos. A distribuição de tráfego pode deixar parte da cota disponível em outro processo.
- `LOW` pode aumentar latência e consumo de tokens. O Free Tier e as cotas efetivas dependem do projeto e do modelo no Google AI Studio.

## Relacionado

- [ADR-064 — Assistente contextual com Gemini e ajuda local](ADR-064%20-%20Assistente%20contextual%20com%20Gemini%20e%20ajuda%20local.md)
- [ADR-066 — Conversa básica e cota de geração da Vuvu](ADR-066%20-%20Conversa%20basica%20e%20cota%20de%20geracao%20da%20Vuvu.md)
- [Comentário de revisão do PR #88](https://github.com/guimunizzz/Vulnera-TCC/pull/88#issuecomment-7205723242)
