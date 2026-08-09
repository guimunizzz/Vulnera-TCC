/**
 * table.tsx
 *
 * O QUE FAZ
 * Tabela de dados com ordenação, seleção de linhas e primeira coluna fixa.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * ROLE / ARIA
 *   - `<table>` NATIVA com `<caption>`. Nada de `role="grid"` sobre `<div>`: o
 *     leitor de tela precisa do modo tabela para anunciar "linha 3 de 40,
 *     coluna Severidade" enquanto a pessoa navega com Ctrl+Alt+setas, e isso só
 *     existe de graça na tabela nativa.
 *   - O `<caption>` é obrigatório e pode ser `.sr-only` — é ele que responde
 *     "tabela de quê?".
 *   - `<th scope="col">` em todo cabeçalho; `scope="row"` na coluna que
 *     identifica a linha. É o que amarra célula a cabeçalho na leitura.
 *   - `aria-sort="ascending" | "descending" | "none"` no `<th>` ordenado.
 *   - Seleção: checkbox por linha, com `aria-label` citando a linha ("Selecionar
 *     SQL Injection em /search") — dez caixas anunciadas como "selecionar" são
 *     dez caixas indistinguíveis.
 *
 * TECLADO
 *   - Cabeçalho ordenável é um `<button>` dentro do `<th>`: Tab alcança,
 *     Enter/Espaço ordenam.
 *   - Nada de navegação por setas entre células: a tabela nativa já dá isso
 *     através do modo de tabela do leitor de tela, e capturar as setas
 *     ATRAPALHARIA esse modo.
 *
 * ORDENAÇÃO
 *   O estado de ordenação é anunciado por `aria-sort` e mostrado por seta.
 *   Nunca só pela seta.
 *
 * COLUNA FIXA
 *   `position: sticky` na primeira coluna. Em telas estreitas é o que mantém a
 *   identidade da linha visível enquanto se rola na horizontal — sem ela, uma
 *   tabela de findings rolada mostra números sem dizer de qual finding são.
 * ==========================================================================
 *
 * QUEM USA
 * Lista de findings, aplicações, projetos, comparativo entre aplicações (CP5).
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Checkbox } from "./checkbox";

export type DirecaoOrdem = "asc" | "desc";

export interface ColunaTabela<T> {
  id: string;
  cabecalho: ReactNode;
  /** Como desenhar a célula. */
  celula: (linha: T) => ReactNode;
  /** Presente = coluna ordenável. Devolve o valor comparável. */
  ordenarPor?: (linha: T) => string | number;
  /** Alinhamento — números vão à direita, para a vírgula alinhar. */
  alinhamento?: "esquerda" | "direita";
  /** Some abaixo de `md`. Use nas colunas secundárias. */
  ocultarEmTelaEstreita?: boolean;
  larguraClassName?: string;
}

export interface TableProps<T> {
  /** Descrição da tabela para leitor de tela. Obrigatória. */
  legenda: string;
  /** Mostrar a legenda visualmente (padrão: só para leitor de tela). */
  legendaVisivel?: boolean;
  colunas: ColunaTabela<T>[];
  linhas: T[];
  chaveDaLinha: (linha: T) => string;
  /** Nome legível da linha, usado no `aria-label` do checkbox de seleção. */
  rotuloDaLinha?: (linha: T) => string;
  /** Presente = habilita seleção. */
  selecionadas?: string[];
  aoMudarSelecao?: (ids: string[]) => void;
  /** Clique na linha inteira. */
  aoClicarLinha?: (linha: T) => void;
  /** Desenhado quando não há linhas. */
  vazio?: ReactNode;
  /** Fixa a primeira coluna na rolagem horizontal. */
  primeiraColunaFixa?: boolean;
  className?: string;
}

export function Table<T>({
  legenda,
  legendaVisivel,
  colunas,
  linhas,
  chaveDaLinha,
  rotuloDaLinha,
  selecionadas,
  aoMudarSelecao,
  aoClicarLinha,
  vazio,
  primeiraColunaFixa,
  className,
}: TableProps<T>) {
  const [ordem, setOrdem] = useState<{ coluna: string; direcao: DirecaoOrdem } | null>(null);
  const selecionavel = Boolean(selecionadas && aoMudarSelecao);

  const linhasOrdenadas = useMemo(() => {
    if (!ordem) return linhas;
    const col = colunas.find((c) => c.id === ordem.coluna);
    if (!col?.ordenarPor) return linhas;
    const fator = ordem.direcao === "asc" ? 1 : -1;
    // Cópia antes de ordenar: `sort` muda o array no lugar, e mutar o array que
    // veio do cache do TanStack Query provoca re-render fora de hora.
    return [...linhas].sort((a, b) => {
      const va = col.ordenarPor!(a);
      const vb = col.ordenarPor!(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * fator;
      // `localeCompare` com pt-BR: sem ele, "Ávila" cai depois de "Zurique".
      return String(va).localeCompare(String(vb), "pt-BR") * fator;
    });
  }, [linhas, colunas, ordem]);

  const alternarOrdem = useCallback((id: string) => {
    setOrdem((atual) => {
      if (atual?.coluna !== id) return { coluna: id, direcao: "asc" };
      // Terceiro clique REMOVE a ordenação e volta à ordem original. Sem isso
      // não há como desfazer uma ordenação a não ser recarregando.
      if (atual.direcao === "asc") return { coluna: id, direcao: "desc" };
      return null;
    });
  }, []);

  const todasSelecionadas = selecionavel && linhas.length > 0 && selecionadas!.length === linhas.length;
  const algumasSelecionadas = selecionavel && selecionadas!.length > 0 && !todasSelecionadas;

  if (linhas.length === 0 && vazio) return <>{vazio}</>;

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">
        <caption className={cn("py-2 text-left text-xs text-fg-muted", !legendaVisivel && "sr-only")}>{legenda}</caption>

        <thead>
          <tr className="border-b border-subtle">
            {selecionavel && (
              <th scope="col" className="w-12 px-3 py-2">
                <Checkbox
                  rotulo={<span className="sr-only">Selecionar todas as linhas</span>}
                  checked={todasSelecionadas}
                  indeterminado={algumasSelecionadas}
                  onChange={(e) => aoMudarSelecao!(e.target.checked ? linhas.map(chaveDaLinha) : [])}
                />
              </th>
            )}
            {colunas.map((c, i) => {
              const ordenadaPor = ordem?.coluna === c.id;
              return (
                <th
                  key={c.id}
                  scope="col"
                  aria-sort={ordenadaPor ? (ordem!.direcao === "asc" ? "ascending" : "descending") : c.ordenarPor ? "none" : undefined}
                  className={cn(
                    "px-3 py-2 text-xs font-semibold uppercase text-fg-muted",
                    c.alinhamento === "direita" ? "text-right" : "text-left",
                    c.ocultarEmTelaEstreita && "hidden md:table-cell",
                    primeiraColunaFixa && i === 0 && !selecionavel && "sticky left-0 z-sticky bg-surface",
                    c.larguraClassName,
                  )}
                >
                  {c.ordenarPor ? (
                    <button
                      type="button"
                      onClick={() => alternarOrdem(c.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-control transition-colors duration-fast hover:text-fg",
                        c.alinhamento === "direita" && "flex-row-reverse",
                      )}
                    >
                      {c.cabecalho}
                      <SetaDeOrdem ativa={ordenadaPor} direcao={ordem?.direcao} />
                    </button>
                  ) : (
                    c.cabecalho
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {linhasOrdenadas.map((linha) => {
            const id = chaveDaLinha(linha);
            const marcada = selecionavel && selecionadas!.includes(id);
            return (
              <tr
                key={id}
                data-selecionada={marcada || undefined}
                onClick={aoClicarLinha ? () => aoClicarLinha(linha) : undefined}
                className={cn(
                  "border-b border-subtle transition-colors duration-fast",
                  "hover:bg-hovered data-[selecionada]:bg-accent-surface",
                  aoClicarLinha && "cursor-pointer",
                )}
              >
                {selecionavel && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      rotulo={<span className="sr-only">Selecionar {rotuloDaLinha?.(linha) ?? id}</span>}
                      checked={marcada}
                      onChange={(e) =>
                        aoMudarSelecao!(
                          e.target.checked ? [...selecionadas!, id] : selecionadas!.filter((x) => x !== id),
                        )
                      }
                    />
                  </td>
                )}
                {colunas.map((c, i) => {
                  // A primeira coluna identifica a linha: vira `<th scope="row">`
                  // para que o leitor de tela repita esse valor ao entrar em
                  // cada célula seguinte.
                  const Tag = i === 0 && !selecionavel ? "th" : "td";
                  return (
                    <Tag
                      key={c.id}
                      scope={Tag === "th" ? "row" : undefined}
                      className={cn(
                        "px-3 py-3 font-regular text-fg",
                        c.alinhamento === "direita" && "text-right tabular-nums",
                        c.ocultarEmTelaEstreita && "hidden md:table-cell",
                        primeiraColunaFixa && Tag === "th" && "sticky left-0 z-sticky bg-surface text-left",
                      )}
                    >
                      {c.celula(linha)}
                    </Tag>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SetaDeOrdem({ ativa, direcao }: { ativa: boolean; direcao?: DirecaoOrdem }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0 transition-opacity duration-fast", ativa ? "opacity-100" : "opacity-30")}
      fill="none"
    >
      {ativa && direcao === "desc" ? (
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="m4 10 4-4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
