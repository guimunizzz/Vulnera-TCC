<!-- Texto para abertura manual de issue no GitHub; documenta dois alertas SAST e os critérios para sua resolução. -->

# Título

[Segurança][SAST] Resolver dois findings HIGH: XSS em relatório DAST e Path Traversal em evidências

# Descrição

O SAST reportou dois findings de severidade **HIGH** na API. Investigar o fluxo completo de cada alerta, corrigir eventuais brechas e adicionar testes de regressão. Caso um alerta seja falso positivo, documentar a conclusão com evidências técnicas e configurar uma exceção específica e justificada.

**Status:** alertas reportados pelo scanner; exploração ainda não reproduzida nesta análise. O código atual já contém controles que precisam ser considerados na validação.

## 1. Cross-site Scripting (XSS)

- **Finding ID:** `d619f81f-c998-486d-9e0c-cc0752719ae4`
- **Severidade:** HIGH
- **Local informado pelo SAST:** `app/api/src/controllers/dast-scan.controller.ts:126`
- **Método:** `getReportHtml`
- **Alerta:** entrada de parâmetro HTTP alcança `send`, que retorna HTML ao usuário.
- **Impacto potencial:** execução de conteúdo malicioso presente no relatório, caso as barreiras de isolamento sejam insuficientes.

### Contexto e trabalho necessário

O controller recebe `req.params.id`, consulta `getReportFile(actor, id, "report.html")` e envia o buffer como HTML. Atualmente a resposta inclui `Content-Security-Policy: sandbox` e `X-Content-Type-Options: nosniff`; o service verifica acesso ao scan e exige estado `COMPLETED`.

- Rastrear a origem do conteúdo do relatório e validar o isolamento no navegador consumidor.
- Usar relatório controlado com scripts, atributos de evento e URLs executáveis para verificar o comportamento.
- Se necessário, reforçar o isolamento, sanitizar o conteúdo ou ajustar a entrega do relatório, preservando sua utilidade.
- Preservar autenticação, autorização e acesso apenas ao scan permitido.

## 2. Path Traversal

- **Finding ID:** `61fbc613-427f-4676-aff9-c9ddfbbe90e0`
- **Severidade:** HIGH
- **Local informado pelo SAST:** `app/api/src/controllers/evidence.controller.ts:65`
- **Método:** `download`
- **Alerta:** entrada de parâmetro HTTP alcança `download` e é utilizada como caminho.
- **Impacto potencial:** leitura de arquivos fora do armazenamento autorizado, caso seja possível contornar o confinamento.

### Contexto e trabalho necessário

O parâmetro `evidenceId` é usado para buscar a evidência. O caminho vem de `evidence.filePath` no banco; `getFileForDownload` verifica autorização e chama `resolveDentroDeUploads`, que resolve o caminho e verifica o prefixo da raiz com separador. O download usa `nosniff` e nome sanitizado.

- Validar o fluxo HTTP → busca → autorização → resolução → download, considerando caminhos persistidos adulterados.
- Cobrir `../`, caminhos absolutos, variantes codificadas, separadores Windows/Linux e diretórios com prefixo semelhante ao permitido.
- Verificar links simbólicos que apontem para fora da raiz, quando suportados no ambiente de execução.
- Garantir que o arquivo servido permaneça no armazenamento autorizado e que outro tenant não consiga acessá-lo.

## Critérios de aceite

- [ ] Os dois fluxos foram investigados e a classificação de cada finding foi documentada.
- [ ] Relatório malicioso controlado não executa código nem acessa a origem da aplicação; relatório legítimo continua utilizável.
- [ ] Tentativas de escape não retornam conteúdo externo à raiz autorizada; download legítimo continua funcionando.
- [ ] Testes de autorização e isolamento entre tenants continuam aprovados, incluindo canários TEN aplicáveis.
- [ ] Testes de regressão da API cobrem os casos relevantes; validação de XSS inclui navegador real.
- [ ] `npm run check` foi executado, com resultado e eventuais bloqueios preexistentes registrados.
- [ ] Nova execução do SAST demonstra a resolução dos dois IDs, por correção ou exceção individual fundamentada; regras globais permanecem habilitadas.
- [ ] PRD e BACKLOG foram atualizados com o resultado e as evidências.

**Labels sugeridas:** `security`, `sast`, `backend`, `high`.
