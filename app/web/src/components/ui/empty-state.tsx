/**
 * empty-state.tsx — EmptyState e ErrorState
 *
 * O QUE FAZ
 * As duas telas que aparecem quando NÃO há o que mostrar: nada ainda, ou deu
 * errado.
 *
 * POR QUE EXISTE COMO COMPONENTE
 * A auditoria do CP0 encontrou o vazio tratado como `<p>Nenhum item.</p>` em
 * sete telas e ausente em outras. Estado vazio é uma tela de produto, não uma
 * frase: ela precisa dizer O QUE falta, POR QUE está vazio e O QUE FAZER. E o
 * estado de erro precisa oferecer recuperação — "algo deu errado" sem botão de
 * tentar de novo é um beco sem saída.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - EmptyState: `role="status"` — informativo, não interrompe.
 *   - ErrorState: `role="alert"` — interrompe, porque a pessoa está esperando
 *     dados que não vieram.
 *   - O ícone é `aria-hidden`; a informação está no título e no texto.
 *   - A ação é um `<button>`/`<a>` de verdade, alcançável por Tab.
 *
 * QUEM USA
 * Toda lista, todo gráfico, toda tabela.
 */

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Button } from "./button";

export interface EmptyStateProps {
  titulo: string;
  /** Explica POR QUE está vazio. "Nenhum resultado" não explica nada. */
  descricao?: string;
  icone?: ReactNode;
  /** O que a pessoa pode fazer agora. */
  acao?: ReactNode;
  /** Versão compacta, para dentro de um card pequeno. */
  compacto?: boolean;
  className?: string;
}

export function EmptyState({ titulo, descricao, icone, acao, compacto, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-container border border-dashed border-subtle text-center",
        compacto ? "p-6" : "p-12",
        className,
      )}
    >
      {icone && (
        <span aria-hidden="true" className="text-fg-muted">
          {icone}
        </span>
      )}
      <p className={cn("font-medium text-fg", compacto ? "text-sm" : "text-base")}>{titulo}</p>
      {descricao && <p className="max-w-prose text-sm text-fg-muted">{descricao}</p>}
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  titulo?: string;
  /** Mensagem já traduzida para o usuário — nunca o código de erro cru. */
  descricao?: string;
  aoTentarNovamente?: () => void;
  className?: string;
}

export function ErrorState({
  titulo = "Não foi possível carregar",
  descricao = "A conexão com o servidor falhou. Tente novamente em instantes.",
  aoTentarNovamente,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-container border border-subtle bg-danger-surface p-8 text-center",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-danger" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v8h-2V7Zm0 10h2v2h-2v-2Z" />
      </svg>
      <p className="text-base font-medium text-fg">{titulo}</p>
      <p className="max-w-prose text-sm text-fg-secondary">{descricao}</p>
      {aoTentarNovamente && (
        <Button variant="secundario" size="sm" onClick={aoTentarNovamente} className="mt-2">
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
