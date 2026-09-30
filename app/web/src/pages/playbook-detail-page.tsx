/**
 * playbook-detail-page.tsx
 *
 * O QUE FAZ
 * Mostra um playbook de remediação inteiro (CP-5) e, quando ele é da casa,
 * permite editá-lo ali mesmo.
 *
 * DUAS TELAS NUM ARQUIVO SÓ, DE PROPÓSITO: o modo leitura e o modo edição
 * mostram exatamente os mesmos campos, e separá-los em duas páginas faria o
 * mesmo conteúdo existir em dois lugares — a receita conhecida para uma seção
 * ser acrescentada num e esquecida no outro.
 *
 * O QUE NÃO TEM AQUI, E POR QUÊ
 *   Editor de Markdown com prévia lado a lado. A prévia renderiza conteúdo não
 *   salvo, e a tentação seguinte seria renderizá-lo sem passar pelo mesmo
 *   caminho do conteúdo salvo. A prévia aqui é a própria tela de leitura,
 *   depois de salvar: um caminho só, o testado.
 *
 * QUEM USA
 * Rota `/playbooks/:id`.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { playbooksApi } from "../lib/api/playbooks.api";
import { useApiError } from "../hooks/use-api-error";
import { useAuthStore } from "../store/auth.store";
import { Breadcrumb } from "../components/ui/navigation";
import { Card, Skeleton } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Field } from "../components/ui/field";
import { Alert } from "../components/ui/alert";
import { ErrorState } from "../components/ui/empty-state";
import { BadgeOrigem, PlaybookViewer } from "../components/playbooks/playbook-viewer";
import { SECOES_PLAYBOOK, type Playbook, type PlaybookInput } from "../types/playbook.types";

/** Os campos editáveis, com o rótulo que a pessoa vê. */
const CAMPOS_TEXTO = [
  { campo: "summary", titulo: "Resumo", linhas: 3 },
  ...SECOES_PLAYBOOK.map((s) => ({ campo: s.campo, titulo: s.titulo, linhas: 8 })),
] as const;

type ChaveTexto = (typeof CAMPOS_TEXTO)[number]["campo"];

function paraFormulario(p: Playbook): PlaybookInput {
  return {
    title: p.title,
    summary: p.summary,
    owaspCategory: p.owaspCategory,
    rootCause: p.rootCause,
    remediation: p.remediation,
    validationSteps: p.validationSteps,
    secureExample: p.secureExample,
    compensatingControls: p.compensatingControls,
  };
}

export function PlaybookDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<PlaybookInput | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const consulta = useQuery({
    queryKey: ["playbooks", id],
    queryFn: () => playbooksApi.getById(id),
    enabled: Boolean(id),
  });

  const playbook = consulta.data;
  // O System é imutável para todo mundo — inclusive ADMIN (D5).
  const podeEditar = Boolean(playbook && !playbook.isSystem && (role === "ADMIN" || role === "PENTESTER"));
  const podeClonar = role === "ADMIN" || role === "PENTESTER";

  useEffect(() => {
    if (playbook && !form) setForm(paraFormulario(playbook));
  }, [playbook, form]);

  const salvar = useMutation({
    mutationFn: (input: PlaybookInput) => playbooksApi.update(id, input),
    onSuccess: (atualizado) => {
      setEditando(false);
      setErro(null);
      setAviso("Playbook atualizado.");
      setForm(paraFormulario(atualizado));
      void queryClient.invalidateQueries({ queryKey: ["playbooks"] });
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  const clonar = useMutation({
    mutationFn: () => playbooksApi.clone(id),
    onSuccess: (novo) => {
      void queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      navigate(`/playbooks/${novo.id}`);
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  const remover = useMutation({
    mutationFn: () => playbooksApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["playbooks"] });
      navigate("/playbooks");
    },
    onError: (e) => setErro(getErrorMessage(e)),
  });

  if (consulta.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (consulta.isError || !playbook) {
    return (
      <ErrorState
        titulo="Playbook indisponível"
        descricao={getErrorMessage(consulta.error)}
        aoTentarNovamente={() => void consulta.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        itens={[
          { rotulo: "Início", para: "/dashboard" },
          { rotulo: "Playbooks", para: "/playbooks" },
          { rotulo: playbook.title },
        ]}
      />

      <header data-ops-hero="playbook" className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-fg">{playbook.title}</h1>
            <BadgeOrigem isSystem={playbook.isSystem} />
          </div>
          {playbook.owaspCategory && (
            <p className="text-sm text-fg-secondary">Categoria OWASP {playbook.owaspCategory}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {podeEditar && !editando && (
            <Button variant="secundario" size="sm" onClick={() => setEditando(true)}>
              Editar
            </Button>
          )}
          {podeClonar && (
            <Button variant="secundario" size="sm" onClick={() => clonar.mutate()} carregando={clonar.isPending}>
              {playbook.isSystem ? "Duplicar e adaptar" : "Duplicar"}
            </Button>
          )}
          {podeEditar && !editando && (
            <Button variant="destrutivo" size="sm" onClick={() => remover.mutate()} carregando={remover.isPending}>
              Remover
            </Button>
          )}
        </div>
      </header>

      {playbook.isSystem && (
        <Alert tom="info" titulo="Conteúdo oficial, somente leitura">
          Este playbook vem do OWASP Top 10 e não pode ser alterado — editá-lo e manter o selo da OWASP seria atribuir a
          ela um texto que não é dela. Para adaptar ao seu contexto, use <strong>Duplicar e adaptar</strong>: a cópia
          fica editável e continua creditando a fonte.
        </Alert>
      )}

      {aviso && (
        <Alert tom="sucesso" aoFechar={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}
      {erro && (
        <Alert tom="perigo" aoFechar={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      {editando && form ? (
        <Card titulo="Editar playbook">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              salvar.mutate(form);
            }}
          >
            <Field rotulo="Título" obrigatorio>
              {(props) => (
                <Input
                  {...props}
                  value={form.title}
                  maxLength={180}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              )}
            </Field>

            {CAMPOS_TEXTO.map((c) => (
              <Field
                key={c.campo}
                rotulo={c.titulo}
                dica={c.campo === "secureExample" ? "Markdown. Use ``` para blocos de código." : undefined}
              >
                {(props) => (
                  <Textarea
                    {...props}
                    rows={c.linhas}
                    value={(form[c.campo as ChaveTexto] as string | null) ?? ""}
                    onChange={(e) => setForm({ ...form, [c.campo]: e.target.value })}
                  />
                )}
              </Field>
            ))}

            <div className="flex gap-2">
              <Button type="submit" carregando={salvar.isPending}>
                Salvar
              </Button>
              <Button
                type="button"
                variant="secundario"
                onClick={() => {
                  setForm(paraFormulario(playbook));
                  setEditando(false);
                  setErro(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card>
          <PlaybookViewer playbook={playbook} />
        </Card>
      )}

      {playbook.provenance.clonedFromId && (
        <p className="text-xs text-fg-muted">
          Adaptado de{" "}
          <Link to={`/playbooks/${playbook.provenance.clonedFromId}`} className="text-accent-ink hover:underline">
            outro playbook do catálogo
          </Link>
          .
        </p>
      )}
    </div>
  );
}
