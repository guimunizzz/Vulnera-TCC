/**
 * navegacao.ts
 *
 * Os grupos e itens de navegação da área autenticada, num módulo próprio: a
 * barra lateral desenha e a paleta de comandos (Ctrl+K, ADR-062) busca nos
 * mesmos itens, com os mesmos papéis. Fora do arquivo do componente para o
 * fast refresh do Vite continuar funcionando.
 */

import { CalendarClock, Clock3, FileCode2, FileText, Folder, Inbox, LayoutDashboard, ListTodo, Monitor, Network, Radar, Scale, ScanLine, Search, ShieldCheck, UserPlus, Users, type LucideIcon } from "lucide-react";
import type { UserRole } from "../../types/auth.types";

type CompanyRole = "OWNER" | "MEMBER";

export interface ItemNav {
  para: string;
  rotulo: string;
  icone: LucideIcon;
  /** Se definido, só esses papéis veem o item. */
  papeis?: UserRole[];
  /** Exige também vínculo empresarial com um dos papéis definidos. */
  companyRoles?: CompanyRole[];
  /**
   * Selo "new" no canto do item. Fixo de propósito (decisão de 2026-11-13):
   * some quando alguém tirar daqui, não por visita — previsível na demo.
   */
  novo?: boolean;
}

export interface GrupoNav {
  rotulo: string;
  itens: ItemNav[];
}

export const GRUPOS: GrupoNav[] = [
  {
    rotulo: "Visão geral",
    itens: [{ para: "/dashboard", rotulo: "Dashboard", icone: LayoutDashboard }],
  },
  {
    rotulo: "Operação",
    itens: [
      { para: "/applications", rotulo: "Aplicações", papeis: ["ADMIN", "CLIENT"], icone: Monitor },
      { para: "/exposure-graph", rotulo: "Exposure Graph", papeis: ["ADMIN", "CLIENT"], icone: Network },
      // ADR-063 — requisitos de LGPD, ISO 27001 e NIST CSF em risco pelas vulnerabilidades abertas.
      { para: "/conformidade", rotulo: "Conformidade", papeis: ["ADMIN", "CLIENT"], icone: Scale, novo: true },
      // Threat Intel (ADR-053): os três papéis — o que cada um pode fazer em cada empresa a API decide.
      { para: "/threat-intel", rotulo: "Threat Intel", icone: Radar, novo: true },
      { para: "/projects", rotulo: "Projetos", icone: Folder },
      // ADR-062 — caixa de triagem única (DAST, SAST/SCA, Threat Intel). Os três papéis; o conteúdo é o que cada um pode triar.
      { para: "/triagem", rotulo: "Triagem", icone: Inbox, novo: true },
      // Os papéis são os mesmos das rotas; agrupar não amplia o acesso.
      { para: "/findings", rotulo: "Findings", papeis: ["ADMIN", "PENTESTER"], icone: Search },
      { para: "/remediation", rotulo: "Remediação", papeis: ["ADMIN", "PENTESTER"], icone: ShieldCheck },
      { para: "/dast", rotulo: "DAST", papeis: ["ADMIN", "PENTESTER"], icone: ScanLine },
      // ADR-052 — importação de relatórios SAST (SARIF) e SCA (CycloneDX).
      { para: "/sast-sca", rotulo: "SAST/SCA", papeis: ["ADMIN", "PENTESTER"], icone: FileCode2, novo: true },
      // ADR-056 — scans DAST agendados. Os três papéis: o CLIENT acompanha os da própria empresa, sem editar.
      { para: "/agendamentos", rotulo: "Agendamentos", icone: CalendarClock, novo: true },
      { para: "/playbooks", rotulo: "Playbooks", icone: FileText },
    ],
  },
  {
    rotulo: "Administração",
    itens: [
      { para: "/settings/sla", rotulo: "Políticas de SLA", papeis: ["ADMIN", "CLIENT"], icone: Clock3 },
      { para: "/admin/access-requests", rotulo: "Central de solicitações", papeis: ["ADMIN"], icone: UserPlus },
      // ADR-056 — painel de filas (contagens e falhas do BullMQ). Só ADMIN, como a rota.
      { para: "/admin/filas", rotulo: "Filas", papeis: ["ADMIN"], icone: ListTodo, novo: true },
    ],
  },
  {
    rotulo: "Empresa",
    itens: [{ para: "/team", rotulo: "Minha equipe", papeis: ["CLIENT"], companyRoles: ["OWNER", "MEMBER"], icone: Users }],
  },
];

/** Os itens que um papel enxerga (a mesma regra da barra lateral). */
export function itensDoPapel(
  papel: UserRole | undefined,
  companyRole?: string | null,
  companyId?: string | null,
): ItemNav[] {
  return GRUPOS.flatMap((g) => g.itens).filter((item) => {
    const papelPermitido = !item.papeis || (papel !== undefined && item.papeis.includes(papel));
    const empresaPermitida = !item.companyRoles || (!!companyId && item.companyRoles.some((role) => role === companyRole));
    return papelPermitido && empresaPermitida;
  });
}
