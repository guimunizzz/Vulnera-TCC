/**
 * lib/lazy-page.ts
 *
 * O QUE FAZ
 * Cria o componente `React.lazy` de uma página a partir do seu export nomeado
 * e marca a falha de download com um erro próprio.
 *
 * POR QUE EXISTE
 * As páginas exportam por nome (`export function DashboardPage`), mas
 * `React.lazy` exige um `default`. Sem este helper, cada rota de `App.tsx`
 * repetiria o mesmo `.then((m) => ({ default: m.X }))`.
 *
 * A marca `FalhaAoCarregarPagina` permite que `LimiteDeRota` trate SÓ o modo de
 * falha que o code-splitting introduziu (chunk que não baixa: rede caiu, deploy
 * novo trocou o nome do arquivo). Erro de render de uma página continua
 * subindo como antes do split — o limite não passa a engolir bugs.
 *
 * QUEM USA
 * `App.tsx` (todas as páginas lazy) e `components/layout/route-boundary.tsx`.
 */

import { lazy, type ComponentType } from "react";

export class FalhaAoCarregarPagina extends Error {
  // Campo próprio porque o `lib` do projeto é ES2020, sem `Error.cause`.
  readonly causa: unknown;

  constructor(causa: unknown) {
    super("Falha ao baixar o código da página");
    this.name = "FalhaAoCarregarPagina";
    this.causa = causa;
  }
}

export function paginaLazy<Nome extends string>(
  carregar: () => Promise<Record<Nome, ComponentType>>,
  nome: Nome,
) {
  return lazy(() =>
    carregar().then(
      (modulo) => ({ default: modulo[nome] }),
      (erro: unknown) => {
        throw new FalhaAoCarregarPagina(erro);
      },
    ),
  );
}
