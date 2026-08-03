---
type: enum
tags: [data, domain, source-of-truth]
status: ativo
---

# Enum - Roles

## Definição
`Role` é o papel global de um usuário no sistema. Determina o escopo macro de acesso e as capacidades disponíveis na plataforma.

## Valores

| Valor | Nome | Descrição |
|---|---|---|
| `ADMIN` | Administrador | Operador da consultoria. Visão global, aprova assinaturas, atribui pentesters, avalia maturidade, responde tickets. |
| `PENTESTER` | Analista / Pentester | Executa análises. Acessa apenas projetos atribuídos. Registra findings, evidências e comentários. |
| `CLIENT` | Cliente | Representante da empresa contratante. Acompanha projetos, comenta, abre tickets, baixa relatórios. |

## Campo no banco

Tabela `USER`, campo `role`:
```
role  VARCHAR / ENUM  NOT NULL
```

Valores válidos no Prisma:
```prisma
enum Role {
  ADMIN
  PENTESTER
  CLIENT
}
```

## Impacto funcional por role

### ADMIN
- visão global da plataforma
- aprovação e rejeição de assinaturas
- CRUD de empresas e usuários
- atribuição de pentesters a projetos
- avaliação de maturidade (MaturityAssessment e MaturityScore)
- resposta a tickets de suporte
- pode mover qualquer status com auditoria (RN15)
- acesso a todos os projetos e findings

### PENTESTER
- vê apenas Projects onde é ProjectMember (RN17)
- registra Vulnerability, Evidence, VulnerabilityComment
- não acessa empresas, assinaturas ou dados de outros projetos
- pode usar IA Gemini para sugestões
- pode gerar relatórios nos projetos atribuídos

### CLIENT
- vê apenas dados da própria Company (RN16)
- acompanha projetos, findings liberados e maturidade
- comenta em findings, envia mensagens no chat, abre tickets
- baixa relatórios
- pode solicitar revalidação (sem remediation service)
- não pode criar projetos ou findings

## Combinação com CompanyRole

`Role = CLIENT` pode ter adicionalmente um `CompanyRole` (`OWNER` ou `MEMBER`).
Ver: [[Enum - CompanyRole]]

## Regras associadas
- [[RN15 - Admin pode sempre mover status com auditoria]]
- [[RN16 - Cliente so ve dados da propria Company]]
- [[RN17 - Pentester so ve Projects atribuidos]]
- [[RN19 - Maturidade e feita por Admin]]

## Links relacionados
[[Enum - CompanyRole]]
[[Roles]]
[[Matriz de Permissoes]]
[[Middlewares e Ownership]]
[[User]]
[[MOC - Dominio]]
