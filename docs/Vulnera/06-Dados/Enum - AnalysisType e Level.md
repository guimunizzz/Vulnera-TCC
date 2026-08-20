---
type: enum
tags: [data, domain, source-of-truth]
status: ativo
---

# Enum - AnalysisType e Level

## Definição
Dois enums distintos que classificam o tipo e a profundidade de análise de um `Project`. São definidos no momento da solicitação do projeto e influenciam o escopo do trabalho.

---

## AnalysisType — Tipo de análise

### Definição
Indica a metodologia principal da análise de segurança sendo realizada.

### Valores

| Valor | Nome | Descrição |
|---|---|---|
| `SAST` | Static Application Security Testing | Análise estática do código-fonte ou bytecode sem executar a aplicação. Identifica vulnerabilidades na estrutura do código. |
| `DAST` | Dynamic Application Security Testing | Análise dinâmica da aplicação em execução. Testa entradas, fluxos e comportamentos em tempo real. |
| `MATURITY` | Avaliação de Maturidade | Análise do nível de maturidade de segurança da organização. Gera MaturityAssessment com scores por domínio. |
| `COMBO` | Combinado | Combina dois ou mais tipos de análise em um mesmo projeto. |

### Campo no banco

Tabela `PROJECT`, campo `analysis_type`:
```
analysis_type  VARCHAR / ENUM  NOT NULL
```

Valores válidos no Prisma:
```prisma
enum AnalysisType {
  SAST
  DAST
  MATURITY
  COMBO
}
```

### Impacto funcional por tipo

| Tipo | Módulos ativados | Observação |
|---|---|---|
| `SAST` | Vulnerability, Evidence, Report | Código-fonte como objeto de análise |
| `DAST` | Vulnerability, Evidence, Report | Aplicação em execução como objeto |
| `MATURITY` | MaturityAssessment, MaturityScore, Report | Avaliação por domínios e controles |
| `COMBO` | Todos os acima conforme escopo | Escopo definido no projeto |

---

## AnalysisLevel — Nível de profundidade

### Definição
Indica a profundidade e abrangência da análise. Influencia o escopo, o esforço estimado e o que será entregue.

### Valores

| Valor | Nome | Descrição |
|---|---|---|
| `BASIC` | Básico | Varredura superficial, cobertura dos riscos mais críticos. Menor esforço e menor custo. |
| `INTERMEDIATE` | Intermediário | Análise aprofundada dos módulos principais. Equilíbrio entre cobertura e tempo. |
| `ADVANCED` | Avançado | Cobertura máxima. Análise detalhada de todos os componentes, lógica de negócio e integrações. |

### Campo no banco

Tabela `PROJECT`, campo `analysis_level`:
```
analysis_level  VARCHAR / ENUM  NOT NULL
```

Valores válidos no Prisma:
```prisma
enum AnalysisLevel {
  BASIC
  INTERMEDIATE
  ADVANCED
}
```

### Impacto funcional por nível

| Nível | Escopo típico | Impacto em MaturityAssessment |
|---|---|---|
| `BASIC` | Principais fluxos e endpoints críticos | Score final mapeado como < 40 |
| `INTERMEDIATE` | Módulos principais + integrações | Score final mapeado como 40–70 |
| `ADVANCED` | Cobertura completa + lógica de negócio | Score final mapeado como > 70 |

---

## Combinação dos dois campos

Os campos `analysis_type` e `analysis_level` são independentes e combinados livremente no momento de criação do `Project`:

| Exemplo | Tipo | Nível |
|---|---|---|
| Varredura DAST rápida | `DAST` | `BASIC` |
| Revisão completa de código | `SAST` | `ADVANCED` |
| Diagnóstico de maturidade | `MATURITY` | `INTERMEDIATE` |
| Avaliação completa | `COMBO` | `ADVANCED` |

---

## Links relacionados
[[Project]]
[[MaturityAssessment]]
[[Maquina - Project]]
[[Projetos]]
[[MOC - Dominio]]
