/**
 * evidence-uploader.tsx
 *
 * Drag-drop multi-arquivo com preview local (antes do upload) e barra de
 * progresso por arquivo (Axios onUploadProgress). Lista as evidências já
 * enviadas com download autenticado (blob — nunca token em query string).
 * Read-only (sem a zona de drop) quando canUpload=false — é o caso do CLIENT.
 */

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { evidencesApi } from "../../lib/api/evidences.api";
import { useApiError } from "../../hooks/use-api-error";
import { cn } from "../../lib/cn";
import { Progress } from "../ui/progress";
import type { Evidence } from "../../types/evidence.types";

interface QueuedFile {
  id: string;
  file: File;
  previewUrl?: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

const MIME_ICON: Record<string, string> = {
  "image/png": "🖼️",
  "image/jpeg": "🖼️",
  "application/pdf": "📄",
  "text/plain": "📝",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidenceUploader({ vulnerabilityId, canUpload }: { vulnerabilityId: string; canUpload: boolean }) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getErrorMessage = useApiError();
  const queryClient = useQueryClient();

  const { data: evidences } = useQuery({
    queryKey: ["vulnerabilities", vulnerabilityId, "evidences"],
    queryFn: () => evidencesApi.list(vulnerabilityId),
  });

  function uploadFiles(files: FileList | File[]): void {
    Array.from(files).forEach((file) => {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      setQueue((prev) => [...prev, { id, file, previewUrl, progress: 0, status: "uploading" }]);

      evidencesApi
        .upload(vulnerabilityId, file, "", (percent) => {
          setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, progress: percent } : q)));
        })
        .then(() => {
          setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, status: "done", progress: 100 } : q)));
          void queryClient.invalidateQueries({ queryKey: ["vulnerabilities", vulnerabilityId, "evidences"] });
        })
        .catch((err: unknown) => {
          setQueue((prev) =>
            prev.map((q) => (q.id === id ? { ...q, status: "error", error: getErrorMessage(err) } : q)),
          );
        });
    });
  }

  async function handleDownload(evidence: Evidence): Promise<void> {
    const blob = await evidencesApi.download(vulnerabilityId, evidence.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = evidence.originalName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "cursor-pointer rounded-container border-2 border-dashed border-subtle p-6 text-center text-sm text-fg-muted transition-colors hover:border-accent hover:text-fg",
            isDragging && "border-accent bg-accent/5 text-fg",
          )}
        >
          Arraste arquivos aqui ou clique para selecionar
          <div className="mt-1 text-xs text-fg-muted">PNG, JPEG, PDF ou TXT · até 10MB cada</div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {queue.length > 0 && (
        <div className="flex flex-col gap-2">
          {queue.map((q) => (
            <div key={q.id} className="flex items-center gap-3 rounded-control border border-subtle p-2">
              {q.previewUrl ? (
                <img src={q.previewUrl} alt={q.file.name} className="h-10 w-10 rounded object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded bg-canvas text-lg">
                  {MIME_ICON[q.file.type] ?? "📎"}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-fg">{q.file.name}</div>
                {q.status === "uploading" && <Progress rotulo="Progresso do envio" valor={q.progress} className="mt-1" />}
                {q.status === "error" && <p className="mt-1 text-xs text-severity-critical-ink">{q.error}</p>}
                {q.status === "done" && <p className="mt-1 text-xs text-severity-low">Enviado</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {evidences?.length === 0 && <p className="text-sm text-fg-muted">Nenhuma evidência anexada ainda.</p>}
        {evidences?.map((evidence) => (
          <div
            key={evidence.id}
            className="flex items-center justify-between rounded-control bg-canvas px-3 py-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span>{MIME_ICON[evidence.mimeType] ?? "📎"}</span>
              <span className="truncate text-fg">{evidence.originalName}</span>
              <span className="shrink-0 text-xs text-fg-muted">{formatBytes(evidence.sizeBytes)}</span>
            </div>
            <button onClick={() => handleDownload(evidence)} className="shrink-0 text-accent-ink hover:underline">
              Baixar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
