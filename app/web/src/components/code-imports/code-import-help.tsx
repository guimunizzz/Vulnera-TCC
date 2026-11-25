/**
 * code-import-help.tsx
 *
 * O QUE FAZ
 * O "?" ao lado de "Importar relatório" (ADR-052): um passo a passo que monta
 * o comando certo para gerar o relatório SAST/SCA e termina no botão de
 * importar. A pessoa escolhe o que analisar (código → Semgrep, dependências →
 * Trivy), o sistema (detectado do navegador) e como rodar (sem instalar,
 * instalando ou Docker); o guia mostra UM bloco pronto para colar no
 * terminal, já com as correções daquele sistema, e o que conferir antes de
 * importar. CodeQL e GitHub Actions ficam em "Outras ferramentas".
 *
 * POR QUE EXISTE
 * O Vulnera não roda os scanners: quem gera o arquivo é a pessoa, com uma
 * ferramenta de terceiros. Uma lista solta de comandos levava a erros reais:
 * Semgrep no Windows gravando SARIF vazio (cp1252 → UnicodeEncodeError, só
 * resolvido com PYTHONUTF8=1), scans de 9 minutos por Docker com a pasta do
 * Windows montada, e relatórios cheios de node_modules e .env. Cada
 * combinação aqui já carrega a correção do seu caso.
 *
 * QUEM USA
 * `sast-sca-page.tsx` e a aba SAST/SCA de `project-detail-page.tsx`.
 */

import { useState, type ReactNode } from "react";
import { Check, CircleHelp, Copy, Upload } from "lucide-react";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Tabs } from "../ui/tabs";
import { Tooltip } from "../ui/tooltip";
import { cn } from "../../lib/cn";
import {
  CMD_SEMGREP_DOCKER,
  CODEQL_CONFIG,
  MODOS_POR_ALVO,
  ROTULO_MODO,
  detectarSistema,
  montarReceita,
  type Alvo,
  type Modo,
  type Sistema,
} from "../../lib/code-import-receitas";

const COMO_ABRIR_TERMINAL: Record<Sistema, string> = {
  windows: "Abra a pasta do projeto no Explorador de Arquivos, clique com o botão direito num espaço vazio e escolha “Abrir no Terminal” (PowerShell).",
  mac: "Abra o Terminal e entre na pasta do projeto: cd caminho/do/projeto (ou arraste a pasta para o Terminal depois de digitar cd ).",
  linux: "Abra o terminal e entre na pasta do projeto: cd caminho/do/projeto.",
};

/** Bloco de comando com "Copiar". Sem a API de área de transferência (http, permissão), seleciona o texto. */
function BlocoDeComando({ rotulo, codigo }: { rotulo: string; codigo: string }) {
  const [copiado, setCopiado] = useState(false);
  const [preRef, setPreRef] = useState<HTMLPreElement | null>(null);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      if (preRef) window.getSelection()?.selectAllChildren(preRef);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">{rotulo}</span>
        <Button
          variant={copiado ? "secundario" : "primario"}
          size="sm"
          onClick={copiar}
          iconeInicio={copiado ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          aria-label={`Copiar: ${rotulo}`}
        >
          {copiado ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <pre ref={setPreRef} className="overflow-x-auto whitespace-pre-wrap break-all rounded-control border border-subtle bg-inset p-3 font-mono text-xs text-fg">
        <code>{codigo}</code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {copiado ? "Comando copiado" : ""}
      </span>
    </div>
  );
}

/** Grupo de opções exclusivas (radiogroup): botões grandes, a escolhida destacada. */
function Escolha<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: { id: T; titulo: string; detalhe?: string; recomendado?: boolean }[];
  aoMudar(v: T): void;
}) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr">
      {opcoes.map((o) => {
        const ativo = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoMudar(o.id)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-control border px-3 py-2 text-left transition-colors duration-fast",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              ativo ? "border-accent bg-accent-surface" : "border-subtle bg-inset hover:border-strong",
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-fg">
              {o.titulo}
              {o.recomendado && <span className="rounded-full bg-accent-surface px-2 text-[10px] font-medium uppercase tracking-wide text-accent-ink">recomendado</span>}
            </span>
            {o.detalhe && <span className="text-xs text-fg-muted">{o.detalhe}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Passo({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section aria-label={`Passo ${n}: ${titulo}`} className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-medium text-fg">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-surface font-mono text-xs text-accent-ink" aria-hidden="true">
          {n}
        </span>
        {titulo}
      </h3>
      <div className="flex flex-col gap-2 sm:pl-8">{children}</div>
    </section>
  );
}


function OutrasFerramentas() {
  return (
    <Tabs
      abas={[
        {
          id: "codeql",
          rotulo: "CodeQL",
          conteudo: (
            <div className="flex flex-col gap-3 pt-3">
              <p className="text-sm text-fg-muted">SAST com fluxo de dados entre arquivos. Troque javascript pela linguagem do projeto.</p>
              <BlocoDeComando rotulo="1. Salve como codeql-config.yml (o que ignorar)" codigo={CODEQL_CONFIG} />
              <BlocoDeComando
                rotulo="2. Criar o banco e exportar"
                codigo={[
                  "codeql database create db --language=javascript --source-root . --codescanning-config=codeql-config.yml",
                  "codeql database analyze db codeql/javascript-queries --format=sarif-latest --output=codeql.sarif",
                ].join("\n")}
              />
            </div>
          ),
        },
        {
          id: "ci",
          rotulo: "GitHub Actions",
          conteudo: (
            <div className="flex flex-col gap-3 pt-3">
              <p className="text-sm text-fg-muted">Roda o Semgrep a cada push; baixe o artefato semgrep-sarif e importe aqui. Envio automático ainda não existe (CODE-FUT-01).</p>
              <BlocoDeComando
                rotulo=".github/workflows/sast.yml"
                codigo={[
                  "name: SAST",
                  "on: [push]",
                  "jobs:",
                  "  semgrep:",
                  "    runs-on: ubuntu-latest",
                  "    steps:",
                  "      - uses: actions/checkout@v4",
                  `      - run: ${CMD_SEMGREP_DOCKER.replace('"${PWD}:/src"', '"$PWD:/src"')}`,
                  "      - uses: actions/upload-artifact@v4",
                  "        with:",
                  "          name: semgrep-sarif",
                  "          path: semgrep.sarif",
                ].join("\n")}
              />
            </div>
          ),
        },
      ]}
    />
  );
}

export function AjudaImportacao({ aoImportar }: { aoImportar(): void }) {
  const [aberto, setAberto] = useState(false);
  const [alvo, setAlvo] = useState<Alvo>("codigo");
  const [sistema, setSistema] = useState<Sistema>(detectarSistema);
  const [modo, setModo] = useState<Modo>("instalando");

  const modos = MODOS_POR_ALVO[alvo];
  const modoEfetivo = modos.includes(modo) ? modo : modos[0];
  const receita = montarReceita(alvo, sistema, modoEfetivo);

  function trocarAlvo(a: Alvo) {
    setAlvo(a);
    setModo(MODOS_POR_ALVO[a][0]);
  }

  return (
    <>
      <Tooltip conteudo="Como gerar e importar o relatório">
        <Button variant="secundario" size="sm" rotulo="Como importar um relatório SAST/SCA" onClick={() => setAberto(true)} data-tour="sast-ajuda">
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
        </Button>
      </Tooltip>

      {/* min-w-0: sem ele, a linha mais longa de comando alarga o painel além da tela no celular. */}
      {aberto && (
        <Dialog aberto={aberto} aoFechar={() => setAberto(false)} tamanho="lg" className="min-w-0">
          <DialogTitle>Como importar um relatório SAST/SCA</DialogTitle>
          <DialogDescription>
            O relatório é gerado por uma ferramenta gratuita no seu computador — o código nunca sai da sua máquina. Responda as perguntas abaixo e copie o
            comando pronto.
          </DialogDescription>
          <DialogClose />

          <div className="mt-5 flex flex-col gap-6">
            <Passo n={1} titulo="O que você quer analisar?">
              <Escolha<Alvo>
                rotulo="O que analisar"
                valor={alvo}
                aoMudar={trocarAlvo}
                opcoes={[
                  { id: "codigo", titulo: "O código (SAST)", detalhe: "Semgrep — injeção, segredos, configuração insegura" },
                  { id: "dependencias", titulo: "As dependências (SCA)", detalhe: "Trivy — bibliotecas com CVE, lidas dos lockfiles" },
                ]}
              />
            </Passo>

            <Passo n={2} titulo="Seu sistema e como rodar">
              <Escolha<Sistema>
                rotulo="Sistema operacional"
                valor={sistema}
                aoMudar={setSistema}
                opcoes={[
                  { id: "windows", titulo: "Windows" },
                  { id: "mac", titulo: "macOS" },
                  { id: "linux", titulo: "Linux" },
                ]}
              />
              <Escolha<Modo>
                rotulo="Como rodar"
                valor={modoEfetivo}
                aoMudar={setModo}
                opcoes={modos.map((m, i) => ({ id: m, titulo: ROTULO_MODO[m], recomendado: i === 0 }))}
              />
            </Passo>

            <Passo n={3} titulo="Abra o terminal na pasta do projeto">
              <p className="text-sm text-fg-muted">{COMO_ABRIR_TERMINAL[sistema]}</p>
            </Passo>

            <Passo n={4} titulo="Cole e rode">
              <BlocoDeComando rotulo={`${sistema === "windows" ? "PowerShell" : "Terminal"} · ${ROTULO_MODO[modoEfetivo]}`} codigo={receita.comando} />
              {receita.aviso && <p className="rounded-control border border-subtle bg-inset p-2 text-xs text-fg-muted">{receita.aviso}</p>}
              <p className="text-xs text-fg-muted">
                Leva {receita.tempo}. Já ignora node_modules, builds e arquivos .env — só o código e os lockfiles entram na análise.
              </p>
            </Passo>

            <Passo n={5} titulo="Confira e importe">
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-fg-muted">
                <li>
                  Apareceu <strong className="font-mono text-fg">{receita.arquivo}</strong> na pasta do projeto — é ele que você importa.
                </li>
                <li>
                  Se o arquivo ficou com <strong className="text-fg">0 KB</strong> ou não apareceu, o comando falhou: role o terminal até o erro (normalmente a
                  ferramenta não foi instalada).
                </li>
                <li>Importe sempre a mesma ferramenta no mesmo projeto: é assim que o Vulnera mostra o que foi resolvido e mantém a triagem.</li>
              </ul>
            </Passo>

            <details className="rounded-control border border-subtle p-3 text-sm text-fg-muted">
              <summary className="cursor-pointer text-fg">Outras ferramentas (CodeQL, GitHub Actions) e formatos aceitos</summary>
              <p className="mt-2 text-xs">
                Aceita qualquer <strong className="text-fg">SARIF 2.1.0</strong> ou <strong className="text-fg">CycloneDX 1.4+</strong> com a seção de
                vulnerabilidades, até 10 MB e 5.000 achados. Nada é executado do arquivo; só os achados são lidos.
              </p>
              <OutrasFerramentas />
            </details>
          </div>

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
              Já tenho o arquivo — importar
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </>
  );
}
