/**
 * route-boundary.tsx
 *
 * O QUE FAZ
 * Envolve rotas lazy com `Suspense` (skeleton enquanto o código da página
 * baixa) e com um limite de erro que trata SÓ a falha de download do chunk.
 *
 * POR QUE EXISTE
 * Com o code-splitting por rota, cada página vira um arquivo à parte. Dois
 * cuidados vêm junto:
 *   - o `Suspense` das rotas autenticadas fica DENTRO do `AppLayout`, para que
 *     sidebar, cabeçalho e atmosfera não desmontem ao navegar. Só a área de
 *     conteúdo mostra o skeleton (`variante="conteudo"`);
 *   - um chunk pode não baixar (rede, deploy novo). Antes do split esse modo de
 *     falha não existia; aqui ele ganha um `ErrorState` com "Tentar novamente",
 *     que recarrega a página — o `React.lazy` guarda a promessa rejeitada, então
 *     só uma nova carga busca o arquivo de novo. Qualquer outro erro é relançado
 *     e sobe como antes.
 *
 * QUEM USA
 * `App.tsx` (rotas fora do layout, `variante="tela"`) e `app-layout.tsx`
 * (outlet autenticado, `variante="conteudo"`).
 */

import { Component, Suspense, type ReactNode } from "react";
import { Card, ErrorState, RegiaoCarregando, Skeleton } from "../ui";
import { FalhaAoCarregarPagina } from "../../lib/lazy-page";

type Variante = "conteudo" | "tela";

class LimiteDeFalhaDeCarga extends Component<{ variante: Variante; children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };

  static getDerivedStateFromError(erro: unknown) {
    if (erro instanceof FalhaAoCarregarPagina) return { falhou: true };
    // Erro de render da própria página: não é deste limite.
    throw erro;
  }

  render() {
    if (!this.state.falhou) return this.props.children;
    return (
      <div className={this.props.variante === "tela" ? "flex min-h-dvh items-center justify-center bg-canvas p-6" : undefined}>
        <ErrorState
          titulo="Não foi possível abrir esta tela"
          descricao="O código da página não foi baixado. Verifique a conexão e tente novamente."
          aoTentarNovamente={() => window.location.reload()}
        />
      </div>
    );
  }
}

/** Silhueta genérica de página: cabeçalho e um card com linhas de tabela. */
function ConteudoCarregando() {
  return (
    <RegiaoCarregando rotulo="Carregando página" className="flex flex-col gap-6">
      <Card>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-1/3" />
        <Skeleton className="mt-3 h-4 w-1/2" />
      </Card>
      <Card semPadding className="overflow-hidden">
        {[0, 1, 2].map((linha) => (
          <div key={linha} className="grid grid-cols-3 gap-4 border-b border-subtle px-4 py-5 last:border-0">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}
      </Card>
    </RegiaoCarregando>
  );
}

function TelaCarregando() {
  return (
    <RegiaoCarregando rotulo="Carregando página" className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </RegiaoCarregando>
  );
}

export function LimiteDeRota({ variante, children }: { variante: Variante; children: ReactNode }) {
  return (
    <LimiteDeFalhaDeCarga variante={variante}>
      <Suspense fallback={variante === "tela" ? <TelaCarregando /> : <ConteudoCarregando />}>{children}</Suspense>
    </LimiteDeFalhaDeCarga>
  );
}
