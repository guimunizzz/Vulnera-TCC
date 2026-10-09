<!-- Registra a mudança de alvo e as provas da apresentação; consumido pelos mantenedores e pela banca. -->

# DAST em rede interna — validação de 09/10/2026

**✅ Concluída: 100% (4/4 entregas).** Branch
`codex/fix-dast-network-targets`, base `dev` em `33f6438`.

Implementação em `98ca2e9`; branch publicada e [PR #58](https://github.com/guimunizzz/Vulnera-TCC/pull/58)
em rascunho para `dev`, sem merge. A abertura usou a autenticação Git existente
após o conector GitHub retornar 403 por permissão da integração.

## Comportamento entregue

Rafael autorizou remover permanentemente o bloqueio de endereço privado ou
local. `validateTargetUrl` agora valida formato HTTP/HTTPS, recusa
credenciais embutidas e remove fragmentos. A classificação de rede, a flag
`DAST_ALLOW_PRIVATE_TARGETS` e o erro `TARGET_NOT_ALLOWED` foram retirados.
Configurações antigas dessa flag não têm efeito. Alcance e consequências
registrados no ADR-045.

O Real continua exigindo confirmação explícita, ADMIN/PENTESTER e ownership.
Seu perfil é GET limitado/análise passiva, sem executar JavaScript ou
exploração ativa; falha real não vira simulação. A promoção exige projeto
autorizado e revisão humana do vetor CVSS. Demo permite triagem para
apresentar a interface, mas não promoção/comparação operacional.

O PDF foi corrigido para descrever esse perfil e a gestão de resultados
existente, distinguindo Real/demonstração na capa, sumário e metodologia.

## Evidência real

O primeiro IP `192.168.0.1:5173` expirou no teste da API em Docker. O usuário
corrigiu para `http://10.87.169.107:5173/`, que respondeu HTTP 200. O scan foi
iniciado pela UI em **Real — análise passiva**, após confirmação do alvo.

| Campo | Resultado |
| --- | --- |
| Scan | `cmv0w39160001qm012bshqfva` |
| Estado | `COMPLETED`, `simulated=false`, `progress=100`, `phase=DONE` |
| Duração do runner | 21.331 ms (21,331 s) |
| Motor | ZAP 2.17.0 |
| Achados | 5: 0 altos, 3 médios, 1 baixo, 1 informativo |
| HTML original | HTTP 200, CSP `sandbox`, `nosniff`, visualizado em iframe |
| Cobertura observada | Uma página HTML, método GET; a SPA não foi executada |

## Percurso pela interface

Foi preparado um tenant separado via API: registro de CLIENT, empresa no
plano Enterprise, solicitação de assinatura e aprovação ADMIN. A UI ADMIN
foi usada nos demais passos; o cenário TechNova anterior foi preservado.

1. Cadastro **Aplicação LAN — apresentação**, com a URL autorizada e a
   empresa **Demonstração DAST LAN — 09/10/2026**. A lista atualizou para
   seis aplicações sem recarga manual.
2. Wizard com aplicação pré-selecionada, tipo DAST, nome/escopo e remediação;
   projeto criado e iniciado com sucesso.
3. Scan real e contadores visíveis. Achado CSP confirmado com nota salva.
4. Promoção para o projeto criado, categoria A05, vetor CVSS ilustrativo
   explicitamente identificado na descrição como demonstração. Vulnerability
   aberta com origem DAST, depois comentário e `OPEN → IN_PROGRESS`.
5. Relatório ZAP aberto pela UI; PDF Real baixado (5 páginas). PDF Demo
   existente baixado (7 páginas), sem enviar tráfego ao colega.
6. PDFs renderizados e inspecionados; capa/metodologia correspondem aos
   modos escolhidos. Dados de cadastro, status, procedência e vínculo tenant
   conferidos por leitura da API/banco.

IDs do cenário conservado para repetir a apresentação:

| Recurso | ID |
| --- | --- |
| Company | `cmv0w4gt9000iqm01lsj8rvht` |
| Application | `cmv0w8itl000sqm0140fgawhf` |
| Project | `cmv0w9hgt000uqm016wkxdz76` |
| DastFinding promovido | `cmv0w3pzz0004qm01xgxl689i` |
| Vulnerability | `cmv0wayh70012qm019n0x28w1` |

`Vulnerability.companyId/applicationId/projectId` correspondem ao cenário
acima; `sourceType=DAST_IMPORT` e `sourceDastFindingId` conferidos no banco.
Não foram excluídos registros anteriores nem alterados seus status.

## Checks

| Check executado | Resultado |
| --- | --- |
| API `npm run build` | Aprovado |
| API `npm run check` | Para no lint: dois imports não usados preexistentes em `vulnerability.service.ts:45` |
| API `npm run test -- --silent` | 617/617 testes, 43/43 suítes, 351,02 s |
| ESLint API dos quatro arquivos alterados | Aprovado |
| Web `npm run check -- -- --maxWorkers=1` | 338/338 testes, 30/30 suítes; lint 0 erros/9 avisos preexistentes; contraste 66/66 |
| Web teste DAST focal | 4/4 |
| Builds Docker API/web | Aprovados; serviços recriados, API saudável |
| Revisão independente | Correção de coerência no texto demo: triagem disponível; promoção/comparação bloqueadas |

As correções textuais finais do PDF receberam novo build Docker/TypeScript e
conferência do PDF exportado. A suíte completa não foi repetida por alteração
exclusivamente textual. Sem schema, migration, dependência ou lockfile.

## Limites e trabalho futuro

- O IP é dinâmico: antes da apresentação, confirmar endereço/porta Vite,
  firewall e acesso a partir da rede Docker. Loopback aponta para o ZAP;
  usar `host.docker.internal` para servidor no host Docker Desktop.
- GET passivo não avalia toda a SPA nem comprova exploração. Achados exigem
  revisão; o CVSS usado na promoção está marcado como ilustrativo.
- Normalização de sentinelas CWE/WASC `-1` permanece como polimento futuro.
- O lint global API preexistente continua pendente. Esta entrega não é uma
  nova validação manual do mobile ou uma reanálise dos findings SAST.

Evidências locais: `output/dast-network/` (screenshot resultado/HTML ZAP,
JSON, PDFs, textos e renderizações); log web
`output/dast-network-web-check.log`. Dados brutos do alvo permanecem locais.
