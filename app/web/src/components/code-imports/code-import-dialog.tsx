/**
 * code-import-dialog.tsx
 *
 * O QUE FAZ
 * Envia um relatório SARIF ou CycloneDX para um projeto (ADR-052): escolher
 * o projeto (ou vir travado, quando aberto da aba do projeto), soltar o
 * arquivo e acompanhar o envio. Ao concluir, leva direto ao detalhe da
 * importação — quem acabou de importar quer ver o resultado, não caçar a
 * linha na lista (mesma decisão do "Nova análise" do DAST).
 *
 * VALIDAÇÃO NO CLIENTE
 * Só o que poupa um upload inútil: tamanho (o teto da API é 10 MB) e
 * extensão. Se o conteúdo é mesmo SARIF/CycloneDX quem decide é a API, e o
 * erro dela é traduzido por `useApiError`.
 */

import { useId, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileJson, UploadCloud } from "lucide-react";
import { codeImportsApi } from "../../lib/api/code-imports.api";
import { projectsApi } from "../../lib/api/projects.api";
import { useApiError } from "../../hooks/use-api-error";
import { Dialog, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import { Progress } from "../ui/progress";
import { cn } from "../../lib/cn";
import { tamanhoLegivel, validarArquivo } from "../../lib/code-import";

const CLASSE_SELECT = "h-touch w-full rounded-control border border-default bg-surface px-3 text-sm text-fg";

export function CodeImportDialog({
  aberto,
  aoFechar,
  projetoFixo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  /** Quando aberto da aba do projeto, o destino já está decidido. */
  projetoFixo?: { id: string; name: string };
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const getErrorMessage = useApiError();
  const inputRef = useRef<HTMLInputElement>(null);
  const idDica = useId();

  const [projectId, setProjectId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list, enabled: aberto && !projetoFixo });
  const destino = projetoFixo?.id ?? projectId;

  const fechar = () => {
    setArquivo(null);
    setErro(null);
    setProgresso(0);
    setProjectId("");
    aoFechar();
  };

  const mutation = useMutation({
    mutationFn: () => codeImportsApi.importReport(destino, arquivo!, setProgresso),
    onSuccess: (criada) => {
      queryClient.invalidateQueries({ queryKey: ["code-imports"] });
      fechar();
      navigate(`/sast-sca/imports/${criada.id}`);
    },
    onError: (err: unknown) => {
      setProgresso(0);
      setErro(getErrorMessage(err));
    },
  });

  function escolher(file: File | undefined) {
    if (!file) return;
    const problema = validarArquivo(file);
    setErro(problema);
    setArquivo(problema ? null : file);
  }

  function aoSoltar(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    if (!mutation.isPending) escolher(e.dataTransfer.files?.[0]);
  }

  const projetos = projectsQuery.data ?? [];
  const podeEnviar = !!destino && !!arquivo && !mutation.isPending;

  return (
    <Dialog aberto={aberto} aoFechar={() => !mutation.isPending && fechar()} tamanho="lg">
      <DialogTitle>Importar relatório SAST/SCA</DialogTitle>
      <DialogDescription>
        Envie o relatório que a sua pipeline já gera. O Vulnera lê os achados, compara com a importação anterior da mesma
        ferramenta e preserva a triagem do que continua aparecendo.
      </DialogDescription>

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (podeEnviar) mutation.mutate();
        }}
      >
        {erro && <Alert tom="perigo">{erro}</Alert>}

        {projetoFixo ? (
          <p className="text-sm text-fg-muted">
            Projeto de destino: <strong className="text-fg">{projetoFixo.name}</strong>
          </p>
        ) : (
          <Field rotulo="Projeto de destino" obrigatorio dica="Só aparecem os projetos em que você participa.">
            {(attrs) => (
              <select {...attrs} className={CLASSE_SELECT} value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={mutation.isPending}>
                <option value="">Selecione um projeto...</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        {projectsQuery.isSuccess && !projetoFixo && projetos.length === 0 && (
          <Alert tom="atencao">Você ainda não participa de nenhum projeto. Peça a um administrador para incluir você em um.</Alert>
        )}

        <div
          role="button"
          tabIndex={0}
          aria-describedby={idDica}
          aria-label={arquivo ? `Arquivo escolhido: ${arquivo.name}. Clique para trocar.` : "Escolher arquivo do relatório"}
          onClick={() => !mutation.isPending && inputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !mutation.isPending) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltar}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-3 rounded-container border border-dashed border-default bg-inset px-6 py-8 text-center transition-colors duration-fast",
            "hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            arrastando && "border-accent bg-accent-surface",
          )}
        >
          {arquivo ? (
            <>
              <FileJson size={32} strokeWidth={1.5} aria-hidden="true" className="text-accent-ink" />
              <span className="font-mono text-sm text-fg">{arquivo.name}</span>
              <span className="text-xs text-fg-muted">{tamanhoLegivel(arquivo.size)} · clique ou solte outro para trocar</span>
            </>
          ) : (
            <>
              <UploadCloud size={32} strokeWidth={1.5} aria-hidden="true" className="text-fg-muted" />
              <span className="text-sm text-fg">
                <strong>Solte o arquivo aqui</strong> ou clique para escolher
              </span>
            </>
          )}
          <span id={idDica} className="text-xs text-fg-muted">
            SARIF 2.1.0 (.sarif/.json) ou CycloneDX (.json) · até 10 MB
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".sarif,.json,application/json,application/sarif+json"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              escolher(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <details className="rounded-control border border-subtle bg-surface p-3 text-sm text-fg-muted">
          <summary className="cursor-pointer text-fg">Como gerar o relatório</summary>
          <ul className="mt-2 flex flex-col gap-2 font-mono text-xs">
            <li>semgrep scan --config p/default --sarif --output semgrep.sarif</li>
            <li>codeql database analyze db --format=sarif-latest --output=codeql.sarif</li>
            <li>trivy fs --scanners vuln --format cyclonedx --output sbom.cdx.json .</li>
            <li>trivy fs --scanners vuln --format sarif --output trivy.sarif .</li>
          </ul>
        </details>

        {mutation.isPending && (
          <Progress valor={progresso} rotulo="Envio do relatório" textoDoValor={progresso < 100 ? `${progresso}% enviado` : "Processando achados..."} mostrarValor />
        )}

        <DialogFooter>
          <Button type="button" variant="secundario" onClick={fechar} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeEnviar} carregando={mutation.isPending}>
            Importar
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
