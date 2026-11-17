/**
 * code-import-help.tsx
 *
 * O QUE FAZ
 * O "?" ao lado de "Importar relatório" (ADR-052): abre um guia de como gerar
 * e importar um relatório SAST/SCA — o fluxo em cinco passos, os comandos
 * prontos para copiar (Semgrep, Trivy, CodeQL e GitHub Actions; local e por
 * Docker) e o que é bom saber antes de importar. Termina no próprio botão de
 * importar.
 *
 * POR QUE EXISTE
 * O Vulnera não roda os scanners: quem gera o arquivo é a pessoa (ou a CI
 * dela). Sem este guia, a primeira importação dependia de saber de antemão
 * que comando rodar e que formato exportar.
 *
 * QUEM USA
 * `sast-sca-page.tsx` e a aba SAST/SCA de `project-detail-page.tsx`.
 */

import { useState } from "react";
import { ArrowRight, Check, CircleHelp, Copy, FileJson, GitCompare, ListChecks, Terminal, Upload } from "lucide-react";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Tabs } from "../ui/tabs";
import { Tooltip } from "../ui/tooltip";

interface Comando {
  rotulo: string;
  codigo: string;
}

interface Ferramenta {
  id: string;
  nome: string;
  tipo: string;
  oQueAcha: string;
  saida: string;
  comandos: Comando[];
  observacao?: string;
}

const FERRAMENTAS: Ferramenta[] = [
  {
    id: "semgrep",
    nome: "Semgrep",
    tipo: "SAST · código",
    oQueAcha: "Falhas no código-fonte: eval com entrada do usuário, SQL montado na mão, segredos no repositório, configuração insegura.",
    saida: "semgrep.sarif",
    comandos: [
      { rotulo: "Instalado na máquina", codigo: "semgrep scan --config p/default --sarif --output semgrep.sarif" },
      {
        rotulo: "Sem instalar nada (Docker)",
        codigo: 'docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep scan --config p/default --sarif --output /src/semgrep.sarif /src',
      },
    ],
  },
  {
    id: "trivy",
    nome: "Trivy",
    tipo: "SCA · dependências",
    oQueAcha: "Bibliotecas com CVE conhecida, com a versão que corrige. Lê os lockfiles (package-lock.json, yarn.lock, requirements.txt, pom.xml...).",
    saida: "sbom.cdx.json",
    comandos: [
      { rotulo: "Instalado na máquina", codigo: "trivy fs --scanners vuln --format cyclonedx --output sbom.cdx.json ." },
      {
        rotulo: "Sem instalar nada (Docker)",
        codigo: 'docker run --rm -v "${PWD}:/src" aquasec/trivy fs --scanners vuln --format cyclonedx --output /src/sbom.cdx.json /src',
      },
      { rotulo: "Mesmo resultado em SARIF", codigo: "trivy fs --scanners vuln --format sarif --output trivy.sarif ." },
    ],
    observacao: "Sem lockfile no repositório o Trivy não acha os pacotes: o Vulnera importa e avisa, mas não haverá CVEs.",
  },
  {
    id: "codeql",
    nome: "CodeQL",
    tipo: "SAST · código",
    oQueAcha: "Fluxo de dados até pontos perigosos (injeção, XSS, path traversal), com análise entre arquivos.",
    saida: "codeql.sarif",
    comandos: [
      { rotulo: "1. Criar o banco do código", codigo: "codeql database create db --language=javascript --source-root ." },
      { rotulo: "2. Analisar e exportar", codigo: "codeql database analyze db codeql/javascript-queries --format=sarif-latest --output=codeql.sarif" },
    ],
    observacao: "Troque javascript pela linguagem do projeto (python, java, csharp, go...).",
  },
  {
    id: "ci",
    nome: "GitHub Actions",
    tipo: "na pipeline",
    oQueAcha: "Roda o Semgrep a cada push e guarda o SARIF como artefato; baixe o artefato e importe aqui.",
    saida: "semgrep.sarif (artefato)",
    comandos: [
      {
        rotulo: ".github/workflows/sast.yml",
        codigo: [
          "name: SAST",
          "on: [push]",
          "jobs:",
          "  semgrep:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: actions/checkout@v4",
          "      - run: docker run --rm -v \"$PWD:/src\" semgrep/semgrep semgrep scan --config p/default --sarif --output /src/semgrep.sarif /src",
          "      - uses: actions/upload-artifact@v4",
          "        with:",
          "          name: semgrep-sarif",
          "          path: semgrep.sarif",
        ].join("\n"),
      },
    ],
    observacao: "Envio automático da CI para o Vulnera ainda não existe (backlog CODE-FUT-01).",
  },
];

const PASSOS = [
  { icone: Terminal, titulo: "Rode a ferramenta", texto: "No repositório da aplicação, na sua máquina ou na CI." },
  { icone: FileJson, titulo: "Gere o arquivo", texto: "SARIF (.sarif) ou SBOM CycloneDX (.json)." },
  { icone: Upload, titulo: "Importe aqui", texto: "Escolha o projeto e solte o arquivo." },
  { icone: ListChecks, titulo: "Trie e promova", texto: "Confirmado, falso-positivo ou risco aceito; promova o que é real." },
  { icone: GitCompare, titulo: "Corrija e reimporte", texto: "A nova versão mostra o que foi resolvido e mantém a triagem." },
];

/** Bloco de comando com "Copiar". Sem a API de área de transferência (http, permissão), seleciona o texto. */
function BlocoDeComando({ comando }: { comando: Comando }) {
  const [copiado, setCopiado] = useState(false);
  const [preRef, setPreRef] = useState<HTMLPreElement | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(comando.codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      if (preRef) window.getSelection()?.selectAllChildren(preRef);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">{comando.rotulo}</span>
        <Button
          variant="fantasma"
          size="sm"
          onClick={copiar}
          iconeInicio={copiado ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          aria-label={`Copiar: ${comando.rotulo}`}
        >
          {copiado ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <pre ref={setPreRef} className="overflow-x-auto rounded-control border border-subtle bg-inset p-3 font-mono text-xs text-fg">
        <code>{comando.codigo}</code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {copiado ? "Comando copiado" : ""}
      </span>
    </div>
  );
}

function PainelDaFerramenta({ f }: { f: Ferramenta }) {
  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="text-sm text-fg-muted">
        <span className="font-medium text-fg">{f.tipo}.</span> {f.oQueAcha}
      </p>
      {f.comandos.map((c) => (
        <BlocoDeComando key={c.rotulo} comando={c} />
      ))}
      <p className="text-xs text-fg-muted">
        Gera <span className="font-mono text-fg">{f.saida}</span> — é esse arquivo que você importa.
        {f.observacao ? ` ${f.observacao}` : ""}
      </p>
    </div>
  );
}

export function AjudaImportacao({ aoImportar }: { aoImportar(): void }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Tooltip conteudo="Como gerar e importar o relatório">
        <Button
          variant="secundario"
          size="sm"
          rotulo="Como importar um relatório SAST/SCA"
          onClick={() => setAberto(true)}
          data-tour="sast-ajuda"
        >
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </Button>
      </Tooltip>

      {/* min-w-0: sem ele, a linha mais longa de comando alarga o painel além da tela no celular (o <pre> rola). */}
      {aberto && (
        <Dialog aberto={aberto} aoFechar={() => setAberto(false)} tamanho="lg" className="min-w-0">
          <DialogTitle>Como importar um relatório SAST/SCA</DialogTitle>
          <DialogDescription>
            O Vulnera não roda os scanners nem lê o seu código: você gera o relatório no repositório da aplicação e importa aqui. O Vulnera
            cuida do resto — comparação, triagem, promoção e PDF.
          </DialogDescription>
          <DialogClose />

          <section aria-label="O fluxo" className="mt-5">
            <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-fg-muted">O fluxo</h3>
            <ol className="grid gap-2 sm:grid-cols-5">
              {PASSOS.map(({ icone: Icone, titulo, texto }, i) => (
                <li key={titulo} className="relative flex flex-col gap-1 rounded-control border border-subtle bg-inset p-3">
                  <span className="flex items-center gap-2 text-xs font-medium text-accent-ink">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-surface font-mono" aria-hidden="true">
                      {i + 1}
                    </span>
                    <Icone className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-medium text-fg">{titulo}</span>
                  <span className="text-xs text-fg-muted">{texto}</span>
                  {i < PASSOS.length - 1 && (
                    <ArrowRight className="absolute -right-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-fg-muted sm:block" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Comandos" className="mt-6">
            <h3 className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-fg-muted">Comandos</h3>
            <Tabs
              abas={FERRAMENTAS.map((f) => ({ id: f.id, rotulo: f.nome, conteudo: <PainelDaFerramenta f={f} /> }))}
            />
            <p className="mt-2 text-xs text-fg-muted">
              Rode na pasta raiz do repositório. <span className="font-mono">{"${PWD}"}</span> funciona no PowerShell e no bash.
            </p>
          </section>

          <section aria-label="Bom saber" className="mt-6">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.1em] text-fg-muted">Bom saber</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-fg-muted">
              <li>
                Aceita <strong className="text-fg">SARIF 2.1.0</strong> e <strong className="text-fg">CycloneDX 1.4+</strong> com a seção de
                vulnerabilidades, até 10 MB e 5.000 achados.
              </li>
              <li>
                Importe sempre a <strong className="text-fg">mesma ferramenta no mesmo projeto</strong>: é assim que o Vulnera compara as versões e
                mantém a triagem do que continua.
              </li>
              <li>Achado que some do relatório aparece como resolvido — se já era vulnerabilidade, reteste antes de fechar.</li>
              <li>Nada é executado nem salvo do arquivo além dos achados; o código-fonte nunca sai da sua máquina.</li>
            </ul>
          </section>

          <DialogFooter>
            <Button variant="secundario" onClick={() => setAberto(false)}>
              Fechar
            </Button>
            <Button
              onClick={() => {
                setAberto(false);
                aoImportar();
              }}
              iconeInicio={<Upload className="h-4 w-4" aria-hidden="true" />}
            >
              Importar relatório
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  );
}
