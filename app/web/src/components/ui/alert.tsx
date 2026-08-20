/**
 * alert.tsx
 *
 * O QUE FAZ
 * Mensagem persistente dentro da página: erro de formulário, aviso de limite de
 * plano, confirmação que precisa continuar visível.
 *
 * ALERT × TOAST — a diferença é o tempo de vida
 * Alert FICA na página, ancorado ao contexto que o gerou. Toast SOME. Se a
 * pessoa precisa reler, agir, ou copiar a mensagem, é Alert. Ver toast.tsx.
 *
 * CONTRATO DE ACESSIBILIDADE
 *   - `role="alert"` (implícito `aria-live="assertive"`) quando `tom="perigo"`;
 *     `role="status"` (`polite`) nos demais. Erro interrompe; informação espera.
 *   - Ícone `aria-hidden`; a informação está no texto.
 *   - Cor nunca sozinha: cada tom tem ícone próprio (WCAG 1.4.1).
 *   - `aoFechar` gera um botão de verdade, com `aria-label`.
 *
 * QUEM USA
 * Login (credenciais inválidas), criação de aplicação (limite do plano),
 * onboarding, editor de finding.
 */

import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TomAlert = "info" | "sucesso" | "atencao" | "perigo";

const ESTILO: Record<TomAlert, { caixa: string; icone: ReactNode }> = {
  info: {
    caixa: "bg-accent-surface text-accent-ink",
    icone: <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm-.75 3h1.5v1.5h-1.5V4.5Zm0 3h1.5v4h-1.5v-4Z" />,
  },
  sucesso: {
    caixa: "bg-success-surface text-success-ink",
    icone: <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm3.2 4.8-4 4.5-2.4-2.2.9-1 1.5 1.4 3.1-3.5.9.8Z" />,
  },
  atencao: {
    caixa: "bg-warning-surface text-warning-ink",
    icone: <path d="M8 1.2 15 14H1L8 1.2Zm-.75 4.3v4h1.5v-4h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z" />,
  },
  perigo: {
    caixa: "bg-danger-surface text-danger-ink",
    icone: <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 4.5h1.5v5h-1.5v-5Zm0 6.25h1.5v1.5h-1.5v-1.5Z" />,
  },
};

export interface AlertProps {
  children: ReactNode;
  tom?: TomAlert;
  titulo?: string;
  aoFechar?: () => void;
  className?: string;
}

export function Alert({ children, tom = "info", titulo, aoFechar, className }: AlertProps) {
  const { caixa, icone } = ESTILO[tom];

  return (
    <div
      role={tom === "perigo" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-container p-4 text-sm", caixa, className)}
    >
      <svg viewBox="0 0 16 16" className="mt-px h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
        {icone}
      </svg>
      <div className="flex flex-1 flex-col gap-1">
        {titulo && <p className="font-medium">{titulo}</p>}
        <div className="text-fg-secondary">{children}</div>
      </div>
      {aoFechar && (
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={aoFechar}
          className="alvo-estendido shrink-0 rounded-control p-1 transition-colors duration-fast hover:bg-hovered"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
