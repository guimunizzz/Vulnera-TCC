---
type: decisao
tags: [decision, dast, rede]
status: vigente
codigo: ADR-045
data: 2026-10-09
---

<!-- Explica o suporte permanente a alvos internos; consumido pelos mantenedores e pela banca. -->

# ADR-045 — DAST aceita alvos de redes internas

## Contexto

Um alvo Vite autorizado na mesma LAN foi recusado com `TARGET_NOT_ALLOWED`.
O runner classificava endereços privados/loopback, enquanto o Compose fixava
`DAST_ALLOW_PRIVATE_TARGETS=false`. Rafael solicitou remover permanentemente
essa restrição para usar o produto em aplicações internas, inclusive na
apresentação. O primeiro IP informado não respondeu; o endereço corrigido
`http://10.87.169.107:5173/` respondeu HTTP 200 a partir da API em Docker.

## Decisão

- `validateTargetUrl` aceita qualquer endereço HTTP/HTTPS, sem classificar a
  rede do host. URLs com usuário/senha embutidos ou outro protocolo continuam
  inválidas; o fragmento é removido e a URL é canonicalizada.
- A flag `DAST_ALLOW_PRIVATE_TARGETS`, seus helpers e o erro
  `TARGET_NOT_ALLOWED` são retirados do código/configuração vigente. Uma
  variável legada ainda presente em `.env` não altera o comportamento.
- A escolha REAL/SIMULATED, a confirmação do REAL, autenticação,
  ADMIN/PENTESTER, ownership dos scans, autorização de promoção, auditoria,
  fila e limites de recursos continuam seguindo os contratos existentes.
- A cobertura real segue o ADR-042: GET limitado e análise passiva, sem
  executar JavaScript da aplicação. Não se acrescenta active scan.
- Acesso depende da rede do ZAP. Na LAN, usar o IP/porta da máquina do alvo;
  `localhost`/loopback designam o próprio container ZAP; um serviço no host
  Docker Desktop pode ser acessado por `host.docker.internal`.

## Consequências

- Aplicações privadas não precisam de liberação temporária para iniciar scan.
- Esta validação deixa de ser uma proteção SSRF por faixa de endereço.
  Uma conta ADMIN/PENTESTER pode direcionar o ZAP a serviços HTTP acessíveis
  pela rede do container, incluindo loopback e link-local. Esse alcance foi
  escolhido explicitamente pelo responsável do projeto; não há isolamento
  de rede adicional nesta mudança. Autorização no produto não comprova
  autorização do proprietário do alvo.
- Rede/firewall/porta incorretos ainda causam falha real, sem demonstração
  automática. Um alvo SPA pode gerar poucos alertas porque o crawler não
  executa JavaScript; zero achados não comprova ausência de vulnerabilidades.
- Sem alteração de schema, migration, dependência ou lockfile.

## Relacionado

- `ADR-028 - Execucao do ZAP via Docker spawn.md` — substitui parcialmente
  a política de bloqueio de hosts; execução por Docker permanece vigente.
- `ADR-042 - DAST explicito e baseline passivo.md`
- `docs/DAST.md`
- `docs/DAST-REDE-VALIDACAO-2026-10-09.md`
