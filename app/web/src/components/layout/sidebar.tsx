import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { useAuthStore } from "../../store/auth.store";
import type { UserRole } from "../../types/auth.types";

interface NavItem {
  to: string;
  label: string;
  /** Se definido, só esses roles veem o item — senão, qualquer autenticado vê. */
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/applications", label: "Aplicações", roles: ["ADMIN", "CLIENT"] },
  { to: "/projects", label: "Projetos" },
  { to: "/admin/subscriptions", label: "Aprovações", roles: ["ADMIN"] },
];

export function Sidebar() {
  const role = useAuthStore((s) => s.user?.role);
  const items = NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface p-4">
      <span className="mb-6 text-lg font-bold text-accent">Vulnera</span>
      <nav className="flex flex-col gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-border hover:text-foreground",
                isActive && "bg-border text-foreground",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
