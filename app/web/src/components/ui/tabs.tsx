/**
 * tabs.tsx
 *
 * O QUE FAZ
 * Abas. Opcionalmente sincronizadas com a query string, para que a aba aberta
 * sobreviva a recarregar e a compartilhar o link.
 *
 * ==========================================================================
 * CONTRATO DE ACESSIBILIDADE (padrão APG "Tabs with Manual Activation")
 * ==========================================================================
 * ROLE / ARIA
 *   - `role="tablist"` na barra · `role="tab"` em cada aba · `role="tabpanel"`
 *     no painel.
 *   - `aria-selected` na aba ativa · `aria-controls` (aba → painel) e
 *     `aria-labelledby` (painel → aba).
 *   - `tabIndex` roving: SÓ a aba ativa é focável por Tab. É o que faz Tab
 *     pular a barra inteira e cair no conteúdo — sem isso, uma barra de 4 abas
 *     custa 4 Tabs antes de chegar ao painel.
 *
 * TECLADO
 *   ← → movem entre abas · Home/End vão aos extremos · Tab sai da barra e vai
 *   para o painel.
 *
 *   ⚠️ ATIVAÇÃO MANUAL: a seta MOVE o foco, e a aba só é ativada com
 *   Enter/Espaço. A alternativa (ativação automática ao focar) é mais fluida
 *   com poucas abas, mas aqui cada aba dispara requisições de métricas —
 *   atravessar quatro abas com a seta dispararia quatro cargas que ninguém
 *   pediu.
 *
 * FOCO
 *   Roving tabindex (e não `activedescendant`): aqui o foco real DEVE estar na
 *   aba, porque é ela que responde a Enter.
 * ==========================================================================
 *
 * QUEM USA
 * Dashboard da aplicação (CP5, quatro visões), detalhe de projeto.
 */

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "../../lib/cn";
import { TrocaDeConteudo } from "../../motion/components";

export interface Aba {
  id: string;
  rotulo: string;
  icone?: ReactNode;
  /** Número exibido ao lado (contagem de itens). */
  contagem?: number;
  conteudo: ReactNode;
}

export interface TabsProps {
  abas: Aba[];
  /** Controlado de fora. Sem isto e sem `paramUrl`, as abas controlam a si. */
  ativa?: string;
  aoMudar?: (id: string) => void;
  /**
   * Nome do parâmetro na query string. Presente = a aba vive na URL, o botão
   * "voltar" funciona e o link é compartilhável (é o princípio do CP6).
   */
  paramUrl?: string;
  className?: string;
}

export function Tabs({ abas, ativa: ativaExterna, aoMudar, paramUrl, className }: TabsProps) {
  const [params, setParams] = useSearchParams();
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Estado interno para o caso NÃO CONTROLADO e SEM `paramUrl`. Sem ele, um
  // `<Tabs abas={...} />` puro renderiza a primeira aba e nunca troca — os
  // cliques chamariam um `aoMudar` inexistente. Precedência: prop externa >
  // URL > estado interno, do mais explícito ao menos.
  const [ativaInterna, setAtivaInterna] = useState<string | null>(null);
  const doUrl = paramUrl ? params.get(paramUrl) : null;
  const ativa = ativaExterna ?? doUrl ?? ativaInterna ?? abas[0]?.id;
  const indiceAtivo = Math.max(
    0,
    abas.findIndex((a) => a.id === ativa),
  );

  const selecionar = useCallback(
    (id: string) => {
      setAtivaInterna(id);
      aoMudar?.(id);
      if (paramUrl) {
        const novos = new URLSearchParams(params);
        novos.set(paramUrl, id);
        // `replace` para não encher o histórico: trocar de aba cinco vezes não
        // deveria exigir cinco cliques no "voltar" para sair da página.
        setParams(novos, { replace: true });
      }
    },
    [aoMudar, paramUrl, params, setParams],
  );

  const aoTeclar = (e: React.KeyboardEvent) => {
    const n = abas.length;
    let alvo = -1;
    if (e.key === "ArrowRight") alvo = (indiceAtivo + 1) % n;
    else if (e.key === "ArrowLeft") alvo = (indiceAtivo - 1 + n) % n;
    else if (e.key === "Home") alvo = 0;
    else if (e.key === "End") alvo = n - 1;
    if (alvo < 0) return;
    e.preventDefault();
    // Só move o foco. A ativação fica para Enter/Espaço — ver contrato.
    refs.current[alvo]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-subtle" onKeyDown={aoTeclar}>
        {abas.map((aba, i) => {
          const selecionada = aba.id === ativa;
          return (
            <button
              key={aba.id}
              ref={(el) => (refs.current[i] = el)}
              role="tab"
              type="button"
              id={`${base}-aba-${aba.id}`}
              aria-selected={selecionada}
              aria-controls={`${base}-painel-${aba.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => selecionar(aba.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium",
                "border-b-2 transition-colors duration-fast ease-out",
                selecionada
                  ? "border-accent text-fg"
                  : "border-transparent text-fg-muted hover:border-strong hover:text-fg",
              )}
            >
              {aba.icone && <span aria-hidden="true">{aba.icone}</span>}
              {aba.rotulo}
              {aba.contagem != null && (
                <span
                  className="rounded-full bg-severity-info-surface px-2 py-px text-xs text-fg-muted"
                  data-numeric
                  aria-hidden="true"
                >
                  {aba.contagem}
                </span>
              )}
              {/* A contagem visível é `aria-hidden` e repetida aqui por
                  extenso: "12" ao lado de "Findings" é lido como um número
                  solto, sem dizer do que é. */}
              {aba.contagem != null && <span className="sr-only">, {aba.contagem} itens</span>}
            </button>
          );
        })}
      </div>

      {abas.map((aba) =>
        aba.id === ativa ? (
          <div
            key={aba.id}
            role="tabpanel"
            id={`${base}-painel-${aba.id}`}
            aria-labelledby={`${base}-aba-${aba.id}`}
            // `tabIndex={0}` para que Tab, saindo da barra, entre NO PAINEL —
            // inclusive quando o painel começa com conteúdo não focável.
            tabIndex={0}
            className="pt-6 focus-visible:outline-none"
          >
            <TrocaDeConteudo chave={aba.id}>{aba.conteudo}</TrocaDeConteudo>
          </div>
        ) : null,
      )}
    </div>
  );
}
