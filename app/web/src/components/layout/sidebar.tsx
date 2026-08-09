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
import { cn } from "../../lib/cn";
import { useAuthStore } from "../../store/auth.store";
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
    para: "/admin/subscriptions",
    rotulo: "Aprovações",
    papeis: ["ADMIN"],
    icone: <path d="M8 1.5 14 5v6l-6 3.5L2 11V5l6-3.5Zm-.8 8.7 4-4.2-1-1-3 3.2-1.4-1.5-1 1 2.4 2.5Z" />,
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
    </nav>
  );
}
