/**
 * sidebar.tsx
 *
 * O QUE FAZ
 * Navegação principal, filtrada por papel.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - `<nav aria-label="Navegação principal">` — nomeada, porque uma página
 *     pode ter várias `<nav>` (esta, a trilha, a paginação) e sem nome o leitor
 *     de tela anuncia três "navegação" indistinguíveis.
 *   - O item ativo leva `aria-current="page"`, não só cor de fundo.
 *   - Ícones `aria-hidden`; o texto é o nome acessível.
 *
 * QUEM USA
 * `AppLayout`, nas duas formas: fixa em telas largas e dentro do `Drawer` em
 * telas estreitas (`embutida`).
 */

import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { cn } from "../../lib/cn";
import { useAuthStore } from "../../store/auth.store";
import { savedQueriesApi } from "../../lib/api/saved-queries.api";
import type { UserRole } from "../../types/auth.types";

interface ItemNav {
  para: string;
  rotulo: string;
  icone: JSX.Element;
  /** Se definido, só esses papéis veem o item. */
  papeis?: UserRole[];
}

const ITENS: ItemNav[] = [
  {
    para: "/dashboard",
    rotulo: "Dashboard",
    icone: <path d="M2 2h5v5H2V2Zm7 0h5v3H9V2ZM2 9h5v5H2V9Zm7-2h5v7H9V7Z" />,
  },
  {
    para: "/applications",
    rotulo: "Aplicações",
    papeis: ["ADMIN", "CLIENT"],
    icone: <path d="M2 3.5h12v9H2v-9Zm1.5 1.5v6h9V5h-9Z" />,
  },
  {
    para: "/projects",
    rotulo: "Projetos",
    icone: <path d="M2 4h4l1 1.5h7V13H2V4Z" />,
  },
  {
    // Varredura entre projetos — ferramenta de quem analisa. O CLIENT não vê
    // o item e é barrado na rota; ver o comentário em `App.tsx`.
    para: "/findings",
    rotulo: "Findings",
    papeis: ["ADMIN", "PENTESTER"],
    icone: <path d="M7 2a5 5 0 1 0 3.1 8.9l3 3 1.4-1.4-3-3A5 5 0 0 0 7 2Zm0 1.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z" />,
  },
  {
    // SLA de remediação (CP-2) — governança da empresa. PENTESTER não define
    // prazo de ninguém; CLIENT OWNER define o da sua; ADMIN, de qualquer uma.
    para: "/settings/sla",
    rotulo: "SLA",
    papeis: ["ADMIN", "CLIENT"],
    icone: <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm-.75 2v3.6l2.6 1.55.75-1.3-1.85-1.1V5h-1.5Z" />,
  },
  {
    para: "/admin/subscriptions",
    rotulo: "Aprovações",
    papeis: ["ADMIN"],
    icone: <path d="M8 1.5 14 5v6l-6 3.5L2 11V5l6-3.5Zm-.8 8.7 4-4.2-1-1-3 3.2-1.4-1.5-1 1 2.4 2.5Z" />,
  },
  {
    // Quadro de remediação (CP-7) — operação do dia a dia de quem corrige.
    // Mover e atribuir são escrita em finding: mesmo recorte da listagem.
    para: "/remediation",
    rotulo: "Remediação",
    papeis: ["ADMIN", "PENTESTER"],
    icone: <path d="M2 2h3.5v12H2V2Zm4.5 0H10v8H6.5V2Zm4.5 0h3.5v5H11V2Z" />,
  },
  {
    // Catálogo de remediação (CP-5). Todos os papéis leem: o CLIENT precisa
    // saber o que foi pedido para corrigir, e o catálogo System é global.
    para: "/playbooks",
    rotulo: "Playbooks",
    icone: <path d="M3 2h7l3 3v9H3V2Zm1.5 1.5v9h7V6H9.5V3.5h-5Zm1.5 4h5V9H6V7.5Zm0 2.5h5v1.5H6V10Z" />,
  },
  {
    para: "/dast",
    rotulo: "DAST",
    papeis: ["ADMIN", "PENTESTER"],
    icone: <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm-.75 2v3h3v-1.5H8.75V5.5h-1.5Z" />,
  },
];

export function Sidebar({ aoNavegar, embutida }: { aoNavegar?: () => void; embutida?: boolean }) {
  const papel = useAuthStore((s) => s.user?.role);
  const itens = ITENS.filter((i) => !i.papeis || (papel && i.papeis.includes(papel)));

  return (
    <nav
      id="navegacao-principal"
      aria-label="Navegação principal"
      className={cn(
        "flex flex-col gap-1",
        !embutida && "h-dvh w-56 shrink-0 border-r border-subtle bg-surface p-4",
      )}
    >
      {!embutida && (
        <span className="mb-6 px-3 text-lg font-bold tracking-tight text-accent-ink">Vulnera</span>
      )}

      {itens.map((item) => (
        <NavLink
          key={item.para}
          to={item.para}
          onClick={aoNavegar}
          // `aria-current="page"` é o que comunica "você está aqui" para quem
          // não vê a cor de fundo.
          className={({ isActive }) =>
            cn(
              "flex min-h-touch items-center gap-3 rounded-control px-3 py-2 text-sm",
              "transition-colors duration-fast ease-out",
              isActive ? "bg-accent-surface font-medium text-accent-ink" : "text-fg-muted hover:bg-hovered hover:text-fg",
            )
          }
        >
          {({ isActive }) => (
            <>
              <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                {item.icone}
              </svg>
              <span>{item.rotulo}</span>
              {isActive && <span className="sr-only">(página atual)</span>}
            </>
          )}
        </NavLink>
      ))}

      <WatchlistsFixadas aoNavegar={aoNavegar} />
    </nav>
  );
}

/**
 * Os atalhos fixados (CP-6).
 *
 * 🎯 SÓ OS FIXADOS, E COM TETO. A API já limita quantos cada pessoa pode
 * fixar; pedir `pinned=true` é o que mantém a barra lateral navegável quando
 * alguém tem cinquenta buscas salvas. As demais ficam na própria tela de
 * findings, que é onde uma lista longa faz sentido.
 *
 * Silenciosa quando não há nada: um cabeçalho "Watchlists" acima do vazio só
 * ocuparia espaço para dizer que não há nada.
 */
function WatchlistsFixadas({ aoNavegar }: { aoNavegar?: () => void }) {
  const fixadas = useQuery({
    queryKey: ["saved-queries", "pinned"],
    queryFn: () => savedQueriesApi.list(true),
    // Um erro aqui (sessão expirando, rede caindo) não pode derrubar a
    // navegação principal — a seção simplesmente não aparece.
    retry: false,
  });

  if (!fixadas.data || fixadas.data.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Watchlists</h2>

      <ul className="flex flex-col gap-1">
        {fixadas.data.map((q) => (
          <li key={q.id}>
            {/* Abrir é NAVEGAR: a listagem busca de novo, com o escopo de quem
                clicou. Não há resultado guardado em lugar nenhum. */}
            <NavLink
              to={`/findings?${q.queryString}`}
              onClick={aoNavegar}
              title={q.description ?? q.name}
              className={({ isActive }) =>
                cn(
                  "flex min-h-touch items-center gap-2 rounded-control px-3 py-2 text-sm",
                  "transition-colors duration-fast ease-out",
                  isActive ? "bg-accent-surface font-medium text-accent-ink" : "text-fg-muted hover:bg-hovered hover:text-fg",
                )
              }
            >
              <span aria-hidden="true" className="text-xs">
                ◆
              </span>
              <span className="truncate">{q.name}</span>
              {q.scope === "COMPANY" && <span className="sr-only">(compartilhada com a empresa)</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
