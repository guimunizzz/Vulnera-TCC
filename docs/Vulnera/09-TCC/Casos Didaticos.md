---
type: tcc
tags: [academico, didatico]
status: em-construcao
---

# Casos Didaticos

## Objetivo

O Vulnera foi projetado para ser também um **laboratório didático**: aplicações desenvolvidas por colegas do curso serão cadastradas na plataforma e analisadas com ferramentas reais (SonarQube SAST e OWASP ZAP DAST), gerando casos concretos de uso para o TCC e envolvendo a turma como usuários de teste.

> Isso cria um diferencial significativo: o projeto não é apenas funcional — é verificável por terceiros.

---

## Estrutura de um caso didático

Cada caso registrado deve ter:

1. **Nome da aplicação analisada** (fictício ou consentido)
2. **Perfil da aplicação** (tech stack, tipo: web/mobile/API)
3. **Tipo de análise realizada** (SAST, DAST ou ambos)
4. **Principais findings encontrados** (anonimizados se necessário)
5. **Severidades distribuídas** (quantos críticos, altos, médios, baixos)
6. **Lição acadêmica** — o que o caso ensina sobre segurança

---

## Casos planejados

### Caso 1 — Aplicação Web de colegas do curso
**Status**: planejado

Convidar 1–2 grupos de colegas do curso a cadastrar uma aplicação que estejam desenvolvendo. Realizar:
- SonarQube SAST no código
- OWASP ZAP DAST na aplicação rodando

**Objetivo**: demonstrar como findings reais surgem mesmo em código de estudantes bem intencionados.

**Lição esperada**: vulnerabilidades comuns como XSS refletido, SQL Injection superficial, tokens sem expiração, endpoints sem autenticação.

---

### Caso 2 — Aplicação interna (Vulnera analisando a si mesmo)
**Status**: planejado

Analisar o próprio Vulnera como objeto de estudo:
- SonarQube já roda no CI
- ZAP executa contra a API do Vulnera

**Objetivo**: demonstração meta — a plataforma de segurança sendo auditada pela própria plataforma.

**Lição esperada**: mesmo com práticas de desenvolvimento seguro documentadas, o ZAP pode encontrar achados menores (ex: missing header, cookie sem flag, informational disclosures).

**Evidência**: relatório ZAP gerado na Fase 7, arquivado em `zap-reports/`.

---

### Caso 3 — Seed didático (dados simulados)
**Status**: será criado na Fase 8

Para a demo da banca, o seed incluirá um caso didático simulado com:
- Empresa fictícia: "FinTech Segura SA"
- Aplicação: "App de pagamentos Node.js + React"
- Projeto: DAST INTERMEDIATE
- 10 findings representativos:
  - 2 críticos (SQL Injection, auth bypass)
  - 3 altos (XSS persistente, IDOR, upload sem validação)
  - 3 médios (CSRF, informação sensível em log, token sem expiração)
  - 2 baixos (missing headers, verbose error)
- Avaliação de maturidade com score 2.4 (Básico)
- Relatório PDF gerado

**Objetivo**: mostrar o produto com dados realistas sem depender de criação ao vivo.

---

### Caso 4 — Comparativo de maturidade (evolução no tempo)
**Status**: possível bônus na Fase 8

Se houver tempo, demonstrar dois assessments para a mesma empresa em momentos distintos, mostrando evolução do score de maturidade após remediação de findings críticos.

**Lição esperada**: o ciclo completo — encontrar, corrigir e validar melhora o score de maturidade.

---

## O que documentar por caso

```markdown
## Caso N — [Nome]

**Aplicação**: [nome e stack]
**Tipo de análise**: SAST | DAST | COMBO
**Nível**: BASIC | INTERMEDIATE | ADVANCED
**Data**: [data de execução]

### Findings por severidade
- Crítico: N
- Alto: N
- Médio: N
- Baixo: N

### Achado mais relevante
[Descrição breve do finding mais representativo]

### Lição acadêmica
[O que esse caso ensina sobre segurança de software]

### Evidências
- [ ] Screenshot dos findings na plataforma
- [ ] Relatório PDF gerado
- [ ] Relatório ZAP (se DAST)
```

---

## Uso na monografia

Os casos didáticos alimentam:
- **Capítulo 2** (Fundamentação Teórica): exemplos reais dos conceitos CVSS/OWASP
- **Capítulo 7** (Resultados): demonstração prática de valor do produto
- **Apresentação para a banca**: slides com findings reais mostram que o produto funciona além do seed

---

## Considerações éticas

- toda análise de código de colegas requer **consentimento prévio**
- resultados são usados apenas para fins acadêmicos
- nomes reais de aplicações/empresas são anonimizados na monografia
- findings de vulnerabilidades reais não são divulgados publicamente

---

## Links relacionados
[[Evidencias para Banca]]
[[Estrutura da Monografia]]
[[OWASP ZAP]]
[[SonarQube]]
[[Findings]]
[[MaturityAssessment]]
