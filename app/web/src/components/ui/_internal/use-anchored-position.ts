/**
 * use-anchored-position.ts
 *
 * O QUE FAZ
 * Posiciona um elemento flutuante (popover, dropdown, tooltip) em relação a um
 * gatilho, virando de lado quando não cabe e grudando na borda da janela quando
 * transborda.
 *
 * POR QUE À MÃO E NÃO COM FLOATING-UI
 * O `@floating-ui/react` resolve isto e muito mais — âncora virtual, seta,
 * estratégias de colisão configuráveis. Nada disso é usado no Vulnera: os
 * flutuantes são sempre ancorados a um botão real, sempre acima ou abaixo,
 * sempre alinhados a uma borda. Trocar uma dependência do Radix por outra
 * dependência de terceiro contrariaria o próprio ADR-023, que assume o custo de
 * possuir esse comportamento. São ~80 linhas.
 *
 * COMO FUNCIONA
 * 1. Mede gatilho e flutuante com `getBoundingClientRect`.
 * 2. Calcula a posição preferida.
 * 3. Se não couber no lado preferido, VIRA para o oposto (flip).
 * 4. Se ainda transbordar na horizontal, GRUDA na borda com uma margem.
 * Recalcula em `scroll` e `resize`.
 *
 * ⚠️ Coordenadas de viewport + `position: fixed`. Com `absolute` seria preciso
 * somar o scroll e descobrir o ancestral posicionado — que é exatamente o tipo
 * de bug que aparece só quando o flutuante está dentro de um container rolável.
 *
 * QUEM USA
 * `Popover`, `DropdownMenu`, `ContextMenu`, `Tooltip`, `Select`, `Combobox`.
 */

import { useCallback, useEffect, useState } from "react";

export type Lado = "top" | "bottom";
export type Alinhamento = "start" | "center" | "end";

export interface OpcoesAncoragem {
  ativo: boolean;
  refGatilho: React.RefObject<HTMLElement>;
  refFlutuante: React.RefObject<HTMLElement>;
  lado?: Lado;
  alinhamento?: Alinhamento;
  /** Distância entre gatilho e flutuante, em px. */
  espacamento?: number;
  /** Margem mínima até a borda da janela, em px. */
  margem?: number;
  /** Igualar a largura do flutuante à do gatilho (Select faz isso). */
  igualarLargura?: boolean;
}

export interface PosicaoAncorada {
  top: number;
  left: number;
  /** O lado REALMENTE usado depois do flip — vira `data-side` no elemento. */
  ladoFinal: Lado;
  largura?: number;
  /** Altura máxima disponível até a borda; evita flutuante maior que a tela. */
  maxHeight: number;
}

export function useAnchoredPosition({
  ativo,
  refGatilho,
  refFlutuante,
  lado = "bottom",
  alinhamento = "start",
  espacamento = 6,
  margem = 8,
  igualarLargura = false,
}: OpcoesAncoragem): PosicaoAncorada | null {
  const [posicao, setPosicao] = useState<PosicaoAncorada | null>(null);

  const recalcular = useCallback(() => {
    const gatilho = refGatilho.current;
    const flutuante = refFlutuante.current;
    if (!gatilho || !flutuante) return;

    const g = gatilho.getBoundingClientRect();
    const f = flutuante.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    const espacoAbaixo = vh - g.bottom - espacamento - margem;
    const espacoAcima = g.top - espacamento - margem;

    // Flip: só vira se não couber no lado preferido E couber melhor no oposto.
    // "Couber melhor", e não "couber": num campo no meio de uma tela baixa,
    // nenhum lado cabe — aí fica no que tem mais espaço, com maxHeight.
    let ladoFinal = lado;
    if (lado === "bottom" && f.height > espacoAbaixo && espacoAcima > espacoAbaixo) ladoFinal = "top";
    if (lado === "top" && f.height > espacoAcima && espacoAbaixo > espacoAcima) ladoFinal = "bottom";

    const maxHeight = Math.max(120, ladoFinal === "bottom" ? espacoAbaixo : espacoAcima);
    const top = ladoFinal === "bottom" ? g.bottom + espacamento : g.top - espacamento - Math.min(f.height, maxHeight);

    const largura = igualarLargura ? g.width : undefined;
    const larguraFlutuante = largura ?? f.width;

    let left: number;
    if (alinhamento === "start") left = g.left;
    else if (alinhamento === "end") left = g.right - larguraFlutuante;
    else left = g.left + g.width / 2 - larguraFlutuante / 2;

    // Gruda na borda. `Math.max` depois de `Math.min` porque, num flutuante
    // mais largo que a janela, o min empurraria para a esquerda do zero.
    left = Math.max(margem, Math.min(left, vw - larguraFlutuante - margem));

    setPosicao({ top, left, ladoFinal, largura, maxHeight });
  }, [alinhamento, espacamento, igualarLargura, lado, margem, refFlutuante, refGatilho]);

  useEffect(() => {
    if (!ativo) {
      setPosicao(null);
      return;
    }
    recalcular();

    // `capture: true` no scroll pega a rolagem de QUALQUER container ancestral,
    // não só a da janela — o caso de um dropdown dentro de uma tabela rolável.
    window.addEventListener("scroll", recalcular, true);
    window.addEventListener("resize", recalcular);

    // O conteúdo do flutuante pode mudar de tamanho depois de aberto (busca do
    // Combobox filtrando a lista). Sem observar, ele fica ancorado pela altura
    // antiga e transborda.
    const observer = new ResizeObserver(recalcular);
    if (refFlutuante.current) observer.observe(refFlutuante.current);

    return () => {
      window.removeEventListener("scroll", recalcular, true);
      window.removeEventListener("resize", recalcular);
      observer.disconnect();
    };
  }, [ativo, recalcular, refFlutuante]);

  return posicao;
}
