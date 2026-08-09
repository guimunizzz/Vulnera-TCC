/**
 * card.tsx — Card, Separator e Skeleton
 *
 * O QUE FAZ
 * As três peças de superfície mais usadas: o contêiner, a linha que separa e o
 * espaço reservado enquanto carrega.
 *
 * POR QUE JUNTAS
 * Skeleton só existe para preencher um Card, e Separator só existe dentro de
 * um. São três componentes de 15 linhas com a mesma razão de existir.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE
 * ==========================================================================
 * Card — `<section>` quando recebe `titulo` (vira uma landmark com
 *   `aria-labelledby`, navegável pelo rotor); `<div>` quando não recebe. Uma
 *   section SEM nome acessível não é landmark e só polui a árvore.
 *
 * Separator — `role="separator"` com `aria-orientation`. Puramente decorativo
 *   (`decorativo`) vira `aria-hidden`: uma linha que só agrupa visualmente não
 *   deve interromper a leitura.
 *
 * Skeleton — `aria-hidden` SEMPRE, e a região que ele preenche leva
 *   `aria-busy="true"` + um texto `.sr-only` ("Carregando findings"). Anunciar
 *   as formas do esqueleto é ruído; anunciar "carregando" é informação.
 * ==========================================================================
 *
 * QUEM USA
 * Todas as telas.
 */

import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

/* ==========================================================================
   Card
   ========================================================================== */

export interface CardProps {
  children: ReactNode;
  /** Presente = vira `<section>` nomeada. */
  titulo?: ReactNode;
  /** Ações no canto do cabeçalho. */
  acoes?: ReactNode;
  descricao?: ReactNode;
  className?: string;
  /** Sem padding interno — para card que contém tabela de borda a borda. */
  semPadding?: boolean;
}

export function Card({ children, titulo, acoes, descricao, className, semPadding }: CardProps) {
  const id = useId();
  const Tag = titulo ? "section" : "div";

  return (
    <Tag
      aria-labelledby={titulo ? id : undefined}
      className={cn("rounded-container border border-subtle bg-surface shadow-raised", className)}
    >
      {titulo && (
        <header className={cn("flex items-start justify-between gap-4", semPadding ? "p-4 pb-0" : "p-4 pb-0")}>
          <div className="flex flex-col gap-1">
            <h2 id={id} className="text-sm font-semibold text-fg">
              {titulo}
            </h2>
            {descricao && <p className="text-xs text-fg-muted">{descricao}</p>}
          </div>
          {acoes && <div className="shrink-0">{acoes}</div>}
        </header>
      )}
      <div className={cn(semPadding ? "" : "p-4", titulo && !semPadding && "pt-3")}>{children}</div>
    </Tag>
  );
}

/* --------------------------------------------------------------------------
   Composição explícita
   --------------------------------------------------------------------------
   O `Card` aceita DUAS formas, e as duas são legítimas:

     <Card titulo="Findings" descricao="…">      ← concisa, para o caso comum
     <Card><CardHeader><CardTitle>…             ← explícita, quando o cabeçalho
                                                   tem layout próprio

   A forma explícita existe porque cabeçalho de card real raramente é só texto:
   tem badge de contagem, seletor de período, botão de exportar. Espremer isso
   numa prop `titulo: ReactNode` funciona, mas fica ilegível.

   ⚠️ Na forma explícita o `aria-labelledby` NÃO é gerado — o `<Card>` não tem
   como saber o id do título que você mesmo montou. Se o card precisa ser uma
   landmark nomeada, use a forma concisa.
   -------------------------------------------------------------------------- */

export function CardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <header className={cn("mb-4 flex items-start justify-between gap-4", className)}>{children}</header>;
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-sm font-semibold text-fg", className)}>{children}</h2>;
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-1 text-xs text-fg-muted", className)}>{children}</p>;
}

export function CardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <footer className={cn("mt-4 flex items-center gap-2 border-t border-subtle pt-4", className)}>{children}</footer>;
}

/**
 * Rótulo avulso.
 *
 * Prefira `Field` — ele gera os ids, amarra a dica e o erro e cuida do
 * `aria-invalid`. Este `Label` existe para o formulário que já controla os
 * próprios ids (`htmlFor` + `id` escritos à mão), o que é igualmente correto do
 * ponto de vista de acessibilidade, só mais manual.
 *
 * Substitui o `@radix-ui/react-label` (ADR-023). O que se perde é a supressão da
 * seleção de texto no duplo clique — comportamento cosmético que não vale uma
 * dependência.
 */
export function Label({
  children,
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label className={cn("text-sm font-medium text-fg", className)} {...props}>
      {children}
    </label>
  );
}

/* ==========================================================================
   Separator
   ========================================================================== */

export function Separator({
  orientacao = "horizontal",
  decorativo = true,
  className,
}: {
  orientacao?: "horizontal" | "vertical";
  decorativo?: boolean;
  className?: string;
}) {
  return (
    <div
      role={decorativo ? undefined : "separator"}
      aria-hidden={decorativo || undefined}
      aria-orientation={decorativo ? undefined : orientacao}
      className={cn("bg-surface", orientacao === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      style={{ backgroundColor: "oklch(var(--color-border-subtle))" }}
    />
  );
}

/* ==========================================================================
   Skeleton
   ========================================================================== */

/**
 * Espaço reservado com a FORMA do conteúdo final.
 *
 * ⚠️ A regra que faz diferença: o esqueleto tem que ter a MESMA altura do que
 * vai substituí-lo. Um esqueleto de 20px trocado por um card de 120px produz um
 * salto de layout — que é exatamente o que ele deveria evitar.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-control",
        // Cor por token, não por classe: `--color-skeleton-base` já embute a
        // opacidade e muda com o tema.
        className,
      )}
      style={{ backgroundColor: "var(--color-skeleton-base)" }}
    />
  );
}

/**
 * Envelope de uma região em carregamento.
 *
 * Junta as duas metades que costumam ficar separadas: `aria-busy` na região e o
 * texto que o leitor de tela anuncia. Sem o texto, `aria-busy` sozinho não é
 * anunciado por vários leitores.
 */
export function RegiaoCarregando({
  children,
  rotulo,
  className,
}: {
  children: ReactNode;
  /** "Carregando findings", "Carregando métricas da aplicação". */
  rotulo: string;
  className?: string;
}) {
  return (
    <div aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  );
}
