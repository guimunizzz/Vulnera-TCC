---
type: referencia-codigo
tags: [backend, code-style, migration, source-of-truth]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Referencia - Adaptacao Express MySQL para Express Prisma

## Objetivo

Explicar como o Claude deve interpretar códigos de referência criados originalmente com TypeScript, Express e MySQL/MySQL2 ao implementar o Vulnera com Express, Prisma e MySQL.

## Regra principal

Os códigos legados do autor são referência de estilo e organização, não definição obrigatória de tecnologia.

Eles mostram como o autor costuma estruturar backend de forma simples, didática e separada por responsabilidades.

## Stack dos exemplos legados

Os exemplos podem conter:

- TypeScript
- Express
- MySQL ou MySQL2
- rotas manuais
- middlewares Express
- conexão manual com banco
- repositories com SQL manual
- models como classes simples
- controllers e services em pastas separadas

## Stack oficial do Vulnera

O Vulnera deve usar:

- TypeScript
- Express
- Prisma
- MySQL
- módulos Express
- DTOs
- middlewares
- Pipes
- Interceptors
- PrismaService
- arquitetura modular

## Mapeamento obrigatório

| Conceito nos exemplos legados | Equivalente no Vulnera |
|---|---|
| `server.ts` com Express | `main.ts` com bootstrap Express |
| `routes/routes.ts` | imports de módulos em `app.module.ts` |
| `*.routes.ts` | decorators nos controllers Express |
| `*.controller.ts` Express | `*.controller.ts` Express |
| `*.service.ts` | `*.service.ts` Express |
| `*.repository.ts` com SQL | `*.repository.ts` usando Prisma |
| `db.connection.ts` MySQL2 | `prisma.service.ts` |
| middleware de auth Express | `jwt-auth.middlewares.ts` |
| middleware de upload Express | interceptor/configuração Multer no Express |
| validação manual de body | DTO + ValidationPipe |
| model class simples | DTOs, tipos e schema Prisma |
| queries SQL manuais | Prisma Client |

## Como adaptar controllers

### Exemplo legado conceitual

```ts
router.post('/produtos', produtoController.create);
```

### Adaptação no Vulnera

```ts
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  create(@Body() dto: CreateApplicationDto, @CurrentUser() user: AuthUser) {
    return this.applicationsService.create(dto, user);
  }
}
```

## Como adaptar services

O service continua sendo a camada principal de regra de negócio.

### Manter dos exemplos

- método claro
- regra explícita
- chamada ao repository
- erros tratados de forma simples

### Adaptar no Vulnera

- usar exceptions do Express
- receber usuário autenticado quando precisar de ownership
- chamar repositories com Prisma
- registrar auditoria quando necessário
- validar regras documentadas no vault

### Exemplo conceitual

```ts
@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly subscriptionsRepository: SubscriptionsRepository,
  ) {}

  async create(dto: CreateApplicationDto, user: AuthUser) {
    const activeSubscription =
      await this.subscriptionsRepository.findActiveByCompanyId(user.companyId);

    if (!activeSubscription) {
      throw new throw new Error("FORBIDDEN")('Empresa sem assinatura ativa.');
    }

    const totalApps =
      await this.applicationsRepository.countActiveByCompanyId(user.companyId);

    if (totalApps >= activeSubscription.plan.appLimit) {
      throw new throw new Error("<ENTITY>_LIMIT_REACHED")('Limite de aplicações atingido.');
    }

    return this.applicationsRepository.create({
      ...dto,
      companyId: user.companyId,
    });
  }
}
```

## Como adaptar repositories

### Exemplo legado conceitual

```ts
await connection.execute(
  'SELECT * FROM produtos WHERE id = ?',
  [id]
);
```

### Adaptação no Vulnera

```ts
return this.prisma.application.findUnique({
  where: { id },
});
```

## Regras para uso de Prisma

- não concatenar input em query
- preferir métodos do Prisma Client
- usar `where`, `select`, `include` com clareza
- evitar query complexa espalhada no service
- manter regra de negócio fora do repository

## Como adaptar config e env

### Legado

- `EnvKey.ts`
- `EnvVar.ts`
- leitura direta de ambiente

### Vulnera

Pode manter a ideia de centralização, mas adaptada para Express:

- `config/app.config.ts`
- `config/database.config.ts`
- `config/jwt.config.ts`
- `config/mail.config.ts`
- `config/storage.config.ts`

Regra:

Não acessar `process.env` espalhado pelo código.

## Como adaptar middleware

Express usa middleware com frequência.

No Express, avaliar:

| Caso | Recurso recomendado no Express |
|---|---|
| autenticação | middlewares |
| autorização | middlewares |
| validação | Pipe |
| logging | Interceptor ou Middleware |
| transformação de resposta | Interceptor |
| tratamento de erro | Filter |
| upload | Multer + Interceptor |

## O que o Claude deve preservar

- simplicidade
- clareza
- organização controller/service/repository
- nomes diretos
- baixo acoplamento
- código fácil de explicar no TCC
- separação entre regra de negócio e persistência

## O que o Claude deve evitar

- copiar Express literalmente
- criar `routes.ts` no Express
- usar MySQL2 no Vulnera
- criar SQL manual sem necessidade
- ignorar Prisma
- ignorar DTOs e ValidationPipe
- transformar exemplos simples em abstrações complexas
- usar bibliotecas suspeitas ou desnecessárias

## Regra de decisão

Se o exemplo legado mostrar uma prática de organização, seguir.

Se o exemplo legado depender de tecnologia diferente da stack oficial, adaptar.

Se houver conflito entre exemplo legado e documentação do Vulnera, prevalece:

1. política de segurança
2. decisões ADR
3. arquitetura oficial do Vulnera
4. estilo dos exemplos legados

## Frase-chave

> Estes exemplos mostram como o autor pensa e organiza código.  
> Eles não definem a stack final do Vulnera.  
> Ao implementar, adaptar para Express, Prisma e MySQL.

## Relacionado

- [[Guia de Estilo de Codigo]]
- [[Referencia - Estrutura Backend Simples]]
- [[Referencia - Controller]]
- [[Referencia - Service]]
- [[Referencia - Repository]]
- [[Back-end Express]]
- [[ORM Prisma]]
- [[Banco de Dados MySQL]]
- [[Politica de Desenvolvimento Seguro]]
---
type: referencia-codigo
tags: [architecture, code-style, backend, adaptacao]
status: ativo
---

# Referencia - Adaptacao Express MySQL para Express Prisma

## Objetivo

Orientar o Claude a adaptar exemplos de código do autor — escritos originalmente em TypeScript, Express e MySQL/MySQL2 — para a stack oficial do Vulnera: Express, Prisma e MySQL.

O objetivo é preservar o estilo, a simplicidade e a organização do autor, sem copiar a tecnologia.

## Origem dos exemplos legados

Os exemplos de referência do autor foram criados com:

- **TypeScript**
- **Express**
- **MySQL / MySQL2**
- estrutura `controller → service → repository`
- rotas manuais com arquivos `.routes.ts`
- middlewares Express como funções simples
- conexão manual com banco via pool MySQL2
- models como classes TypeScript simples
- configuração de variáveis de ambiente com enum manual

Esses exemplos representam a forma como o autor pensa, organiza e nomeia o código.

**Eles não definem a stack do Vulnera.**

## Stack oficial do Vulnera

- Express (não Express)
- Prisma (não MySQL2 manual)
- MySQL (não MySQL)
- arquitetura modular por domínio
- DTOs com validação
- middlewares, Pipes, Interceptors, Filters

## Regra fundamental

> Seguir a forma de pensar e organizar do autor. Não copiar a tecnologia utilizada nos exemplos.

---

## Mapeamento geral

| Camada legada (Express / MySQL) | Equivalente no Vulnera (Express / Prisma) |
|---|---|
| `server.ts` Express | `main.ts` + `AppModule` |
| `routes/*.routes.ts` | `@Controller()` + `@Module()` |
| Express `Router` | Express Controller + Module |
| `middleware/*.ts` | middlewares, Pipe, Interceptor ou Filter |
| `controllers/*.ts` | `*.controller.ts` com decorators Express |
| `services/*.ts` | `*.service.ts` com `@Injectable()` |
| `repository/*.ts` | `*.repository.ts` com PrismaService |
| `models/*.ts` | DTOs + schema Prisma |
| `config/EnvVar.ts` | `ConfigModule` + `ConfigService` |
| `config/EnvKey.ts` | enum de chaves de variáveis |
| `config/produto.multer.ts` | Multer registrado no módulo Express |
| `database/connection.ts` | `PrismaService` |
| MySQL2 `connection.execute(sql, values)` | Prisma Client methods |
| `SELECT * FROM tabela WHERE id = ?` | `prisma.model.findUnique({ where: { id } })` |
| `INSERT INTO tabela...` | `prisma.model.create({ data })` |
| `UPDATE tabela SET...` | `prisma.model.update({ where, data })` |
| `DELETE FROM tabela WHERE id = ?` | `prisma.model.delete()` ou soft delete |
| `BEGIN / COMMIT / ROLLBACK` | `prisma.$transaction()` |
| `req.body` | `@Body()` |
| `req.params.id` | `@Param('id')` |
| `req.query` | `@Query()` |
| `req.user` | `@CurrentUser()` |
| middleware de autenticação | `JwtAuthGuard` |
| middleware de role | `RolesGuard` |
| `res.status(200).json(...)` | retorno direto (Express serializa) |
| `res.status(400).json(...)` | `throw new throw new Error("INVALID_<FIELD>")(...)` |
| `res.status(401).json(...)` | `throw new throw new Error("UNAUTHORIZED")(...)` |
| `res.status(403).json(...)` | `throw new throw new Error("FORBIDDEN")(...)` |
| `res.status(404).json(...)` | `throw new throw new Error("<ENTITY>_NOT_FOUND")(...)` |
| `res.status(500).json(...)` | `throw new InternalServerErrorException(...)` |

---

## Adaptação por camada

### server.ts → main.ts + AppModule

**Legado (Express):**
```ts
import express from 'express';
import cors from 'cors';
import { router } from './routes';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', router);
app.listen(3000);
```

**No Vulnera (Express):**
```ts
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.enableCors();
  await app.listen(3000);
}
bootstrap();
```

O que preservar: inicialização única, configuração centralizada, prefixo global.

---

### routes/*.routes.ts → Controller + Module

**Legado (Express):**
```ts
// user.routes.ts
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';

const router = Router();
const controller = new UserController();

router.get('/', controller.listarTodos);
router.post('/', controller.criar);
router.get('/:id', controller.buscarPorId);
router.patch('/:id', controller.atualizar);
router.delete('/:id', controller.deletar);

export { router };
```

**No Vulnera (Express):**
```ts
// users.controller.ts
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.usersService.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthUser) {
    return this.usersService.update(id, dto, user);
  }
}
```

O que preservar: um arquivo por recurso, métodos claros, delegação total para o service.

---

### middleware → middlewares / Pipe / Interceptor / Filter

**Legado (Express):**
```ts
// auth.middleware.ts
export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ mensagem: 'Não autenticado.' });
  // verificar token...
  next();
};
```

**No Vulnera (Express):**
```ts
// middlewares/jwt-auth.middlewares.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

// uso no controller
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get()
findAll() { ... }
```

Tabela de correspondência:

| Tipo de middleware legado | Equivalente Express |
|---|---|
| autenticação JWT | `JwtAuthGuard extends AuthGuard('jwt')` |
| autorização de role | `RolesGuard` |
| validação de corpo | `ValidationPipe` (global em `main.ts`) |
| tratamento global de erros | `ExceptionFilter` |
| log de requisição | `LoggingInterceptor` |
| upload de arquivo | Multer configurado no `@Module` |

---

### config/EnvVar.ts → ConfigModule + ConfigService

**Legado:**
```ts
// config/EnvVar.ts
import { EnvKey } from './enum/EnvKey';

export const EnvVar = {
  DB_HOST: process.env[EnvKey.DB_HOST] ?? '',
  DB_PORT: Number(process.env[EnvKey.DB_PORT]) ?? 3306,
  JWT_SECRET: process.env[EnvKey.JWT_SECRET] ?? '',
};
```

**No Vulnera:**
```ts
// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
  ],
})
export class AppModule {}

// uso em qualquer service
@Injectable()
export class AuthService {
  constructor(private readonly config: ConfigService) {}

  private readonly secret = this.config.getOrThrow<string>('JWT_SECRET');
}
```

O que preservar: variáveis centralizadas, acesso via chave tipada, nunca hardcoded.

---

### database/connection.ts → PrismaService

**Legado (MySQL2):**
```ts
// database/connection.database.ts
import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: EnvVar.DB_HOST,
  user: EnvVar.DB_USER,
  password: EnvVar.DB_PASSWORD,
  database: EnvVar.DB_NAME,
});
```

**No Vulnera (Prisma):**
```ts
// prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

O que preservar: conexão centralizada, injetável, não espalhada pelos arquivos.

---

### repository com MySQL2 → repository com Prisma

**Legado (MySQL2):**
```ts
async selectById(id: number): Promise<ResultSetHeader> {
  const sql = 'SELECT * FROM Estoque WHERE id_estoque = ?';
  const [rows] = await db.execute<ResultSetHeader>(sql, [id]);
  return rows;
}

async adicionarEstoque(dados: Estoque): Promise<ResultSetHeader> {
  const sql = 'INSERT INTO Estoque (id_produto, quantidade_atual) VALUES (?, ?)';
  const [rows] = await db.execute<ResultSetHeader>(sql, [dados.IdProduto, dados.QuantidadeAtual]);
  return rows;
}
```

**No Vulnera (Prisma):**
```ts
findById(id: string) {
  return this.prisma.application.findUnique({
    where: { id },
  });
}

create(data: Prisma.ApplicationUncheckedCreateInput) {
  return this.prisma.application.create({ data });
}
```

O que preservar: um método por operação, nomes claros, sem regra de negócio.

---

### models → DTOs + schema Prisma

**Legado (model class):**
```ts
// models/estoque.model.ts
export class Estoque {
  IdProduto: number;
  QuantidadeAtual: number;

  static adicionar(idProduto: number, quantidadeAtual: number) {
    const e = new Estoque();
    e.IdProduto = idProduto;
    e.QuantidadeAtual = quantidadeAtual;
    return e;
  }
}
```

**No Vulnera:**

```ts
// dto/create-application.dto.ts
export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
```

```prisma
// schema.prisma
model Application {
  id          String   @id @default(cuid())
  name        String
  description String?
  companyId   String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  company     Company  @relation(fields: [companyId], references: [id])
}
```

O que preservar: tipos explícitos, nomes descritivos, estrutura clara.

---

### multer config → MulterModule no módulo Express

**Legado:**
```ts
// config/produto.multer.ts
import multer from 'multer';
import path from 'path';

export const uploadProduto = multer({
  storage: multer.diskStorage({
    destination: 'uploads/images',
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
});
```

**No Vulnera:**
```ts
// evidence.module.ts
@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/evidences',
        filename: (req, file, cb) => {
          const safeName = `${Date.now()}-${randomUUID()}${extname(file.originalname)}`;
          cb(null, safeName);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
})
export class EvidenceModule {}
```

Diferença importante: no Vulnera, o nome do arquivo deve ser gerado com `randomUUID()` para evitar colisão e não expor nomes originais.

---

## O que preservar do estilo legado

- controller fino, delegando para service
- service com regra de negócio explícita e bem nomeada
- repository isolando persistência
- nomes de métodos claros e descritivos
- fluxo fácil de seguir linha a linha
- código didático e explicável
- organização por responsabilidade
- configuração de ambiente centralizada
- tratamento explícito de erros

## O que não copiar literalmente

- conexão MySQL2
- queries SQL manuais (salvo documentação ou exemplo didático)
- `server.ts` Express
- `Router` Express
- middlewares Express como funções simples
- `res.status().json()` em Express
- `req.body` / `req.params` sem decorators Express
- model classes com factory methods (usar DTOs)
- dependências do projeto antigo (`mysql2`, `express`)
- nomes de entidades de domínio de outro projeto
- regras de negócio que não existem no Vulnera

---

## Segurança na adaptação

Ao adaptar código legado, sempre verificar:

- DTOs com `ValidationPipe` global aplicado em `main.ts`
- middlewares protegendo rotas autenticadas
- sem SQL concatenado com input de usuário
- uploads com validação de MIME, tamanho e nome seguro
- secrets via `ConfigService`, nunca hardcoded
- exceptions seguras — sem vazar stack trace na resposta
- `select` no Prisma para evitar retorno de campos sensíveis (senha, token)
- ownership verificado no service, não no controller

---

## Relação com arquitetura

- [[Back-end Express]]
- [[API REST]]
- [[DTOs e Validacao]]
- [[Middlewares e Ownership]]
- [[ORM Prisma]]
- [[Banco de Dados MySQL]]

## Relação com referências de estilo

- [[Guia de Estilo de Codigo]]
- [[Referencia - Estrutura Backend Simples]]
- [[Referencia - Controller]]
- [[Referencia - Service]]
- [[Referencia - Repository]]

## Relação com segurança

- [[Politica de Desenvolvimento Seguro]]
- [[Padrao - Validacao de Entradas]]
- [[Padrao - Prevencao de Injection]]
- [[Padrao - Segredos e Variaveis Sensiveis]]
- [[Padrao - Upload Seguro]]
- [[Padrao - Logs e Dados Sensiveis]]
