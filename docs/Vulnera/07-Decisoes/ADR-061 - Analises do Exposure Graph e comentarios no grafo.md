---
type: decisao
tags: [decision, exposure-graph, frontend, backend, multi-tenant]
status: vigente
codigo: ADR-061
data: 2026-11-23
---

# ADR-061 - Análises do Exposure Graph e comentários no grafo

> Número: 057–059 são da branch `refactor/assistant-ui`, 060 é o das
> atmosferas, 062 e 063 são as branches irmãs (`feat/produtividade`,
> `feat/conformidade-correcao`).

## Contexto

O Security Graph (Exposure Graph da empresa e CyberGraph do scan) foi a
funcionalidade de que o Rafael mais gostou. Das ideias inspiradas em outras
ferramentas, ele escolheu quatro para o grafo:

- combinações tóxicas, à moda da Wiz;
- raio de impacto;
- máquina do tempo;
- comentários fixados nos nós, à moda do Figma.

Restrições que já valiam:

- **D8**: nunca "Attack Path". O Vulnera não coleta topologia, identidades nem
  permissões, então não afirma caminho de ataque.
- **D9**: só relações comprovadas no modelo.
- **ADR-035**: o VRS é aditivo e auditável.
- **Factory → controller → service → repository**: a company sempre vem do
  usuário lido do banco.

## Decisão

1. **Combinações tóxicas, não caminhos de ataque.** É uma vulnerabilidade
   aberta em que agravantes **comprovados** coincidem:
   - Internet (`Application.internetFacing`);
   - gravidade alta ou crítica;
   - ameaça ativa: KEV, ou EPSS no percentil ≥ 0,9, alcançado pela origem
     (`CodeFinding.advisoryId` ou `ThreatMatch.advisoryId`);
   - dado confidencial ou restrito;
   - produção.

   A regra é fixa (D22.2). Internet **e** gravidade são obrigatórias, mais
   pelo menos um terceiro agravante. A ordem é: mais agravantes, depois KEV,
   depois EPSS, depois o VRS (que continua sendo o score), depois a
   severidade, depois a vulnerabilidade mais antiga. Manual e DAST não têm
   CVE e entram sem o fator de ameaça. A tela mostra a **cadeia de
   exposição** (Internet → aplicação → categoria → vulnerabilidade → ameaça),
   com o dado de cada elo, e um texto que diz que ela não afirma caminho de
   ataque.

2. **Raio de impacto por pacote, CVE ou categoria** (D22.3):
   - pacote e CVE vêm do **estado atual** do SCA: a última importação de cada
     (projeto, ferramenta), sem falso positivo, a mesma regra de
     novos/continuam/resolvidos do ADR-052;
   - categoria vem das vulnerabilidades abertas gerenciadas;
   - a CVE do Threat Intel só entra quando já foi promovida, porque o
     inventário é da empresa e não da aplicação (D9).

3. **A máquina do tempo reconstrói o passado no front.** Usa
   `Vulnerability.createdAt` mais os `STATUS_CHANGE` do AuditLog, a mesma
   fonte do burndown (D22.4). Não há tabela de série histórica nem
   snapshot. Uma vulnerabilidade sem trilha entra pelo estado atual, o mesmo
   limite do ADR-025. O contexto da aplicação é o de hoje.

4. **Comentários em qualquer nó** (D22.9): o modelo `GraphComment` guarda
   `graphKind`, `scopeId` e `nodeId` (o id que o front desenha):
   - **EXPOSURE**: `scopeId` = companyId do usuário no banco; todos os papéis
     da empresa comentam;
   - **DAST_SCAN**: o acesso é exatamente o de ver o scan
     (`DastScanService.getById`).

   Não há edição. O autor ou o ADMIN apagam. Comentário de outra empresa
   responde 404, não 403. Ainda não há menção com `@`. Um comentário novo
   avisa pelo sino quem já comentou no nó.

5. **Fronteira das camadas**: um repository novo (`exposure-analysis`) em vez
   de engordar o `exposure-graph.repository` ("cinco consultas fixas").
   Consultas raw só para a regra da "última importação". O service reaproveita
   o repository do grafo para as aplicações ativas. Os comentários reaproveitam
   o `DastScanService` montado pela factory do DAST.

## Alternativas descartadas

- **Chamar de "caminho de ataque"**: contradiz o D8.
- **Pesos configuráveis por empresa** (D22.2): fica para depois. A regra
  fixa é explicável na defesa.
- **Snapshot diário do grafo** (D22.4): só valeria daqui para frente e
  precisaria de job.
- **TechAsset no raio de impacto**: ele é da empresa, não da aplicação, então
  só daria um "pode afetar".

## Consequências

- Três endpoints novos em `/companies/me/exposure-graph/*` e
  `/graph-comments`, todos com tenancy do banco e testes negativos (TEN-EXA,
  TEN-GCO).
- Uma migration aditiva (`GraphComment`).
- O seed passa a importar o SBOM real em três aplicações da TechNova, para o
  raio de impacto ter "onde mais". KEV e EPSS **não** são inventados.

## Relacionado

[[ADR-035 - Vulnera Risk Score aditivo e auditavel]] ·
[[ADR-052 - Importacao SAST e SCA por SARIF e CycloneDX]] ·
[[ADR-053 - Threat Intel com inventario de tecnologias e sincronizacao agendada]] ·
[[ADR-060 - Atmosferas por secao na area autenticada]] · `docs/DECISIONS.md` D8, D9, D22
