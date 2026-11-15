/**
 * notification-bell.tsx
 *
 * O sino do topo (ADR-053, D19.6): quantas notificações não lidas e a lista
 * das mais recentes. Abrir uma notificação marca como lida e leva para onde
 * ela aponta (ex.: a CVE na aba "Afeta você" da Threat Intel).
 *
 * A contagem é consultada a cada 60 s (só ela, que é barata); a lista só é
 * buscada quando o painel abre. O número também vai no rótulo do botão — a
 * bolinha vermelha sozinha não diz nada a quem usa leitor de tela.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { notificationsApi } from "../../lib/api/threat-intel.api";
import { Button } from "../ui/button";
import { Popover } from "../ui/popover";
import { cn } from "../../lib/cn";
import type { Notificacao } from "../../types/threat-intel.types";

const INTERVALO_MS = 60_000;

function quando(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);

  const contagem = useQuery({ queryKey: ["notifications", "unread"], queryFn: notificationsApi.unreadCount, refetchInterval: INTERVALO_MS });
  const lista = useQuery({ queryKey: ["notifications", "list"], queryFn: () => notificationsApi.list(), enabled: aberto });
  const naoLidas = contagem.data?.naoLidas ?? 0;

  const atualizar = () => void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const lerUma = useMutation({ mutationFn: (id: string) => notificationsApi.markRead(id), onSettled: atualizar });
  const lerTodas = useMutation({ mutationFn: () => notificationsApi.markAllRead(), onSettled: atualizar });

  function abrir(n: Notificacao) {
    if (!n.isRead) lerUma.mutate(n.id);
    setAberto(false);
    // Só rota interna ("/x", nunca "//host"): o link vem da API, mas a tela não confia nele para sair do app.
    if (n.link && /^\/(?!\/)/.test(n.link)) navigate(n.link);
  }

  return (
    <Popover
      aberto={aberto}
      aoMudarAberto={setAberto}
      alinhamento="end"
      rotulo="Notificações"
      className="w-[22rem] max-w-[calc(100vw-2rem)]"
      gatilho={
        <Button variant="fantasma" size="sm" rotulo={naoLidas > 0 ? `Notificações: ${naoLidas} não lida${naoLidas === 1 ? "" : "s"}` : "Notificações"} className="relative">
          <Bell size={18} aria-hidden="true" />
          {naoLidas > 0 && (
            <span aria-hidden="true" className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-danger-fg">
              {naoLidas > 99 ? "99+" : naoLidas}
            </span>
          )}
        </Button>
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-subtle px-4 py-3">
        <p className="text-sm font-semibold text-fg">Notificações</p>
        <Button variant="fantasma" size="sm" disabled={naoLidas === 0 || lerTodas.isPending} onClick={() => lerTodas.mutate()}>
          <CheckCheck size={14} aria-hidden="true" /> Marcar todas como lidas
        </Button>
      </div>
      <div className="max-h-[24rem] overflow-y-auto">
        {lista.isLoading ? (
          <p className="px-4 py-6 text-sm text-fg-muted">Carregando...</p>
        ) : lista.isError ? (
          <p className="px-4 py-6 text-sm text-fg-muted">Não foi possível carregar as notificações.</p>
        ) : (lista.data?.data.length ?? 0) === 0 ? (
          <p className="px-4 py-6 text-sm text-fg-muted">Nada por aqui. Quando uma CVE nova afetar o inventário, ela aparece neste sino.</p>
        ) : (
          <ul aria-label="Notificações recentes">
            {lista.data!.data.map((n) => (
              <li key={n.id} className="border-b border-subtle last:border-b-0">
                <button
                  type="button"
                  onClick={() => abrir(n)}
                  className={cn("flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors duration-fast hover:bg-inset", !n.isRead && "bg-accent-surface")}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className={cn("text-sm text-fg", !n.isRead && "font-semibold")}>{n.title}</span>
                    {!n.isRead && <span className="sr-only">(não lida)</span>}
                    <span className="shrink-0 text-xs text-fg-muted">{quando(n.createdAt)}</span>
                  </span>
                  <span className="text-xs text-fg-muted">{n.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Popover>
  );
}
