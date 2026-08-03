---
type: referencia-codigo
tags: [backend, code-style, upload, security]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Referencia - Middleware Upload

## Objetivo

Registrar o estilo esperado para implementação de upload de arquivos, usando exemplos legados como referência de organização, mas adaptando para a stack oficial do Vulnera.

## Papel desta nota

Esta nota orienta o Claude sobre como tratar uploads no projeto.

No Vulnera, uploads são usados principalmente para **evidências de vulnerabilidades**, como imagens, logs ou arquivos de texto associados a uma `Vulnerability`.

## Contexto dos exemplos legados

Os exemplos antigos do autor podem usar:

- Express
- Multer
- middleware manual
- pasta `uploads/images`
- validação básica de extensão ou MIME

Esses exemplos devem ser usados como referência de simplicidade e separação, não como implementação literal obrigatória.

## Adaptação para o Vulnera

No Vulnera, adaptar para:

- Express
- Multer integrado ao Express
- interceptors quando necessário
- configuração centralizada
- validação no service e/ou pipe
- armazenamento em `uploads/evidences`
- associação obrigatória com `Vulnerability`
- campo `proof` obrigatório

## Regras obrigatórias

- validar tipo do arquivo
- validar tamanho máximo
- não confiar apenas na extensão
- reescrever o nome do arquivo
- impedir path traversal
- não salvar arquivo sem vínculo com uma entidade válida
- não expor caminho interno diretamente ao cliente
- registrar metadados do arquivo em `Evidence`
- exigir contexto da evidência por meio do campo `proof`

## Estrutura esperada no Vulnera

```text
apps/api/
├── src/
│   ├── config/
│   │   └── storage.config.ts
│   ├── modules/
│   │   └── evidences/
│   │       ├── evidences.module.ts
│   │       ├── evidences.controller.ts
│   │       ├── evidences.service.ts
│   │       ├── evidences.repository.ts
│   │       └── dto/
│   │           └── upload-evidence.dto.ts
│   └── common/
│       └── filters/
└── uploads/
    └── evidences/
```

## Exemplo legado do autor

Cole aqui um exemplo antigo de middleware/upload usado em projetos anteriores.

```ts
import createMulter from "../config/produto.multer";

const uploadImage = createMulter ({
    folder: 'Images',
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
    fileSize: 10 * 1024 * 1024
}).single('vinculoImagem');

export default uploadImage
```

## Exemplo do config/produto.multer
```ts
import multer from "multer";
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { Request } from "express";

const baseUploadDir = path.resolve(process.cwd(), 'uploads');

const verificaDir = (dir: string): void => {
    // Verifica se o diretório não existe
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

interface MulterOptions {
    folder: string;
    allowedTypes: string[];
    fileSize: number
}

const createMulter = ({ folder, allowedTypes, fileSize }: MulterOptions) => {
    // Monta caminho do diretório base (uploads) + pasta
    const uploadDir = path.join(baseUploadDir, folder);
    // Verifica se o diretório não existe para criar
    verificaDir(uploadDir);

    const storage: multer.StorageEngine = multer.diskStorage({
        destination: (req, file, cb): void => {
            cb(null, uploadDir);
        },
        filename: (req, file, cb): void => {
            const hash = crypto.randomBytes(12).toString('hex');
            cb(null, `${hash}-${file.originalname}`);
        }
    });

    const fileFilter: multer.Options['fileFilter'] = (req: Request, file, cb) => {
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Tipo de arquivo não permitido'));
        }
        cb(null, true);
    }

    return multer({
        storage,
        limits: { fileSize },
        fileFilter
    })

}

export default createMulter;
```

## O que o Claude deve aprender com o exemplo

- como separar configuração de upload
- como manter o código simples
- como evitar lógica pesada no controller
- como tratar arquivo como responsabilidade específica
- como manter nomes e pastas previsíveis

## O que não deve ser copiado literalmente

- estrutura Express
- middleware aplicado em rota Express
- pasta `uploads/images` se não fizer sentido
- validação apenas por extensão
- nomes de domínio de outro projeto
- ausência de vínculo com `Vulnerability`

## Exemplo adaptado para Express

```ts
@Controller('vulnerabilities/:vulnerabilityId/evidences')
export class EvidencesController {
  constructor(private readonly evidencesService: EvidencesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('vulnerabilityId') vulnerabilityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadEvidenceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.evidencesService.upload(vulnerabilityId, file, dto, user);
  }
}
```

## Responsabilidades por camada

### Controller

- recebe o arquivo
- recebe DTO
- delega para o service

### Service

- valida ownership
- valida se a vulnerability existe
- valida `proof`
- valida regras de negócio
- registra metadados da evidência

### Config

- define pasta
- define tamanho máximo
- define filtro de arquivo
- define estratégia de nome seguro

## Relação com o domínio

- [[Evidence]]
- [[Vulnerability]]
- [[Evidencias]]
- [[Padrao - Upload Seguro]]

## Relação com segurança

Consultar sempre:

- [[Padrao - Upload Seguro]]
- [[Padrao - Validacao de Entradas]]
- [[Padrao - Logs e Dados Sensiveis]]
- [[Seguranca da Aplicacao]]

## Regra final para o Claude

Usar exemplos antigos de upload apenas como referência de organização.

No Vulnera, implementar upload com segurança, usando Express, validação explícita e vínculo obrigatório com `Vulnerability`.