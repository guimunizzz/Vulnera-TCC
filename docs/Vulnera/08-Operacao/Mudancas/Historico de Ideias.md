---
type: historico
tags: [operacao, historico]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Historico de Ideias

Registro de ideias que surgiram durante o design do Vulnera — tanto as que foram incorporadas quanto as descartadas ou adiadas. Serve como memória das decisões de escopo e como referência para futuras evoluções.

---

## Ideias incorporadas ao produto

### Serviço de remediação como flag por projeto
**Origem**: design do módulo de findings
**Status**: incorporada

A ideia de que o fluxo de remediação pode variar por projeto (com ou sem analista conduzindo a correção) tornou o produto mais próximo da realidade de consultorias. Resolvida via flag `hasRemediationService` no `Project`.

Ver: [[RN13 - Fluxo com remediation service]], [[RN14 - Fluxo sem remediation service]]

---

### Maturidade com scores 1–5 por subcontrole
**Origem**: referência a ferramentas de mercado
**Status**: incorporada

Em vez de um score binário (conforme/não conforme), adotar escala 1–5 por controle permite granularidade maior e dashboards de radar mais ricos. O nível final (BASIC/INTERMEDIATE/ADVANCED) é derivado da média.

Ver: [[MaturityScore]], [[MaturityControl]], [[Maturidade]]

---

### Gemini como assistivo, não autônomo
**Origem**: debate sobre uso de IA no TCC
**Status**: incorporada com rate limit

A tentação inicial era permitir que o Gemini gerasse todo o relatório automaticamente. Decidiu-se restringir: IA sugere, humano aprova. Flag `aiAssisted` registra transparência. Rate limit previne abuso de cota.

Ver: [[ADR-006 - Gemini com rate limit agressivo]], [[Integracao Gemini]]

---

### PDF client-side
**Origem**: debate sobre onde gerar o PDF
**Status**: incorporada

Evitar processamento pesado no servidor não é apenas performance — é superfície de DDoS reduzida. `pdf-lib` roda no browser sem custo de servidor.

Ver: [[ADR-003 - PDF gerado no cliente]]

---

### Testes canário para auth e multi-tenant
**Origem**: preocupação com regressão em regras críticas
**Status**: incorporada

A ideia de marcar testes específicos como "intocáveis" (`@canary`) e torná-los required checks no CI surgiu da percepção de que quebrar autenticação ou vazar dados entre empresas seria catastrófico. São os únicos testes que bloqueiam merge.

Ver: [[GitHub Actions CI]]

---

## Ideias descartadas (fora do escopo)

### Integração com Jira/Linear para rastreamento de tarefas
**Motivo do descarte**: aumenta dependência externa e complexidade sem ganho proporcional para o TCC. O GitHub Projects cobre o caso de uso.

---

### Notificações por WhatsApp
**Motivo do descarte**: fora do escopo do MVP; aumenta custo de API e complexidade de integração sem contribuição técnica nova.

---

### Geração de relatório server-side (PDF via Puppeteer)
**Motivo do descarte**: superfície de DDoS, custo de servidor, complexidade. Client-side resolve com menor risco.

Ver: [[ADR-003 - PDF gerado no cliente]]

---

### Upload de evidências no S3/MinIO
**Motivo do descarte**: filesystem local em volume Docker é suficiente para o TCC. Migração para S3 é evolução documentada, não requisito do MVP.

---

### Chat com suporte a markdown e imagens inline
**Motivo do descarte**: chat é canal de comunicação simples — texto puro é suficiente. Markdown + imagens requer sanitização adicional e UX mais complexa.

---

### Mobile com funcionalidades de escrita (criar findings pelo celular)
**Motivo do descarte**: aumenta escopo mobile significativamente; pentester usa desktop para análise. Mobile é read-mostly por design.

Ver: [[ADR-004 - Mobile cliente e read-mostly]]

---

## Ideias adiadas (backlog futuro)

### Integração com scanner externo (Nessus, Burp Suite)
Importar findings automaticamente de ferramentas de varredura. Valor alto, mas complexidade de integração está fora do TCC.

---

### Dashboard comparativo de maturidade entre períodos
Comparar dois assessments da mesma empresa ao longo do tempo. Arquitetura suporta (MaturityAssessment é histórico), mas UI de comparação está fora do MVP.

---

### Assinatura digital de relatórios
Relatório PDF com assinatura digital da consultoria. Relevante para uso real, fora do escopo acadêmico.

---

### Múltiplos projetos simultâneos por Application
Abrir SAST e DAST em paralelo na mesma aplicação. Decisão documentada de simplificar para 1-para-1 no TCC.

Ver: [[ADR-002 - Project 1 para 1 com Application]]

---

## Como usar este arquivo

- ao propor uma nova feature: registrar aqui se for descartada, para não reabrir o debate futuro
- ao concluir o TCC: revisar ideias adiadas como potencial de evolução do produto

---

## Links relacionados
[[Hipoteses em Validacao]]
[[Decisoes Recentes]]
[[Changelog do Projeto]]
[[Fora do Escopo]]
[[MOC - Operacao]]
