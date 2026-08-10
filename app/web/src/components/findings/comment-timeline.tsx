/**
 * comment-timeline.tsx
 *
 * Thread de discussão paginada do finding. Qualquer ator com acesso de
 * leitura ao finding pode comentar (não é edição do finding em si — é canal
 * de comunicação, ver vulnerability-comment.service.ts no backend).
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vulnerabilityCommentsApi } from "../../lib/api/vulnerability-comments.api";
import { usersApi } from "../../lib/api/users.api";
import { useAuthStore } from "../../store/auth.store";
import { useApiError } from "../../hooks/use-api-error";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";

const PAGE_SIZE = 10;

export function CommentTimeline({ vulnerabilityId }: { vulnerabilityId: string }) {
  const [content, setContent] = useState("");
  const [page, setPage] = useState(1);
  const currentUser = useAuthStore((s) => s.user);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["vulnerabilities", vulnerabilityId, "comments", page],
    queryFn: () => vulnerabilityCommentsApi.list(vulnerabilityId, page, PAGE_SIZE),
  });
  // lista de usuários já vem escopada por role no backend (ADMIN vê todos,
  // CLIENT só a própria company, PENTESTER só ele mesmo) — autor fora do
  // escopo cai no fallback "Usuário" abaixo.
  const { data: users } = useQuery({ queryKey: ["users"], queryFn: usersApi.list });

  const authorName = (authorId: string): string =>
    authorId === currentUser?.id ? "Você" : (users?.find((u) => u.id === authorId)?.name ?? "Usuário");

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["vulnerabilities", vulnerabilityId, "comments"] });
  };

  const createMutation = useMutation({
    mutationFn: () => vulnerabilityCommentsApi.create(vulnerabilityId, content),
    onSuccess: () => {
      setContent("");
      setPage(1);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => vulnerabilityCommentsApi.delete(vulnerabilityId, commentId),
    onSuccess: invalidate,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {data?.items.length === 0 && <p className="text-sm text-fg-muted">Nenhum comentário ainda.</p>}
        {data?.items.map((comment) => (
          <div key={comment.id} className="rounded-control bg-canvas p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-fg">{authorName(comment.authorId)}</span>
              <div className="flex items-center gap-2 text-xs text-fg-muted">
                <span>{new Date(comment.createdAt).toLocaleString("pt-BR")}</span>
                {(currentUser?.role === "ADMIN" || comment.authorId === currentUser?.id) && (
                  <button
                    onClick={() => deleteMutation.mutate(comment.id)}
                    className="text-severity-critical-ink hover:underline"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-fg">{comment.content}</p>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button variant="secundario" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-fg-muted">
            {page} / {totalPages}
          </span>
          <Button variant="secundario" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (content.trim()) createMutation.mutate();
        }}
      >
        <Textarea placeholder="Escreva um comentário..." value={content} onChange={(e) => setContent(e.target.value)} />
        {createMutation.isError && (
          <p className="text-xs text-severity-critical-ink">{getErrorMessage(createMutation.error)}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={!content.trim() || createMutation.isPending}>
            {createMutation.isPending ? "Enviando..." : "Comentar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
