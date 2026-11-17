/**
 * lib/code-import-receitas.ts
 *
 * Os comandos que o guia "?" da importação SAST/SCA (ADR-052) monta para cada
 * combinação de ferramenta, sistema e modo. Fora do componente para o
 * fast-refresh funcionar e para ser testável sem renderizar nada.
 */
/*
 * O que nenhum scan deve ler: dependências instaladas, saídas de build,
 * cobertura e arquivos de ambiente. Varrer node_modules enche o relatório de
 * achados de código de terceiros; ler .env coloca segredos locais dentro do
 * arquivo que será importado. Os lockfiles NÃO entram aqui: o SCA depende
 * deles para saber as versões instaladas.
 */
export const PASTAS_IGNORADAS = ["node_modules", "vendor", ".venv", "venv", "dist", "build", "coverage", ".next"] as const;
export const ARQUIVOS_IGNORADOS = [".env*", "*.min.js"] as const;

const EXCLUIR_SEMGREP = [...PASTAS_IGNORADAS, ...ARQUIVOS_IGNORADOS].map((p) => `--exclude "${p}"`).join(" ");
const EXCLUIR_TRIVY = [
  ...PASTAS_IGNORADAS.map((p) => `--skip-dirs "**/${p}"`),
  ...ARQUIVOS_IGNORADOS.map((p) => `--skip-files "**/${p}"`),
].join(" ");

export const CMD_SEMGREP = `semgrep scan --config p/default ${EXCLUIR_SEMGREP} --sarif --output semgrep.sarif`;
export const CMD_TRIVY_CYCLONEDX = `trivy fs --scanners vuln ${EXCLUIR_TRIVY} --format cyclonedx --output sbom.cdx.json .`;
export const CMD_SEMGREP_DOCKER = `docker run --rm -v "\${PWD}:/src" semgrep/semgrep semgrep scan --config p/default ${EXCLUIR_SEMGREP} --sarif --output /src/semgrep.sarif /src`;
const CMD_TRIVY_DOCKER = `docker run --rm -v "\${PWD}:/src" aquasec/trivy fs --scanners vuln ${EXCLUIR_TRIVY} --format cyclonedx --output /src/sbom.cdx.json /src`;

/** Sem isto o Semgrep no Windows grava o SARIF em cp1252 e quebra no primeiro "→": o arquivo fica vazio. */
const UTF8_WINDOWS = "$env:PYTHONUTF8=1";

export type Alvo = "codigo" | "dependencias";
export type Sistema = "windows" | "mac" | "linux";
export type Modo = "sem-instalar" | "instalando" | "docker";

export interface Receita {
  comando: string;
  arquivo: string;
  tempo: string;
  aviso?: string;
}

export const MODOS_POR_ALVO: Record<Alvo, Modo[]> = {
  codigo: ["instalando", "sem-instalar", "docker"],
  // O Trivy é um binário Go: não há pipx/npx. "Sem instalar" é o Docker.
  dependencias: ["docker", "instalando"],
};

export const ROTULO_MODO: Record<Modo, string> = { "sem-instalar": "Sem instalar (pipx)", instalando: "Instalando", docker: "Docker" };

/** Monta o bloco completo para colar no terminal. Função pura: é ela que os testes cobrem combinação a combinação. */
export function montarReceita(alvo: Alvo, sistema: Sistema, modo: Modo): Receita {
  const win = sistema === "windows";
  if (alvo === "codigo") {
    const arquivo = "semgrep.sarif";
    if (modo === "docker") {
      return {
        comando: CMD_SEMGREP_DOCKER,
        arquivo,
        tempo: win ? "até ~10 minutos" : "de 1 a 5 minutos",
        aviso: win ? "No Windows o Docker lê a pasta bem mais devagar (medido: ~9 min contra ~2 min instalando). Se puder, prefira “Instalando”." : undefined,
      };
    }
    const instalar = modo === "instalando" ? (sistema === "mac" ? "brew install semgrep" : sistema === "linux" ? "pipx install semgrep" : "pip install semgrep") : null;
    const scan = modo === "sem-instalar" ? `pipx run ${CMD_SEMGREP}` : CMD_SEMGREP;
    return {
      comando: [instalar, win ? UTF8_WINDOWS : null, scan].filter(Boolean).join("\n"),
      arquivo,
      tempo: "de 1 a 5 minutos",
      aviso: modo === "sem-instalar" ? "Precisa do pipx (pip install pipx). Com uv, uvx semgrep faz o mesmo." : undefined,
    };
  }
  const arquivo = "sbom.cdx.json";
  if (modo === "instalando") {
    const instalar =
      sistema === "windows"
        ? "scoop install trivy"
        : sistema === "mac"
          ? "brew install trivy"
          : "curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin";
    return {
      comando: `${instalar}\n${CMD_TRIVY_CYCLONEDX}`,
      arquivo,
      tempo: "menos de 1 minuto",
      aviso: win ? "Sem o Scoop? choco install trivy (PowerShell como administrador) também serve." : undefined,
    };
  }
  return { comando: CMD_TRIVY_DOCKER, arquivo, tempo: "~1 minuto na primeira vez (baixa a base de CVEs), segundos depois" };
}

export function detectarSistema(): Sistema {
  if (typeof navigator === "undefined") return "windows";
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const p = `${nav.userAgentData?.platform ?? ""} ${nav.platform ?? ""} ${nav.userAgent ?? ""}`.toLowerCase();
  if (p.includes("mac")) return "mac";
  if (p.includes("linux") || p.includes("x11")) return "linux";
  return "windows";
}


export const CODEQL_CONFIG = ["paths-ignore:", ...[...PASTAS_IGNORADAS, ...ARQUIVOS_IGNORADOS].map((p) => `  - "**/${p}"`)].join("\n");
