---
type: padrao-seguranca
tags: [devsecops, architecture]
status: ativo
---

> [!info] Nota refatorada em 2026-07-26
> Stack e convenções atualizadas conforme [[Contexto Mestre v4]]. Referências a NestJS, PostgreSQL, Next.js e `@react-pdf/renderer` foram substituídas por Express, MySQL, React + Vite e `pdf-lib`.

# Padrao - Prevencao de XSS

## Objetivo
Evitar execução de scripts ou conteúdo malicioso em interfaces web e conteúdos renderizados.

## Áreas de risco no Vulnera
- comentários em findings
- chat do projeto
- descrições
- campos de notas
- qualquer renderização markdown ou HTML
- relatórios client-side

## Regras
- não renderizar HTML arbitrário sem sanitização
- escapar conteúdo textual por padrão
- sanitizar conteúdo quando houver renderização rica
- evitar `dangerouslySetInnerHTML` sem necessidade extrema e proteção adequada
- validar e limitar conteúdo vindo do usuário
- não confiar em rich text sem limpeza

## Cuidados adicionais
- refletir mensagens de erro com moderação
- revisar qualquer biblioteca de markdown ou rich text
- considerar CSP quando aplicável em produção

---

## Implementação no Vulnera

### React escapa por padrão (proteção base)

Em todo texto renderizado com JSX, o React escapa HTML automaticamente. Isso cobre a maioria dos casos:

```tsx
// SEGURO — React escapa automaticamente
<p>{vulnerability.description}</p>
<span>{message.content}</span>
<div>{comment.text}</div>
```

### Renderização de markdown — sanitização obrigatória

Campos de texto livre que suportam markdown (descrições, notas, comentários enriquecidos) **devem** ser sanitizados antes de renderizar como HTML:

```tsx
// OPÇÃO 1: react-markdown + rehype-sanitize
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  {vulnerability.description}
</ReactMarkdown>

// OPÇÃO 2: DOMPurify para HTML gerado dinamicamente
import DOMPurify from 'dompurify'

const safe = DOMPurify.sanitize(htmlContent)
<div dangerouslySetInnerHTML={{ __html: safe }} />
```

`dangerouslySetInnerHTML` sem DOMPurify é proibido no projeto.

### Chat e comentários

O conteúdo de `ChatMessage.content` e `VulnerabilityComment.content` é texto livre. Exibir como texto puro (sem renderização HTML) é a opção mais segura:

```tsx
// SEGURO — exibe como texto puro, sem parsing HTML
<p className="whitespace-pre-wrap">{message.content}</p>
```

Se o chat evoluir para suportar markdown, aplicar `rehype-sanitize` obrigatoriamente.

### Relatórios PDF (client-side)

O PDF é gerado com `pdf-lib` — componentes React que não executam HTML arbitrário. Os dados do servidor são injetados como strings em componentes React PDF:

```tsx
// SEGURO — pdf-lib não executa HTML
<Text>{vulnerability.title}</Text>
<Text>{vulnerability.description}</Text>
```

Cuidado: não construir HTML como string para inserir no PDF.

### Content Security Policy (Helmet)

O Helmet configura CSP restritiva que bloqueia scripts inline não autorizados:

```ts
// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // necessário para Tailwind
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}))
```

### Cabeçalhos anti-XSS adicionais

O Helmet também configura:
- `X-XSS-Protection: 1; mode=block` (browsers legados)
- `X-Content-Type-Options: nosniff` — previne MIME sniffing
- `X-Frame-Options: DENY` — previne clickjacking

### Mensagens de erro no front-end

Nunca renderizar diretamente a mensagem de erro do servidor:

```tsx
// PERIGOSO — mensagem de erro pode conter HTML malicioso do servidor
<div dangerouslySetInnerHTML={{ __html: error.message }} /> // ❌

// SEGURO — renderizar como texto
<p>{error.message}</p> // ✅ (React escapa)
```

---

## Relacionado
[[Front-end Web React]]
[[Chat e Comentarios]]
[[VulnerabilityComment]]
[[ChatMessage]]
[[Relatorios]]
[[Seguranca da Aplicacao]]
[[Padrao - Validacao de Entradas]]
[[Politica de Desenvolvimento Seguro]]