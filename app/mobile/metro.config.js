// metro.config.js
//
// Monorepo (npm workspaces) faz o Metro observar a raiz do repo inteira, não
// só app/mobile — inclusive `app/api/uploads-test/`, onde os testes de
// Evidence do backend criam e apagam arquivo o tempo todo. Isso derruba o
// dev server com ENOENT (watcher tenta assistir um arquivo que já sumiu)
// sempre que `npm run check` roda no backend em paralelo. blockList exclui
// essas pastas voláteis do watch sem restringir `watchFolders` (que
// precisa continuar amplo pra resolução de node_modules hoisted).
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /app[\\/]api[\\/]uploads(-test)?[\\/].*/,
  /app[\\/]api[\\/]coverage[\\/].*/,
];

module.exports = config;
