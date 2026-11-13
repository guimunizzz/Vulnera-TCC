/**
 * code-promote-dialog.tsx
 *
 * Transforma um achado SAST/SCA numa `Vulnerability` do projeto da
 * importação (ADR-052). Mesma regra do DAST (ADR-032): o rascunho PROPÕE, o
 * humano DISPÕE — o score oficial sai do vetor CVSS confirmado aqui (RN10).
 *
 * Diferenças para o diálogo do DAST:
 *  - não há escolha de projeto: o destino é o projeto da importação (a API
 *    ignora qualquer outro), então pedir a escolha só abriria espaço a erro;
 *  - o vetor pode vir da PRÓPRIA ferramenta (CVSS do NVD num SBOM do Trivy),
 *    e o aviso muda conforme a origem — continua editável nos dois casos.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { codeImportsApi } from "../../lib/api/code-imports.api";
import { useApiError } from "../../hooks/use-api-error";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import { Skeleton } from "../ui/card";
import { OWASP_CATEGORIES, OWASP_LABELS, type OwaspCategory } from "../../types/vulnerability.types";
import { calculateCvss } from "../../lib/cvss";
import type { CodeFinding } from "../../types/code-import.types";

const CLASSE_SELECT = "h-touch w-full rounded-control border border-default bg-surface px-3 text-sm text-fg";

function previaDoScore(vector: string): string | null {
  const r = calculateCvss(vector.trim());
  return r ? `${r.score.toFixed(1)} · ${r.severity}` : null;
}

export function CodePromoteDialog({
  finding,
  projetoNome,
  aberto,
  aoFechar,
}: {
  finding: CodeFinding | null;
  /** Projeto da importação — o único destino possível. */
  projetoNome: string;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const [erro, setErro] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owaspCategory, setOwaspCategory] = useState<OwaspCategory>("A06");
  const [cvssVector, setCvssVector] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [impact, setImpact] = useState("");

  const draftQuery = useQuery({
    queryKey: ["code-imports", "findings", finding?.id, "promotion-draft"],
    queryFn: () => codeImportsApi.getPromotionDraft(finding!.id),
    enabled: aberto && !!finding,
  });

  // Preenche quando o rascunho chega; depende do id do achado para não
  // sobrescrever o que a pessoa já editou num refetch com a janela aberta.
  useEffect(() => {
    const d = draftQuery.data;
    if (!d) return;
    setTitle(d.title.slice(0, 191));
    setDescription(d.description);
    setOwaspCategory((d.owaspCategory as OwaspCategory) ?? "A06");
    setCvssVector(d.cvssVector);
    setRecommendation(d.recommendation ?? "");
    setImpact(d.impact ?? "");
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finding?.id, draftQuery.isSuccess]);

  const mutation = useMutation({
    mutationFn: () =>
      codeImportsApi.promote(finding!.id, {
        title: title.trim(),
        description: description.trim(),
        owaspCategory,
        cvssVector: cvssVector.trim(),
        recommendation: recommendation.trim() || undefined,
        impact: impact.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["code-imports"] });
      queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      queryClient.invalidateQueries({ queryKey: ["findings"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      aoFechar();
    },
    onError: (err: unknown) => setErro(getErrorMessage(err)),
  });

  if (!finding) return null;

  const jaPromovido = finding.promotedVulnerability ?? (draftQuery.data?.alreadyPromotedTo ? { id: draftQuery.data.alreadyPromotedTo } : null);
  const previa = previaDoScore(cvssVector);
  const doFerramenta = draftQuery.data?.cvssVectorSource === "TOOL";
  const podeSalvar = !!title.trim() && !!description.trim() && !!previa;

  return (
    <Dialog aberto={aberto} aoFechar={aoFechar} tamanho="lg">
      <DialogTitle>Promover para vulnerabilidade</DialogTitle>
      <DialogDescription>
        O achado vira uma vulnerabilidade do projeto <strong>{projetoNome}</strong>, com SLA, priorização (VRS),
        evidências, comentários e relatório.
      </DialogDescription>
      <DialogClose />

      {jaPromovido ? (
        <Alert tom="atencao" className="mt-4" titulo="Este achado já é uma vulnerabilidade">
          Ele (ou o mesmo achado numa importação anterior) já foi promovido.{" "}
          <Link className="underline" to={`/findings/${jaPromovido.id}`}>
            Abrir a vulnerabilidade
          </Link>
          .
        </Alert>
      ) : draftQuery.isLoading ? (
        <div className="mt-4 flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">Carregando o rascunho</span>
          <Skeleton className="h-10 w-full bg-inset" />
          <Skeleton className="h-24 w-full bg-inset" />
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (podeSalvar) mutation.mutate();
          }}
        >
          {erro && <Alert tom="perigo">{erro}</Alert>}

          <Field rotulo="Título" obrigatorio>
            {(attrs) => <Input {...attrs} value={title} maxLength={191} onChange={(e) => setTitle(e.target.value)} />}
          </Field>

          <Field
            rotulo="Vetor CVSS 3.1"
            obrigatorio
            dica={previa ? `Score calculado: ${previa}` : "Vetor inválido — confira as 8 métricas."}
            erro={cvssVector.trim() && !previa ? "Vetor CVSS 3.1 inválido." : null}
          >
            {(attrs) => <Input {...attrs} value={cvssVector} onChange={(e) => setCvssVector(e.target.value)} className="font-mono text-xs" />}
          </Field>

          {doFerramenta ? (
            <Alert tom="info" titulo="Vetor informado pela ferramenta">
              Este vetor veio do relatório (ex.: NVD via Trivy). Ele descreve a CVE em geral, não o seu contexto: ajuste se o
              componente não está exposto ou se o trecho vulnerável não é usado.
            </Alert>
          ) : (
            <Alert tom="atencao" titulo="O vetor acima é uma sugestão, não uma medição">
              A ferramenta só informou a severidade do achado; o vetor pré-preenchido é o caso típico dessa faixa.{" "}
              <strong>Confira contra o código real</strong> antes de salvar: o score sai exatamente deste campo.
            </Alert>
          )}

          <Field rotulo="Categoria OWASP" obrigatorio dica={finding.category === "SCA" ? "Componente com CVE conhecida é A06." : "Deduzida do CWE informado pela ferramenta."}>
            {(attrs) => (
              <select {...attrs} className={CLASSE_SELECT} value={owaspCategory} onChange={(e) => setOwaspCategory(e.target.value as OwaspCategory)}>
                {OWASP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {OWASP_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field rotulo="Descrição" obrigatorio dica="Já traz a origem: ferramenta, regra, arquivo/linha ou pacote.">
            {(attrs) => <Textarea {...attrs} rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>

          <Field rotulo="Recomendação">
            {(attrs) => <Textarea {...attrs} rows={4} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />}
          </Field>

          <Field rotulo="Impacto">
            {(attrs) => (
              <Textarea {...attrs} rows={3} value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="O que um atacante consegue com isso, neste contexto." />
            )}
          </Field>

          <DialogFooter>
            <Button type="button" variant="secundario" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!podeSalvar || mutation.isPending} carregando={mutation.isPending}>
              Promover
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
