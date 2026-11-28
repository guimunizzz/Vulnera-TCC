/**
 * sidebar.tsx
 *
 * O QUE FAZ
 * Navegação principal agrupada por finalidade e filtrada por papel.
 * A marca e o indicador violeta seguem a prévia aprovada da barra lateral;
 * cores e estados continuam usando os tokens dos dois temas.
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
import { GRUPOS } from "./navegacao";
import "./sidebar.css";

export function Sidebar({ aoNavegar, embutida }: { aoNavegar?: () => void; embutida?: boolean }) {
  const papel = useAuthStore((s) => s.user?.role);
  const companyRole = useAuthStore((s) => s.user?.companyRole);
  const companyId = useAuthStore((s) => s.user?.companyId);
  const grupos = GRUPOS.map((grupo) => ({
    ...grupo,
    itens: grupo.itens.filter((item) => {
      const papelPermitido = !item.papeis || (papel && item.papeis.includes(papel));
      const empresaPermitida = !item.companyRoles || (companyId && item.companyRoles.some((role) => role === companyRole));
      return papelPermitido && empresaPermitida;
    }),
  })).filter((grupo) => grupo.itens.length > 0);

  return (
    <nav
      id="navegacao-principal"
      aria-label="Navegação principal"
      className={cn("app-sidebar", embutida && "app-sidebar--embedded")}
    >
      {!embutida && (
        <div className="app-sidebar-brand" role="img" aria-label="Vulnera Security">
          <span className="app-sidebar-mark" aria-hidden="true">V</span>
          <span className="app-sidebar-wordmark" aria-hidden="true">
            VULNERA
            <span className="app-sidebar-security">SECURITY</span>
          </span>
        </div>
      )}

      <div className="app-sidebar-scroll">
        {grupos.map((grupo) => (
          <section key={grupo.rotulo} className="app-sidebar-group" aria-label={grupo.rotulo}>
            <h2 className="app-sidebar-caption">{grupo.rotulo}</h2>
            <ul className="app-sidebar-list">
              {grupo.itens.map(({ icone: Icone, ...item }) => (
                <li key={item.para}>
                  <NavLink to={item.para} onClick={aoNavegar} className="app-sidebar-link" data-nav={item.para}>
                    {({ isActive }) => (
                      <>
                        <Icone size={18} strokeWidth={1.6} aria-hidden="true" focusable="false" />
                        <span>{item.rotulo}</span>
                        {item.novo && (
                          <span className="app-sidebar-new">new</span>
                        )}
                        {isActive && <span className="sr-only">(página atual)</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <WatchlistsFixadas aoNavegar={aoNavegar} />
      </div>

      {!embutida && (
        <div className="app-sidebar-footer">
          <span className="app-sidebar-footer-dot" aria-hidden="true" />
          <span>Vulnera · Security workspace</span>
        </div>
      )}
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
    <div className="app-sidebar-group">
      <h2 className="app-sidebar-caption">Watchlists</h2>

      <ul className="app-sidebar-list">
        {fixadas.data.map((q) => (
          <li key={q.id}>
            {/* Abrir é NAVEGAR: a listagem busca de novo, com o escopo de quem
                clicou. Não há resultado guardado em lugar nenhum. */}
            <NavLink
              to={`/findings?${q.queryString}`}
              onClick={aoNavegar}
              title={q.description ?? q.name}
              className="app-sidebar-link"
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
