<!-- Evidências do SBOM do próprio Vulnera: os três CycloneDX gerados em 2026-11-27, com hash, procedência e como conferir; consumido pela banca e pela revisão do PR. -->

# Evidências — SBOM do Vulnera (2026-11-27)

Arquivos gerados pelo **Trivy 0.76.2** (imagem oficial
`aquasec/trivy@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb`)
com a base de vulnerabilidades de 2026-11-27 07:06 UTC. Nenhum foi editado à
mão. Método, resultados e limites estão em [`docs/SBOM.md`](../../SBOM.md).

| Arquivo | Alvo | Componentes | Vulnerabilidades (entradas no arquivo) | Tamanho | SHA-256 |
|---|---|---|---|---|---|
| `vulnera-api.cdx.json` | imagem `vulnera-tcc-api` (`sha256:8835b75d9b8f…`), sem `app/prisma/seeds` | 947 | 37 | 1,36 MB | `7b7b14195b3c892656c8139c73ecc03cbc479795f25adc826c428b637cc622a0` |
| `vulnera-web.cdx.json` | imagem `vulnera-tcc-web` (`sha256:82b0b83752d7…`) | 626 | 102 | 1,38 MB | `d5a878a9db6643e3ae8cfdb0a187f895668e6c70d17223298febd4aa48fc84dc` |
| `vulnera-mobile.cdx.json` | `app/mobile/package-lock.json` | 598 | 35 | 0,56 MB | `6a1aa3c0f73069cf43bde96e305ac599b764349f44716b16445d0cada08f724c` |

Uma entrada de `vulnerabilities` pode afetar mais de um componente. Na
importação do Vulnera cada par (CVE, componente) vira um achado: 52, 108 e 35.
Esses são os números usados em `docs/SBOM.md`.

## Procedência

- Imagens construídas em 2026-11-27 com `docker compose up -d --build`, a
  partir de código idêntico ao da `dev` em `54c6f36`.
- Formato: CycloneDX **1.7**, JSON.
- A primeira geração da API incluiu por engano os componentes da fixture
  `app/api/prisma/seeds/cenarios/fixtures/vulnera-trivy.cdx.json`, que vai
  dentro da imagem. O arquivo versionado aqui é o da segunda geração, com
  `--skip-dirs app/prisma/seeds` (ver `docs/SBOM.md`, "As fixtures do seed ficam
  de fora").

## Como conferir

```bash
sha256sum docs/evidencias/sbom/*.cdx.json
```

Para regenerar, siga os comandos de `docs/SBOM.md` → "Como regenerar". A lista
de componentes só muda com o código. A de vulnerabilidades muda com a base do
Trivy, então um arquivo novo raramente terá o mesmo hash.
