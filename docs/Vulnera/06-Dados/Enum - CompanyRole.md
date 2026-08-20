---
type: enum
tags: [data, domain, source-of-truth]
status: ativo
---

# Enum - CompanyRole

## Definição
`CompanyRole` é o papel interno de um usuário dentro de uma `Company`. Aplica-se **exclusivamente** a usuários com `role = CLIENT`. Representa a hierarquia interna da empresa contratante na plataforma.

## Valores

| Valor | Nome | Descrição |
|---|---|---|
| `OWNER` | Responsável | Usuário fundador da conta da empresa. Pode convidar membros, editar dados da empresa e cancelar assinatura. |
| `MEMBER` | Membro | Usuário convidado pelo OWNER. Acesso de acompanhamento — leitura, comentários, tickets e download de relatórios. |
| `null` | Não aplicável | Usuários com `role = ADMIN` ou `role = PENTESTER` não possuem CompanyRole. |

## Campo no banco

Tabela `USER`, campo `company_role`:
```
company_role  VARCHAR / ENUM  NULLABLE
```

Valores válidos no Prisma:
```prisma
enum CompanyRole {
  OWNER
  MEMBER
}

model User {
  // ...
  companyRole  CompanyRole?  // nullable: null para ADMIN e PENTESTER
}
```

## Diferenças entre OWNER e MEMBER

| Capacidade | OWNER | MEMBER |
|---|---|---|
| Ver projetos da empresa | Sim | Sim |
| Comentar em findings | Sim | Sim |
| Baixar relatórios | Sim | Sim |
| Abrir tickets de suporte | Sim | Sim |
| Solicitar revalidação | Sim | Sim |
| Convidar novos usuários | Sim | Não |
| Editar dados da empresa | Sim | Não |
| Cancelar assinatura | Sim | Não |

## Atribuição

- `OWNER`: definido automaticamente no momento do onboarding — o usuário que registra a empresa
- `MEMBER`: atribuído pelo OWNER via convite dentro da plataforma

## Regras associadas
- [[RN01 - Empresa pode ter multiplos usuarios cliente]]
- [[RN02 - Usuario pertence a no maximo uma Company]]

## Links relacionados
[[Enum - Roles]]
[[CompanyRole]]
[[User]]
[[Company]]
[[Regras de Ownership]]
[[MOC - Dominio]]
