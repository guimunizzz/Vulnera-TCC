/**
 * paleta-de-comandos.tsx
 *
 * O QUE FAZ
 * A paleta de comandos (Ctrl+K / ⌘K, ADR-062), à la Linear e VS Code: de
 * qualquer tela, ir para uma seção, executar uma ação (tema, nova análise,
 * apresentar o Dashboard, abrir a triagem) ou achar uma aplicação, um projeto
 * ou uma vulnerabilidade pelo nome.
 *
 * ACESSO
 * Nada aqui amplia permissão: a navegação usa os mesmos itens e papéis da barra
 * lateral (`navegacao.ts`), as ações respeitam os papéis das rotas e a busca
 * usa as APIs de lista que o papel já tem (a API filtra o escopo).
 *
 * ACESSIBILIDADE
 * Padrão combobox + listbox: o campo mantém o foco, ↑↓ mudam a opção ativa
 * (`aria-activedescendant`), Enter executa, Esc fecha (o Dialog). O atalho
 * abre de qualquer lugar, inclusive de dentro de um campo.
 *
 * QUEM USA
 * `AppLayout` (montada uma vez, com o botão "Buscar" do cabeçalho).
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Search } from "lucide-react";
import { Dialog, DialogTitle } from "../ui/dialog";
import { useTheme } from "../../design/theme-provider";
import { useAuthStore } from "../../store/auth.store";
import { applicationsApi } from "../../lib/api/applications.api";
import { projectsApi } from "../../lib/api/projects.api";
import { vulnerabilitiesApi } from "../../lib/api/vulnerabilities.api";
import { filtrarComandos, type Comando } from "../../lib/paleta";
import { cn } from "../../lib/cn";
import { itensDoPapel } from "./navegacao";

const ESPERA_DA_BUSCA_MS = 200;
/** Id da área de conteúdo do layout (modo apresentação do Dashboard). */
const CONTEUDO = "conteudo";

/** Atalho global: Ctrl+K (⌘K no Mac) abre e fecha. */
function useAtalhoDaPaleta(alternar: () => void) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        alternar();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [alternar]);
}

export function PaletaDeComandos({ aberta, aoMudar }: { aberta: boolean; aoMudar(aberta: boolean): void }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const papel = user?.role;
  const { definirTema } = useTheme();
  const [consulta, setConsulta] = useState("");
  const [buscaAtrasada, setBuscaAtrasada] = useState("");
  const [ativo, setAtivo] = useState(0);
  const base = useId();
  const lista = useRef<HTMLUListElement>(null);

  useAtalhoDaPaleta(() => aoMudar(!aberta));

  // Ao abrir, começa do zero.
  useEffect(() => {
    if (!aberta) return;
    setConsulta("");
    setBuscaAtrasada("");
    setAtivo(0);
  }, [aberta]);

  useEffect(() => {
    const t = window.setTimeout(() => setBuscaAtrasada(consulta.trim()), ESPERA_DA_BUSCA_MS);
    return () => window.clearTimeout(t);
  }, [consulta]);

  const podeVerAplicacoes = papel === "ADMIN" || papel === "CLIENT";
  const aplicacoes = useQuery({ queryKey: ["applications"], queryFn: applicationsApi.list, enabled: aberta && podeVerAplicacoes, staleTime: 60_000 });
  const projetos = useQuery({ queryKey: ["projects"], queryFn: projectsApi.list, enabled: aberta, staleTime: 60_000 });
  const vulnerabilidades = useQuery({
    queryKey: ["paleta", "vulnerabilidades", buscaAtrasada],
    queryFn: () => vulnerabilitiesApi.search(new URLSearchParams({ search: buscaAtrasada, pageSize: "6", sortBy: "severity", sortOrder: "desc" })),
    enabled: aberta && buscaAtrasada.length >= 2,
    staleTime: 30_000,
  });

  const executar = (acao: () => void) => () => {
    aoMudar(false);
    acao();
  };

  const comandos = useMemo<Comando[]>(() => {
    const ir = (para: string) => executar(() => navigate(para));
    const lista: Comando[] = itensDoPapel(papel, user?.companyRole, user?.companyId).map((item) => ({
      id: `ir:${item.para}`,
      grupo: "Ir para",
      rotulo: item.rotulo,
      palavrasChave: [item.para.replace(/\//g, " ")],
      executar: ir(item.para),
    }));
    if (papel === "ADMIN" || papel === "CLIENT") {
      lista.push({ id: "acao:nova-analise", grupo: "Ações", rotulo: "Nova análise", palavrasChave: ["pedir", "pentest", "scan"], executar: ir("/new-analysis") });
    }
    lista.push(
      { id: "acao:triagem", grupo: "Ações", rotulo: "Triar o que chegou", palavrasChave: ["triagem", "caixa", "inbox"], executar: ir("/triagem") },
      {
        id: "acao:apresentar",
        grupo: "Ações",
        rotulo: "Apresentar o Dashboard",
        detalhe: "tela cheia",
        palavrasChave: ["apresentação", "tela cheia", "fullscreen"],
        // O Enter que escolheu o comando é o gesto que o navegador exige para a tela cheia.
        executar: executar(() => {
          navigate("/dashboard");
          void document.getElementById(CONTEUDO)?.requestFullscreen().catch(() => undefined);
        }),
      },
      { id: "acao:tema-escuro", grupo: "Ações", rotulo: "Tema escuro", palavrasChave: ["dark", "aparência"], executar: executar(() => definirTema("dark")) },
      { id: "acao:tema-claro", grupo: "Ações", rotulo: "Tema claro", palavrasChave: ["light", "aparência"], executar: executar(() => definirTema("light")) },
      { id: "acao:tema-sistema", grupo: "Ações", rotulo: "Tema do sistema", palavrasChave: ["system", "aparência", "automático"], executar: executar(() => definirTema("system")) },
    );
    for (const app of aplicacoes.data ?? []) {
      lista.push({ id: `app:${app.id}`, grupo: "Aplicações", rotulo: app.name, detalhe: app.environment, executar: ir(`/applications/${app.id}/dashboard`) });
    }
    for (const p of projetos.data ?? []) {
      lista.push({ id: `projeto:${p.id}`, grupo: "Projetos", rotulo: p.name, executar: ir(`/projects/${p.id}`) });
    }
    for (const v of vulnerabilidades.data?.data ?? []) {
      // Já veio filtrada pela API (título): a palavra-chave garante que passe no filtro local.
      lista.push({ id: `vuln:${v.id}`, grupo: "Vulnerabilidades", rotulo: v.title, detalhe: `${v.severityFinal} · ${v.applicationName}`, palavrasChave: [buscaAtrasada], executar: ir(`/findings/${v.id}`) });
    }
    return lista;
    // `executar` e `ir` são recriados a cada render; o que muda a lista são os dados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papel, user?.companyRole, user?.companyId, aplicacoes.data, projetos.data, vulnerabilidades.data, buscaAtrasada, navigate, definirTema]);

  // Sem consulta, a paleta mostra navegação e ações; entidades só quando se busca.
  const visiveis = useMemo(() => {
    const candidatos = consulta.trim() ? comandos : comandos.filter((c) => c.grupo === "Ir para" || c.grupo === "Ações");
    return filtrarComandos(candidatos, consulta, consulta.trim() ? 6 : 20);
  }, [comandos, consulta]);

  useEffect(() => setAtivo(0), [consulta]);
  const ativoLimitado = Math.min(ativo, Math.max(0, visiveis.length - 1));

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${ativoLimitado}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativoLimitado]);

  const aoTeclar = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((i) => Math.min(visiveis.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      visiveis[ativoLimitado]?.executar();
    }
  };

  const idLista = `${base}-lista`;
  const idOpcao = (i: number) => `${base}-opcao-${i}`;

  return (
    <Dialog aberto={aberta} aoFechar={() => aoMudar(false)} tamanho="lg" className="p-0">
      <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-3">
        <Search className="h-5 w-5 shrink-0 text-fg-muted" aria-hidden="true" />
        <input
          autoFocus
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={aoTeclar}
          role="combobox"
          aria-expanded="true"
          aria-controls={idLista}
          aria-activedescendant={visiveis.length ? idOpcao(ativoLimitado) : undefined}
          aria-autocomplete="list"
          aria-label="Buscar comando, seção, aplicação, projeto ou vulnerabilidade"
          placeholder="Ir para, executar ou buscar…"
          className="w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
        />
        <kbd className="hidden rounded border border-subtle bg-inset px-[0.375rem] font-mono text-xs text-fg-muted sm:inline">Esc</kbd>
      </div>

      <ul ref={lista} id={idLista} role="listbox" aria-label="Resultados" className="max-h-[22rem] overflow-y-auto p-2">
        {visiveis.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-fg-muted">
            {vulnerabilidades.isFetching ? "Buscando…" : "Nada encontrado com esse nome."}
          </li>
        ) : (
          visiveis.map((c, i) => {
            const novoGrupo = i === 0 || visiveis[i - 1].grupo !== c.grupo;
            return (
              <li key={c.id} role="presentation">
                {novoGrupo && (
                  <p role="presentation" className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-fg-muted first:pt-1">
                    {c.grupo}
                  </p>
                )}
                <div
                  id={idOpcao(i)}
                  data-indice={i}
                  role="option"
                  aria-selected={i === ativoLimitado}
                  onMouseMove={() => setAtivo(i)}
                  onClick={c.executar}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-control px-3 py-2 text-sm",
                    i === ativoLimitado ? "bg-accent-surface text-fg" : "text-fg-secondary",
                  )}
                >
                  <span className="truncate">{c.rotulo}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-fg-muted">
                    {c.detalhe}
                    {i === ativoLimitado && <CornerDownLeft className="h-[0.875rem] w-[0.875rem]" aria-hidden="true" />}
                  </span>
                </div>
              </li>
            );
          })
        )}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-subtle px-4 py-2 text-[11px] text-fg-muted">
        <span>
          <kbd className="font-mono">↑↓</kbd> navegar
        </span>
        <span>
          <kbd className="font-mono">Enter</kbd> abrir
        </span>
        <span>
          <kbd className="font-mono">Ctrl K</kbd> abre de qualquer tela
        </span>
      </p>
    </Dialog>
  );
}
