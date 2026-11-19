# Evidências — fila BullMQ e scans DAST agendados (ADR-056)

Capturas de 2026-11-19, na stack de desenvolvimento (`docker compose`) com
`QUEUE_DRIVER=bullmq`, branch `feat/fila-bullmq-integracao`, logado como ADMIN do seed.
Dados reais da stack; os scans são do modo SIMULADO (não tocam o alvo).

| Arquivo | O que mostra |
|---|---|
| `01-agendamentos-lista.jpg` | Página `/agendamentos` (menu com selo NEW no canto do ícone): resumo (ativos, pausados, precisam de atenção) e o cartão do agendamento em português — "Todo dia às 09:03", próximo disparo lido do scheduler, autorização do alvo vigente, última execução "Scan iniciado" com link, e os botões Ativo / Rodar agora / Editar / Histórico. |
| `02-rodar-agora-e-historico.jpg` | Depois de "Rodar agora": a execução das 11:08 aparece no histórico ao lado da execução agendada das 09:03, com a comparação por fingerprint ("↗ 0 novos · ↘ 0 resolvidos") e o link para cada scan. |
| `03-dast-proximos-agendados.jpg` | Tela `/dast`: quadro "Próximos scans agendados" (alvo, modo, frequência e quando — "20/11, 09:03 (em 22 h)") acima da lista de scans; banner do watchdog com o aviso do scan simulado. |
| `04-painel-de-filas.jpg` | Página `/admin/filas` (só ADMIN): contagens por fila (esperando, rodando, agendados, concluídos, com falha) e falhas recentes; atualiza a cada 10 s. |

Não capturado nesta rodada (a extensão do navegador desconectou): o formulário no
modo "Só uma URL" e o card do Monitor de SLA no painel. Ambos foram verificados
antes no navegador (formulário) e nos logs da API ("Monitor de SLA: agendado no
BullMQ às 08:00").
