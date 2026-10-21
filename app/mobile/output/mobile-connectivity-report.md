# Conectividade mobile — 2026-10-07

“Projetos indisponíveis” ocorreu após reabrir o projeto em outro dia. O IP Wi-Fi atual do computador é `10.87.169.60`; o `.env` do mobile ainda usava `10.87.169.7`.

Atualizado somente o endereço público local para `EXPO_PUBLIC_API_URL=http://10.87.169.60:3001/api`. O script de smoke agora recebe a URL pelo ambiente, permitindo `node --env-file=.env output/api-smoke.mjs` sem fixar o IP do dia anterior.

Docker confirmou API/MySQL saudáveis, com API exposta na porta 3001. Pelo novo IP, `/api/health` respondeu `status: ok` e `/api/plans` retornou três planos. A conferência autenticada usa as contas de demonstração existentes, sem alteração de dados de domínio; resultados em [smoke API](./api-smoke-results.json).

O usuário precisa interromper o próprio Expo com Ctrl+C, executar `npx expo start -c` em `app/mobile` e reabrir o app. A URL é incorporada ao bundle pelo Expo. Para conferir a rede do celular, abrir `http://10.87.169.60:3001/api/health` no navegador do aparelho deve retornar `status: ok`; caso não responda, conferir a conexão à mesma rede e o acesso à porta 3001.

Não foi reiniciado o Metro do usuário, alterado o firewall, recriado o banco ou repetido o seed. A validação diretamente no celular depende da recarga do app.
