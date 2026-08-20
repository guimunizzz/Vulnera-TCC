├── 📁 app                      # Raiz do código-fonte (Monorepo)
│   ├── 📁 api                  # Back-end da aplicação (Node.js)
│   │   ├── 📁 prisma           # Esquema do banco de dados e migrações do ORM
│   │   │   └── 📄 schema.prisma
│   │   ├── 📁 src              # Código-fonte principal da API
│   │   │   ├── 📁 config       # Configurações globais (EnvVar/EnvKeys) — singular fixo
│   │   │   ├── 📁 database     # Cliente Prisma (singleton) — singular fixo
│   │   │   ├── 📁 controllers  # Recebe as requisições HTTP e envia as respostas
│   │   │   ├── 📁 models       # Estrutura e tipagem dos dados (type + DTO + entity)
│   │   │   ├── 📁 repositories # Única camada que toca @prisma/client (Queries)
│   │   │   ├── 📁 services     # Camada de regras de negócio
│   │   │   ├── 📁 factories    # Factory Method — monta Repository → Service → Controller
│   │   │   ├── 📁 middlewares  # auth, require-role
│   │   │   ├── 📁 utils        # jwt, hash, cvss
│   │   │   └── 📁 routes       # Definição das rotas (Endpoints) da API
│   │   ├── ⚙️ .env.example
│   │   └── ⚙️ package.json
│   ├── 📁 mobile               # Front-end para dispositivos móveis
│   │   ├── 📁 vulnera-moblie   # Projeto React Native gerenciado pelo Expo
│   │   │   ├── 📁 assets       # Arquivos estáticos (imagens e ícones)
│   │   │   │   └── 📁 images   # Imagens gerais do aplicativo
│   │   │   ├── 📁 scripts      # Automações de desenvolvedor e manutenção local
│   │   │   │   └── 📄 reset-project.js
│   │   │   ├── 📁 src          # Código-fonte principal do app React Native
│   │   │   │   ├── 📁 app      # Componentes de tela que geram as rotas (Expo Router)
│   │   │   │   ├── 📁 components # Peças reutilizáveis de interface
│   │   │   │   ├── 📁 constants # Valores fixos, como paletas de cores e URLs base
│   │   └── ⚙️ package.json
│   └── 📁 web                  # Front-end da aplicação para navegadores
│       ├── 📁 public           # Arquivos entregues sem processamento (ex: index.html)
│       ├── 📁 src              # Código-fonte da interface Web (React/Vite)
│       │   ├── 📁 assets       # Imagens locais, ícones e fontes consumidas no código
│       │   ├── 📁 components   # Blocos visuais reaproveitáveis (Navbar, Botões)
│       │   ├── 📁 pages        # Representações de telas inteiras (Rotas)
│       │   ├── 📁 styles       # Regras globais de CSS ou configurações (ex: Tailwind)
│       │   └── 📁 utils        # Funções de formatação, máscaras e utilidades soltas
│       └── ⚙️ package.json
├── 📁 infra                    # Configurações de servidores e deploy
│   └── 📁 nginx                # Configurações do proxy reverso NGINX
├── ⚙️ package-lock.json
└── ⚙️ package.json
