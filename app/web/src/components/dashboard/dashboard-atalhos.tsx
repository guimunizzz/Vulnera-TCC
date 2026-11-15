/**
 * dashboard-atalhos.tsx
 *
 * O QUE FAZ
 * Bloco "Continue seu trabalho": atalhos para as áreas de operação que o
 * papel pode abrir.
 *
 * POR QUE EXISTE
 * Proposta da Fase 5 do refactor web-motion-3d. A lista espelha as rotas
 * protegidas de `App.tsx` — Aplicações é ADMIN/CLIENT, DAST é
 * ADMIN/PENTESTER — para nunca oferecer um atalho que termina em 403.
 *
 * QUEM USA
 * `pages/dashboard-page.tsx`.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Folder, Monitor, Radar, Search, type LucideIcon } from "lucide-react";
import type { UserRole } from "../../types/auth.types";

interface Atalho {
  rotulo: string;
  to: string;
  Icone: LucideIcon;
  papeis: UserRole[];
}

const ATALHOS: Atalho[] = [
  { rotulo: "Aplicações", to: "/applications", Icone: Monitor, papeis: ["ADMIN", "CLIENT"] },
  { rotulo: "Projetos", to: "/projects", Icone: Folder, papeis: ["ADMIN", "CLIENT", "PENTESTER"] },
  { rotulo: "Findings", to: "/findings", Icone: Search, papeis: ["ADMIN", "CLIENT", "PENTESTER"] },
  { rotulo: "DAST", to: "/dast", Icone: Radar, papeis: ["PENTESTER"] },
];

export function DashboardAtalhos({ role }: { role?: UserRole }) {
  if (!role) return null;
  const atalhos = ATALHOS.filter((a) => a.papeis.includes(role));

  return (
    <nav aria-labelledby="dashboard-atalhos" className="rounded-container border border-subtle bg-surface p-4 shadow-raised sm:p-5">
      <h2 id="dashboard-atalhos" className="text-sm font-semibold text-fg">Continue seu trabalho</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        {atalhos.map(({ rotulo, to, Icone }) => (
          <li key={to}>
            <Link
              to={to}
              className="group flex items-center gap-3 rounded-control border border-subtle bg-inset px-4 py-3 text-sm font-medium text-fg transition-colors duration-fast hover:border-strong hover:bg-hovered focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Icone className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
              <span className="flex-1">{rotulo}</span>
              <ArrowRight
                className="h-4 w-4 text-fg-muted transition-transform duration-fast group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
