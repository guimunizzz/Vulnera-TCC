---
type: regra-negocio
tags: [rule, source-of-truth]
status: ativo
codigo: RN24
criticidade: baixa
---

# RN24 - Push mobile filtravel por categoria

## Enunciado
As push notifications mobile são filtráveis por categoria nas configurações do usuário.

## Motivação
Evitar fadiga de notificações. O cliente pode desativar categorias menos urgentes sem perder alertas críticos. Respeita a autonomia do usuário e melhora a experiência no mobile.

## Escopo
Aplica-se às push notifications enviadas pelo Expo Push Service para usuários CLIENT no app mobile.

## Categorias configuráveis
- Findings críticos (`CRITICAL_FINDING`)
- Mudanças de status de projeto (`PROJECT_STATUS`)
- Novas mensagens de chat (`CHAT_MESSAGE`)
- Comentários em findings (`FINDING_COMMENT`)

## Condições
- as preferências são armazenadas por usuário (campo ou tabela de preferências de notificação)
- antes de enviar um push, o sistema verifica se a categoria está habilitada para aquele usuário
- por padrão, todas as categorias estão habilitadas no primeiro acesso
- a tela de configurações do app mobile deve permitir ativar/desativar cada categoria individualmente

## Impacta
[[Notification]]
[[User]]
[[Mobile Cliente]]

## Casos de teste
- usuário desativa categoria CHAT_MESSAGE → push de nova mensagem não é enviado
- usuário reativa categoria → push volta a ser enviado
- preferências são persistidas entre sessões

## Relacionado
[[Mobile Cliente]]
[[Notificacoes]]
[[RN22 - Nova assinatura notifica Admin]]
