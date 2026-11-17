/**
 * components/ui/table-estilos.ts
 *
 * O QUE FAZ
 * As classes de uma tabela de dados da plataforma, num lugar só: cabeçalho,
 * célula e linha.
 *
 * POR QUE EXISTE
 * Cada página escrevia a própria `<table>` e havia quatro cabeçalhos
 * diferentes (caixa alta em `bg-inset`, texto normal em `bg-surface`, com e
 * sem `tracking`) e células em `py-2`, `py-3` e `py-4`. O padrão é o das telas
 * de Aplicações e Projetos aprovadas no redesenho (refactor web-motion-3d,
 * Fase 5). Tanto o componente `Table` quanto as tabelas escritas à mão usam
 * estas constantes.
 *
 * QUEM USA
 * `table.tsx` e as páginas com `<table>` própria.
 */

export const TABELA = {
  /** `<thead>`: faixa `bg-inset`, rótulos curtos em caixa alta. */
  cabecalho: "border-b border-subtle bg-inset text-xs uppercase tracking-[0.1em] text-fg-muted",
  /** `<th scope="col">`. */
  th: "px-4 py-3 font-medium",
  /** `<tr>` do corpo: divisória sutil e realce no hover. */
  linha: "border-t border-subtle transition-colors duration-fast hover:bg-hovered",
  /** `<td>`: o mesmo respiro do cabeçalho. */
  celula: "px-4 py-3",
} as const;
