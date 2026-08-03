---
type: padrao-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Padrao - Upload Seguro

## Objetivo
Garantir que upload de evidências seja tratado como superfície crítica de ataque.

## Regras
- validar MIME type
- validar tamanho máximo
- reescrever nome do arquivo
- impedir path traversal
- restringir tipos permitidos
- armazenar com caminho controlado
- exigir contexto da evidência via campo `proof`

## Cuidados
- não confiar apenas na extensão
- não servir arquivos arbitrariamente sem controle
- considerar magic number quando aplicável
- manter arquivos fora de caminhos públicos inseguros

---

## Implementação no Vulnera (Multer + Express)

### Configuração do Multer

```ts
// multer.config.ts
import { MulterOptions } from 'express/multer/interfaces/multer-options.interface'
import { throw new Error("INVALID_<FIELD>") } from 'express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { v4 as uuidv4 } from 'uuid'

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export const evidenceUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'evidences'),
    filename: (req, file, cb) => {
      // reescreve o nome — nunca usa originalname diretamente
      const ext = extname(file.originalname).toLowerCase()
      const safeName = `${uuidv4()}${ext}`
      cb(null, safeName)
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // apenas um arquivo por request
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new throw new Error("INVALID_<FIELD>")(`Tipo não permitido: ${file.mimetype}`), false)
    }
    cb(null, true)
  },
}
```

### Uso no controller

```ts
@Post(':vulnerabilityId/evidences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PENTESTER)
@UseInterceptors(FileInterceptor('file', evidenceUploadOptions))
async uploadEvidence(
  @Param('vulnerabilityId', ParseUUIDPipe) vulnerabilityId: string,
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: CreateEvidenceDto,
  @CurrentUser() user: JwtPayload,
) {
  // file.filename = UUID gerado pelo Multer (já seguro)
  // file.mimetype = validado pelo fileFilter
  // file.size = validado pelo limits
  return this.evidenceService.create(vulnerabilityId, file, dto, user.sub)
}
```

### Validação de magic number (recomendada)

A validação de `mimetype` pelo Multer lê o header da requisição — pode ser manipulada. Para maior segurança, validar o magic number do conteúdo real do arquivo:

```ts
import { readFileSync } from 'fs'

const MAGIC_NUMBERS: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
}

function validateMagicNumber(filePath: string, expectedMime: string): boolean {
  const magic = MAGIC_NUMBERS[expectedMime]
  if (!magic) return true // tipo sem magic number definido — aceitar
  const buffer = readFileSync(filePath).slice(0, magic.length)
  return buffer.equals(magic)
}
```

### Servir arquivos com controle de acesso

Evidências não são públicas — devem ser servidas com verificação de ownership:

```ts
@Get(':evidenceId/download')
@UseGuards(JwtAuthGuard)
async download(
  @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  @CurrentUser() user: JwtPayload,
  @Res() res: Response,
) {
  const evidence = await this.evidenceService.findWithOwnershipCheck(evidenceId, user)
  // verifica que o user tem acesso ao projeto da evidência
  res.download(join(UPLOAD_BASE_DIR, evidence.fileName))
}
```

**Nunca expor a pasta de uploads como diretório estático público sem autenticação.**

### Tipos permitidos e limites

| Tipo | MIME | Observação |
|---|---|---|
| JPEG | `image/jpeg` | Screenshots de vulnerabilidades |
| PNG | `image/png` | Screenshots |
| GIF | `image/gif` | Demonstrações animadas |
| WebP | `image/webp` | Screenshots modernos |
| PDF | `application/pdf` | Relatórios externos, docs |
| Texto | `text/plain` | Logs, outputs de ferramentas |
| **Bloqueado** | Qualquer outro | Executáveis, scripts, Office |

Tamanho máximo por arquivo: **10 MB**.

### Riscos adicionais

- extensões duplas (`arquivo.php.jpg`): validar a extensão final real e o magic number
- arquivo vazio: `file.size === 0` deve ser rejeitado
- nome muito longo: `originalname` não é usado diretamente, então risco é baixo

---

## Relacionado
[[Evidencias]]
[[Evidence]]
[[Seguranca da Aplicacao]]
[[Back-end Express]]
[[Padrao - Prevencao de Injection]]
[[Padrao - Validacao de Entradas]]
[[Politica de Desenvolvimento Seguro]]