/**
 * promover-dialog.tsx
 *
 * Promover uma CVE que afeta o inventário a vulnerabilidade de um projeto
 * (ADR-053, D19.8). Mesma regra do DAST e do SAST/SCA: o rascunho PROPÕE
 * (título, descrição com a tecnologia, versão corrigida, KEV e EPSS, A06 e o
 * vetor do aviso), a pessoa REVISA, e o score sai do vetor confirmado (RN10).
 * Diferente do SAST/SCA, o destino é escolhido: a tecnologia é da empresa,
 * não de um projeto.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { threatIntelApi } from "../../lib/api/threat-intel.api";
import { useApiError } from "../../hooks/use-api-error";
import { Dialog, DialogClose, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Field } from "../ui/field";
import { Alert } from "../ui/alert";
import { Skeleton } from "../ui/card";
import { OWASP_CATEGORIES, OWASP_LABELS } from "../../types/vulnerability.types";
import { calculateCvss } from "../../lib/cvss";
import type { CasamentoTI } from "../../types/threat-intel.types";

const CLASSE_SELECT = "h-touch w-full rounded-control border border-default bg-surface px-3 text-sm text-fg";

function previa(vetor: string): string | null {
  const r = calculateCvss(vetor.trim());
  return r ? `${r.score.toFixed(1)} · ${r.severity}` : null;
}

export function PromoverDialog({ casamento, aoFechar }: { casamento: CasamentoTI | null; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const getErrorMessage = useApiError();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owaspCategory, setOwaspCategory] = useState("A06");
  const [cvssVector, setCvssVector] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const rascunho = useQuery({
    queryKey: ["threat-intel", "promotion-draft", casamento?.id],
    queryFn: () => threatIntelApi.promotionDraft(casamento!.id),
    enabled: !!casamento,
  });

  useEffect(() => {
    const d = rascunho.data;
    if (!d) return;
    setTitle(d.title);
    setDescription(d.description);
    setOwaspCategory(d.owaspCategory);
    setCvssVector(d.cvssVector);
    setRecommendation(d.recommendation);
    setProjectId(d.projetos.length === 1 ? d.projetos[0]!.id : "");
    setErro(null);
  }, [rascunho.data]);

  const promover = useMutation({
    mutationFn: () => threatIntelApi.promote(casamento!.id, { projectId, title, description, owaspCategory, cvssVector, recommendation }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["threat-intel"] });
      void queryClient.invalidateQueries({ queryKey: ["findings"] });
      void queryClient.invalidateQueries({ queryKey: ["vulnerabilities"] });
      aoFechar();
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  if (!casamento) return null;
  const score = previa(cvssVector);
  const podeSalvar = !!projectId && !!title.trim() && !!description.trim() && !!score;
  const jaPromovida = casamento.promotedVulnerability?.id ?? rascunho.data?.alreadyPromotedTo ?? null;

  return (
    <Dialog aberto={!!casamento} aoFechar={aoFechar} tamanho="lg">
      <DialogTitle>Promover para vulnerabilidade</DialogTitle>
      <DialogDescription>
        {casamento.advisory.id} em <strong>{casamento.asset.displayName}</strong> vira uma vulnerabilidade do projeto escolhido, com SLA,
        priorização (VRS), comentários e relatório.
      </DialogDescription>
      <DialogClose />

      {jaPromovida ? (
        <Alert tom="atencao" className="mt-4" titulo="Esta CVE já é uma vulnerabilidade">
          <Link className="underline" to={`/findings/${jaPromovida}`}>
            Abrir a vulnerabilidade
          </Link>
          .
        </Alert>
      ) : rascunho.isLoading ? (
        <div className="mt-4 flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">Carregando o rascunho</span>
          <Skeleton className="h-10 w-full bg-inset" />
          <Skeleton className="h-24 w-full bg-inset" />
        </div>
      ) : rascunho.isError ? (
        <Alert tom="perigo" className="mt-4">
          {getErrorMessage(rascunho.error)}
        </Alert>
      ) : (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (podeSalvar) promover.mutate();
          }}
        >
          {erro && <Alert tom="perigo">{erro}</Alert>}

          <Field rotulo="Projeto" obrigatorio dica="Projetos desta empresa em que você pode registrar vulnerabilidades.">
            {(attrs) => (
              <select {...attrs} className={CLASSE_SELECT} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Escolha o projeto</option>
                {(rascunho.data?.projetos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field rotulo="Título" obrigatorio>
            {(attrs) => <Input {...attrs} value={title} maxLength={180} onChange={(e) => setTitle(e.target.value)} />}
          </Field>

          <Field
            rotulo="Vetor CVSS 3.1"
            obrigatorio
            dica={score ? `Score calculado: ${score}` : "Sem vetor 3.x no aviso: monte o vetor do seu contexto."}
            erro={cvssVector.trim() && !score ? "Vetor CVSS 3.1 inválido." : null}
          >
            {(attrs) => <Input {...attrs} value={cvssVector} onChange={(e) => setCvssVector(e.target.value)} className="font-mono text-xs" />}
          </Field>
          <Alert tom="info" titulo="O vetor do aviso descreve a CVE em geral">
            Ajuste ao seu contexto: se o componente não fica exposto, ou se a função vulnerável não é usada, o risco real é menor. O score sai
            exatamente deste campo.
          </Alert>

          <Field rotulo="Categoria OWASP" obrigatorio dica="Componente com CVE conhecida é A06.">
            {(attrs) => (
              <select {...attrs} className={CLASSE_SELECT} value={owaspCategory} onChange={(e) => setOwaspCategory(e.target.value)}>
                {OWASP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {OWASP_LABELS[c]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field rotulo="Descrição" obrigatorio dica="Já traz a tecnologia, a versão corrigida, KEV e EPSS.">
            {(attrs) => <Textarea {...attrs} rows={8} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>

          <Field rotulo="Recomendação">
            {(attrs) => <Textarea {...attrs} rows={3} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} />}
          </Field>

          <DialogFooter>
            <Button type="button" variant="secundario" onClick={aoFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!podeSalvar || promover.isPending} carregando={promover.isPending}>
              Promover
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
