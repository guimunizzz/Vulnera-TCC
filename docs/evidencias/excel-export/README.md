<!-- Evidências visuais da exportação Excel de findings; consumido por quem revisa o PR e pela banca. -->

# Evidências — exportação Excel de findings

Capturas de **22/10/2026**, feitas na stack Docker local (`web` em `:8086`, `api` em `:3001`) com os dados
da demonstração. Guia da funcionalidade: [FINDINGS_EXCEL_EXPORT.md](../../FINDINGS_EXCEL_EXPORT.md).

## Interface (Chrome real, via Playwright)

| # | O que mostra |
| --- | --- |
| [01](01-botao-exportar-excel.png) | O botão **Exportar Excel**, ao lado do CSV, com o filtro `severidade = CRITICAL, HIGH` aplicado |
| [02](02-sucesso-download-e-toast.png) | Sucesso: o download começou e o aviso mostra o nome vindo do servidor (`findings_filtrado_…xlsx`) |
| [03](03-recorte-vazio-botao-desabilitado.png) | Recorte vazio: botão desabilitado e o motivo visível |
| [04](04-erro-com-tentar-novamente.png) | Falha de rede: aviso com **Tentar novamente** |
| [05](05-cliente-aba-findings-do-projeto.png) | **CLIENT** exportando pela aba Findings do projeto (`findings_pentest-api-integracao-b2b_…xlsx`) |

## Planilha (arquivos reais exportados pela API, renderizados no LibreOffice → PDF → PNG)

| # | O que mostra |
| --- | --- |
| [06](06-planilha-resumo.png) | Aba **Resumo** |
| [07](07-planilha-findings-esquerda.png) · [08](08-planilha-findings-direita.png) | Aba **Findings** (recortes em alta resolução). ⚠️ Gerados a partir de dados **sintéticos** de teste, de propósito: incluem valores `=cmd…` e `=App*…` gravados como texto, caracteres de controle removidos e texto com quebra de linha |
| [09](09-planilha-dashboard-admin.png) | **Dashboard** do ADMIN: cartões e os 4 gráficos nativos |
| [10](10-planilha-dashboard-pentester-escopo-restrito.png) | **Dashboard** do PENTESTER filtrado por críticas e altas: só os findings dos projetos dele (3 críticos + 2 altos) |
| [11](11-planilha-acompanhamento.png) | Aba **Acompanhamento**: colunas âmbar para preencher, calculadas com cores de SLA |
| [12](12-planilha-resumo-cliente-com-filtros.png) | **Resumo** de um CLIENT, com os filtros aplicados em português |

> [!WARNING]
> O LibreOffice renderizou os arquivos; a abertura no **Excel desktop e no Excel Online não foi validada**
> (não há como automatizar). Confira manualmente antes de entregar ao cliente.
