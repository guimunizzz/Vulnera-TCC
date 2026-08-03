---
type: enum
tags: [data, domain, source-of-truth]
status: ativo
---

# Enum - ProjectStatus

## Definição
`ProjectStatus` representa o estágio atual de um `Project` dentro do ciclo de vida de uma análise de segurança. Controla o fluxo operacional do trabalho de consultoria.

## Valores

| Valor | Descrição | Quem pode entrar |
|---|---|---|
| `REQUESTED` | Projeto solicitado pelo cliente. Aguarda triagem do Admin. | Sistema (criação) |
| `TRIAGE` | Admin recebeu e está avaliando o escopo e viabilidade. | Admin |
| `PLANNED` | Análise planejada, pentesters atribuídos, data definida. | Admin |
| `IN_PROGRESS` | Análise em execução. Pentesters registrando findings. | Admin |
| `IN_REVIEW` | Análise concluída. Relatório em revisão pelo Admin. | Admin |
| `DELIVERED` | Relatório entregue ao cliente. | Admin |
| `CLOSED` | Projeto encerrado definitivamente. | Admin |

## Campo no banco

Tabela `PROJECT`, campo `status`:
```
status  VARCHAR / ENUM  NOT NULL
```

Valores válidos no Prisma:
```prisma
enum ProjectStatus {
  REQUESTED
  TRIAGE
  PLANNED
  IN_PROGRESS
  IN_REVIEW
  DELIVERED
  CLOSED
}
```

## Fluxo de transições

```
REQUESTED → TRIAGE → PLANNED → IN_PROGRESS → IN_REVIEW → DELIVERED → CLOSED
```

Retornos permitidos:
```
IN_REVIEW → IN_PROGRESS   (ajustes necessários)
DELIVERED → IN_PROGRESS   (revalidação solicitada)
```

Ver máquina de estados completa: [[Maquina - Project]]

## Impacto funcional por status

| Status | Efeito no sistema |
|---|---|
| `REQUESTED` | Cliente criou o projeto; Admin não atuou ainda |
| `TRIAGE` | Admin pode atribuir pentesters |
| `PLANNED` | Pentesters atribuídos podem ver o projeto |
| `IN_PROGRESS` | Pentesters podem registrar Vulnerability e Evidence |
| `IN_REVIEW` | Relatórios podem ser gerados (RN18) |
| `DELIVERED` | Cliente pode ver e baixar relatório |
| `CLOSED` | Nenhuma operação adicional permitida |

## Restrições por status

- relatórios só podem ser gerados a partir de `IN_REVIEW` — ver [[RN18 - Relatorios exigem Project em IN_REVIEW ou superior]]
- transições só são permitidas conforme a máquina de estados — ver [[RN12 - Transicoes seguem maquina de estados]]
- apenas ADMIN pode transicionar status — com auditoria (RN15)

## Links relacionados
[[Maquina - Project]]
[[Project]]
[[RN12 - Transicoes seguem maquina de estados]]
[[RN15 - Admin pode sempre mover status com auditoria]]
[[RN18 - Relatorios exigem Project em IN_REVIEW ou superior]]
[[MOC - Dominio]]
