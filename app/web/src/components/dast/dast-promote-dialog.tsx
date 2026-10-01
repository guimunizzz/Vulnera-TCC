/**
 * dast-promote-dialog.tsx
 *
 * O QUE FAZ
 * O formulário que transforma um `DastFinding` numa `Vulnerability` de um
 * Project real. Abre já preenchido com um rascunho vindo do backend
 * (título, descrição com a proveniência, categoria OWASP deduzida do CWE e
 * um vetor CVSS sugerido) e exige que o pentester escolha o projeto e
 * confirme o vetor.
 *
 * POR QUE O VETOR CVSS É EDITÁVEL E VEM MARCADO COMO SUGESTÃO
 * Esta é a razão pela qual o [[ADR-029]] tinha recusado importar findings do
 * ZAP direto pra Vulnerability: o ZAP **não fornece vetor CVSS**, só um
 * riskcode de 0 a 3. Derivar um vetor completo disso seria inventar, e um
 * score inventado convincente é pior que score nenhum — o resto do produto
 * trata `cvssScore` como calculado com confiança (RN10), e ninguém saberia,
 * olhando a lista, quais são reais.
 *
 * A saída adotada (ADR-032) é a que o próprio ADR-029 apontava: o rascunho
 * PROPÕE, o humano DISPÕE. O aviso em cima do campo não é decoração — é o
 * que impede a sugestão de virar, na prática, um score automático.
 *
 * QUEM CONSOME
 * `dast-scan-detail-page.tsx`.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { dastApi } from "../../lib/api/dast.api";
import { projectsApi } from "../../lib/api/projects.api";
import { useApiError } from "../../hooks/use-api-error";
import { Dialog, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import { Skeleton } from "../ui/card";
import { OWASP_CATEGORIES, OWASP_LABELS, type OwaspCategory } from "../../types/vulnerability.types";
import type { DastFinding } from "../../types/dast.types";

const CLASSE_SELECT = "h-touch w-full rounded-control border border-default bg-surface px-3 text-sm text-fg";

export function DastPromoteDialog({
  finding,
  aberto,
  aoFechar,
}: {
  finding: DastFinding | null;
  aberto: boolean;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const [erro, setErro] = useState<string | null>(null);

  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owaspCategory, setOwaspCategory] = useState<OwaspCategory>("A06");
  const [cvssVector, setCvssVector] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [impact, setImpact] = useState("");

  const draftQuery = useQuery({
    queryKey: ["dast", "findings", finding?.id, "promotion-draft"],
    queryFn: () => dastApi.getPromotionDraft(finding!.id),
    enabled: aberto && !!finding,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
    enabled: aberto,
  });

  // Preenche o formulário quando o rascunho chega. Depende do `id` do finding
  // (e não do objeto do draft) pra não sobrescrever o que a pessoa já editou
  // caso o react-query refaça o fetch com a janela aberta.
  useEffect(() => {
    const draft = draftQuery.data;
    if (!draft) return;
    setTitle(draft.title);
    setDescription(draft.description);
    setOwaspCategory((draft.owaspCategory as OwaspCategory) ?? "A06");
    setCvssVector(draft.cvssVector);
    setRecommendation(draft.recommendation ?? "");
    setImpact(draft.impact ?? "");
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finding?.id, draftQuery.isSuccess]);

  const mutation = useMutation({
    mutationFn: () =>
      dastApi.promote(finding!.id, {
        projectId,
        title: title.trim(),
        description: description.trim(),
        owaspCategory,
        cvssVector: cvssVector.trim(),
        recommendation: recommendation.trim() || undefined,
        impact: impact.trim() || undefined,
      }),
    onSuccess: () => {
      // Duas listas mudam: a de findings (o finding ganha o selo "promovido")
      // e a de vulnerabilities do projeto de destino.
      queryClient.invalidateQueries({ queryKey: ["dast", "scans", finding?.scanId, "findings"] });
      queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      aoFechar();
    },
    onError: (err: unknown) => setErro(getErrorMessage(err)),
  });

  if (!finding) return null;

  const jaPromovido = finding.promotedVulnerability;
  const projetos = projectsQuery.data ?? [];
  const podeSalvar = !!projectId && !!title.trim() && !!description.trim() && !!cvssVector.trim();

  return (
    // fecharAoClicarFora desligado: é um formulário longo e já preenchido —
    // perder isso num clique de raspão é o tipo de coisa que não se perdoa.
    <Dialog aberto={aberto} aoFechar={aoFechar} tamanho="lg" fecharAoClicarFora={false}>
      <DialogTitle>Promover para vulnerabilidade</DialogTitle>
      <DialogDescription>
        Este achado do OWASP ZAP vira uma vulnerabilidade de um projeto, entrando no fluxo normal de triagem e
        remediação — com evidências, comentários e relatório.
      </DialogDescription>
      <DialogClose />

      {jaPromovido ? (
        <Alert tom="atencao" className="mt-4" titulo="Este achado já foi promovido">
          Ele já existe como vulnerabilidade e não pode ser promovido duas vezes.{" "}
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
            mutation.mutate();
          }}
        >
          {erro && <Alert tom="perigo">{erro}</Alert>}

          <Field rotulo="Projeto de destino" obrigatorio dica="Só aparecem os projetos em que você participa.">
            {(attrs) => (
              <select {...attrs} className={CLASSE_SELECT} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Selecione um projeto...</option>
                {projetos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          {projectsQuery.isSuccess && projetos.length === 0 && (
            <Alert tom="atencao">
              Você não participa de nenhum projeto ainda — peça a um administrador para adicionar você a um antes de
              promover achados.
            </Alert>
          )}

          <Field rotulo="Título" obrigatorio>
            {(attrs) => <Input {...attrs} value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>

          <Field
            rotulo="Vetor CVSS 3.1"
            obrigatorio
            dica="Revise antes de salvar — o score é calculado a partir daqui."
          >
            {(attrs) => (
              <Input
                {...attrs}
                value={cvssVector}
                onChange={(e) => setCvssVector(e.target.value)}
                className="font-mono text-xs"
              />
            )}
          </Field>

          <Alert tom="atencao" titulo="O vetor acima é uma sugestão, não uma medição">
            O OWASP ZAP não fornece vetor CVSS — ele classifica o achado apenas como alto/médio/baixo. O vetor
            pré-preenchido é o caso típico dessa faixa de risco. <strong>Confira contra o achado real</strong> antes
            de salvar: o score e a severidade da vulnerabilidade saem exatamente do que estiver nesse campo.
          </Alert>

          <Field rotulo="Categoria OWASP" obrigatorio dica="Deduzida do CWE que o ZAP reportou. Ajuste se não bater.">
            {(attrs) => (
              <select
                {...attrs}
                className={CLASSE_SELECT}
                value={owaspCategory}
                onChange={(e) => setOwaspCategory(e.target.value as OwaspCategory)}
              >
                {OWASP_CATEGORIES.map((categoria) => (
                  <option key={categoria} value={categoria}>
                    {OWASP_LABELS[categoria]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field rotulo="Descrição" obrigatorio dica="Já traz a origem do achado (scan, URL e parâmetro).">
            {(attrs) => (
              <Textarea {...attrs} rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />
            )}
          </Field>

          <Field rotulo="Recomendação" dica="Veio da solução sugerida pelo próprio ZAP.">
            {(attrs) => (
              <Textarea {...attrs} rows={4} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />
            )}
          </Field>

          <Field rotulo="Impacto">
            {(attrs) => (
              <Textarea
                {...attrs}
                rows={3}
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                placeholder="O que um atacante consegue com isso, neste contexto."
              />
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
