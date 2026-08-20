---
type: documentacao-tecnica
tags: [architecture, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Expo Push

## Resumo
O Vulnera usa o serviço de push notifications do Expo para enviar alertas ao app mobile. O back-end envia notificações via Expo Push API, que distribui para APNs (iOS) e FCM (Android) de forma transparente. O envio é best-effort e filtrável por categoria nas preferências do usuário.

## Papel na arquitetura
- canal de alerta proativo para usuários CLIENT no app mobile
- complementar às notificações in-app (web) — não as substitui
- acionado pelo `NotificationService` após eventos de negócio específicos

## Tecnologia
- **Expo Notifications** no app mobile para registro e recebimento
- **`expo-server-sdk`** no back-end Express para envio via Expo Push API
- Expo faz o relay para APNs (iOS) e FCM (Android)

## Fluxo de registro do token

```
App mobile inicia → solicita permissão de notificação ao SO
Usuário concede → Expo gera ExponentPushToken[...]
App envia token para a API via POST /users/push-token
Back-end armazena token no perfil do usuário
```

O token de push é armazenado no `User` (campo adicional) ou em uma tabela separada de dispositivos.

## Fluxo de envio

```
Evento de negócio ocorre (ex: finding crítico)
NotificationService verifica preferências do usuário (RN24)
Se push habilitado para a categoria:
  → Expo Push API recebe a mensagem
  → Expo distribui para APNs / FCM
  → Dispositivo exibe a notificação
```

## Eventos que disparam push mobile

| Categoria | Evento | Filtrável? |
|---|---|---|
| `CRITICAL_FINDING` | Finding crítico liberado | Sim |
| `PROJECT_STATUS` | Mudança de status do projeto | Sim |
| `CHAT_MESSAGE` | Nova mensagem no chat | Sim |
| `FINDING_COMMENT` | Comentário em finding | Sim |

Eventos administrativos (nova assinatura, ticket aberto) **não** disparam push — Admin não usa o app mobile.

## Regras associadas
- [[RN24 - Push mobile filtravel por categoria]]
- [[ADR-004 - Mobile cliente e read-mostly]]

## Exemplo de envio (back-end)

```ts
import Expo, { ExpoPushMessage } from 'expo-server-sdk'

const expo = new Expo()

const messages: ExpoPushMessage[] = [{
  to: user.expoPushToken,
  sound: 'default',
  title: 'Finding crítico detectado',
  body: 'Um novo finding crítico foi registrado no seu projeto.',
  data: { category: 'CRITICAL_FINDING', projectId },
}]

const chunks = expo.chunkPushNotifications(messages)
for (const chunk of chunks) {
  await expo.sendPushNotificationsAsync(chunk)
}
```

## Considerações de segurança
- o `expoPushToken` é um identificador de dispositivo — não deve ser exposto em respostas de API para outros usuários
- verificar se o token ainda é válido: tokens Expo podem expirar ou ser revogados — tratar erros `DeviceNotRegistered`
- o conteúdo da notificação push não deve incluir dados sensíveis (hashes, detalhes técnicos) — push é canal não cifrado na camada de transporte Expo→SO

## Riscos e cuidados
- push é best-effort: falha no envio não deve bloquear operação de negócio principal — tratar como fire-and-forget
- usuário sem token cadastrado (nunca abriu o app ou não concedeu permissão): verificar antes de tentar enviar
- Expo Push API tem limites de rate — `chunkPushNotifications` ajuda a respeitar esses limites para envios em lote
- sem confirmação de entrega no MVP: não há rastreamento se a notificação chegou ao dispositivo

## Links relacionados
[[Notification]]
[[RN24 - Push mobile filtravel por categoria]]
[[ADR-004 - Mobile cliente e read-mostly]]
[[Mobile Expo]]
[[Notificacoes]]
[[MOC - Arquitetura]]
