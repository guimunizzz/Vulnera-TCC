/**
 * comentarios-do-no.tsx
 *
 * O QUE FAZ
 * O fio de comentários de um nó do grafo (ADR-061): a conversa em ordem, o
 * campo para comentar e "apagar" para o autor (ou ADMIN). Quem já comentou
 * no nó recebe aviso pelo sino quando chega comentário novo (backend).
 *
 * DADOS
 * A página busca os comentários do GRAFO inteiro uma vez (também alimentam o
 * selo de contagem nos nós); este componente recebe só os do nó e invalida a
 * mesma consulta depois de criar ou apagar.
 *
 * QUEM USA
 * O painel do Exposure Graph e o painel de detalhes do CyberGraph do scan.
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { useApiError } from "../../hooks/use-api-error";
import { graphCommentsApi } from "../../lib/api/graph-comments.api";
import { haQuanto } from "../../lib/threat-intel";
import type { ComentarioDoGrafo, GrafoComentavel } from "../../types/graph-comment.types";
import { chaveDosComentarios } from "./comentarios";

const LIMITE = 2000;

export function ComentariosDoNo({
  grafo,
  escopo,
  noId,
  rotulo,
  comentarios,
}: {
  grafo: GrafoComentavel;
  escopo?: string;
  noId: string;
  /** Nome do nó como a tela mostra (vai na notificação). */
  rotulo: string;
  comentarios: ComentarioDoGrafo[];
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const mensagemDeErro = useApiError();
  const doNo = comentarios.filter((c) => c.nodeId === noId);
  const atualizar = () => queryClient.invalidateQueries({ queryKey: chaveDosComentarios(grafo, escopo) });

  const criar = useMutation({
    mutationFn: () => graphCommentsApi.criar({ grafo, escopo, noId, texto, rotulo }),
    onSuccess: () => {
      setTexto("");
      setErro(null);
      void atualizar();
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  });
  const apagar = useMutation({
    mutationFn: (id: string) => graphCommentsApi.apagar(id),
    onSuccess: () => void atualizar(),
    onError: (e) => setErro(mensagemDeErro(e)),
  });

  return (
    <section aria-label={`Comentários em ${rotulo}`} className="space-y-3 border-t border-subtle pt-4">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
        <MessageSquare className="h-4 w-4" aria-hidden="true" /> Comentários
        <span className="font-mono" data-numeric>
          {doNo.length}
        </span>
      </p>

      {doNo.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum comentário neste nó. Deixe contexto para o time: prazo, dono, decisão.</p>
      ) : (
        <ol className="space-y-2">
          {doNo.map((c) => (
            <li key={c.id} className="rounded-control border border-subtle bg-inset p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-fg-muted">
                  <span className="font-semibold text-fg">{c.autor.name}</span> · <time dateTime={c.createdAt}>{haQuanto(c.createdAt)}</time>
                </p>
                {c.podeApagar && (
                  <Button
                    variant="fantasma"
                    size="sm"
                    rotulo="Apagar comentário"
                    onClick={() => apagar.mutate(c.id)}
                    disabled={apagar.isPending}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
              {/* Texto puro: o React escapa; quebra de linha preservada pelo CSS. */}
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fg">{c.body}</p>
            </li>
          ))}
        </ol>
      )}

      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim()) criar.mutate();
        }}
      >
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={LIMITE}
          mostrarContador
          maxLinhas={6}
          rows={2}
          placeholder="Comentar neste nó…"
          aria-label={`Novo comentário em ${rotulo}`}
        />
        {erro && (
          <p role="alert" className="text-sm text-danger-ink">
            {erro}
          </p>
        )}
        <Button type="submit" size="sm" carregando={criar.isPending} disabled={!texto.trim()}>
          Comentar
        </Button>
      </form>
    </section>
  );
}
