/**
 * correcao-sugerida.ts
 *
 * O QUE FAZ
 * A correção sugerida de uma dependência vulnerável (ADR-063), SEM IA
 * (ADR-017 continua valendo): com o ecossistema, o pacote, a versão em uso e
 * a(s) versão(ões) que corrigem — o que o Trivy/Grype/OSV já informam —
 * monta o comando de atualização e o trecho do manifesto, no formato de cada
 * gerenciador. Também o link do advisory.
 *
 * QUAL VERSÃO SUGERIR
 * Ferramentas costumam listar várias versões corrigidas ("2.15.0, 2.12.2",
 * uma por linha de release). Sugerimos a MENOR versão corrigida que esteja na
 * mesma major da versão em uso (menos risco de quebra); sem nenhuma na mesma
 * major, a menor de todas acima da atual.
 *
 * QUEM USA
 * `components/findings/correcao-sugerida.tsx`. Testado em `correcao-sugerida.test.ts`.
 */

export type Ecossistema = "npm" | "pypi" | "maven" | "golang" | "nuget" | "gem" | "cargo" | "composer";

export interface CorrecaoDePacote {
  ecossistema: Ecossistema;
  pacote: string;
  versaoAtual: string | null;
  versaoSugerida: string;
  /** Comando para rodar na raiz do projeto. */
  comando: string;
  /** Onde a dependência é declarada e como fica. */
  manifesto: { arquivo: string; trecho: string };
}

/** Normaliza o nome do ecossistema que vem do purl, do OSV ou do inventário. */
export function normalizarEcossistema(bruto: string | null | undefined): Ecossistema | null {
  const e = (bruto ?? "").toLowerCase();
  if (e === "npm") return "npm";
  if (e === "pypi" || e === "pip") return "pypi";
  if (e === "maven") return "maven";
  if (e === "golang" || e === "go") return "golang";
  if (e === "nuget") return "nuget";
  if (e === "gem" || e === "rubygems") return "gem";
  if (e === "cargo" || e === "crates.io") return "cargo";
  if (e === "composer" || e === "packagist") return "composer";
  return null;
}

/** Ecossistema e nome a partir do Package URL (`pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1`). */
export function lerPurl(purl: string | null | undefined): { ecossistema: Ecossistema | null; nome: string | null } {
  const m = purl ? /^pkg:([^/]+)\/([^@?#]+)/i.exec(purl) : null;
  if (!m) return { ecossistema: null, nome: null };
  const nome = decodeURIComponent(m[2]);
  return { ecossistema: normalizarEcossistema(m[1]), nome };
}

/** Partes numéricas de uma versão ("v2.15.0-rc1" → [2, 15, 0]). */
function partes(versao: string): number[] {
  return versao.replace(/^v/i, "").split(/[.+-]/).map((p) => Number.parseInt(p, 10)).filter((n) => !Number.isNaN(n));
}

export function compararVersoes(a: string, b: string): number {
  const pa = partes(a);
  const pb = partes(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Escolhe a versão a sugerir a partir do texto livre de versões corrigidas. */
export function escolherVersaoCorrigida(versaoAtual: string | null, corrigidas: string | null): string | null {
  const candidatas = (corrigidas ?? "")
    .split(/[,;\s]+/)
    .map((v) => v.replace(/^[>=~^v]+/, "").trim())
    .filter((v) => /^\d/.test(v));
  if (candidatas.length === 0) return null;
  const acima = versaoAtual ? candidatas.filter((v) => compararVersoes(v, versaoAtual) > 0) : candidatas;
  const pool = acima.length ? acima : candidatas;
  const major = versaoAtual ? partes(versaoAtual)[0] : undefined;
  const mesmaMajor = major === undefined ? [] : pool.filter((v) => partes(v)[0] === major);
  return [...(mesmaMajor.length ? mesmaMajor : pool)].sort(compararVersoes)[0];
}

/** Comando e manifesto por ecossistema. */
export function montarCorrecao(dados: {
  ecossistema: Ecossistema;
  pacote: string;
  versaoAtual: string | null;
  versoesCorrigidas: string | null;
}): CorrecaoDePacote | null {
  const versao = escolherVersaoCorrigida(dados.versaoAtual, dados.versoesCorrigidas);
  if (!versao) return null;
  const { pacote, ecossistema } = dados;
  const base = { ecossistema, pacote, versaoAtual: dados.versaoAtual, versaoSugerida: versao };

  switch (ecossistema) {
    case "npm":
      return { ...base, comando: `npm install ${pacote}@^${versao}`, manifesto: { arquivo: "package.json", trecho: `"${pacote}": "^${versao}"` } };
    case "pypi":
      return { ...base, comando: `pip install "${pacote}>=${versao}"`, manifesto: { arquivo: "requirements.txt", trecho: `${pacote}>=${versao}` } };
    case "maven": {
      // purl do Maven: grupo/artefato.
      const [grupo, artefato] = pacote.includes("/") ? pacote.split("/") : pacote.split(":");
      const g = artefato ? grupo : pacote;
      const a = artefato ?? pacote;
      return {
        ...base,
        comando: `mvn versions:use-dep-version -Dincludes=${g}:${a} -DdepVersion=${versao}`,
        manifesto: { arquivo: "pom.xml", trecho: `<dependency>\n  <groupId>${g}</groupId>\n  <artifactId>${a}</artifactId>\n  <version>${versao}</version>\n</dependency>` },
      };
    }
    case "golang":
      return { ...base, comando: `go get ${pacote}@v${versao.replace(/^v/, "")} && go mod tidy`, manifesto: { arquivo: "go.mod", trecho: `require ${pacote} v${versao.replace(/^v/, "")}` } };
    case "nuget":
      return { ...base, comando: `dotnet add package ${pacote} --version ${versao}`, manifesto: { arquivo: "*.csproj", trecho: `<PackageReference Include="${pacote}" Version="${versao}" />` } };
    case "gem":
      return { ...base, comando: `bundle update ${pacote} --conservative`, manifesto: { arquivo: "Gemfile", trecho: `gem "${pacote}", ">= ${versao}"` } };
    case "cargo":
      return { ...base, comando: `cargo update -p ${pacote} --precise ${versao}`, manifesto: { arquivo: "Cargo.toml", trecho: `${pacote} = "${versao}"` } };
    case "composer":
      return { ...base, comando: `composer require ${pacote}:^${versao}`, manifesto: { arquivo: "composer.json", trecho: `"${pacote}": "^${versao}"` } };
  }
}

/** Link público do advisory; só para os formatos conhecidos (nada de URL vinda do relatório aqui). */
export function linkDoAdvisory(id: string | null | undefined): string | null {
  if (!id) return null;
  const limpo = id.trim().toUpperCase();
  if (/^CVE-\d{4}-\d{4,}$/.test(limpo)) return `https://nvd.nist.gov/vuln/detail/${limpo}`;
  if (/^GHSA(-[0-9A-Z]{4}){3}$/.test(limpo)) return `https://github.com/advisories/${id.trim()}`;
  return null;
}

/** Referência vinda do relatório (helpUri): só http(s) vira link — o relatório pode trazer "javascript:". */
export const linkSeguro = (url: string | null | undefined): string | null => (url && /^https?:\/\//i.test(url) ? url : null);
